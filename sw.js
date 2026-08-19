/**
 * Offline support for the installed app.
 *
 * Network-first for same-origin requests, falling back to the cache. That way a
 * deploy is picked up on the next load instead of the installed copy going
 * stale, which is the usual failure mode of cache-first app shells — and this
 * is one HTML file and three small modules, so there is no bundle worth
 * optimising for.
 *
 * Cross-origin requests are left alone: the forecast has its own localStorage
 * cache inside the app, and if Google Fonts is unreachable the page falls back
 * to the system sans on its own. Clocks, sunrise, sunset and time conversion are
 * all computed locally, so those keep working with no network at all.
 */
const CACHE = "timezones-v1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./favicon.svg",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  // index.html is a module now: without these three it loads to an empty board
  // for anyone who goes offline before the browser has fetched them.
  "./js/cities.js", "./js/tz.js", "./js/sky.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      // Individually, so one missing file cannot fail the whole install.
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then(hit =>
        hit || (request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
