import {EXPENSE_CATEGORIES, rangeBounds} from '../../core/ledger';

/**
 * After an import, make sure the selected date range shows it: the default "Last 30 days"
 * would hide most of a multi-year report and look like lost data. Returns the filters to
 * use plus a sentence for the success message ('' when nothing changed).
 */
export function filtersShowingImport(filters, importedRows) {
  const earliest = importedRows
    .map(row => row.date)
    .filter(Boolean)
    .sort()[0];
  if (!earliest || filters.range === 'all') return {filters, note: ''};
  const {start} = rangeBounds(filters.range, filters.from, filters.to);
  if (new Date(`${earliest}T12:00:00`) >= start) return {filters, note: ''};
  return {filters: {...filters, range: 'all'}, note: ' Switched the date range to "All time" so you can see it.'};
}

/** Best-matching expense category for a free-text category from a file, or 'other'. */
export function guessExpenseCategory(rawCategory) {
  if (!rawCategory) return 'other';
  const text = String(rawCategory).toLowerCase().trim();
  const match =
    EXPENSE_CATEGORIES.find(category => category.id === text) ||
    EXPENSE_CATEGORIES.find(category => {
      const name = category.name.toLowerCase();
      return name === text || name.includes(text) || text.includes(name);
    });
  return match?.id || 'other';
}

/**
 * Open a store's report page. In the desktop app the embedded window has no store login,
 * so it goes through the Python bridge to the user's real browser; on the web, a new tab.
 */
export function openExternalUrl(url) {
  const desktopBridge = window.pywebview?.api;
  if (desktopBridge?.open_external) desktopBridge.open_external(url);
  else window.open(url, '_blank', 'noopener');
}
