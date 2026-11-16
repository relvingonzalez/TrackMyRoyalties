/** Reading report files, and downloading exports. */
import {buildKdpSmartPlan, isExcelFile, loadExcelSupport, readWorkbook} from './importers';

export const SPREADSHEET_ACCEPT = [
  '.csv',
  '.tsv',
  '.txt',
  '.xlsx',
  '.xls',
  '.xlsm',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

/** SHA-256 of the raw bytes, so re-importing the exact same file can be detected
 * regardless of which platform or sheet it's imported as. */
async function hashBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Read a CSV/TSV/TXT or Excel file into:
 * {name, hash, text, sheets, sheetName, kdpSmart}
 * For Excel, `text` is the best-guess sheet as CSV, `sheets` lists every sheet, and
 * `kdpSmart` is set when the workbook is a KDP Orders export whose per-format sheets can
 * be combined.
 */
export async function readReportFile(file) {
  const name = file.name || 'report';
  const bytes = await file.arrayBuffer();
  const hash = await hashBytes(bytes);

  if (isExcelFile(name, file.type)) {
    await loadExcelSupport();
    const workbook = readWorkbook(bytes);
    const kdpPlan = workbook.sheets.length > 1 ? buildKdpSmartPlan(workbook.sheets) : null;
    return {
      name,
      hash,
      text: workbook.text,
      sheets: workbook.sheets,
      sheetName: workbook.bestSheetName,
      kdpSmart: kdpPlan?.ok ? kdpPlan : null,
    };
  }

  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) throw new Error(`${name} looks empty.`);
  return {name, hash, text, sheets: null, sheetName: null, kdpSmart: null};
}

/** readReportFile that reports failure as {error} instead of throwing: {report} | {error}. */
export async function tryReadReportFile(file) {
  try {
    return {report: await readReportFile(file)};
  } catch (error) {
    return {error: error.message || `Couldn't read ${file.name}.`};
  }
}

/** Download the whole ledger as a vault file (restoreVault reads it back and strips the marker). */
export function downloadVault(ledger, brand) {
  const marker = {format: `${brand.slug}-vault`, version: 1, exportedAt: new Date().toISOString()};
  const vault = {...ledger, ['_' + brand.slug]: marker};
  downloadFile(JSON.stringify(vault, null, 2), `${brand.slug}-vault-${Date.now()}.json`, 'application/json');
}

export function csvField(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadFile(content, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([content], {type: mimeType}));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
