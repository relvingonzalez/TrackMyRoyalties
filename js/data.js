/**
 * WideLedger — platforms, storage, demo catalog, aggregation
 */
(function (global) {
  const STORAGE_KEY = "wideledger.v1";

  const PLATFORMS = [
    { id: "kdp", name: "Amazon KDP", short: "KDP", color: "#FF9900", free: true },
    { id: "kobo", name: "Kobo Writing Life", short: "Kobo", color: "#BF1E2E", free: true },
    { id: "d2d", name: "Draft2Digital", short: "D2D", color: "#2B6CB0", free: false },
    { id: "apple", name: "Apple Books", short: "Apple", color: "#A2AAAD", free: false },
    { id: "bn", name: "B&N Press", short: "B&N", color: "#3467B0", free: false },
    { id: "google", name: "Google Play Books", short: "Google", color: "#34A853", free: false },
    { id: "ingram", name: "IngramSpark", short: "Ingram", color: "#5C2D91", free: false },
    { id: "smashwords", name: "Smashwords", short: "SW", color: "#E85D04", free: false },
    { id: "direct", name: "Direct / Shopify", short: "Direct", color: "#95BF47", free: false },
    { id: "other", name: "Other", short: "Other", color: "#718096", free: false },
  ];

  const EXPENSE_CATEGORIES = [
    { id: "ads_amazon", name: "Amazon Ads (AMS)", group: "Advertising" },
    { id: "ads_meta", name: "Meta / Facebook Ads", group: "Advertising" },
    { id: "ads_bookbub", name: "BookBub Ads / Featured", group: "Advertising" },
    { id: "ads_other", name: "Other advertising", group: "Advertising" },
    { id: "cover", name: "Cover design", group: "Production" },
    { id: "editing", name: "Editing / proofreading", group: "Production" },
    { id: "formatting", name: "Formatting / Vellum", group: "Production" },
    { id: "isbn", name: "ISBN / barcodes", group: "Production" },
    { id: "narration", name: "Audiobook narration", group: "Production" },
    { id: "tools", name: "Software & tools", group: "Ops" },
    { id: "website", name: "Website / email", group: "Ops" },
    { id: "promo", name: "Promo copies / ARCs", group: "Marketing" },
    { id: "other", name: "Other expense", group: "Other" },
  ];

  const BOOKS_SEED = [
    { id: "b1", title: "Ember Protocol", series: "Circuit Crown", penName: "A. R. Hale", format: "ebook" },
    { id: "b2", title: "Ember Protocol", series: "Circuit Crown", penName: "A. R. Hale", format: "paperback" },
    { id: "b3", title: "Glass Orchard", series: "Circuit Crown", penName: "A. R. Hale", format: "ebook" },
    { id: "b4", title: "Night Market Heist", series: "Rogue Cartography", penName: "Mira Vale", format: "ebook" },
    { id: "b5", title: "Night Market Heist", series: "Rogue Cartography", penName: "Mira Vale", format: "audiobook" },
    { id: "b6", title: "Letters from the Salt Flats", series: "", penName: "A. R. Hale", format: "ebook" },
    { id: "b7", title: "Winter of Quiet Engines", series: "Circuit Crown", penName: "A. R. Hale", format: "ebook" },
  ];

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  const PRE_DEMO_KEY = "wideledger.preDemo.v1";

  function defaultState() {
    return {
      version: 1,
      premium: false, // derived only after license verify — never trust alone
      licenseKey: "",
      currency: "USD",
      showKenp: true,
      compactMode: false,
      books: [],
      royalties: [],
      expenses: [],
      connectedPlatforms: {},
      importBatches: [], // [{id, platformId, fileName, sheetName, importedAt, rowCount, royaltyTotal}]
      chartAnnotations: [], // [{id, date, label}] — user-pinned markers on the royalties chart
      firstVisit: true,
      isDemo: false, // true when sample author data is loaded
    };
  }

  /** Record metadata about one completed import so it can be reviewed or undone later. */
  function addImportBatch(state, batch) {
    state.importBatches = state.importBatches || [];
    state.importBatches.push(batch);
    return state;
  }

  /** Remove just the rows that came from one specific import (keeps other imports for the same platform). */
  function removeBatch(state, batchId) {
    state.royalties = (state.royalties || []).filter((r) => r.batchId !== batchId);
    state.importBatches = (state.importBatches || []).filter((b) => b.id !== batchId);
    return state;
  }

  /** Wipe every royalty row + import record for one platform (used by "Replace this platform's data"). */
  function removePlatformData(state, platformId) {
    state.royalties = (state.royalties || []).filter((r) => r.platformId !== platformId);
    state.importBatches = (state.importBatches || []).filter((b) => b.platformId !== platformId);
    delete state.connectedPlatforms?.[platformId];
    return state;
  }

  function platformBatches(state, platformId) {
    return (state.importBatches || [])
      .filter((b) => b.platformId === platformId)
      .sort((a, b) => (b.importedAt || "").localeCompare(a.importedAt || ""));
  }

  /** One row per platform that currently has data — for the "Your imports" management table. */
  function importSummary(state) {
    const byPlat = {};
    (state.royalties || []).forEach((r) => {
      if (!byPlat[r.platformId]) byPlat[r.platformId] = { platformId: r.platformId, rows: 0, royalty: 0 };
      byPlat[r.platformId].rows += 1;
      byPlat[r.platformId].royalty += r.royalty || 0;
    });
    return Object.values(byPlat)
      .map((p) => {
        const batches = platformBatches(state, p.platformId);
        const fileNames = [...new Set(batches.map((b) => b.fileName).filter(Boolean))];
        const lastImportedAt = batches[0]?.importedAt || state.connectedPlatforms?.[p.platformId]?.lastImport || null;
        return { ...p, batches, fileNames, lastImportedAt };
      })
      .sort((a, b) => b.royalty - a.royalty);
  }

  function snapshotBeforeDemo(state) {
    // Only snapshot if there is real (non-demo) data worth restoring
    if (state.isDemo) return false;
    const hasData =
      (state.royalties && state.royalties.length) ||
      (state.expenses && state.expenses.length) ||
      (state.books && state.books.length);
    if (!hasData) return false;
    try {
      localStorage.setItem(
        PRE_DEMO_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          state: {
            books: state.books,
            royalties: state.royalties,
            expenses: state.expenses,
            connectedPlatforms: state.connectedPlatforms,
            currency: state.currency,
            showKenp: state.showKenp,
            compactMode: state.compactMode,
            isDemo: false,
          },
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  function loadPreDemoSnapshot() {
    try {
      const raw = localStorage.getItem(PRE_DEMO_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearPreDemoSnapshot() {
    localStorage.removeItem(PRE_DEMO_KEY);
  }

  /** Empty catalog/sales but keep license + prefs */
  function clearCatalogData(state) {
    return {
      ...state,
      books: [],
      royalties: [],
      expenses: [],
      connectedPlatforms: {},
      chartAnnotations: [],
      isDemo: false,
      firstVisit: false,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /** Deterministic-ish demo generator for a realistic wide author */
  function generateDemoData() {
    const books = BOOKS_SEED.map((b) => ({ ...b }));
    const royalties = [];
    const expenses = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const platformWeights = {
      kdp: 0.58,
      kobo: 0.12,
      d2d: 0.1,
      apple: 0.08,
      bn: 0.04,
      google: 0.03,
      ingram: 0.03,
      direct: 0.02,
    };

    // ~14 months of daily-ish data
    for (let day = 420; day >= 0; day--) {
      const date = addDays(today, -day);
      const dow = date.getDay();
      const weekendBoost = dow === 0 || dow === 6 ? 1.25 : 1;
      // Seasonal: Nov–Dec boost, summer dip
      const month = date.getMonth();
      const season = month === 10 || month === 11 ? 1.45 : month >= 5 && month <= 7 ? 0.85 : 1;
      // Launch spikes for a few books
      const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
      const launchSpike = dayOfYear % 97 < 5 ? 2.2 : 1;

      Object.entries(platformWeights).forEach(([platformId, weight]) => {
        // Skip some days for smaller platforms
        if (platformId !== "kdp" && Math.random() > 0.55) return;

        const book = books[Math.floor(Math.random() * books.length)];
        const baseRoyalty = (8 + Math.random() * 42) * weight * weekendBoost * season * launchSpike;
        const units = Math.max(0, Math.round((baseRoyalty / (3 + Math.random() * 4)) * (0.7 + Math.random())));
        let kenp = 0;
        if (platformId === "kdp" && book.format === "ebook" && Math.random() > 0.25) {
          kenp = Math.round(400 + Math.random() * 12000);
          // KU page-read royalty estimate ~ $0.004 per page (varies)
          royalties.push({
            id: uid("r"),
            date: isoDate(date),
            platformId,
            bookId: book.id,
            title: book.title,
            royalty: +(kenp * 0.0042 * (0.9 + Math.random() * 0.2)).toFixed(2),
            units: 0,
            kenp,
            type: "ku",
            format: "ku",
            currency: "USD",
          });
        }

        if (units > 0 || baseRoyalty > 2) {
          royalties.push({
            id: uid("r"),
            date: isoDate(date),
            platformId,
            bookId: book.id,
            title: book.title,
            royalty: +baseRoyalty.toFixed(2),
            units,
            kenp: 0,
            type: "sale",
            format: book.format || "ebook",
            currency: "USD",
          });
        }
      });
    }

    // Expenses over the year. platform: set only where the spend is genuinely tied to one
    // store (Amazon Ads only ever drives Amazon/KDP sales) — cross-platform costs like
    // editing, covers, or Meta/BookBub ads (which drive whichever store link is used) stay
    // general, same as a real author's spend would be.
    const expensePlan = [
      { daysAgo: 10, cat: "ads_amazon", amount: 185, note: "AMS — Ember Protocol", platform: "kdp" },
      { daysAgo: 12, cat: "ads_amazon", amount: 210, note: "AMS — series push", platform: "kdp" },
      { daysAgo: 18, cat: "ads_meta", amount: 95, note: "Meta retargeting" },
      { daysAgo: 25, cat: "ads_bookbub", amount: 320, note: "Featured Deal deposit" },
      { daysAgo: 40, cat: "editing", amount: 650, note: "Line edit — Winter of Quiet Engines" },
      { daysAgo: 55, cat: "cover", amount: 400, note: "Cover + series branding" },
      { daysAgo: 70, cat: "ads_amazon", amount: 160, note: "AMS", platform: "kdp" },
      { daysAgo: 90, cat: "formatting", amount: 0, note: "Vellum (amortized)" },
      { daysAgo: 100, cat: "tools", amount: 29, note: "Publisher Rocket" },
      { daysAgo: 120, cat: "website", amount: 16, note: "Host + ConvertKit" },
      { daysAgo: 140, cat: "isbn", amount: 295, note: "Bowker 10-pack" },
      { daysAgo: 160, cat: "ads_amazon", amount: 140, note: "AMS", platform: "kdp" },
      { daysAgo: 180, cat: "promo", amount: 45, note: "ARC mailing" },
      { daysAgo: 200, cat: "narration", amount: 1200, note: "ACX PFH Night Market" },
      { daysAgo: 220, cat: "ads_meta", amount: 75, note: "Launch ads" },
      { daysAgo: 250, cat: "editing", amount: 480, note: "Copyedit Glass Orchard" },
      { daysAgo: 280, cat: "ads_amazon", amount: 190, note: "AMS", platform: "kdp" },
      { daysAgo: 300, cat: "cover", amount: 350, note: "Paperback wrap" },
      { daysAgo: 330, cat: "tools", amount: 120, note: "Annual software" },
      { daysAgo: 360, cat: "ads_bookbub", amount: 180, note: "CPC test" },
      { daysAgo: 390, cat: "other", amount: 50, note: "Conference swag" },
    ];

    expensePlan.forEach((e) => {
      if (e.amount <= 0) return;
      expenses.push({
        id: uid("e"),
        date: isoDate(addDays(today, -e.daysAgo)),
        categoryId: e.cat,
        platformId: e.platform || null,
        amount: e.amount,
        note: e.note,
        bookId: null,
        recurring: false,
      });
    });

    // Monthly website + tools as recurring-ish
    for (let m = 0; m < 14; m++) {
      expenses.push({
        id: uid("e"),
        date: isoDate(addDays(today, -(m * 30 + 3))),
        categoryId: "website",
        amount: 29,
        note: "Email list + site",
        bookId: null,
        recurring: true,
      });
    }

    const connectedPlatforms = {};
    Object.keys(platformWeights).forEach((id) => {
      connectedPlatforms[id] = { connected: true, lastImport: isoDate(today), method: "demo" };
    });

    return {
      version: 1,
      premium: false,
      licenseKey: "", // demo stays free until you apply a signed license
      currency: "USD",
      showKenp: true,
      compactMode: false,
      books,
      royalties,
      expenses,
      connectedPlatforms,
      firstVisit: false,
      isDemo: true,
    };
  }

  function parseISO(d) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day, 12, 0, 0, 0);
  }

  function rangeBounds(rangeKey, customFrom, customTo) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date(0);

    if (rangeKey === "7d") start = addDays(end, -7);
    else if (rangeKey === "30d") start = addDays(end, -30);
    else if (rangeKey === "90d") start = addDays(end, -90);
    else if (rangeKey === "12m") start = addDays(end, -365);
    else if (rangeKey === "ytd") start = new Date(end.getFullYear(), 0, 1);
    else if (rangeKey === "all") start = new Date(0);
    else if (rangeKey === "custom") {
      start = customFrom ? parseISO(customFrom) : addDays(end, -30);
      if (customTo) {
        const t = parseISO(customTo);
        t.setHours(23, 59, 59, 999);
        return { start, end: t };
      }
    }

    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function inRange(dateStr, bounds) {
    const d = parseISO(dateStr);
    return d >= bounds.start && d <= bounds.end;
  }

  function filterRoyalties(state, { range, platformId, from, to }) {
    const bounds = rangeBounds(range, from, to);
    return state.royalties.filter((r) => {
      if (!inRange(r.date, bounds)) return false;
      if (platformId && platformId !== "all" && r.platformId !== platformId) return false;
      return true;
    });
  }

  function filterExpenses(state, { range, platformId, from, to }) {
    const bounds = rangeBounds(range, from, to);
    return state.expenses.filter((e) => {
      if (!inRange(e.date, bounds)) return false;
      // Expenses with no platformId are general/unattributed (editing, ISBNs, tools…) —
      // they count toward the "all platforms" total but never toward one platform's spend.
      if (platformId && platformId !== "all" && e.platformId !== platformId) return false;
      return true;
    });
  }

  function sum(arr, key) {
    return arr.reduce((a, x) => a + (Number(x[key]) || 0), 0);
  }

  function aggregate(state, filters) {
    const royalties = filterRoyalties(state, filters);
    const expenses = filterExpenses(state, filters);
    const income = sum(royalties, "royalty");
    const spend = sum(expenses, "amount");
    const units = sum(royalties, "units");
    const kenp = sum(royalties, "kenp");
    const kuIncome = sum(
      royalties.filter((r) => r.type === "ku"),
      "royalty"
    );
    const saleIncome = income - kuIncome;

    const byPlatform = {};
    royalties.forEach((r) => {
      if (!byPlatform[r.platformId]) byPlatform[r.platformId] = { royalty: 0, units: 0, kenp: 0, spend: 0, net: 0 };
      byPlatform[r.platformId].royalty += r.royalty;
      byPlatform[r.platformId].units += r.units || 0;
      byPlatform[r.platformId].kenp += r.kenp || 0;
    });

    // Per-platform spend, independent of the filters.platformId scoping above (so a
    // single-platform view's byPlatform entry still carries its own real spend). Expenses
    // with no platformId are general/unattributed and excluded — they only ever count
    // toward the "all platforms" totals (income/spend/net at the top of this function).
    const expensesInRange = filterExpenses(state, { range: filters.range, from: filters.from, to: filters.to });
    let generalSpend = 0;
    expensesInRange.forEach((e) => {
      if (!e.platformId) {
        generalSpend += e.amount;
        return;
      }
      if (!byPlatform[e.platformId]) byPlatform[e.platformId] = { royalty: 0, units: 0, kenp: 0, spend: 0, net: 0 };
      byPlatform[e.platformId].spend += e.amount;
    });
    Object.values(byPlatform).forEach((p) => {
      p.net = p.royalty - p.spend;
    });

    const byBook = {};
    royalties.forEach((r) => {
      const key = r.bookId || r.title || "unknown";
      if (!byBook[key]) {
        const book = state.books.find((b) => b.id === key);
        byBook[key] = {
          bookId: key,
          title: book?.title || r.title || "Unknown",
          series: book?.series || "",
          penName: book?.penName || "",
          format: book?.format || r.format || "",
          royalty: 0,
          units: 0,
          kenp: 0,
        };
      }
      byBook[key].royalty += r.royalty;
      byBook[key].units += r.units || 0;
      byBook[key].kenp += r.kenp || 0;
    });

    // ebook vs paperback vs hardcover vs audiobook vs KU/other
    const byFormat = {};
    royalties.forEach((r) => {
      const book = state.books.find((b) => b.id === r.bookId);
      let fmt = normalizeFormat(
        r.format || book?.format || (r.type === "ku" ? "ku" : "")
      );
      if (r.type === "ku") fmt = "ku";
      if (!byFormat[fmt]) byFormat[fmt] = { royalty: 0, units: 0, kenp: 0, rows: 0 };
      byFormat[fmt].royalty += r.royalty || 0;
      byFormat[fmt].units += r.units || 0;
      byFormat[fmt].kenp += r.kenp || 0;
      byFormat[fmt].rows += 1;
    });

    const byCategory = {};
    expenses.forEach((e) => {
      byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.amount;
    });

    // Daily series
    const dayMap = {};
    royalties.forEach((r) => {
      if (!dayMap[r.date]) dayMap[r.date] = { date: r.date, royalty: 0, expense: 0 };
      dayMap[r.date].royalty += r.royalty;
    });
    expenses.forEach((e) => {
      if (!dayMap[e.date]) dayMap[e.date] = { date: e.date, royalty: 0, expense: 0 };
      dayMap[e.date].expense += e.amount;
    });
    const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    // Monthly for tax
    const monthMap = {};
    state.royalties.forEach((r) => {
      const m = r.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, royalty: 0, expense: 0 };
      monthMap[m].royalty += r.royalty;
    });
    state.expenses.forEach((e) => {
      const m = e.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, royalty: 0, expense: 0 };
      monthMap[m].expense += e.amount;
    });
    const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    return {
      income,
      spend,
      net: income - spend,
      units,
      kenp,
      kuIncome,
      saleIncome,
      byPlatform,
      byBook,
      byFormat,
      byCategory,
      generalSpend,
      daily,
      monthly,
      royaltyCount: royalties.length,
      expenseCount: expenses.length,
      royalties,
      expenses,
    };
  }

  function freePlatformLimit(state) {
    return state.premium ? Infinity : 2;
  }

  function canUsePlatform(state, platformId) {
    if (state.premium) return true;
    const p = PLATFORMS.find((x) => x.id === platformId);
    if (p?.free) return true;
    // Count platforms that already have data
    const used = new Set(state.royalties.map((r) => r.platformId));
    if (used.has(platformId)) return true;
    if (used.size < 2) return true;
    return false;
  }

  function currencySymbol(code) {
    return (
      {
        USD: "$",
        EUR: "€",
        GBP: "£",
        CAD: "C$",
        AUD: "A$",
      }[code] || "$"
    );
  }

  const KNOWN_FORMATS = ["ebook", "paperback", "hardcover", "audiobook", "ku", "unknown"];

  /**
   * Normalize store format labels → ebook | paperback | hardcover | audiobook | ku | unknown.
   * Never returns raw junk (e.g. KDP royalty rates like "70%" or "n/a").
   */
  function normalizeFormat(raw) {
    if (raw == null || raw === "") return "unknown";
    let s = String(raw).toLowerCase().trim();
    if (!s || s === "—" || s === "-" || s === "n/a" || s === "na" || s === "null") return "unknown";

    // KDP Royalty % column values look like 70%, 60%, 35%, 0.7 — not formats
    if (/^[\d.,]+\s*%?$/.test(s)) return "unknown";
    if (/percent|percentage|rate only/i.test(s) && !/ebook|paper|hard|audio|kindle/i.test(s)) {
      return "unknown";
    }

    // Strip common KDP suffixes for matching
    s = s.replace(/\s+royalty\b/g, " ").replace(/\s+/g, " ").trim();

    if (/\bku\b|kenp|kindle\s*unlimited|page\s*read|kdp\s*select|normalized\s*pages/.test(s)) {
      return "ku";
    }
    if (/hard\s*cover|hardcover|hardback|\bhc\b/.test(s)) return "hardcover";
    if (/paper\s*back|paperback|soft\s*cover|softcover|\bprint\b/.test(s)) return "paperback";
    if (/\baudio|audible|mp3|unabridged/.test(s)) return "audiobook";
    // ebook last among product types (kindle edition = ebook)
    if (/e-?book|kindle|mobi|epub|digital|\bebook\b/.test(s)) return "ebook";

    // Already a known id
    if (KNOWN_FORMATS.includes(s)) return s;

    return "unknown";
  }

  function formatLabel(fmt) {
    const id = normalizeFormat(fmt);
    return (
      {
        ebook: "Ebook",
        paperback: "Paperback",
        hardcover: "Hardcover",
        audiobook: "Audiobook",
        ku: "KU / page reads",
        unknown: "Unknown / unstated",
      }[id] || "Unknown / unstated"
    );
  }

  function formatMoney(amount, currency = "USD") {
    const sym = currencySymbol(currency);
    const n = Number(amount) || 0;
    const sign = n < 0 ? "-" : "";
    return `${sign}${sym}${Math.abs(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatInt(n) {
    return Math.round(Number(n) || 0).toLocaleString();
  }

  global.WideLedgerData = {
    PLATFORMS,
    EXPENSE_CATEGORIES,
    STORAGE_KEY,
    PRE_DEMO_KEY,
    uid,
    isoDate,
    loadState,
    saveState,
    defaultState,
    generateDemoData,
    snapshotBeforeDemo,
    loadPreDemoSnapshot,
    clearPreDemoSnapshot,
    clearCatalogData,
    addImportBatch,
    removeBatch,
    removePlatformData,
    platformBatches,
    importSummary,
    rangeBounds,
    filterRoyalties,
    filterExpenses,
    aggregate,
    freePlatformLimit,
    canUsePlatform,
    formatMoney,
    formatInt,
    currencySymbol,
    normalizeFormat,
    formatLabel,
  };
})(window);
