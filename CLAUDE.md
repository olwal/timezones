# Working on timezones.cc

A board of analog clocks for cities around the world. `index.html` plus three ES
modules under `js/`, no build step, no dependencies. Live at
[timezones.cc](https://timezones.cc/) and at `olwal.github.io/timezones`.

## Getting oriented

`index.html` holds the styles in one `<style>`, then one `<script type="module">` with
the rendering and the settings. Under `js/`: `cities.js` is the city table and its
lookups, `tz.js` the zone helpers and the labels made from them, `sky.js` the sun and
moon maths. None of the three touches `state` or the DOM, which is what makes them
reusable from a future `meet.html`. `sw.js` caches the shell, those three included, and
`manifest.webmanifest` makes it installable.

**The page will not open over `file://` any more.** Module imports are blocked there, so
the board comes up empty with nothing but a console error. Serve it instead:

    python -m http.server 8000        # then http://localhost:8000/

Read the README before changing behaviour. It documents not only what each thing does but
why the alternatives were rejected, and several of those rejections were expensive to
learn. Keep it current in the same commit as the change.

## Deploying

Push to `main` and Cloudflare Workers Builds deploys in 20 to 60 seconds. It is an
assets-only Worker: `wrangler.jsonc` has no `main`, so there is no server code. Confirm a
deploy landed by comparing bytes, which should equal `wc -c index.html`:

    curl -so /dev/null -w '%{size_download}\n' https://timezones.cc/

Anything added at the repo root ships to the public site unless `.assetsignore` excludes
it. `npx wrangler deploy --dry-run` must ship exactly **10 assets**: `index.html`, the
three files in `js/`, `favicon.svg`, `manifest.webmanifest`, `sw.js` and three icons.
Wrangler 4 no longer prints that count, only `Read N files from the assets directory`,
which counts everything it walked before `.assetsignore` applied. Run it under
`WRANGLER_LOG=debug` and read the `Ignoring asset:` lines instead: whatever is not
listed there ships. If anything beyond those ten survives, something is leaking. An
earlier manual upload published the entire `.git` directory this way, and it was live
for two days.

## How to verify a change

There is no test suite. Use headless Edge, and assert on painted output rather than
looking at a screenshot and believing it.

    python -m http.server 8000 &
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new \
      --disable-gpu --no-sandbox --virtual-time-budget=9000 --dump-dom \
      "http://localhost:8000/index.html?cities=london,tokyo" \
      > "$LOCALAPPDATA/Temp/d.html"

The productive pattern is a **probe**: stage a copy of the tree outside the repo, inject a
`<script>` before `</body>` that drives the app and writes its findings into a
`<pre id="probe">`, serve that directory, then dump the DOM and read the element. Register
`window.onerror` in the probe and bail if it fires, so an exception surfaces as a result
instead of as silence.

A probe is a classic script, so module scope is invisible to it. `index.html` ends by
publishing `window.__wc` with `state`, `cards`, `CITIES`, `BY_ID`, `setMenu`,
`openPicker`, `startEdit`, `freezeAt`, `goLive`, `buildCards`, `repaintAll` and `update`.
That handle is there for probes and nothing in the app reads it. Drive the board through
it, and add to it rather than reaching for a global that is no longer there.

Traps, all of which have already cost time here:

- `node --check` catches syntax only. A `ReferenceError` from a renamed variable passes it
  and kills the render loop. Run an error probe after every script edit.
- **An empty painted field means the paint loop is dead.** `meta`, `rel` and the sunrise
  labels are written only by `paintSlow`. If they come back empty, `update()` threw on its
  first frame. Do not write this off as a headless quirk. It was a real bug once, shipped,
  and the symptom had been visible twice before it was believed.
- Calling `paintSlow` directly from a probe **bypasses** `update()`, so labels can look
  perfect while the app is dead. Check both.
- `requestAnimationFrame` chains are unreliable under `--virtual-time-budget`. Use
  `setTimeout` when a probe has to wait for a repaint.
- CSS transitions do not advance under virtual time, so a screenshot taken after a colour
  change shows the old colour. Inject `.card { transition: none !important }`.
- Screenshots need PowerShell. Edge cannot write the png from the Bash tool's sandbox.
- Python here reads `/tmp` as `C:\tmp`. Use `os.environ["TEMP"]` or repo-relative paths.
- **A DOM dump outruns the network.** Under `--virtual-time-budget` the virtual clock
  races ahead of real fetches, so a dumped page shows no forecast at all and every ring
  comes back bare. That is the harness, not the app: `--screenshot` waits, so check
  weather in a screenshot. To make weather deterministic, keep `worldclock.wx.*` in
  localStorage and run the same page twice against one `--user-data-dir`, so the second
  run paints from the warm cache.
- Forecast rows exist from today onwards only. Freezing the board into the past correctly
  shows no conditions and no temperature. That is not a bug.

## Decisions that look arbitrary and are not

- **Times are absolute instants.** `state.frozen` is epoch ms, and the dome, the darkness
  and the countdowns all derive from it. `zonedTimeToEpoch` converts wall clock to instant
  by correction, because the offset in force depends on the answer.
- **A fading surface's ink does not fade with it.** It steps at the halfway colour, where
  black reads about 4.6:1 and white about 4.5:1. Interpolating both gives grey on grey at
  the midpoint, which is the exact failure the fade exists to avoid. The card cross-fades
  its background over 0.35s and its `color` not at all, deliberately.
- **The sun's glyph is the current conditions.** A clear sky's icon is a rayed sun, so the
  two coincide when it is clear. The day form is used at every hour on purpose: the night
  form of "clear" is a moon, which would put a second moon on the dome.
- **The moon has a legibility floor.** An honest 7% crescent is 0.8px wide at this size.
  `TERM_MAX` caps the terminator so thin phases still read, and only the last 2% at either
  end is exact. An earlier version outlined the whole disc so a new moon had a shape, and
  every phase then read as full.
- **The forecast ring shows 11 hours, not 12.** The twelfth lands on the same angle as the
  current hour, closing the ring into a seamless circle with no reading direction. The
  gap that leaves now carries the metric's caption (`°C`, `Feels`, `Rain`, `km/h`,
  `AQI`), smaller and fainter than the readings. It used to mean "now" on its own, which
  stopped being worth a slot once there were five metrics and no way to tell which one
  the numbers were.
- **A plain press on a dial must not call `preventDefault`.** Cancelling `pointerdown`
  suppresses the compatibility mouse events, and click-to-jump depends on the click that
  follows. The native card drag is stopped by clearing `draggable`, selection by
  `user-select`.
- **Wind drops its unit on the ring.** `22km/h` at the three o'clock position overhangs the
  viewBox and clips. The dome readout has room and keeps it.
- **The page theme follows the viewer's own evening**, not a vote of the cards on screen.
  The vote drifted for no visible reason whenever a city was added.
- **The dome is a circle seen edge on.** Below the horizon the direction of travel
  reverses, which is what makes sun and moon read as one circling movement rather than two
  animations. `domeSpot` places both from hour angle and declination, so the arc's ends
  agree with the printed sunrise and sunset.

## The state, and where it lives

`state` holds it and each field persists to `localStorage` under `worldclock.<name>`.
Groups: `preset`, `density`, `hour12`, `date`, `nums`, `ticks`, `shade`, `solar`, `hours`
(four pickers stored as one key), `weather`, `metric`, `ring`, `units`, `air`, `theme`.
`CONFIG` holds the defaults for the four hour boundaries plus the constants that stay
constant.

Adding a setting means: a key in `LS`, a field in `state` with a validity check, a
`.row` in the right `.grp` of the popover, a case in `settingValue`, a branch in
`applySetting`, and a `tip()` line in `syncTools`. Anything that changes the dial's
geometry needs `buildCards()`. Anything that only changes ink needs `c._k = undefined`
then `repaintAll()`.

The menu is rows, not sections: label left, control right, explanation on the row's
`title`. Two named modes get a `.seg`; a genuine on/off gets a `.tgl` switch. Keep it
short. It reached fifteen sections at 1341px tall, against 655px of menu on a 1440x900
screen, and the setting added last was on screen and unreachable. Measure the height
after adding one.

The forecast cache is versioned. A row is
`[ts, code, temp, feels, rainChance, wind, humidity]` and `WX_CACHE_V` is 2. Widening a
row means bumping it, or old caches get read past their end.

Air quality is a second cache, not a wider forecast row, under `worldclock.aq.<id>` with
its own `AQ_CACHE_V`. It is deliberate: widening the forecast row would throw away every
stored forecast for a field that is off by default. Its rows are
`[ts, europeanAqi, pm2.5, pm10, ozone, no2]`, matched to a forecast hour by timestamp,
which works because both come from Open-Meteo as whole UTC hours. `state.air` gates the
request, and `metric = "air"` cannot outlive it: turning the setting off puts the ring
back on `temp`, since the column would otherwise stop being fetched.

## Conventions

- **No em-dashes in prose.** Use colons, commas or parentheses. Code comments are exempt
  and use them freely. Check with `grep -c "—" README.md` before committing.
- Commit messages are a short imperative subject, then prose explaining why, including
  what was tried and rejected. See `git log` for the register.
- Comments explain why a thing is the way it is, not what the line does.
- Ask before pushing. A push deploys the live site.

## Open threads

1. **Group scheduling**. Phase 1 is done: `js/cities.js`, `js/tz.js` and `js/sky.js` are
   extracted as ES modules and the board was verified byte-identical across the move,
   by pinning `Date.now`, turning the forecast off and diffing `#grid` innerHTML before
   against after. The cost, accepted deliberately, is that `file://` no longer works.
   The feature itself is unstarted. Doodle-style and account-free: propose slots,
   everyone ticks, and every row is rendered in the reader's own zone with the card
   shading, so an unkind hour looks unkind. Agreed shape: a Durable Object per poll
   (SQLite-backed, available on the free plan, strongly consistent, and the
   `new_sqlite_classes` migration provisions it on first deploy with no dashboard step),
   and a separate `meet.html` importing the three modules above. `worker/` must go in
   `.assetsignore`, and note that the Worker stops being assets-only, so a broken `main`
   takes the whole site down rather than just the API.
2. **Compact URLs**, parked at the user's request. The recommendation was two base64url
   characters per city, an append-only city table so codes stay stable, and a checksum
   guard that shouts if the table is ever reordered.
