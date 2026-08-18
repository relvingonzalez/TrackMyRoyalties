#!/usr/bin/env python3
"""
Generate TrackMyRoyalties Premium license keys.

Requires the private key at tools/keys/private.pem (NEVER ship this with the app).
Only the public key is embedded in the client for verification.

Usage:
  ../.venv/bin/python generate_license.py
  ../.venv/bin/python generate_license.py --name "Jane Author" --days 365
  ../.venv/bin/python generate_license.py --name "Relvin" --perpetual --out owner.license
"""

from __future__ import annotations

import argparse
import base64
import json
import secrets
import sys
import time
from pathlib import Path

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

ROOT = Path(__file__).resolve().parent
PRIVATE_KEY_PATH = ROOT / "keys" / "private.pem"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def load_private_key():
    if not PRIVATE_KEY_PATH.exists():
        print(f"ERROR: Missing private key at {PRIVATE_KEY_PATH}", file=sys.stderr)
        print("Generate with: openssl ecparam -name prime256v1 -genkey -noout -out tools/keys/private.pem", file=sys.stderr)
        sys.exit(1)
    pem = PRIVATE_KEY_PATH.read_bytes()
    return serialization.load_pem_private_key(pem, password=None, backend=default_backend())


def sign_payload(private_key, payload: dict) -> str:
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    der_sig = private_key.sign(body, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_sig)
    raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return f"WL1.{b64url(body)}.{b64url(raw)}"


def main():
    parser = argparse.ArgumentParser(description="Mint a TrackMyRoyalties Premium license")
    parser.add_argument("--name", default="licensee", help="Label stored in the license (not verified as identity)")
    parser.add_argument("--days", type=int, default=0, help="Expiry in days (0 = use --perpetual or default 36500)")
    parser.add_argument("--perpetual", action="store_true", help="~100 year expiry")
    parser.add_argument("--tier", default="premium", choices=["premium"])
    parser.add_argument("--out", type=Path, help="Write key to this file")
    args = parser.parse_args()

    if args.perpetual or args.days == 0:
        days = 36500 if args.perpetual or args.days == 0 else args.days
    else:
        days = args.days
    if args.perpetual:
        days = 36500

    now = int(time.time())
    payload = {
        "v": 1,
        "tier": args.tier,
        "sub": args.name,
        "iat": now,
        "exp": now + days * 86400,
        "jti": secrets.token_hex(8),
    }

    key = load_private_key()
    license_str = sign_payload(key, payload)

    print("License created")
    print(f"  Subject : {payload['sub']}")
    print(f"  Tier    : {payload['tier']}")
    print(f"  Expires : {time.strftime('%Y-%m-%d', time.gmtime(payload['exp']))} (UTC)")
    print(f"  ID      : {payload['jti']}")
    print()
    print(license_str)

    if args.out:
        args.out.write_text(license_str + "\n", encoding="utf-8")
        print(f"\nWrote {args.out}")

    # Convenience: also print install hint
    home = Path.home() / ".trackmyroyalties" / "license.key"
    print(f"\nTo auto-unlock the desktop app for yourself:")
    print(f"  mkdir -p ~/.trackmyroyalties")
    print(f"  echo '{license_str}' > ~/.trackmyroyalties/license.key")


if __name__ == "__main__":
    main()
