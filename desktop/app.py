#!/usr/bin/env python3
"""
TrackMyRoyalties desktop shell (macOS / Windows / Linux via pywebview).

- Serves the local web app (no internet required for app code)

Run:
  cd ~/TrackMyRoyalties
  .venv/bin/python desktop/app.py
"""

from __future__ import annotations

import os
import re
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

# Tied to the actual files on disk (their newest mtime), not "when did this process start" —
# a process can start fresh and still be pointed at a stale/wrong folder, and a launch-time
# stamp would misleadingly say "now" either way. This one only changes when the files
# genuinely change, which is exactly what's useful for confirming "am I on the build I think
# I am" when troubleshooting a caching or wrong-folder problem.
def compute_build_stamp() -> str:
    watched = [
        ROOT / "index.html",
        ROOT / "js" / "app.js",
        ROOT / "js" / "import.js",
        ROOT / "js" / "data.js",
        ROOT / "js" / "platform-icons.js",
        ROOT / "css" / "app.css",
    ]
    newest = 0.0
    for f in watched:
        try:
            newest = max(newest, f.stat().st_mtime)
        except OSError:
            pass
    if not newest:
        return "unknown"
    return datetime.fromtimestamp(newest, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


BUILD_STAMP = compute_build_stamp()
# Cache-busting query param appended to this app's own local script/link URLs (never the
# external CDN ones) — same value as the build stamp shown in the UI, so a fresh set of files
# always gets fresh URLs the embedded browser has never cached before.
CACHE_BUST = str(int(time.time()))
LOCAL_ASSET_RE = re.compile(r'((?:href|src)=")((?:css|js)/[^"]+\.(?:css|js))(")')


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

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

    def do_GET(self):
        # Serve index.html with cache-busted local asset URLs instead of the raw file, so a
        # browser that already cached the old js/app.js etc. from a PRIOR run (before this
        # no-store fix even existed) can't accidentally keep using that stale copy — the
        # ?v=... query string makes it a URL the browser has never seen, forcing a real fetch.
        # Also stamps the visible build indicator in the sidebar footer.
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            try:
                html = (ROOT / "index.html").read_text(encoding="utf-8")
            except OSError:
                return super().do_GET()
            html = LOCAL_ASSET_RE.sub(rf"\g<1>\g<2>?v={CACHE_BUST}\g<3>", html)
            html = html.replace('id="build-stamp" style="opacity:0.5">build: unknown<', f'id="build-stamp" style="opacity:0.5">build: {BUILD_STAMP}<')
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


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

    os.chdir(ROOT)
    start_server()
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
