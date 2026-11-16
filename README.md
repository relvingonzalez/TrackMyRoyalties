# TrackMyRoyalties

**Author income, expenses, and true profit, across every store. Free, with every feature included.**

Try it: https://track-my-royalties.vercel.app/ · If it saves you time, you can [buy me a coffee](https://buymeacoffee.com/relvingonzalez).

TrackMyRoyalties is a local-first web app for indie authors who publish wide. It aggregates royalties from Amazon KDP, Kobo Writing Life, Draft2Digital, Apple Books, B&N Press, Google Play Books, IngramSpark, and more; tracks ads and production costs; and shows **net profit**, not just dashboard royalties. Your data stays in your browser on your device.

Built with React 19 and [Astryx](https://github.com/facebook/astryx) (Meta's design system), with a custom "Writer's Desk" theme. Developer setup and code layout: **[DEVELOPING.md](./DEVELOPING.md)**. Testing: **[HOW_TO_TEST.md](./HOW_TO_TEST.md)**.

> **Version 2 (November 2026):** the app was rebuilt on React + Astryx. Saved data carries over automatically: same browser storage, same data code. The original plain-JavaScript app is in git history (up to commit `d27e49a`).

---

## Open the app

**Desktop (Mac):** double-click **`Launch TrackMyRoyalties.command`**. The first run builds the app (needs [Node.js](https://nodejs.org) 22+) and sets up the window.

**Browser:**

```bash
npm ci
npm run build
npx vite preview --port 8787   # or: python3 -m http.server 8787 --directory dist
```

Then visit **http://localhost:8787**. Click **Explore with demo data** for a realistic multi-platform catalog, or **Start empty** and import the CSVs in `sample-data/`. Move devices with a vault file (Import → Vault, or Settings).

---

## Why this exists (research summary)

Synthesized from r/selfpublish, r/KDP, Kindlepreneur tracker roundups, and competitor models (Book Report, ScribeCount, PublishWide, Publisher Champ):

| Author pain | How TrackMyRoyalties responds |
| --- | --- |
| **Subscriptions that scale with income** ($10–$249/mo) | **Free**, every feature (no “success tax”) |
| **Income ≠ profit** (ads, covers, editing invisible) | Expenses & ad categories → **net P&L** |
| **Re-login / password hell**; scrapers break when Amazon changes UI | **CSV / report upload** + manual entry — **no platform passwords** |
| **No public KDP API** (confirmed: SP-API does not expose KDP sales) | Architecture that survives dashboard changes |
| **~15 min/day multi-store checks** (~100 hrs/year) | One dashboard; filter **all platforms or one** |
| **Privacy anxiety** about cloud + credentials | **Local-first** (browser IndexedDB); backup/export anytime |
| **Tax-season chaos** | Year summary + CSV/JSON export for accountants |
| **Overwhelming UIs** or too-limited free tiers | Clean overview + insights; nothing held back |
| **Double-counting** when using D2D + direct | Platform filter + import guides warn about overlap |
| **KU / KENP mixed with sales** | Separate KENP + KU royalty metrics |

### Competitor pricing context (approx. 2026)

- **Book Report:** free under ~$1k/mo, then $19–$249/mo by earnings tier  
- **ScribeCount:** ~$10–$20/mo (income-based); explicitly **no one-time purchase**  
- **PublishWide:** ~$29/mo  
- **Publisher Champ:** ~$17–$22/mo  

TrackMyRoyalties’s positioning: **free, with no tiers and no account**.

---

## Features

All free:
- Dashboard: gross royalties, expenses, **net profit**, units, KENP, with changes vs the prior period
- Date ranges: 7d / 30d / 90d / YTD / 12 months / all time / custom
- Filter: all platforms or one
- Charts: royalties over time (with annotations), platform mix, format mix, income vs expenses
- Top titles, series read-through, auto insights
- Import CSV and Excel reports (KDP multi-sheet workbooks combined automatically), several at once
- Manual royalty entry; expense tracking and expense-list import
- Tax year monthly breakdown; CSV / JSON exports
- Vault backup and restore
- Themes: Writer's Desk (default), Neutral, Y2K, Gothic; light and dark

---

## Platforms

| Platform | Typical data source |
| --- | --- |
| Amazon KDP | Orders → Lifetime → Download (.xlsx) |
| Kobo Writing Life | KWL sales export |
| Draft2Digital | D2D sales export |
| Apple Books | Apple / aggregator export |
| B&N Press | B&N sales CSV |
| Google Play Books | Partner Center |
| IngramSpark | Reports export |
| Smashwords / Direct / Other | CSV or manual |

### Hard truth about “API keys / login”

| Store | Public royalty API? | Practical integration |
| --- | --- | --- |
| Amazon KDP | **No** (SP-API does not cover KDP) | CSV export; some tools use fragile browser automation |
| Kobo / B&N / Google / Apple | Limited / partner-only | CSV or official partner programs |
| Draft2Digital | Dashboard export | CSV |
| IngramSpark | Reports portal | CSV / monthly statements |

Products that auto-login to KDP frequently break, re-prompt for passwords, and have been shut out by Amazon historically. **TrackMyRoyalties deliberately chooses CSV-first** so authors keep control and the product doesn’t die when a dashboard changes.

---

---

## Path to Apple App Store (iPhone + Mac)

You asked for one app in the App Store. Realistic path:

1. **Now (done):** Responsive web app with an install manifest. Installable on iOS via Safari → Share → Add to Home Screen; works on desktop browsers.
2. **Next:** Wrap with **[Capacitor](https://capacitorjs.com/)**  
   - `npx cap init` → iOS + optionally macOS Catalyst  
   - Same React codebase (`npm run build` output)  
3. **Ship:** Apple Developer Program ($99/year), App Store screenshots, privacy nutrition labels (“Data Not Collected” if fully local).
4. **Optional:** Mac App Store via Catalyst or a thin WKWebView shell.

Native SwiftUI rewrite is only worth it after product validation.

---

---

## CSV format (recommended)

```csv
date,platform,title,royalty,units,kenp
2026-07-01,kdp,Ember Protocol,42.50,12,0
2026-07-01,kdp,Ember Protocol,18.20,0,4200
```

Platform ids: `kdp`, `kobo`, `d2d`, `apple`, `bn`, `google`, `ingram`, `smashwords`, `direct`, `other`.

The importer also tolerates common alternate headers (`sale_date`, `earnings`, `pages_read`, etc.).

---

---

## Security & privacy

- Data is stored in **IndexedDB** in your browser, on your device only.
- No third-party analytics. Fonts load from Google Fonts (body text) and the app bundle (headings).
- Never paste KDP passwords into this app; it never asks for them.

---

## Roadmap ideas

- [ ] Capacitor iOS + Mac wrapper  
- [ ] Amazon Ads CSV ↔ royalty day matching (true ad ROI)  
- [ ] Multi-currency conversion table (user-set rates)  
- [ ] Pen-name and series rollup charts  
- [ ] Optional end-to-end encrypted sync  
- [ ] Returns / payment-vs-estimate status fields  

---

---

## License

Personal project scaffold — use and modify freely for your product. Not affiliated with Amazon, Kobo, Apple, or Draft2Digital.
