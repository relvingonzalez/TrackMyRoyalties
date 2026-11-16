/*
 * Retires the service worker the original app installed at this address.
 *
 * Browsers re-check /sw.js on every visit, so returning visitors pick this up, and it:
 * deletes the old app's offline caches and unregisters itself. It has no fetch handler, so
 * it never serves anything, and it doesn't reload open pages (a forced reload could
 * interrupt a save in progress). The new app doesn't register a service worker.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.registration.unregister()),
  );
});
