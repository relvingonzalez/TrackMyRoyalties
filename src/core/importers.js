/**
 * Report parsers: royalty CSV/Excel for every store, KDP multi-sheet workbooks, and
 * expense lists, plus the per-store export guides.
 *
 * The logic lives in classic/import.js, carried over unchanged from the original app (see
 * core/ledger.js).
 */
import './ledger.js'; // import.js expects data.js to have loaded
import './classic/import.js';

const importers = window.WideLedgerImport;

export const {
  EXPORT_GUIDES,
  isExcelFile,
  readWorkbook,
  buildKdpSmartPlan,
  previewImport,
  importRoyaltyCSV,
  importExpensesFile,
} = importers;

/**
 * import.js reads Excel through a global `XLSX`. SheetJS is the largest dependency and most
 * visits never open an Excel file, so it's loaded the first time one is.
 */
export async function loadExcelSupport() {
  if (!window.XLSX) window.XLSX = await import('xlsx');
}
