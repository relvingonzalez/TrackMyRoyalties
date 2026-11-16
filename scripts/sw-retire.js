/*
 * EMERGENCY UNDO for offline support — not part of the normal build.
 *
 * If the offline service worker ever misbehaves, deploy this file as public/sw.js (and
 * remove the serviceWorker plugin from vite.config.js). It's what shipped in 7a566c0, so a
 * Vercel rollback to that deployment does the same thing.
 *
 * It retires the service worker installed at this address.
 *
 * Browsers re-check /sw.js on every visit, so returning visitors pick this up, and it:
 * deletes every offline cache and unregisters itself. It has no fetch handler, so it never
 * serves anything, and it doesn't reload open pages (a forced reload could interrupt a save
 * in progress).
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
