/* WideLedger offline shell */
const CACHE = "wideledger-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/data.js",
  "./js/platform-icons.js",
  "./js/import.js",
  "./js/charts.js",
  "./js/app.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Network-first: always prefer the current bytes on disk when online, so a fresh install/
  // update is visible immediately. Only fall back to the cached copy when offline — this used
  // to be reversed (cache-first, update in background), which meant a fresh deploy silently
  // stayed invisible until a *second* load.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
