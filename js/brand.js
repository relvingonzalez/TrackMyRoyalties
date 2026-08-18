/**
 * Single source of truth for the product name. Change it here and everything that reads
 * from Brand — storage keys, exported filenames, in-app copy, the header — follows.
 * Must load before every other app script (data.js derives its storage key from it).
 *
 * Not fully self-updating: index.html's <title>/<meta> tags, manifest.json, and sw.js's
 * cache name stay static literals on purpose — crawlers, social-link previews, the OS
 * install prompt, and the service worker (no `window`/`document` there) never run this
 * file. Its init() re-syncs the HTML <head> at runtime. On a future rebrand: update
 * NAME/SLUG here, then grep for the old name in index.html's <head>, manifest.json, and
 * sw.js's CACHE constant as the remaining manual spots.
 */
(function (global) {
  const NAME = "TrackMyRoyalties";
  const SLUG = "trackmyroyalties"; // lowercase — storage keys, exported filenames, config dir
  const TAGLINE = "Author Income & Profit";

  function init() {
    document.title = `${NAME} — ${TAGLINE}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `${NAME} — one dashboard for author income, expenses, and true profit across every publishing platform.`);
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute("content", NAME);
    document.querySelectorAll(".brand-name").forEach((el) => (el.textContent = NAME));
    document.querySelectorAll(".brand-mark").forEach((el) => (el.textContent = NAME[0]));
  }

  global.Brand = { name: NAME, slug: SLUG, tagline: TAGLINE, init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
