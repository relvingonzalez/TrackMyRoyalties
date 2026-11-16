#!/usr/bin/env python3
"""
TrackMyRoyalties desktop shell (macOS / Windows / Linux via pywebview).

- Serves the local web app (no internet required for app code)

Run (after `npm ci && npm run build`, which writes dist/):
  .venv/bin/python desktop/app.py
"""

from __future__ import annotations

import os
import sys
import time
import threading
import functools
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Single source of truth for this process, same idea as js/brand.js on the web side — a
# future rebrand only means changing these two lines and CONFIG_DIR's old-name fallback
# below (no other language/runtime can share one literal constant with the browser JS
# without a build step, so this is the Python-side mirror, not a duplicate to hunt down).
APP_NAME = "TrackMyRoyalties"
APP_SLUG = "trackmyroyalties"

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = Path.home() / f".{APP_SLUG}"
STORAGE_DIR = CONFIG_DIR / "webview_data"
HOST = "127.0.0.1"
PORT = 8788

# One-time migration from the pre-rebrand (WideLedger) config dir, so the persistent
# browser profile isn't silently orphaned by the rename.
_LEGACY_CONFIG_DIR = Path.home() / ".wideledger"
if _LEGACY_CONFIG_DIR.is_dir() and not CONFIG_DIR.exists():
    import shutil

    shutil.copytree(_LEGACY_CONFIG_DIR, CONFIG_DIR)
    print(f"Migrated {_LEGACY_CONFIG_DIR} -> {CONFIG_DIR}")

# The built app (`npm run build` writes it). Built asset file names change with every
# build, so new code is always fetched fresh; index.html itself is covered by the no-store
# header below and the per-launch ?boot= page URL in main().
DIST = ROOT / "dist"


def compute_build_stamp() -> str:
    """Newest modification time of the built files: confirms which build is running."""
    newest = max((f.stat().st_mtime for f in DIST.rglob("*") if f.is_file()), default=0.0)
    if not newest:
        return "unknown"
    return datetime.fromtimestamp(newest, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


CACHE_BUST = str(int(time.time()))


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, format, *args):  # noqa: A003
        pass

    def end_headers(self):
        # Making the webview profile persistent (see the private_mode fix below) means the
        # embedded browser's HTTP cache now also survives across app relaunches, where before
        # it didn't. Without this, replacing app files on disk (e.g. installing an update)
        # could silently keep serving old cached HTML/JS after relaunch. Always fetch fresh.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


def start_server():
    server = ThreadingHTTPServer((HOST, PORT), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


# Domains the "Go to report" deep links are allowed to open in the system browser.
# Allowlisted rather than open-anything: this method is reachable from any JS running in
# the embedded webview, so it shouldn't blindly shell out to whatever URL it's handed.
EXTERNAL_LINK_ALLOWED_HOSTS = {
    "kdpreports.amazon.com",
    "draft2digital.com",
    "www.draft2digital.com",
    "play.google.com",
    "myaccount.ingramspark.com",
    "writinglife.kobo.com",
    "press.barnesandnoble.com",
    "authors.apple.com",
}


class Api:
    """Exposed to the frontend as window.pywebview.api — lets JS ask the OS to open a
    report page in the user's real, already-logged-in default browser, instead of the
    app's own embedded webview (which has no session, no address bar, no back button)."""

    def open_external(self, url: str) -> bool:
        try:
            import webbrowser
            from urllib.parse import urlparse

            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.hostname not in EXTERNAL_LINK_ALLOWED_HOSTS:
                print(f"Refused to open non-allowlisted URL: {url}")
                return False
            webbrowser.open(url)
            return True
        except Exception as e:
            print("Could not open external URL:", e)
            return False


def main():
    try:
        import webview
    except ImportError:
        print("pywebview not installed. Run:")
        print("  python3 -m venv .venv && .venv/bin/pip install pywebview cryptography")
        sys.exit(1)

    if not (DIST / "index.html").is_file():
        print("The app hasn't been built yet. From the project folder, run:")
        print("  npm ci && npm run build")
        sys.exit(1)

    os.chdir(ROOT)
    start_server()
    print(f"Serving the build from {compute_build_stamp()}")
    # Include a cache-buster on the top-level page URL itself, not just the assets it
    # references — a fixed URL here means the embedded browser can decide its existing
    # cached copy of THIS page is "fresh enough" and never even make a request, in which
    # case the no-store header above is never seen because no request happens at all. A
    # genuinely new URL every launch forces a real fetch no matter what's already cached.
    url = f"http://{HOST}:{PORT}/index.html?boot={CACHE_BUST}"

    window = webview.create_window(
        APP_NAME,
        url,
        width=1280,
        height=840,
        min_size=(900, 600),
        background_color="#0c1015",
        text_select=True,
        js_api=Api(),
    )

    print(f"{APP_NAME} desktop → {url}")

    # BUG FIX: pywebview defaults to private_mode=True, which means the
    # WKWebView/Edge/GTK backend uses an ephemeral, in-memory data store —
    # localStorage is wiped every time the window closes. That's why the
    # app looked "reset" on every relaunch even though app.js was correctly
    # calling localStorage.setItem(). Pinning a real storage_path and turning
    # private_mode off gives the embedded browser a persistent profile on
    # disk, the same way a normal browser tab would behave. (The app now
    # stores data in IndexedDB; the same persistent profile covers it.)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    webview.start(
        debug=os.environ.get(f"{APP_SLUG.upper()}_DEBUG") == "1",
        private_mode=False,
        storage_path=str(STORAGE_DIR),
    )


if __name__ == "__main__":
    main()
