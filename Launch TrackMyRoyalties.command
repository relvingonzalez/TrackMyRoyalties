#!/bin/zsh
cd "$(dirname "$0")"

# Build the app on first run, and again whenever its source is newer than the last build
# (e.g. after pulling an update). Needs Node.js 22+.
if [[ ! -f dist/index.html ]] || [[ -n "$(find src public index.html package-lock.json -newer dist/index.html -print -quit)" ]]; then
  if ! command -v npm >/dev/null; then
    echo "Node.js is needed to build the app: install the LTS version from https://nodejs.org, then open this again."
    read -k 1 "?Press any key to close."
    exit 1
  fi
  echo "Building TrackMyRoyalties…"
  if ! { npm ci && npm run build; }; then
    echo "The build failed (see above)."
    read -k 1 "?Press any key to close."
    exit 1
  fi
fi

if [[ ! -x .venv/bin/python ]]; then
  echo "Creating virtualenv…"
  python3 -m venv .venv
  .venv/bin/pip install cryptography pywebview
fi
exec .venv/bin/python desktop/app.py
