/**
 * The ledger's data model: platforms, expense categories, aggregation, formatting,
 * IndexedDB persistence, and the demo catalog.
 *
 * This is the classic app's js/data.js, shared as-is so both UIs read and write the same
 * data the same way. That file is a plain script that attaches itself to `window`; this
 * module loads it once and re-exports its functions by name.
 */
import '../../../js/brand.js'; // must load first: data.js derives its storage key from it
import '../../../js/data.js';

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
