/**
 * The ledger store: the one place the app's data lives and changes.
 *
 * The data is persisted in IndexedDB (via core/ledger.js), which makes it an external
 * store, so components read it with useSyncExternalStore (useLedger / useLedgerStatus)
 * rather than copying it into React state. Every change goes through a named action below.
 *
 * State is immutable, as React Compiler requires (it memoizes on reference identity):
 * update() hands each action a draft with fresh copies of every collection, and an action
 * that changes an item replaces it (`{...book, format}`) instead of editing it in place,
 * because unchanged items are shared with the previous state.
 */
import {useSyncExternalStore} from 'react';
import {
  addImportBatch,
  clearCatalogData,
  clearPreDemoSnapshot,
  defaultState,
  generateDemoData,
  loadPreDemoSnapshot,
  loadState,
  normalizeFormat,
  onSaveError,
  removePlatformData,
  saveState,
  snapshotBeforeDemo,
  storageEstimate,
  uid,
} from '../core/ledger';
import {toIsoDate} from '../options';

// ---------- Store plumbing ----------

let ledger = null;
let status = {saveError: null, storageUsage: null, hasPreDemoSnapshot: false, setAsideCount: 0};
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach(listener => listener());
}

function setStatus(changes) {
  status = {...status, ...changes};
  notify();
}

onSaveError(error => setStatus({saveError: error}));

async function refreshStorageUsage() {
  setStatus({storageUsage: await storageEstimate()});
}

// ---------- Repairing malformed data ----------

const isIsoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function toNumber(value) {
  const number = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

/** The item with these fields as numbers, or the same item when they already are. */
function withNumbers(item, fields) {
  if (fields.every(field => item[field] == null || typeof item[field] === 'number')) return item;
  return {...item, ...Object.fromEntries(fields.map(field => [field, toNumber(item[field])]))};
}

/**
 * Make older or hand-edited data safe to display: numbers stored as text become numbers,
 * and rows with no valid date (which the shared aggregation code can't handle) move to
 * `setAside` instead of being deleted, so they survive in saves and vault backups.
 * Returns {ledger, setAsideCount}.
 */
function repairLedger(raw) {
  const setAside = {royalties: [...(raw.setAside?.royalties || [])], expenses: [...(raw.setAside?.expenses || [])]};
  const before = setAside.royalties.length + setAside.expenses.length;
  const keepDated = (rows, bucket) =>
    (rows || []).filter(row => {
      if (isIsoDate(row?.date)) return true;
      bucket.push(row);
      return false;
    });
  const royalties = keepDated(raw.royalties, setAside.royalties).map(row => withNumbers(row, ['royalty', 'units', 'kenp']));
  const expenses = keepDated(raw.expenses, setAside.expenses).map(expense => withNumbers(expense, ['amount']));
  const setAsideCount = setAside.royalties.length + setAside.expenses.length - before;
  const repaired = {...raw, books: raw.books || [], royalties, expenses};
  if (setAside.royalties.length || setAside.expenses.length) repaired.setAside = setAside;
  return {ledger: repaired, setAsideCount};
}

/** Load saved data from IndexedDB. Called once, before the app first renders. */
export async function loadLedger() {
  const {ledger: repaired, setAsideCount} = repairLedger(await loadState());
  ledger = repaired;
  status = {...status, hasPreDemoSnapshot: !!loadPreDemoSnapshot(), setAsideCount};
  if (setAsideCount > 0) saveState(ledger); // persist the repair, so it only happens once
  refreshStorageUsage();
}

/** The current ledger outside React (e.g. the crash screen's backup button). */
export function getLedgerSnapshot() {
  return ledger;
}

/** The current ledger. Re-renders the component whenever it changes. */
export function useLedger() {
  return useSyncExternalStore(subscribe, () => ledger);
}

/** {saveError, storageUsage: {usage, quota} | null, hasPreDemoSnapshot} */
export function useLedgerStatus() {
  return useSyncExternalStore(subscribe, () => status);
}

function replaceLedger(next) {
  ledger = next;
  notify();
  saveState(next).then(refreshStorageUsage);
}

/** Fresh top-level object with fresh copies of every collection (see file comment). */
function createDraft(current) {
  return {
    ...current,
    books: [...current.books],
    royalties: [...current.royalties],
    expenses: [...current.expenses],
    importBatches: [...(current.importBatches || [])],
    chartAnnotations: [...(current.chartAnnotations || [])],
    connectedPlatforms: {...current.connectedPlatforms},
  };
}

function update(change) {
  const draft = createDraft(ledger);
  change(draft);
  replaceLedger(draft);
}

const replaceWhere = (items, isMatch, changes) => items.map(item => (isMatch(item) ? {...item, ...changes} : item));

// ---------- Preferences ----------

/** key: 'currency' | 'showKenp' | 'compactMode' | 'theme' | 'firstVisit' */
export function setPreference(key, value) {
  update(draft => {
    draft[key] = value;
  });
}

// ---------- Chart annotations ----------

export function addAnnotation({date, label}) {
  update(draft => {
    draft.chartAnnotations.push({id: uid('an'), date, label});
  });
}

export function removeAnnotation(annotationId) {
  update(draft => {
    draft.chartAnnotations = draft.chartAnnotations.filter(annotation => annotation.id !== annotationId);
  });
}

// ---------- Expenses ----------

/** Add (no expenseId) or edit an expense. fields: {date, categoryId, platformId, amount, note} */
export function saveExpense(expenseId, fields) {
  update(draft => {
    if (expenseId) {
      draft.expenses = replaceWhere(draft.expenses, expense => expense.id === expenseId, fields);
    } else {
      draft.expenses.push({id: uid('e'), ...fields, bookId: null, recurring: false});
    }
  });
}

export function removeExpense(expenseId) {
  update(draft => {
    draft.expenses = draft.expenses.filter(expense => expense.id !== expenseId);
  });
}

/** rows: [{note, amount, date, categoryId, platformId}]. Returns {count, total}. */
export function importExpenseRows(rows, {fileName, fileHash}) {
  const batchId = uid('batch');
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  update(draft => {
    rows.forEach(row => draft.expenses.push({id: uid('e'), ...row, bookId: null, recurring: false, batchId}));
    addImportBatch(draft, {
      id: batchId,
      platformId: null,
      fileName,
      fileHash,
      kind: 'expense',
      sheetName: null,
      importedAt: new Date().toISOString(),
      rowCount: rows.length,
      royaltyTotal: total, // stored total; for expense batches it's the expense total
    });
  });
  return {count: rows.length, total};
}

// ---------- Titles ----------

/** Add (no bookId) or edit a title. fields: {title, series, seriesNumber, penName, format, tags, aliases} */
export function saveBook(bookId, fields) {
  update(draft => {
    if (bookId) draft.books = replaceWhere(draft.books, book => book.id === bookId, fields);
    else draft.books.push({id: uid('b'), ...fields});
  });
}

/** Set a title's format and re-tag its sale rows (not KU rows) to match. Returns rows re-tagged. */
export function setBookFormat(bookId, format) {
  const isSaleRow = row => row.bookId === bookId && row.type !== 'ku';
  const retagged = ledger.royalties.filter(isSaleRow).length;
  update(draft => {
    draft.books = replaceWhere(draft.books, book => book.id === bookId, {format});
    draft.royalties = replaceWhere(draft.royalties, isSaleRow, {format});
  });
  return retagged;
}

/**
 * Merge a title into another that's really the same book (platforms often report titles
 * slightly differently). Moves its sale rows, combines identifiers, and removes it.
 * Returns the number of rows moved.
 */
export function mergeBooks(sourceId, targetId) {
  const source = ledger.books.find(book => book.id === sourceId);
  const target = ledger.books.find(book => book.id === targetId);
  const moved = ledger.royalties.filter(row => row.bookId === sourceId).length;
  const identifiers = [...new Set([...(target.identifiers || []), ...(source.identifiers || [])])];
  update(draft => {
    draft.royalties = replaceWhere(draft.royalties, row => row.bookId === sourceId, {bookId: targetId});
    draft.books = replaceWhere(
      draft.books.filter(book => book.id !== sourceId),
      book => book.id === targetId,
      {identifiers},
    );
  });
  return moved;
}

// ---------- Royalty imports ----------

/**
 * Link each imported row to a catalog title, creating titles as needed. Matches by
 * ASIN/ISBN first (titles vary by store even for the same book), then by title + format.
 * Replaces any title it adds an identifier to. Returns the new rows.
 */
function linkRowsToBooks(books, rows) {
  return rows.map(row => {
    const format = normalizeFormat(row.format || (row.type === 'ku' ? 'ku' : 'unknown'));
    const title = (row.title || '').toLowerCase();
    let index = row.identifier ? books.findIndex(book => (book.identifiers || []).includes(row.identifier)) : -1;
    if (index === -1) {
      index = books.findIndex(book => book.title.toLowerCase() === title && normalizeFormat(book.format) === format);
    }
    if (index === -1 && row.title) {
      const newFormat = format === 'unknown' ? 'ebook' : format;
      books.push({id: uid('b'), title: row.title, series: '', penName: '', format: newFormat, identifiers: []});
      index = books.length - 1;
    }
    if (index === -1) return {...row, format};
    const book = books[index];
    if (row.identifier && !(book.identifiers || []).includes(row.identifier)) {
      books[index] = {...book, identifiers: [...(book.identifiers || []), row.identifier]};
    }
    return {...row, format, bookId: book.id};
  });
}

/**
 * Commit parsed royalty rows as one import batch. With replace, the platform's existing
 * rows are removed first (for re-uploading a corrected report). Returns {rowCount, royaltyTotal}.
 */
export function importRoyaltyRows(rows, platformId, {fileName, fileHash, sheetName, replace}) {
  const batchId = uid('batch');
  const royaltyTotal = rows.reduce((sum, row) => sum + (row.royalty || 0), 0);
  update(draft => {
    if (replace) removePlatformData(draft, platformId);
    const tagged = rows.map(row => ({...row, platformId, batchId}));
    draft.royalties.push(...linkRowsToBooks(draft.books, tagged));
    addImportBatch(draft, {
      id: batchId,
      platformId,
      fileName: fileName || 'manual',
      fileHash: fileHash || null,
      kind: 'royalty',
      sheetName: sheetName || null,
      importedAt: new Date().toISOString(),
      rowCount: rows.length,
      royaltyTotal,
    });
    draft.connectedPlatforms[platformId] = {connected: true, lastImport: toIsoDate(), method: 'csv'};
  });
  return {rowCount: rows.length, royaltyTotal};
}

/** One hand-entered royalty row (when a store only shows a monthly total). */
export function addManualRoyalty({date, platformId, title, royalty, units, kenp}) {
  update(draft => {
    const name = title.trim() || 'Manual entry';
    let book = draft.books.find(b => b.title.toLowerCase() === name.toLowerCase());
    if (!book && title.trim()) {
      book = {id: uid('b'), title: name, series: '', penName: '', format: 'ebook'};
      draft.books.push(book);
    }
    draft.royalties.push({
      id: uid('r'),
      date,
      platformId,
      bookId: book?.id || null,
      title: name,
      royalty,
      units,
      kenp,
      type: kenp > 0 && !(units > 0) ? 'ku' : 'sale',
      currency: 'USD',
    });
    draft.connectedPlatforms[platformId] = {connected: true, lastImport: date, method: 'manual'};
  });
}

/** Remove every royalty row and import record for one platform. */
export function clearPlatform(platformId) {
  update(draft => {
    removePlatformData(draft, platformId);
  });
}

// ---------- Whole-ledger actions ----------

/** Swap in demo data, keeping display preferences. Snapshots real data first so it can be restored. */
export function loadDemo() {
  if (!ledger.isDemo && snapshotBeforeDemo(ledger)) setStatus({hasPreDemoSnapshot: true});
  const {currency, showKenp, compactMode, theme} = ledger;
  replaceLedger({...generateDemoData(), currency, showKenp, compactMode, theme, isDemo: true});
}

/** Remove all titles, royalties, and expenses; keep preferences. */
export function clearCatalog() {
  replaceLedger(clearCatalogData(ledger));
}

/** Bring back the data that was there before the demo was loaded. Returns false if there's none. */
export function restorePreDemo() {
  const snapshot = loadPreDemoSnapshot();
  if (!snapshot?.state) return false;
  clearPreDemoSnapshot();
  setStatus({hasPreDemoSnapshot: false});
  replaceLedger({...defaultState(), ...ledger, ...snapshot.state, isDemo: false, firstVisit: false});
  return true;
}

/** Replace everything with a parsed vault file's contents. Returns how many undated rows were set aside. */
export function restoreVault(vault) {
  const merged = {...defaultState(), ...vault, isDemo: !!vault.isDemo};
  Object.keys(merged)
    .filter(key => key.startsWith('_')) // export markers like _trackmyroyalties
    .forEach(key => delete merged[key]);
  const {ledger: repaired, setAsideCount} = repairLedger(merged);
  setStatus({setAsideCount});
  replaceLedger(repaired);
  return setAsideCount;
}

export function resetLedger() {
  replaceLedger({...defaultState(), firstVisit: false});
}
