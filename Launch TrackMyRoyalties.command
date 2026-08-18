#!/bin/zsh
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  echo "Creating virtualenv…"
  python3 -m venv .venv
  .venv/bin/pip install cryptography pywebview
fi
exec .venv/bin/python desktop/app.py
