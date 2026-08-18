# TrackMyRoyalties

**Author income, expenses, and true profit — across every store — without another monthly subscription.**

> **Updated build — what changed:**
> 1. **Fixed the data-reset bug.** `desktop/app.py` was launching pywebview with its default `private_mode=True`, which uses an ephemeral, in-memory browser profile — every `localStorage` write worked, but was discarded the moment the window closed. Now pinned to a persistent profile at `~/.trackmyroyalties/webview_data`.
> 2. **Replace a platform's file.** Import → "Your imports" shows rows/total/last-import per platform with a Clear button, and the importer now offers a "Replace existing data for this platform" checkbox when re-uploading a corrected report (tracked via new `importBatches` in state).
> 3. **Format detection.** The import preview now flags how many rows had an unclear ebook/paperback/hardcover/audiobook format, and the Books page format cell is now an editable dropdown that retroactively re-tags every sale row for that title.
> 4. **Multi-file import.** Drop/select several report files at once — each one's platform is guessed from its own column headers, with one confirmation dialog before committing. (No login automation — see "Hard truth about API keys/login" below for why.)
> 5. **KDP "Orders (Lifetime)" smart import.** These multi-sheet Excel exports have no Format column — the sheet name itself (eBook Royalty, Paperback Royalty, Hardcover Royalty, Audiobook Royalty, KENP) is the only reliable signal. TrackMyRoyalties now detects this shape, tags each row's format from its sheet name, and combines all the relevant sheets into one import by default (a manual single-sheet picker is still available). Combined Sales / Orders Processed / Orders Placed / Summary / Report Definitions are intentionally excluded from the combine since they repeat the same numbers a different way.
> 6. **Duplicate books from title mismatches.** Reports import ASIN/ISBN when present and match books by that identifier first, title text second — so "Ember Protocol" and "Ember Protocol: A Novel (Book 1)" land as one book if they share an ASIN, instead of splitting into two catalog entries. For books already split before this fix, the Books page has a new "Merge into…" button per title to combine them (moves every sale row, keeps both identifiers, can't be undone — export a vault backup first).
> 7. **"Total looks wrong after import" fix.** The dashboard's date range defaults to "Last 30 days" — after importing a multi-year report, that hid most of what was just imported and made a correct import look like data loss. Import now widens the range automatically (to "All time" on Premium, "Last 12 months" on Free) whenever the just-imported data falls outside the currently selected window, with a toast explaining why the range changed.
> 8. **Corrected export-guide directions for every platform.** The per-platform "how to export" text on the Import page was stale/wrong in places, most notably IngramSpark: Reports → Compensation is a lump-sum total per title for the selected period with no per-row date, so it can't be imported. The dated report is under Reports → Sales → Ebook Sales / Print Sales instead. Re-verified current menu paths for KDP, Kobo Writing Life, Draft2Digital, Apple Books, B&N Press, Google Play Books, and IngramSpark against each platform's own current help docs.
> 9. **Platform dropdown stuck on "KDP" fix.** Loading a multi-sheet KDP workbook suggested "Amazon KDP" in the platform field, which was correct — but it also kept silently re-forcing the dropdown back to "kdp" every time it re-rendered, including when you manually picked a different platform, so any other selection instantly snapped back. Now it only sets that default once on file load; picking a different platform afterward sticks. The dropdown is only locked (and shown as such) while "combine sheets automatically" mode is active, since that mode always commits as KDP regardless of the dropdown — so the on-screen note and the actual import can no longer disagree.
> 10. **Draft2Digital import was reading the wrong columns.** Three separate header-matching bugs, all from D2D's real "Raw Sales Data" column names not matching what the parser expected: (1) the royalty amount was matched against "Royalty Rate" (an 85% *rate*) instead of "User Share USD Final" (the actual dollar payout) — any column containing "royalty" as a substring beat the real dollar column since the rate column happened to be checked first; (2) D2D's "Date Range" column (e.g. "12/31/24 - 12/31/24") wasn't recognized as a date column at all; (3) "Net Unit Sales" (singular "Unit") wasn't recognized as a units column, which only matched plural "units". All three are fixed: rate/percent columns are now explicitly excluded from ever matching as a royalty amount (protects every platform, not just D2D), date-range strings take their start date, and the units matcher now covers D2D's exact column name.
> 11. **Percent-value safety net for the royalty column.** Beyond excluding columns whose header says "rate" or "percent," the royalty-column matcher now samples actual cell values for any candidate column and rejects it if most of them look like a percentage (contain "%") — even if the header name gives no hint. Protects against a future platform naming its rate column something the header-text rules don't already catch.
> 12. **"Go to report" deep links.** Each platform's export guide on the Import page now has a button that opens straight to that platform's actual report page — `kdpreports.amazon.com/orders`, `draft2digital.com/reports/raw_sales_data/`, etc. — instead of just the platform's homepage. All were sourced from official docs and field-verified except Apple Books, which is labeled "(unverified link)" in the UI since it's sourced from Apple's own support docs but hasn't been click-tested by anyone yet. On desktop, these route through a small pywebview↔Python bridge (`Api.open_external`, allowlisted to the seven known report domains) so they open in your real, already-logged-in system browser instead of the app's own embedded window, which has no session and would otherwise just swallow the click.
> 13. **Expense CSV/Excel import.** The Import page now has a drop zone for any item+cost list — a spreadsheet, receipts export, credit-card CSV. Detects item/description, cost/amount, and (if present) date and category columns automatically. Every parsed row is editable before committing — item text, cost, and category — with a running total and row count shown live, and a Remove button per row. If a row (or the whole file) has no date, a year selector appears so you can file those under a specific year (defaulting each to Jan 1 of that year) instead of the import failing or guessing a date.
> 14. **Expense column detection now works without matching header names.** If a file's headers don't match any known wording (generic spreadsheet exports, "Column1"/"Field2"-style headers, or wording nobody anticipated), TrackMyRoyalties now looks at what's actually *in* each column instead of giving up: a column that's mostly currency-shaped values ($12.99, 350.00, with a bonus for an explicit $ sign or cents so it doesn't get confused with a bare quantity column) is treated as cost, a column that's mostly parseable dates is treated as date, and whichever remaining column is mostly letters (not numbers, not dates) is treated as the item description. Header-name matching is always tried first and wins when it matches; this is a fallback for the columns it doesn't identify, not a replacement.
> 15. **Fixed stale-cache risk that could hide new features/fixes after an update.** Two related bugs, both about serving old files after new ones were installed: (1) the desktop app's local file server sent no cache-control headers, and now that the browser profile persists across relaunches (see the earlier data-loss fix), its HTTP cache could also persist — replacing the app files on disk didn't guarantee the embedded browser would actually load them. Fixed by sending `Cache-Control: no-store` on every response. (2) That alone couldn't fix a browser that had *already* cached files from a run before this fix existed — a header change can't retroactively invalidate an old cache entry. So `index.html`'s local script/link URLs (`js/app.js`, `css/app.css`, etc. — not the external CDN ones) are now served with a `?v=<launch timestamp>` appended, generated fresh every process start, so every launch requests URLs the embedded browser has genuinely never seen before, regardless of whatever's already cached on disk. (3) The web app's service worker (`sw.js`) had the same class of bug — cache-first, background-update-only — switched to network-first with offline fallback, cache version bumped so old entries are evicted.
> 16. **Expense import is now reachable from the Expenses page too**, not just the Import page — a new "Import from file" button next to "Add expense" jumps straight to the importer and highlights it, rather than requiring people to already know it lives on a different page.
> 17. **Visible build stamp** in the sidebar footer ("build: 2026-08-10 20:57 UTC" or similar) — on desktop, generated from the actual newest file-modification time on disk each launch, not just "when did the process start," so it genuinely reflects whether you're running the files you think you are. Meant to make "am I on the latest version" a one-glance check instead of a guessing game after an update.
> 18. **Fixed the actual root cause of stale launches: the window's own URL never changed.** The cache-busting from #15 only versioned the *sub-resource* URLs (`js/app.js?v=...`); the top-level page itself was always loaded from the exact same fixed `http://127.0.0.1:8788/index.html`, every launch. If the embedded browser had that URL cached from any earlier run, it could decide the cached copy was "fresh enough" and never make a request at all — meaning the `no-store` header was never even seen, since no request happened. The window now loads `index.html?boot=<current time>`, a URL it's never seen before, on every single launch, so a fresh fetch is unavoidable regardless of anything already cached from before this fix existed.

TrackMyRoyalties is a local-first web app (PWA) for indie authors who publish wide. It aggregates royalties from Amazon KDP, Kobo Writing Life, Draft2Digital, Apple Books, B&N Press, Google Play Books, IngramSpark, and more; tracks ads and production costs; and shows **net profit**, not just dashboard royalties.

---

## Open the app

### Desktop (recommended for testing)

```bash
cd ~/TrackMyRoyalties
.venv/bin/python desktop/app.py
```

Or double-click **`Launch TrackMyRoyalties.command`**.

Your owner Premium license auto-loads from `~/.trackmyroyalties/license.key` (already installed). See **[HOW_TO_TEST.md](./HOW_TO_TEST.md)**.

### Browser

```bash
cd ~/TrackMyRoyalties
python3 -m http.server 8787
```

Then visit **http://localhost:8787** (not `file://`).

1. Click **Try demo data** for a realistic multi-platform catalog.
2. Or **Start empty** and import CSVs from `sample-data/`.
3. Move devices with **Import → Export vault**.

---

## Why this exists (research summary)

Synthesized from r/selfpublish, r/KDP, Kindlepreneur tracker roundups, and competitor models (Book Report, ScribeCount, PublishWide, Publisher Champ):

| Author pain | How TrackMyRoyalties responds |
| --- | --- |
| **Subscriptions that scale with income** ($10–$249/mo) | Free core + **one-time $9.99** Premium (no “success tax”) |
| **Income ≠ profit** (ads, covers, editing invisible) | Expenses & ad categories → **net P&L** |
| **Re-login / password hell**; scrapers break when Amazon changes UI | **CSV / report upload** + manual entry — **no platform passwords** |
| **No public KDP API** (confirmed: SP-API does not expose KDP sales) | Architecture that survives dashboard changes |
| **~15 min/day multi-store checks** (~100 hrs/year) | One dashboard; filter **all platforms or one** |
| **Privacy anxiety** about cloud + credentials | **Local-first** (browser storage); backup/export anytime |
| **Tax-season chaos** | Year summary + Premium CSV/JSON for accountants |
| **Overwhelming UIs** or too-limited free tiers | Clean overview + insights; free plan still useful (2 platforms, 12 months) |
| **Double-counting** when using D2D + direct | Platform filter + import guides warn about overlap |
| **KU / KENP mixed with sales** | Separate KENP + KU royalty metrics |

### Competitor pricing context (approx. 2026)

- **Book Report:** free under ~$1k/mo, then $19–$249/mo by earnings tier  
- **ScribeCount:** ~$10–$20/mo (income-based); explicitly **no one-time purchase**  
- **PublishWide:** ~$29/mo  
- **Publisher Champ:** ~$17–$22/mo  

TrackMyRoyalties’s positioning: **useful free forever + $9.99 unlock once**.

---

## Features

### Free
- Dashboard: gross royalties, expenses, **net profit**, units, KENP  
- Date ranges: 7d / 30d / 90d / YTD / 12 months  
- Filter: all platforms or one  
- Charts: royalties over time, platform mix, income vs expenses  
- Top titles, auto insights  
- Import CSV + manual royalty entry  
- Expense tracking (ads, production, tools…)  
- 2 platforms for ongoing imports  
- Local backup download  

### Premium — $9.99 one-time (signed license paywall)
- Unlimited platforms  
- Full history + custom date ranges  
- Tax year monthly breakdown  
- CSV / JSON accountant export  

Premium requires a cryptographically signed `WL1.…` license (ECDSA). There is no free unlock button.  
Mint keys: `.venv/bin/python tools/generate_license.py --name "Customer" --perpetual`  
**Buy $9.99** is a placeholder until Stripe / App Store IAP. Details in [HOW_TO_TEST.md](./HOW_TO_TEST.md).

---

## Platforms

| Platform | Free tier import | Typical data source |
| --- | --- | --- |
| Amazon KDP | ✓ | Orders → Lifetime → Download (.xlsx) |
| Kobo Writing Life | ✓ | KWL sales export |
| Draft2Digital | Premium for *new* 3rd+ | D2D sales export |
| Apple Books | Premium… | Apple / aggregator export |
| B&N Press | Premium… | B&N sales CSV |
| Google Play Books | Premium… | Partner Center |
| IngramSpark | Premium… | Reports export |
| Smashwords / Direct / Other | Premium… | CSV or manual |

### Hard truth about “API keys / login”

| Store | Public royalty API? | Practical integration |
| --- | --- | --- |
| Amazon KDP | **No** (SP-API does not cover KDP) | CSV export; some tools use fragile browser automation |
| Kobo / B&N / Google / Apple | Limited / partner-only | CSV or official partner programs |
| Draft2Digital | Dashboard export | CSV |
| IngramSpark | Reports portal | CSV / monthly statements |

Products that auto-login to KDP frequently break, re-prompt for passwords, and have been shut out by Amazon historically. **TrackMyRoyalties deliberately chooses CSV-first** so authors keep control and the product doesn’t die when a dashboard changes.

---

## Freemium model (recommended production)

| | Free | Premium $9.99 once |
| --- | --- | --- |
| Platforms | 2 | Unlimited |
| History | 12 months | All time + custom |
| Expenses | Yes | Yes |
| Tax monthly table | Locked | Yes |
| Export CSV/JSON | Backup only | Full export |
| Future cloud sync | — | Optional add-on later |

**Why one-time fits authors:** recurring SaaS that rises with income is the #1 resentment in tracker comparisons. Infrastructure cost for local-first is low; optional paid sync can be a separate small subscription later if needed.

---

## Path to Apple App Store (iPhone + Mac)

You asked for one app in the App Store. Realistic path:

1. **Now (done):** Responsive web app + PWA (`manifest.json`, service worker). Installable on iOS via Safari → Share → Add to Home Screen; works on desktop browsers.
2. **Next:** Wrap with **[Capacitor](https://capacitorjs.com/)**  
   - `npx cap init` → iOS + optionally macOS Catalyst  
   - Same HTML/JS codebase  
   - Replace demo Premium button with **StoreKit** non-consumable IAP at $9.99  
3. **Ship:** Apple Developer Program ($99/year), App Store screenshots, privacy nutrition labels (“Data Not Collected” if fully local).
4. **Optional:** Mac App Store via Catalyst or a thin WKWebView shell.

Native SwiftUI rewrite is only worth it after product validation.

---

## Project layout

```
TrackMyRoyalties/
├── index.html          # App shell + landing
├── css/app.css         # Dark literary UI
├── js/
│   ├── data.js         # Platforms, storage, demo generator, aggregates
│   ├── import.js       # CSV parser for KDP-like & native formats
│   ├── charts.js       # Chart.js wrappers
│   └── app.js          # UI, freemium gates, pages
├── sample-data/        # Example CSVs
├── assets/             # Icons
├── manifest.json       # PWA
├── sw.js               # Offline shell
└── README.md
```

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

## Security & privacy

- Data stored in **localStorage** on the device/browser only.  
- No third-party analytics in this MVP.  
- Chart.js loaded from CDN (online first run); service worker caches app shell.  
- Never paste KDP passwords into this app.

---

## Roadmap ideas

- [ ] Real IAP / Stripe for $9.99  
- [ ] Capacitor iOS + Mac wrapper  
- [ ] Amazon Ads CSV ↔ royalty day matching (true ad ROI)  
- [ ] Multi-currency conversion table (user-set rates)  
- [ ] Pen-name and series rollup charts (Premium)  
- [ ] Optional end-to-end encrypted sync  
- [ ] Returns / payment-vs-estimate status fields  

---

## License

Personal project scaffold — use and modify freely for your product. Not affiliated with Amazon, Kobo, Apple, or Draft2Digital.
