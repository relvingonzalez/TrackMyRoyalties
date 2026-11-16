/*
 * Offline support. A template: the build (serviceWorker plugin in vite.config.js) fills in
 * CACHE_VERSION and PRECACHE_URLS and writes the result to dist/sw.js.
 *
 * - Install: saves every file the app needs (code, lazily loaded pages, the Excel reader,
 *   fonts, logos, icons) under this build's cache name.
 * - Pages: network first, so online visitors always get the latest deploy; the saved
 *   index.html when offline (or when the network doesn't answer within a few seconds).
 * - The app's own files: saved copy first. Their names change with every build, so a saved
 *   copy is never stale.
 * - Google Fonts (body text): saved after the first online visit.
 * - Activate: deletes every other cache, including earlier builds' and the original app's.
 *   It doesn't reload open pages; an old tab that later asks for a file that's gone shows
 *   the app's "A newer version is available" screen.
 */
const CACHE_VERSION = '__CACHE_VERSION__';
const PRECACHE_URLS = '__PRECACHE_URLS__';

const APP_CACHE = `trackmyroyalties-${CACHE_VERSION}`;
const FONT_CACHE = 'trackmyroyalties-google-fonts';
const INDEX_URL = new URL('index.html', self.registration.scope).href;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      // cache: 'reload' skips the HTTP cache, so every file comes from this deploy.
      .then(cache => cache.addAll(PRECACHE_URLS.map(url => new Request(url, {cache: 'reload'}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== APP_CACHE && key !== FONT_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkElseSavedPage(request));
  } else if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return; // always from the network
    event.respondWith(savedElseNetwork(request));
  } else if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(googleFont(request));
  }
});

/** Any page address (/, /index.html, ?boot=…) gets the live page, or offline the saved one. */
async function networkElseSavedPage(request) {
  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  try {
    const response = await Promise.race([fetch(request), timeout]);
    if (response) return response;
  } catch {
    // offline: fall through to the saved page
  }
  return (await caches.match(INDEX_URL, {cacheName: APP_CACHE})) || fetch(request);
}

async function savedElseNetwork(request) {
  const saved = await caches.match(request, {cacheName: APP_CACHE});
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(APP_CACHE).then(cache => cache.put(request, copy));
  }
  return response;
}

/**
 * Font files (fonts.gstatic.com) never change, so a saved copy is served. The stylesheet
 * (fonts.googleapis.com) arrives as an opaque response; only that one small file is saved.
 */
async function googleFont(request) {
  const cache = await caches.open(FONT_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
