# Timezones

**[olwal.github.io/timezones](https://olwal.github.io/timezones/)**

A dashboard of Braun-style analog clocks for cities around the world.

Everything lives in one `index.html`: no build step, no dependencies, no framework.
Open it from disk or host it as a static file.

Two optional network requests: Inter from Google Fonts, and the forecast from
Open-Meteo if weather is on. Offline, the font falls back to the system UI sans and
the domes show no icons; clocks, sunrise and sunset are computed locally.

![The dashboard in daylight](docs/board-light.png)

The board is the whole page. Controls are two floating buttons in the bottom-right:
copy-link and settings.

Each card carries a dial, a twelve-hour forecast ring, the local time, a sky dome
showing where the sun is in that city's day, and a countdown to the next end of the
working day.

<img src="docs/second-hand.gif" width="420" alt="The second hand sweeping smoothly">

The second hand is a continuous sweep at real speed, not a once-a-second tick. Measured
off the dial, it moves 1.5° every quarter second rather than jumping 6° and sitting
still.

![Day, dusk and night side by side](docs/card-detail.png)

Tokyo in full daylight, Delhi mid-fade at 06:10, London at night. The dial darkens
with the city while the card around it keeps full contrast. The page follows the
board: when most of your cities are dark, so is everything else.

![The dashboard at night](docs/board-dark.png)

Click any digital time and type into it to convert that moment across the whole
board. Below, someone has proposed 14:30 their time in London: it is 06:30 in Santa
Cruz, an hour and a half before their morning, and 22:30 in Tokyo.

![Converting a time across every city](docs/convert.png)

Clicking a city name opens a search over all 458 cities, each row showing its current
local time. Same-name cities are distinguished by region, which is why `Cambridge`
appears twice below.

![Searching for a city](docs/city-picker.png)

The settings menu shows every mode at once and explains whichever one is selected.
Two of the settings are modes rather than on/off switches, which a cycling button
made impossible to discover.

![The settings menu](docs/settings.png)

The forecast can ride the sky dome instead of the dial, covering the hours left in the
current span rather than a fixed twelve.

![Forecast icons along the sky dome](docs/weather-dome.png)

## Choosing cities

**By URL**, comma-separated, in display order:

```
index.html?cities=san-francisco,new-york,london,tokyo
```

Each token is matched against city slugs (`new-york`), plain names (`New York`),
IANA zones (`Europe/London`), and aliases (`nyc`, `bombay`, `bangalore`, `hk`).
Unrecognised tokens are dropped.

**By clicking**: click any city name to replace that clock, or the `+ Add city`
tile to append one. Search by city, region, country or time zone; arrow keys and
Enter work.

**Reordering**: drag a card onto another to drop it into that position. The new
order is saved and written back to the URL. This uses HTML5 drag-and-drop, so it is
mouse and trackpad only; touch dragging is not supported.

Where a state or province is the more useful label the card shows that instead of the
country (`Santa Cruz / California`, `Cambridge / Massachusetts`). Same-name cities get
distinct slugs (`cambridge-ma` vs `cambridge`, `san-jose-ca` vs `san-jose`,
`portland-me` vs `portland`), and a guard at startup disambiguates any collision
rather than letting one city silently overwrite another.

Whatever is on screen is written back to the URL, so the address bar is always a
shareable link; the copy-link button puts it on the clipboard. The same list is saved
to `localStorage`, so a bare `index.html` reopens your last board. A `?cities=`
parameter always wins over the saved list.

## Converting a time

Click any card's digital time and type into it. The whole board pauses on that
instant and every other card reads the same moment in its own zone, which is what
you want when someone proposes a meeting in theirs. `Esc`, or clicking away, returns
to now and the second hand starts sweeping again.

The field is forgiving about format: `14:30`, `1430`, `930`, `2.30`, `2h30`,
`2:30pm`, `9a` and a bare `14` all work. While what you have typed is not yet a
valid time the underline turns red and the board holds the last good instant, so it
does not lurch around mid-keystroke.

Because everything on a card is derived from a single instant, pausing on one makes
the *whole* card describe that moment, not just the digits: the sky domes move the
sun to where it will be, the dials take on the darkness they will have, and the
footer counts down from then. That is how the screenshot above shows at a glance
that the proposed time lands before Santa Cruz's working day.

Two details worth knowing:

- The date is anchored to the edited city's local date when you start typing, so
  entering `00:30` after `23:30` stays on the same day instead of drifting.
- Converting a wall-clock time to an instant cannot assume an offset, because the
  offset in force depends on the answer. `zonedTimeToEpoch` solves it by correction
  instead, which handles half-hour zones (Kolkata, Kathmandu, St. John's) and
  daylight-saving changes. A local time that does not exist — 02:30 on a
  spring-forward morning — resolves to a real adjacent instant rather than `NaN`.

## Reading a clock

- **The sky dome** at the foot of each card has a horizon line, the day arc above
  it and a dashed night trough below. The sun crosses the dome left to right
  between sunrise and sunset; once it sets a crescent moon takes over and crosses
  the trough until dawn. Whichever half you are currently in is the lit one.
- **The horizontal axis is progress, not clock angle.** The left end is always
  sunrise and the right end always sunset, however long the day happens to be, so
  the sun at the apex means solar noon and halfway up the left slope means the
  morning is half gone. Sunrise and sunset times are printed at the two ends.
  This is deliberately *not* a clock scale: an earlier version wrapped a 24-hour
  ring around the 12-hour dial, and the two never lining up was confusing.
- **The sun moves in real time**, repositioned every frame.
- **The second hand floats**, a true continuous sweep driven off the epoch so every
  card is in lockstep. The minute and hour hands drift continuously too.
- **The dial fades between white and black** rather than flipping, running white to
  warm dusk to near-black from a single 0-1 darkness value recomputed every second.
  Only the dial fades. The card surface and all its text come from the page theme,
  because fading the whole card left grey text on a grey background at dusk.
  The dial's own markings don't interpolate either: at the midpoint they landed on
  the same grey as the dial and disappeared, so they step from black to white
  instead. Black on mid-grey is roughly 5:1 and white on mid-grey roughly 4:1, so
  both halves of the fade stay readable.
- **Dark clock face** decides what darkness means. *Working hours* (the default) uses
  the fixed evening window in `CONFIG`, fading over 45 minutes either side, so every
  city behaves the same and the board is easy to scan. *Real sun* uses the sun's true
  altitude, fading across civil twilight, so high latitudes look right:

  ```
  Stockholm, one character per hour, '.' = white face, '#' = black
  jun21/working hours:  ######+.............+###
  jun21/real sun:       ###*..................:*     sunrise 03:32, sunset 22:09
  dec21/working hours:  ######+.............+###
  dec21/real sun:       #########:.....+########     sunrise 08:44, sunset 14:49
  ```

  The page background follows the majority of the board while *Page theme* is on
  *Auto*.
- **One quiet line at the foot** counts down to whichever end of the working day
  comes round next: `11h 57m till morning 08:00`, or `57m till evening 18:00` if
  that is sooner.

## Configuration

Four constants at the top of the script define the shape of the day:

```js
const CONFIG = {
  morning:   8 * 60,   // 08:00, start of the working day
  evening:  18 * 60,   // 18:00, end of the working day
  nightFrom: 20 * 60,  // 20:00, the clock face turns black  ("hours" mode)
  nightTo:    6 * 60,  // 06:00, the clock face turns white again
  fade:          45,   // minutes either side of those, spent fading
  dayAbove:       2,   // sun this high  = full daylight        ("solar" mode)
  nightBelow:    -6    // sun this low   = full dark (civil twilight)
};
```

On *Working hours* the dark face is on fixed hours while the sun and moon follow real
astronomy, so the two can legitimately disagree: Tokyo at 05:21 shows a black face
with the sun already up on the dome, which is exactly the situation you want to see
before scheduling a call there. *Real sun* removes that disagreement at the cost of
every city behaving differently.

## Weather

Three placements, all of which draw current conditions and temperature in the middle
of the label row.

**Dial (default)**: twelve icons in a ring outside the dial, one per hour for the
next twelve hours. The analog face already maps hours to angles, so each forecast
hour sits at its own hour position and the ring reads clockwise from the hour hand.
The angle comes from that hour's local wall-clock time rather than a slot index, so
half-hour zones like Kolkata and Kathmandu land correctly between marks. Opacity
falls off with distance in time, which shows the reading direction and keeps the ring
from being ambiguous about which icon is the next hour.

**Dome**: icons along the sky dome for the hours remaining in the current span, now
until sunset by day, now until sunrise by night. Spaced by distance along the arc
rather than by clock hour, because `skyX` is a cosine that barely moves near sunrise
and sunset while the hours keep passing, so every-Nth-hour piles them into a heap at
the ends. The trade-off is that a span with little arc left shows fewer icons; late
afternoon might only fit two before sunset.

**Off**: no forecast, no requests, and the dial gets a slightly roomier viewBox.

Data comes from [Open-Meteo](https://open-meteo.com), which needs no API key and
allows browser requests. One call per city covers 72 hours; responses are cached in
`localStorage` for 30 minutes. If the request fails, the icons simply don't appear.

Every setting in the menu persists to `localStorage`.

## Sun and moon calculations

Sunrise and sunset are computed in-page from each city's latitude and longitude
using the standard NOAA sunrise equation, with the −0.833° altitude used for the
apparent solar disc. Spot-checked against published almanac times for London,
New York, Singapore and Sydney at both solstices, agreement within ~2 minutes.

Positioning the moon needs the neighbouring day too, since the night span runs
from yesterday's sunset to this morning's sunrise; `sunForOffset(city, parts, ±1)`
supplies it. Polar day and polar night are handled: the labels become
`midnight sun` / `polar night` and the body crosses the dome once per calendar day.
Tromsø and Longyearbyen are in the list, so that branch is reachable; try
Longyearbyen in June or December.

Adding a city means one row in the `CITY_DATA` table near the top of the script.
The last three fields are optional:

```js
["Name", "Country", "IANA/Zone", lat, lon, "extra search terms", "Region", "id-override"]
```

To check a batch of additions, loop `CITIES` in the console, calling
`Intl.DateTimeFormat` with each `tz` to confirm the runtime knows the zone, and
`sunFor` to confirm sunrise precedes sunset.
