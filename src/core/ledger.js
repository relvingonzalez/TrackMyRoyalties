/**
 * The ledger's data model: platforms, expense categories, aggregation, formatting,
 * IndexedDB persistence, and the demo catalog.
 *
 * The logic lives in classic/data.js, carried over unchanged from the original
 * plain-JavaScript app, so existing users' saved data keeps loading exactly as before. It's
 * a plain script that attaches itself to `window`; this module loads it once and
 * re-exports its functions by name.
 */
import './classic/brand.js'; // must load first: data.js derives its storage key from it
import './classic/data.js';

const data = window.WideLedgerData;

/** Product name and slug (for exported file names). */
export const brand = window.Brand;

export const {
  // Reference data
  PLATFORMS,
  EXPENSE_CATEGORIES,
  // Ids and dates
  uid,
  rangeBounds,
  // Aggregation
  aggregate,
  importSummary,
  findImportBatchByHash,
  // State transforms (they mutate the object they're given: only call them on a draft)
  defaultState,
  generateDemoData,
  clearCatalogData,
  addImportBatch,
  removePlatformData,
  // Formatting
  formatMoney,
  formatInt,
  formatLabel,
  normalizeFormat,
  currencySymbol,
  // Persistence (used by store/ledgerStore.js only)
  loadState,
  saveState,
  flushSaves,
  onSaveError,
  storageEstimate,
  snapshotBeforeDemo,
  loadPreDemoSnapshot,
  clearPreDemoSnapshot,
} = data;

export function findPlatform(platformId) {
  return PLATFORMS.find(platform => platform.id === platformId) || null;
}

export function findCategory(categoryId) {
  return EXPENSE_CATEGORIES.find(category => category.id === categoryId) || null;
}
