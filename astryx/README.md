# TrackMyRoyalties on Astryx

The full app rebuilt with [Astryx](https://github.com/facebook/astryx), Meta's React design system, alongside the classic app. It isn't deployed yet (`astryx/` is in `.vercelignore`); the classic app at the repo root is still the one that ships.

It reuses the classic app's data and parsing code (`js/data.js`, `js/import.js`) unchanged, so both UIs read and write the same IndexedDB data in the same way.

## Run it

Requires Node 20+ (`nvm use 24`).

```bash
cd astryx
npm install
npm run build
cd ..
python3 -m http.server 8787
```

Open **http://localhost:8787/astryx/dist/**. That's the same origin as the classic app (http://localhost:8787/), so you see the same data.

`npm run dev` runs a live-reloading dev server. It's a different origin, so it starts with empty storage.

## Checks

```bash
npm run lint             # ESLint + React Compiler rules (eslint-plugin-react-hooks)
npm run check:compiler   # fails if React Compiler skips any function
npm run build
```

## Versions

- **Astryx** is pinned to exactly `0.7.16` (it's a beta). Upgrade on purpose, then run the checks.
- **React 19** with **React Compiler 1.0** (`babel-plugin-react-compiler`), wired through Vite in `vite.config.js`. `@babel/core` stays on 7: the compiler's AST handling doesn't support Babel 8 yet.
- **SheetJS 0.20.3** from SheetJS's own CDN (npm only has 0.18.5, which has known security issues). Loaded only when an Excel file is opened.

## Code layout

```
src/
  main.jsx            loads saved data, then renders
  App.jsx             app shell, navigation, confirmations, toasts, demo-data actions
  appContext.js       UI services shared with pages (toast, confirm, navigate, filters…)
  options.js          Selector option lists, small text helpers
  core/               the classic app's data model and parsers, re-exported by name
    ledger.js           platforms, aggregation, formatting, persistence
    importers.js        report parsers, export guides, lazy Excel support
    files.js            reading report files, downloads
    platformLogos.js    store logos
  store/ledgerStore.js  the data: read with useLedger(), changed only through its named actions
  components/         page frame, panels, KPI tiles, filters, charts, store logos, vault controls
  dialogs/            add/edit expense and title, merge titles, chart annotation
  pages/              one file per page; import/ holds the Import page's parts
```

## How state works

- The saved data lives in IndexedDB, an external store. Components read it with `useLedger()` (built on `useSyncExternalStore`), not by copying it into React state.
- It's loaded once in `main.jsx`, before the first render, so there's no loading state.
- It changes only through the named actions in `store/ledgerStore.js` (`saveExpense`, `mergeBooks`, `importRoyaltyRows`…). They update immutably, which React Compiler requires: an action gets a draft with fresh copies of each list, and replaces any item it changes instead of editing it.
- There's no `useEffect`, `useMemo`, `useCallback`, or `useRef` in `src/`. The compiler handles memoization, and nothing needs an effect: data loads before render, and save errors and storage usage come from the store.
