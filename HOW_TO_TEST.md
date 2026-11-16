# How to test TrackMyRoyalties

## Run it

**Browser** (needs Node.js 22+):

```bash
npm ci
npm run build
npx vite preview --port 8787
```

Open **http://localhost:8787**. Saved data belongs to that exact address, so keep using the same port to keep your test data.

**Desktop (Mac):** double-click **Launch TrackMyRoyalties.command**. It builds the app when needed, then opens a native window (port 8788, with its own saved data). Nothing else may be using port 8788.

## Before you commit

```bash
npm run lint             # ESLint, including React Compiler rules
npm run check:compiler   # fails if React Compiler skips any component
npm run build
```

## Checklist

- [ ] First visit (private window): Welcome page → **Explore with demo data** and **Start empty** both work
- [ ] Import: the CSVs in `sample-data/` one at a time and several at once; a KDP Orders (Lifetime) .xlsx combines its per-format sheets; "Replace my existing data" works
- [ ] Expenses: add, edit, remove; import an expense CSV from **Import from file**
- [ ] Titles: change a format, edit a title, merge two titles (the merge icon at the end of a row)
- [ ] Dashboard: range and platform filters, an annotation; Platforms cards open that store's dashboard
- [ ] Tax & export: CSV and JSON downloads
- [ ] Settings: theme, currency, compact layout; export a vault, then **Reset all data**, then restore the vault
- [ ] Reload after making changes: everything is still there
- [ ] Phone width: the menu opens, nothing scrolls sideways

## Known limits

- Keep **one tab** of the app open at a time: two tabs can overwrite each other's changes.
- A change made in the instant before a reload or closing the window can be lost with very large ledgers (tens of thousands of rows), because saving happens in the background.
