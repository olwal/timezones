/* Time zones, and the labels made from them.

   Split out of index.html so meet.html can share it. Loaded as an ES module,
   which is why the board no longer opens over file://: see README.
   ======================================================================= */

/* =======================================================================
   Time-zone helpers
   ======================================================================= */
const partFmts = new Map();
function partsFor(tz, date) {
  let f = partFmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    partFmts.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = +p.value;
  // Wall-clock time in the zone, plus the zone's offset from UTC in minutes.
  const asUTC = Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second);
  const offset = Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  return {
    y: o.year, mo: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second,
    offset, minutes: o.hour * 60 + o.minute + o.second / 60,
    midnightUTC: Date.UTC(o.year, o.month - 1, o.day) - offset * 60000
  };
}

function offsetLabel(min) {
  const sign = min < 0 ? "−" : "+";
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  return "GMT" + (a === 0 ? "" : sign + h + (m ? ":" + String(m).padStart(2, "0") : ""));
}

// English, like every other label here, rather than the browser's locale: a card
// reading "mercredi" beside "TILL MORNING 08:00" would be worse than either.
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                   "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = n => String(n).padStart(2, "0");

/* The date beside the time. A weekday alone answers "which day is that there",
   which is most of it, but not "which date", and once a board spans a date line
   both questions come up. Three formats: the day on its own, the day with the
   date, and ISO for when it has to be unambiguous. */
function dateLabel(p, cardDay, fmt) {
  const day = DAY_NAMES[new Date(cardDay).getUTCDay()];
  if (fmt === "day") return day;
  if (fmt === "iso") return p.y + "-" + pad2(p.mo) + "-" + pad2(p.d);
  return day.slice(0, 3) + " " + p.d + " " + MONTHS[p.mo - 1];
}

function clockText(h, mi, hour12) {
  if (!hour12) return { t: String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0"), suffix: "" };
  const ap = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return { t: hh + ":" + String(mi).padStart(2, "0"), suffix: ap };
}

// A minutes-past-midnight value as a wall-clock label: "18:00" or "6 pm".
function stamp(min, hour12) {
  const v = ((min % 1440) + 1440) % 1440;
  const t = clockText(Math.floor(v / 60), Math.floor(v % 60), hour12);
  if (!hour12) return t.t;
  return (v % 60 === 0 ? t.t.slice(0, -3) : t.t) + " " + t.suffix;
}

function fmtDur(min) {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return m + "m";
  return h + "h " + String(m).padStart(2, "0") + "m";
}

// The instant at which a given zone's wall clock reads y-mo-d h:mi. Solved by
// correction rather than by assuming an offset, since the offset in force is
// itself a function of the answer. Two passes settle it, including across a
// daylight-saving change.
function zonedTimeToEpoch(tz, y, mo, d, h, mi) {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = partsFor(tz, new Date(guess));
    guess += target - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  }
  return guess;
}

export { partsFor, offsetLabel, dateLabel, clockText, stamp, fmtDur,
         zonedTimeToEpoch, DAY_NAMES, MONTHS, pad2 };
