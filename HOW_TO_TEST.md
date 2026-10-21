# How to test TrackMyRoyalties (desktop + browser)

## What you have

| Piece | Role |
|--------|------|
| Web UI in `~/TrackMyRoyalties` | The real product (local-first) |
| `desktop/app.py` | Desktop window shell (pywebview) |
| `Launch TrackMyRoyalties.command` | Double-click on Mac to open the app |

This is **not** on the App Store yet. It is a **desktop app wrapper** around the local web app — good for real testing on your Mac.

---

## Launch the desktop app

**Option A — double-click**

Finder → `TrackMyRoyalties` → **Launch TrackMyRoyalties.command**  
(First time: macOS may ask to allow Terminal / local network.)

**Option B — terminal**

```bash
cd ~/TrackMyRoyalties
.venv/bin/python desktop/app.py
```

You should get a native window titled **TrackMyRoyalties**.

---

## Browser testing (also fine)

```bash
cd ~/TrackMyRoyalties
python3 -m http.server 8787
# open http://localhost:8787
```

> Use `http://localhost`, not `file://`, so the service worker can register.

---

## Vault (move to another browser/device)

1. **Import → Export vault (.json)**
2. Copy file via AirDrop / USB / iCloud
3. On the other device: **Import vault**

---

## Quick test checklist

- [ ] Load demo data → every page opens (Dashboard, Platforms, Titles, Expenses, Import, Tax & export, Settings)
- [ ] Date range "All time" and "Custom" both work
- [ ] Import a third and fourth platform → no limit
- [ ] Tax & export: monthly table shows; CSV and JSON export download
- [ ] Export vault → Reset data → Import vault → data returns
