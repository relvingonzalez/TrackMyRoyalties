# How to test WideLedger (desktop + Premium)

## What you have

| Piece | Role |
|--------|------|
| Web UI in `~/WideLedger` | The real product (local-first) |
| `desktop/app.py` | Desktop window shell (pywebview) |
| `Launch WideLedger.command` | Double-click on Mac to open the app |
| Signed licenses (`WL1.…`) | Only way to unlock Premium |
| `tools/keys/private.pem` | **Your secret** — mint licenses. Never share or ship. |
| `~/.wideledger/license.key` | Your personal license (auto-loaded by desktop) |

This is **not** on the App Store yet. It is a **desktop app wrapper** around the local web app — good for real testing on your Mac.

---

## Launch the desktop app

**Option A — double-click**

Finder → `WideLedger` → **Launch WideLedger.command**  
(First time: macOS may ask to allow Terminal / local network.)

**Option B — terminal**

```bash
cd ~/WideLedger
.venv/bin/python desktop/app.py
```

You should get a native window titled **WideLedger**. If `~/.wideledger/license.key` exists, Premium should auto-activate after a brief reload.

---

## Browser testing (also fine)

```bash
cd ~/WideLedger
python3 -m http.server 8787
# open http://localhost:8787
```

Paste a license under **Premium** (browser won’t read `~/.wideledger` automatically).

> Use `http://localhost`, not `file://` — Web Crypto needs a secure context.

---

## Premium paywall (how it works)

1. There is **no free “Unlock” button**.
2. Premium requires a key starting with `WL1.` signed by **ECDSA P-256** with your private key.
3. On every load the app **re-verifies** the signature. Setting `premium: true` in DevTools **does nothing** without a valid `licenseKey`.
4. **Buy $9.99…** is a placeholder (future Stripe / App Store). For now you mint keys yourself.

### Mint a license (you only)

```bash
cd ~/WideLedger
.venv/bin/python tools/generate_license.py --name "Test Customer" --perpetual
```

Copy the `WL1.…` line → app → **Premium** → paste → **Activate license**.

### Your owner bypass (already set up)

```text
~/.wideledger/license.key     # used by desktop auto-unlock
~/WideLedger/tools/owner.license   # same key, project copy
```

Regenerate anytime:

```bash
.venv/bin/python tools/generate_license.py --name "Relvin (owner)" --perpetual --out tools/owner.license
cp tools/owner.license ~/.wideledger/license.key
```

---

## Vault (move to another browser/device)

1. **Import → Export vault (.json)** (free)
2. Copy file via AirDrop / USB / iCloud
3. On the other device: **Import vault**
4. If the vault included a valid license key, Premium re-verifies after import

---

## Is this “an app”? How real apps lock Premium

| Approach | Crack resistance | Fits WideLedger? |
|----------|------------------|------------------|
| **localStorage flag** (old MVP) | Trivial | Removed |
| **Signed offline license** (now) | Forging keys hard; patching JS still possible | Best local-first option |
| **Stripe + server license** | Strong | Later for web sales |
| **Apple/Google IAP** | Strongest for stores | Later for App Store |

**Honest truth:** no fully offline client is uncrackable. A determined reverse engineer can always edit the binary/JS to skip `isPremium()`. What we prevent is:

- Casual “set premium = true”
- Forging license keys without your private key
- Sharing a single secret code baked into the app

That’s the same model as many indie desktop tools (license keys).

**Do not** put a master password in the JS source — people will find it. Your bypass is the **private key** (only on your machine) + generated licenses.

---

## Quick test checklist

- [ ] Launch desktop app → Free badge without license file removed/renamed
- [ ] Restore `~/.wideledger/license.key` → relaunch → Premium badge
- [ ] Free: only 2 platforms for *new* imports; range capped
- [ ] Premium: tax monthly table unlocked; CSV export works
- [ ] Export vault → Reset data → Import vault → data + license return
- [ ] Fake key `WL1.fake.fake` → rejected
- [ ] DevTools: `localStorage` set `premium:true` without license → still Free after refresh

---

## Security of your private key

```text
tools/keys/private.pem   → NEVER commit, NEVER put in the app bundle for customers
tools/keys/public.pem    → safe to ship (already embedded as JWK in js/license.js)
```

Back up `private.pem` in a password manager or encrypted disk. If it leaks, anyone can mint Premium keys.
