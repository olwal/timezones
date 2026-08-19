/* Where the sun and the moon are, for a place and an instant.

   Split out of index.html so meet.html can share it. Loaded as an ES module,
   which is why the board no longer opens over file://: see README.
   ======================================================================= */

/* =======================================================================
   Sunrise / sunset — NOAA "sunrise equation"
   ======================================================================= */
const RAD = Math.PI / 180;
const toJulian = ms => ms / 86400000 + 2440587.5;
const fromJulian = j => (j - 2440587.5) * 86400000;

function sunTimes(lat, lon, localNoonUTCms) {
  const lw = -lon;
  const n = Math.round(toJulian(localNoonUTCms) - 2451545 - 0.0009 - lw / 360);
  const Js = 2451545 + 0.0009 + lw / 360 + n;                      // mean solar noon
  const M = (357.5291 + 0.98560028 * (Js - 2451545)) % 360;        // solar mean anomaly
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + C + 180 + 102.9372) % 360;                        // ecliptic longitude
  const Jtransit = Js + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const sinDec = Math.sin(L * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  // transit and declination are kept for the altitude calculation below.
  const out = { transit: fromJulian(Jtransit), sinDec, cosDec };
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  if (cosW > 1) { out.polar = "night"; return out; }                // sun never rises
  if (cosW < -1) { out.polar = "day"; return out; }                 // sun never sets
  const w = Math.acos(cosW) / RAD;
  out.sunrise = fromJulian(Jtransit - w / 360);
  out.sunset = fromJulian(Jtransit + w / 360);
  return out;
}

// Height of the sun above the horizon, in degrees. Works everywhere, including
// latitudes where the sun never rises or sets.
function altitudeAt(lat, sun, nowMs) {
  const H = 360 * (nowMs - sun.transit) / 86400000;   // hour angle from solar noon
  const s = Math.sin(lat * RAD) * sun.sinDec +
            Math.cos(lat * RAD) * sun.cosDec * Math.cos(H * RAD);
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD;
}

const sunCache = new Map();

// dayOffset of -1 / +1 gives the neighbouring local day, which is what the
// night span needs: yesterday's sunset, or tomorrow's sunrise.
function sunForOffset(city, parts, dayOffset) {
  const noon = parts.midnightUTC + dayOffset * 86400000 + 12 * 3600000;
  const key = city.id + "|" + noon;
  let v = sunCache.get(key);
  if (!v) {
    v = sunTimes(city.lat, city.lon, noon);
    if (sunCache.size > 400) sunCache.clear();
    sunCache.set(key, v);
  }
  return v;
}
const sunFor = (city, parts) => sunForOffset(city, parts, 0);

/* =======================================================================
   Where the sun and the moon actually are

   The dome needs more than sunrise and sunset: both bodies are on it all the
   time now, one above the horizon and one below, so each has to be placed from
   its own position in the sky rather than from a span of clock time. That means
   right ascension, declination and an hour angle for each.

   Low-precision series, the usual ones: the sun is good to about a minute of
   arc and the moon to about 0.3 degrees, which at this size is a fraction of a
   pixel. Both depend only on the instant, so they are computed once per frame
   and shared by every card; only the hour angle is per city.
   ======================================================================= */
const J2000 = 946728000000;                      // 2000-01-01T12:00Z, in ms
const daysSince2000 = ms => (ms - J2000) / 86400000;
const OBLIQ = 23.4397 * RAD;                     // tilt of the earth's axis

// Ecliptic (longitude, latitude) to equatorial (right ascension, declination).
function eclToEq(lon, lat) {
  return {
    ra: Math.atan2(Math.sin(lon) * Math.cos(OBLIQ) - Math.tan(lat) * Math.sin(OBLIQ),
                   Math.cos(lon)),
    dec: Math.asin(Math.sin(lat) * Math.cos(OBLIQ) +
                   Math.cos(lat) * Math.sin(OBLIQ) * Math.sin(lon))
  };
}

function sunEq(d) {
  const M = (357.5291 + 0.98560028 * d) * RAD;                     // mean anomaly
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) +
             0.0003 * Math.sin(3 * M)) * RAD;                      // equation of centre
  const L = M + C + (102.9372 + 180) * RAD;                        // ecliptic longitude
  return eclToEq(L, 0);
}

function moonEq(d) {
  const L = (218.316 + 13.176396 * d) * RAD;   // mean longitude
  const M = (134.963 + 13.064993 * d) * RAD;   // mean anomaly
  const F = (93.272 + 13.229350 * d) * RAD;    // argument of latitude
  const eq = eclToEq(L + 6.289 * RAD * Math.sin(M), 5.128 * RAD * Math.sin(F));
  eq.dist = 385001 - 20905 * Math.cos(M);      // km, for the phase geometry
  return eq;
}

// Greenwich sidereal time, less the observer's west longitude: the angle the
// sky has turned through where they are standing.
const siderealTime = (d, lonDeg) => (280.16 + 360.9856235 * d) * RAD + lonDeg * RAD;

/* How much of the moon's disc is lit, and which limb it is lit from. Global,
   not per city: everyone sees the same phase at the same instant. Only the
   orientation is local, and only by hemisphere. */
let moonPhaseAt = -1, moonPhaseVal = null;
function moonPhase(nowMs) {
  const minute = Math.floor(nowMs / 60000);
  if (minute === moonPhaseAt) return moonPhaseVal;
  moonPhaseAt = minute;
  const d = daysSince2000(nowMs);
  const s = sunEq(d), m = moonEq(d), sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) +
              Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  // Sign of the limb angle says which side of new moon we are on.
  const limb = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) -
    Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  moonPhaseVal = { fraction: (1 + Math.cos(inc)) / 2, waxing: limb < 0 };
  return moonPhaseVal;
}

const PHASE_NAMES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
  "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
function phaseName(ph) {
  const f = ph.fraction;
  if (f < 0.04) return PHASE_NAMES[0];
  if (f > 0.96) return PHASE_NAMES[4];
  const near = Math.abs(f - 0.5) < 0.03;
  return ph.waxing
    ? (near ? PHASE_NAMES[2] : f < 0.5 ? PHASE_NAMES[1] : PHASE_NAMES[3])
    : (near ? PHASE_NAMES[6] : f > 0.5 ? PHASE_NAMES[5] : PHASE_NAMES[7]);
}

export { RAD, sunTimes, sunFor, sunForOffset, altitudeAt, daysSince2000,
         sunEq, moonEq, siderealTime, moonPhase, phaseName };
