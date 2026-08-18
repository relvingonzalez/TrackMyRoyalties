/**
 * CSV parsers for common author royalty report shapes
 */
(function (global) {
  const { uid, PLATFORMS } = global.WideLedgerData;

  function parseCSV(text) {
    const rows = [];
    let i = 0;
    let field = "";
    let row = [];
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === "," || c === "\t" || c === ";") {
        row.push(field.trim());
        field = "";
        i++;
        continue;
      }
      if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field.trim());
        field = "";
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        i++;
        continue;
      }
      field += c;
      i++;
    }
    if (field.length || row.length) {
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
    }
    return rows;
  }

  /**
   * B&N / Excel often export "CSV" that is tab- or multi-space-separated,
   * or has title lines where a whole row is one cell.
   */
  function parseFlexibleRows(text) {
    let rows = parseCSV(text);
    const multi = rows.filter((r) => r.length >= 3).length;
    if (multi >= 2) return rows;

    // Re-parse line-by-line with broader delimiters
    rows = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\uFEFF/, "").trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.includes("\t")) return line.split("\t").map((c) => c.trim()).filter(Boolean);
        // quoted CSV
        if (/,"/.test(line) || line.includes(",")) {
          const r = parseCSV(line + "\n");
          if (r[0] && r[0].length >= 2) return r[0];
        }
        // 2+ spaces (common when pasting Excel)
        if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
        return [line];
      });
    return rows;
  }

  /** Pull year from B&N "Sales by Month - 2024" style preambles */
  function extractReportContext(rows) {
    let year = null;
    let publisher = "";
    let reportKind = "";
    const scan = rows.slice(0, 25);
    for (const row of scan) {
      const line = row.join(" ").trim();
      let m = line.match(/sales\s+by\s+month\s*[-–—:]\s*(\d{4})/i);
      if (m) {
        year = Number(m[1]);
        reportKind = "month";
      }
      m = line.match(/sales\s+by\s+year\s*[-–—:]\s*(\d{4})/i);
      if (m) {
        year = Number(m[1]);
        reportKind = "year";
      }
      m = line.match(/\b(20\d{2})\b/);
      if (!year && m && /sales|report|month|year/i.test(line)) {
        year = Number(m[1]);
      }
      if (/publishing|press|llc|inc\b/i.test(line) && !/barnes|noble|vendor number/i.test(line) && line.length < 80) {
        if (!publisher) publisher = line.replace(/\s+/g, " ").trim();
      }
    }
    return { year, publisher, reportKind };
  }

  function parseMoney(val) {
    if (val == null || val === "") return 0;
    let s = String(val).trim();
    // Accounting negatives: (12.34)
    const paren = s.match(/^\((.+)\)$/);
    if (paren) s = "-" + paren[1];
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  const MONTHS = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };

  function ymd(y, m, d) {
    const yy = Number(y);
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    if (yy < 1990 || yy > 2100) return null;
    if (Number(mm) < 1 || Number(mm) > 12) return null;
    if (Number(dd) < 1 || Number(dd) > 31) return null;
    return `${yy}-${mm}-${dd}`;
  }

  function excelSerialToDate(n) {
    // Excel serial day (Windows 1900 system). 1 = 1899-12-31-ish; 25569 = 1970-01-01
    if (!Number.isFinite(n) || n < 20000 || n > 80000) return null;
    const utc = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function parseDateLoose(val, opts = {}) {
    if (val == null || val === "") return null;
    const defaultYear = opts.defaultYear || null;

    // Excel sometimes gives a real number
    if (typeof val === "number") {
      return excelSerialToDate(val) || null;
    }

    let s = String(val).trim();
    if (!s || /^n\/?a$/i.test(s) || s === "-" || s === "—") return null;

    // Date *range* strings, e.g. Draft2Digital's "Date Range" column: "12/31/24 - 12/31/24".
    // Take the start date — for same-day rows (the common case) it's identical to the end date anyway.
    const rangeMatch = s.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (rangeMatch) s = rangeMatch[1].trim();

    // Bare month name: "December" / "Dec" (B&N Sales by Month — year from report title)
    const bareMonth = s.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i);
    if (bareMonth && defaultYear) {
      const mon = MONTHS[bareMonth[1].toLowerCase()] || MONTHS[bareMonth[1].toLowerCase().slice(0, 3)];
      if (mon) return ymd(defaultYear, mon, 1);
    }

    // Strip time portion for many formats: "7/1/2025 12:00:00 AM"
    const withTime = s.match(
      /^(.+?)(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?$/
    );
    if (withTime) s = withTime[1].trim();

    // Excel serial as string
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const serial = excelSerialToDate(parseFloat(s));
      if (serial) return serial;
    }

    // YYYY-MM-DD or YYYY/MM/DD (optional time already stripped)
    let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) return ymd(m[1], m[2], m[3]);

    // MM/DD/YYYY or M-D-YYYY or M.D.YYYY
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      // Prefer US M/D/Y (B&N, KDP). If day>12, must be D/M/Y.
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 12 && b <= 12) return ymd(m[3], b, a); // D/M/Y
      return ymd(m[3], a, b); // M/D/Y
    }

    // MM/DD/YY or M/D/YY
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (m) {
      let yy = Number(m[3]);
      yy += yy >= 70 ? 1900 : 2000;
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 12 && b <= 12) return ymd(yy, b, a);
      return ymd(yy, a, b);
    }

    // DD-Mon-YYYY or DD Mon YYYY or DD-Mon-YY
    m = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{2,4})$/);
    if (m) {
      const mon = MONTHS[m[2].toLowerCase()];
      if (mon) {
        let yy = Number(m[3]);
        if (yy < 100) yy += yy >= 70 ? 1900 : 2000;
        return ymd(yy, mon, m[1]);
      }
    }

    // Mon DD, YYYY / Month DD, YYYY
    m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) {
      const mon = MONTHS[m[1].toLowerCase()];
      if (mon) return ymd(m[3], mon, m[2]);
    }

    // Month YYYY / Mon-YYYY / Mon YYYY (period reports)
    m = s.match(/^([A-Za-z]{3,9})[\s\-\/]+(\d{4})$/);
    if (m) {
      const mon = MONTHS[m[1].toLowerCase()];
      if (mon) return ymd(m[2], mon, 1);
    }

    // YYYY-MM (period)
    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return ymd(m[1], m[2], 1);

    // YYYYMMDD
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return ymd(m[1], m[2], m[3]);

    // Last resort — avoid Date.parse timezone shifting for bare dates when possible
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      // Use UTC date parts if ISO-like, else local
      if (/^\d{4}-\d{2}-\d{2}/.test(s) || s.includes("T")) {
        return d.toISOString().slice(0, 10);
      }
      return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    return null;
  }

  function normalizeHeaderKey(h) {
    return String(h || "")
      .toLowerCase()
      .replace(/^\uFEFF/, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function headerMap(headerRow) {
    const map = {};
    headerRow.forEach((h, idx) => {
      const key = normalizeHeaderKey(h);
      if (key) map[key] = idx;
    });
    return map;
  }

  /** Score a row as likely column headers */
  function headerScore(row) {
    const joined = row.map(normalizeHeaderKey).join(" ");
    let score = 0;
    const hints = [
      "date",
      "sale",
      "title",
      "royalty",
      "units",
      "units_sold",
      "isbn",
      "quantity",
      "earnings",
      "book",
      "period",
      "amount",
      "net",
      "kenp",
      "author",
      "format",
      "list_price",
      "month",
      "payment_currency",
      "currency",
    ];
    hints.forEach((h) => {
      if (joined.includes(h)) score += 1;
    });
    // Strong signal for B&N monthly summary
    if (joined.includes("month") && joined.includes("royalty")) score += 3;
    if (joined.includes("units_sold") || joined.includes("units")) score += 1;
    return score;
  }

  /**
   * Find header row (B&N/Excel often put a title line above headers).
   * Returns { headerIdx, map }
   */
  function findHeader(rows) {
    const limit = Math.min(rows.length, 20);
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < limit; i++) {
      const sc = headerScore(rows[i]);
      if (sc > bestScore) {
        bestScore = sc;
        bestIdx = i;
      }
    }
    // Require at least a weak match; fall back to row 0
    if (bestScore < 2 && rows.length > 1) {
      // still use bestIdx if it's better than nothing
    }
    return { headerIdx: bestIdx, map: headerMap(rows[bestIdx]), score: bestScore };
  }

  function findColumn(map, exactKeys, fuzzyIncludes) {
    for (const k of exactKeys) {
      if (map[k] != null) return map[k];
    }
    if (fuzzyIncludes && fuzzyIncludes.length) {
      const keys = Object.keys(map);
      for (const frag of fuzzyIncludes) {
        const hit = keys.find((k) => k.includes(frag));
        if (hit) return map[hit];
      }
    }
    return null;
  }

  /**
   * Safety net on top of the header-name checks: sample a handful of actual data cells for a
   * candidate column and reject it if most of them look like a percentage ("85%", "0.85%", etc).
   * Catches rate/percentage columns the name-based exclusions miss (unexpected header wording,
   * a platform WideLedger hasn't seen yet) — a royalty-amount candidate should never win just
   * because nothing in its header literally says "rate" or "percent".
   */
  function columnLooksLikePercent(rows, headerIdx, colIdx) {
    if (colIdx == null) return false;
    let seen = 0;
    let pct = 0;
    for (let i = headerIdx + 1; i < rows.length && seen < 10; i++) {
      const v = rows[i] ? rows[i][colIdx] : null;
      if (v == null || String(v).trim() === "") continue;
      seen++;
      if (String(v).trim().includes("%")) pct++;
    }
    return seen > 0 && pct / seen >= 0.5;
  }

  function normalizeIdentifier(raw) {
    if (raw == null) return null;
    const s = String(raw).replace(/[\s\-]/g, "").toUpperCase();
    if (!s || /^N\/?A$/.test(s) || s === "0" || s === "-") return null;
    return s;
  }

  function cell(row, idx) {
    if (idx == null || idx < 0) return "";
    return row[idx] != null ? String(row[idx]).trim() : "";
  }

  function detectPlatformFromHeaders(map) {
    const keys = Object.keys(map).join(" ");
    if (
      keys.includes("kenp") ||
      keys.includes("kindle_edition") ||
      keys.includes("royalty_type") ||
      keys.includes("asin") ||
      keys.includes("marketplace") && keys.includes("royalty")
    )
      return "kdp";
    if (keys.includes("kobo") || keys.includes("writing_life")) return "kobo";
    if (keys.includes("draft2digital") || keys.includes("vendor")) return "d2d";
    if (keys.includes("ingram") || keys.includes("pod")) return "ingram";
    if (keys.includes("apple") || keys.includes("itunes")) return "apple";
    if (keys.includes("barnes") || keys.includes("nook") || keys.includes("unit_royalty")) return "bn";
    return null;
  }

  /**
   * Score a worksheet for “detailed order/royalty lines” (KDP multi-view workbooks).
   * Prefer line-item sheets over small summary pivots (by format, marketplace, etc.).
   */
  function scoreKdpSheet(name, sheet) {
    const ref = sheet["!ref"];
    if (!ref) return -1;
    const range = XLSX.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    const cols = range.e.c - range.s.c + 1;
    let score = rows * 10 + cols;

    // Prefer detailed tabs
    if (/order|detail|transaction|line|royalt|sale|kenp|history/i.test(name)) score += 50000;
    // Deprioritize high-level pivots (still usable if they’re the only data)
    if (/^summary$|by format|by marketplace|by title|top.?earning|dashboard|overview/i.test(name)) {
      score -= 15000;
    }
    // Tiny sheets are usually charts/summaries
    if (rows < 5) score -= 20000;

    // Header sniff: first row
    try {
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, blankRows: 1 });
      const header = (aoa[0] || []).join(" ").toLowerCase();
      if (/order date|royalty date|asin|royalty type|title/.test(header)) score += 80000;
      if (/units|kenp|royalty/.test(header)) score += 20000;
    } catch {
      /* ignore */
    }
    return score;
  }

  function sheetToCsv(sheet) {
    return XLSX.utils.sheet_to_csv(sheet, {
      FS: ",",
      RS: "\n",
      dateNF: "yyyy-mm-dd",
      blankrows: false,
    });
  }

  /**
   * Parse Excel → keep workbook so the user can switch sheets (KDP multi-view files).
   */
  function readWorkbook(arrayBuffer) {
    if (typeof XLSX === "undefined") {
      throw new Error("Excel library not loaded. Check your network or reopen the app.");
    }
    const wb = XLSX.read(arrayBuffer, {
      type: "array",
      cellDates: true,
      raw: false,
    });
    if (!wb.SheetNames || !wb.SheetNames.length) {
      throw new Error("Excel file has no sheets.");
    }

    const sheets = wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name];
      const ref = sheet["!ref"];
      let rowCount = 0;
      if (ref) {
        const range = XLSX.utils.decode_range(ref);
        rowCount = range.e.r - range.s.r + 1;
      }
      return {
        name,
        score: scoreKdpSheet(name, sheet),
        rowCount,
        csv: sheetToCsv(sheet),
      };
    });

    sheets.sort((a, b) => b.score - a.score);
    const best = sheets[0];

    return {
      sheetNames: wb.SheetNames.slice(),
      sheets,
      bestSheetName: best.name,
      text: best.csv,
      note:
        sheets.length > 1
          ? `Auto-picked “${best.name}” (${sheets.length} sheets in file — switch below if totals look wrong).`
          : `Sheet “${best.name}”.`,
    };
  }

  /** @deprecated use readWorkbook; kept for simple one-shot */
  function workbookToCsvText(arrayBuffer) {
    const info = readWorkbook(arrayBuffer);
    workbookToCsvText.lastMeta = {
      sheetName: info.bestSheetName,
      allSheets: info.sheetNames,
      note: info.note,
    };
    return info.text;
  }

  /**
   * Dry-run parse + totals so authors can compare to KDP dashboard before committing.
   */
  function previewImport(text, platformId) {
    const result = importRoyaltyCSV(text, platformId);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        errors: result.errors || [],
        stats: null,
        sample: [],
        mapping: result.mapping || null,
      };
    }
    const rows = result.rows;
    let royalty = 0;
    let units = 0;
    let kenp = 0;
    let freeUnitRows = 0;
    let kuRows = 0;
    let saleRows = 0;
    let formatUnknownRows = 0;
    const titles = new Set();
    const dates = [];
    rows.forEach((r) => {
      royalty += r.royalty || 0;
      units += r.units || 0;
      kenp += r.kenp || 0;
      titles.add(r.title || "");
      dates.push(r.date);
      if (r.type === "ku") kuRows++;
      else saleRows++;
      if ((r.units || 0) > 0 && !(r.royalty > 0) && r.type !== "ku") freeUnitRows++;
      if (r.type !== "ku" && global.WideLedgerData.normalizeFormat(r.format) === "unknown") formatUnknownRows++;
    });
    dates.sort();
    return {
      ok: true,
      rows,
      errors: result.errors || [],
      mapping: result.mapping || null,
      stats: {
        rowCount: rows.length,
        royalty: +royalty.toFixed(2),
        units,
        kenp,
        titles: titles.size,
        dateMin: dates[0] || null,
        dateMax: dates[dates.length - 1] || null,
        freeUnitRows,
        kuRows,
        saleRows,
        formatUnknownRows,
        skippedErrors: (result.errors || []).length,
      },
      sample: rows.slice(0, 8),
      detectedPlatformId: result.platformId || null,
    };
  }

  /**
   * Classify a KDP "Orders (Lifetime)" workbook sheet by its NAME.
   * These per-format royalty sheets don't carry a "Format" column — the
   * sheet name itself is the only reliable format signal, so it's trusted
   * over any in-file column when a role is found here.
   */
  function classifyKdpSheet(name) {
    const n = String(name || "").toLowerCase().trim();

    if (/royalty/.test(n)) {
      if (/hard\s*cover|hardcover/.test(n)) return { role: "royalty", format: "hardcover" };
      if (/paper\s*back|paperback/.test(n)) return { role: "royalty", format: "paperback" };
      if (/audio/.test(n)) return { role: "royalty", format: "audiobook" };
      if (/e-?book|kindle/.test(n)) return { role: "royalty", format: "ebook" };
      // Some royalty-ish tab we don't recognize the format of — still usable, format stays unknown
      return { role: "royalty", format: null };
    }
    if (/kenp/.test(n)) return { role: "kenp" };
    if (/combined/.test(n)) return { role: "combined" };
    if (/orders?\s*placed/.test(n)) return { role: "orders_placed" };
    if (/orders?\s*processed/.test(n)) return { role: "orders" };
    if (/^summary$|\bsummary\b/.test(n)) return { role: "summary" };
    if (/report\s*definition|definition/.test(n)) return { role: "definitions" };
    if (/\border(s)?\b/.test(n)) return { role: "orders" };
    return { role: "other" };
  }

  const KDP_ROLE_LABEL = {
    combined: "Excluded — rolls up the per-format sheets (would double-count)",
    orders: "Excluded — line-level order list, not a royalty total",
    orders_placed: "Excluded — units placed, not royalty",
    summary: "Excluded — summary of the sheets above",
    definitions: "Excluded — not data",
    other: "Excluded — not recognized as a royalty view",
  };

  /**
   * Build the "import everything relevant" plan for a KDP Orders (Lifetime)
   * multi-sheet workbook: parse every per-format Royalty sheet plus KENP,
   * force-tag each row's format from ITS SHEET NAME (trusted over any
   * in-sheet column), and combine into one row set. Combined Sales / Orders
   * Processed / Orders Placed / Summary / Report Definitions are skipped —
   * they're the same underlying numbers viewed a different way, and
   * importing them alongside the per-format sheets would double-count.
   */
  function buildKdpSmartPlan(sheets) {
    const bySheet = [];
    const excluded = [];
    const rows = [];

    (sheets || []).forEach((sheet) => {
      const cls = classifyKdpSheet(sheet.name);
      if (cls.role === "royalty" || cls.role === "kenp") {
        const parsed = importRoyaltyCSV(sheet.csv, "kdp");
        const sheetRows = parsed.ok ? parsed.rows : [];
        sheetRows.forEach((r) => {
          if (cls.role === "kenp") {
            r.type = "ku";
            r.format = "ku";
          } else {
            r.format = cls.format || global.WideLedgerData.normalizeFormat(r.format);
          }
        });
        rows.push(...sheetRows);
        const royalty = sheetRows.reduce((s, r) => s + (r.royalty || 0), 0);
        bySheet.push({
          name: sheet.name,
          role: cls.role,
          format: cls.role === "kenp" ? "ku" : cls.format,
          included: true,
          rowCount: sheetRows.length,
          royalty: +royalty.toFixed(2),
          note: parsed.ok ? null : parsed.error,
        });
      } else {
        excluded.push({ name: sheet.name, role: cls.role, label: KDP_ROLE_LABEL[cls.role] || "Excluded" });
        bySheet.push({
          name: sheet.name,
          role: cls.role,
          format: null,
          included: false,
          rowCount: 0,
          royalty: 0,
          note: KDP_ROLE_LABEL[cls.role] || "Excluded",
        });
      }
    });

    if (!rows.length) {
      return {
        ok: false,
        error: "No eBook/Paperback/Hardcover/Audiobook Royalty or KENP sheets found in this workbook.",
        bySheet,
        excluded,
        rows: [],
      };
    }

    let royalty = 0;
    let units = 0;
    let kenp = 0;
    const dates = [];
    rows.forEach((r) => {
      royalty += r.royalty || 0;
      units += r.units || 0;
      kenp += r.kenp || 0;
      dates.push(r.date);
    });
    dates.sort();

    return {
      ok: true,
      rows,
      bySheet,
      excluded,
      totals: {
        rowCount: rows.length,
        royalty: +royalty.toFixed(2),
        units,
        kenp,
        dateMin: dates[0] || null,
        dateMax: dates[dates.length - 1] || null,
        sheetCount: bySheet.filter((s) => s.included).length,
      },
    };
  }

  /**
   * Header-row finder for expense files (item/cost, not royalty reports) — simpler
   * signal set than findHeader() above, which is tuned for royalty column names.
   */
  function findExpenseHeader(rows) {
    const limit = Math.min(rows.length, 10);
    const signals = ["item", "description", "expense", "cost", "amount", "price", "total", "category", "date", "note", "vendor"];
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < limit; i++) {
      const joined = rows[i].map(normalizeHeaderKey).join(" ");
      let score = 0;
      signals.forEach((s) => {
        if (joined.includes(s)) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return { headerIdx: bestIdx, map: headerMap(rows[bestIdx]) };
  }

  /**
   * Value-based column sniffing for expense files, used as a fallback when a column's
   * *name* doesn't match anything expected — e.g. spreadsheet exports with generic headers
   * ("Column1"), no header row worth trusting, or wording nobody anticipated. Looks at what
   * the cells actually contain rather than what the header says.
   */
  function sniffExpenseColumns(rows, headerIdx, numCols, taken, need) {
    const sample = (colIdx) => {
      const vals = [];
      for (let i = headerIdx + 1; i < rows.length && vals.length < 15; i++) {
        const v = rows[i] ? rows[i][colIdx] : null;
        if (v == null || String(v).trim() === "") continue;
        vals.push(String(v).trim());
      }
      return vals;
    };

    // Money-shaped: optional currency symbol / parens-negative, digits with optional
    // thousands separators, optional cents. Bonus for an explicit $/decimal so a column of
    // bare small integers (more likely a quantity) doesn't outscore a real cost column.
    const moneyScore = (colIdx) => {
      const vals = sample(colIdx);
      if (!vals.length) return 0;
      let hit = 0;
      let strong = 0;
      vals.forEach((s) => {
        if (/^\(?[-+]?[$£€]?\s?\d{1,3}(,\d{3})*(\.\d{1,2})?\)?$/.test(s)) {
          hit++;
          if (/[$£€]/.test(s) || /\.\d{2}$/.test(s)) strong++;
        }
      });
      const ratio = hit / vals.length;
      return ratio >= 0.6 ? ratio + strong / vals.length : 0;
    };

    const dateScore = (colIdx) => {
      const vals = sample(colIdx);
      if (!vals.length) return 0;
      const hit = vals.filter((s) => parseDateLoose(s) != null).length;
      return hit / vals.length;
    };

    // "Texty": mostly non-numeric, non-date strings with at least one letter — the item
    // description column, by elimination once cost/date are known.
    const textScore = (colIdx) => {
      const vals = sample(colIdx);
      if (!vals.length) return 0;
      const hit = vals.filter((s) => /[a-zA-Z]/.test(s) && parseDateLoose(s) == null && !/^\(?[-+]?[$£€]?\s?\d[\d,.]*\)?$/.test(s)).length;
      return hit / vals.length;
    };

    const candidates = [];
    for (let c = 0; c < numCols; c++) candidates.push(c);
    const available = (skip) => candidates.filter((c) => !taken.has(c) && c !== skip);

    const best = (scoreFn, pool, threshold) => {
      let bestCol = null;
      let bestScore = threshold;
      pool.forEach((c) => {
        const s = scoreFn(c);
        if (s > bestScore) {
          bestScore = s;
          bestCol = c;
        }
      });
      return bestCol;
    };

    const result = {};
    if (need.cost) {
      const col = best(moneyScore, available(), 0.6);
      if (col != null) {
        result.costIdx = col;
        taken.add(col);
      }
    }
    if (need.date) {
      const col = best(dateScore, available(), 0.6);
      if (col != null) {
        result.dateIdx = col;
        taken.add(col);
      }
    }
    if (need.item) {
      const col = best(textScore, available(), 0.4);
      if (col != null) result.itemIdx = col;
    }
    return result;
  }

  /**
   * Parse a CSV/Excel-derived text as an expense list: item + cost per row, date and
   * category optional. Unlike importRoyaltyCSV, a missing date isn't an error here — the
   * caller (UI) asks the person which year to file undated rows under instead of guessing.
   */
  function importExpensesFile(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").replace(/\0/g, "");
    const rows = parseFlexibleRows(raw);
    if (rows.length < 2) {
      return { ok: false, error: "File needs a header row and at least one data row.", rows: [] };
    }
    const { headerIdx, map } = findExpenseHeader(rows);

    let itemIdx = findColumn(
      map,
      ["item", "description", "expense", "name", "vendor", "payee", "details", "line_item", "title", "memo"],
      ["item", "description", "expense", "vendor", "payee", "detail", "memo"]
    );
    let costIdx = findColumn(
      map,
      ["cost", "amount", "total", "price", "expense_amount", "amount_usd", "total_cost", "spend", "value"],
      ["cost", "amount", "total", "price", "spend"]
    );
    let dateIdx = findColumn(
      map,
      ["date", "expense_date", "purchase_date", "transaction_date", "paid_date", "posted_date", "order_date"],
      ["date"]
    );
    const categoryIdx = findColumn(map, ["category", "type", "expense_category", "expense_type", "group"], ["category", "type"]);

    // Header names didn't nail everything down — fall back to reading what the cells
    // actually look like (currency-shaped → cost, date-shaped → date, texty → item).
    if (costIdx == null || dateIdx == null || itemIdx == null) {
      const numCols = rows[headerIdx] ? rows[headerIdx].length : Math.max(...rows.map((r) => r.length));
      const taken = new Set([itemIdx, costIdx, dateIdx, categoryIdx].filter((v) => v != null));
      const need = { cost: costIdx == null, date: dateIdx == null, item: itemIdx == null };
      const sniffed = sniffExpenseColumns(rows, headerIdx, numCols, taken, need);
      if (costIdx == null && sniffed.costIdx != null) costIdx = sniffed.costIdx;
      if (dateIdx == null && sniffed.dateIdx != null) dateIdx = sniffed.dateIdx;
      if (itemIdx == null && sniffed.itemIdx != null) itemIdx = sniffed.itemIdx;
    }

    if (costIdx == null) {
      return {
        ok: false,
        error: `Could not find a cost/amount column by name or by looking at the values. Headers seen: ${Object.keys(map).join(", ")}.`,
        rows: [],
      };
    }

    const out = [];
    let anyDate = false;
    let allDate = true;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
      const costRaw = cell(row, costIdx);
      if (!costRaw) continue;
      const cost = parseMoney(costRaw);
      if (!cost) continue; // skip $0 / unparseable rows rather than importing noise

      const item = itemIdx != null ? cell(row, itemIdx) : "";
      const dateRaw = dateIdx != null ? cell(row, dateIdx) : "";
      const date = dateRaw ? parseDateLoose(dateRaw) : null;
      if (date) anyDate = true;
      else allDate = false;
      const categoryRaw = categoryIdx != null ? cell(row, categoryIdx) : "";

      out.push({ item: item || "Expense", cost: Math.abs(cost), date, categoryRaw });
    }

    if (!out.length) {
      return { ok: false, error: "No expense rows found — check the file has an item and a cost per row.", rows: [] };
    }

    return { ok: true, rows: out, hasDates: anyDate, allHaveDates: allDate, headers: Object.keys(map) };
  }

  function isExcelFile(name, mime) {
    const n = String(name || "").toLowerCase();
    if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".xlsm")) return true;
    if (mime && /spreadsheet|excel|ms-excel|officedocument\.spreadsheet/i.test(mime)) return true;
    return false;
  }

  /**
   * Normalize any reasonable royalty CSV into WideLedger royalty rows
   */
  function importRoyaltyCSV(text, platformId) {
    // Normalize newlines; strip BOM
    const raw = String(text || "").replace(/^\uFEFF/, "").replace(/\0/g, "");
    const rows = parseFlexibleRows(raw);
    if (rows.length < 2) {
      return { ok: false, error: "CSV needs a header row and at least one data row.", rows: [] };
    }

    const context = extractReportContext(rows);
    const { headerIdx, map, score } = findHeader(rows);
    if (score < 1) {
      return {
        ok: false,
        error:
          "Could not find a header row (e.g. Month / Units Sold / Total Royalty). Check the file format.",
        rows: [],
      };
    }

    const detected = detectPlatformFromHeaders(map);
    // Preamble says Barnes & Noble
    const preamble = rows
      .slice(0, headerIdx)
      .map((r) => r.join(" "))
      .join(" ");
    let plat = platformId || detected || "other";
    if (!platformId && /barnes|b&n|nook/i.test(preamble)) plat = "bn";

    const isMonthlySummary =
      map.month != null &&
      (map.total_royalty != null || map.royalty != null || map.units_sold != null || map.units != null);

    const dateIdx = findColumn(
      map,
      [
        "date",
        "sale_date",
        "sales_date",
        "order_date",
        "royalty_date",
        "transaction_date",
        "activity_date",
        "report_date",
        "payment_date",
        "posted_date",
        "period",
        "period_date",
        "month",
        "sales_period",
        "day",
        "txn_date",
        "purchase_date",
        "date_range", // Draft2Digital: "12/31/24 - 12/31/24" — parseDateLoose takes the start date
      ],
      // KDP Orders: prefer royalty_date / order_date over generic
      ["royalty_date", "order_date", "sale_date", "sales_date", "transaction", "activity_date", "report_date", "date_range", "_date", "period", "month"]
    );

    const titleIdx = findColumn(
      map,
      [
        "title",
        "book_title",
        "product_title",
        "item_name",
        "name",
        "book",
        "title_name",
        "product_name",
        "ebook_title",
        "work_title",
      ],
      ["title", "product_name", "book_name"]
    );

    const royaltyIdx = (() => {
      const preferExact = [
        "royalty",
        "royalties",
        "total_royalty",
        "amount",
        "earnings",
        "net_royalty",
        "estimated_royalty",
        "royalty_earned",
        "proceeds",
        "income",
        "your_royalty",
        "earned",
        "net_earnings",
        "publisher_revenue",
        "royalty_amount",
        "estimated_earnings",
        "user_share_usd_final", // Draft2Digital: the actual dollar payout column
        "user_share_usd",
        "user_share",
        "your_share",
        "publisher_share",
        "net_compensation",
        "compensation",
      ];
      for (const k of preferExact) {
        if (map[k] != null && !columnLooksLikePercent(rows, headerIdx, map[k])) return map[k];
      }
      // Fuzzy fallback — never match a rate/percentage column (e.g. Draft2Digital's
      // "Royalty Rate": 85%), only an actual dollar-amount column. Excluded both by header
      // wording (rate/percent/_pct) and, as a backstop, by sampling the actual cell values.
      const fuzzyFrags = [
        "total_royalty",
        "net_royalty",
        "royalty_amount",
        "estimated_royalty",
        "user_share",
        "royalty",
        "earnings",
        "proceeds",
        "compensation",
      ];
      const keys = Object.keys(map);
      for (const frag of fuzzyFrags) {
        const hit = keys.find(
          (k) =>
            k.includes(frag) &&
            !k.includes("rate") &&
            !k.includes("percent") &&
            !k.endsWith("_pct") &&
            !k.includes("_pct_") &&
            !columnLooksLikePercent(rows, headerIdx, map[k])
        );
        if (hit) return map[hit];
      }
      return null;
    })();

    // Prefer explicit royalty *type* text — never “Royalty %” / rate columns
    const royaltyTypeIdx = (() => {
      const prefer = ["royalty_type", "transaction_type", "transaction_name", "earnings_type"];
      for (const k of prefer) {
        if (map[k] != null) return map[k];
      }
      // Avoid bare "type" if a better column exists; skip % / percent keys
      const keys = Object.keys(map);
      const hit = keys.find(
        (k) =>
          (k.includes("royalty_type") || k.includes("transaction_type")) &&
          !k.includes("percent") &&
          !k.endsWith("_pct") &&
          !k.includes("rate")
      );
      return hit != null ? map[hit] : null;
    })();

    // Format / binding only — do not fuzzy-match keys that might be royalty rates
    const formatIdx = (() => {
      const prefer = [
        "format",
        "binding",
        "book_format",
        "edition_type",
        "product_type",
        "media_type",
        "book_type",
        "content_type",
      ];
      for (const k of prefer) {
        if (map[k] != null && !k.includes("percent") && !k.includes("royalty")) return map[k];
      }
      const keys = Object.keys(map);
      const hit = keys.find(
        (k) =>
          (k === "format" ||
            k.endsWith("_format") ||
            k.includes("binding") ||
            k === "product_type" ||
            k === "book_type") &&
          !k.includes("percent") &&
          !k.includes("royalty")
      );
      return hit != null ? map[hit] : null;
    })();

    const unitRoyaltyIdx = findColumn(map, ["unit_royalty", "royalty_per_unit"], ["unit_royalty"]);

    const unitsIdx = findColumn(
      map,
      [
        "units",
        "quantity",
        "qty",
        "sold",
        "net_units",
        "net_units_sold",
        "units_sold",
        "orders",
        "net_qty",
        "qty_sold",
        "paid_units",
        "free_units",
        "net_unit_sales", // Draft2Digital: "Net Unit Sales" — singular "unit"
        "unit_sales",
      ],
      ["units_sold", "net_units", "paid_units", "unit_sales", "quantity", "units"]
    );

    const kenpIdx = findColumn(
      map,
      [
        "kenp",
        "pages_read",
        "kenp_read",
        "kindle_edition_normalized_pages",
        "kindle_edition_normalized_pages_kenp",
        "kenp_read_pages",
      ],
      ["kenp", "pages_read", "normalized_pages"]
    );

    const platIdx = findColumn(
      map,
      ["platform", "platform_id", "store", "marketplace", "channel", "retailer"],
      ["marketplace", "store"]
    );

    // ASIN/ISBN — the one thing that's stable across reports even when the title text isn't
    // (subtitles, series tags, and punctuation vary by platform; the identifier doesn't).
    const identifierIdx = findColumn(
      map,
      ["asin", "isbn", "isbn13", "isbn_13", "isbn10", "isbn_10", "product_id", "identifier", "sku"],
      ["asin", "isbn"]
    );

    if (dateIdx == null) {
      return {
        ok: false,
        error: `No date/month column found. Headers seen: ${Object.keys(map).slice(0, 12).join(", ") || "(none)"}.`,
        rows: [],
      };
    }

    // B&N monthly reports need the year from "Sales by Month - 2024"
    if (isMonthlySummary && !context.year) {
      return {
        ok: false,
        error:
          'This looks like a B&N "Sales by Month" report, but no year was found (expected a line like "Sales by Month - 2024").',
        rows: [],
      };
    }

    const isNative =
      map.date != null &&
      (map.royalty != null || map.royalties != null || map.amount != null) &&
      (map.platform != null || map.platform_id != null || plat);

    // Reverse map index → original-ish key for diagnostics
    const keyByIdx = {};
    Object.entries(map).forEach(([k, idx]) => {
      keyByIdx[idx] = k;
    });
    const mapping = {
      headers: Object.keys(map),
      date: dateIdx != null ? keyByIdx[dateIdx] : null,
      title: titleIdx != null ? keyByIdx[titleIdx] : null,
      royalty: royaltyIdx != null ? keyByIdx[royaltyIdx] : null,
      units: unitsIdx != null ? keyByIdx[unitsIdx] : null,
      kenp: kenpIdx != null ? keyByIdx[kenpIdx] : null,
      royaltyType: royaltyTypeIdx != null ? keyByIdx[royaltyTypeIdx] : null,
      format: formatIdx != null ? keyByIdx[formatIdx] : null,
      identifier: identifierIdx != null ? keyByIdx[identifierIdx] : null,
      isMonthlySummary,
      reportYear: context.year || null,
    };

    const defaultTitle =
      isMonthlySummary
        ? context.publisher
          ? `${context.publisher} (monthly)`
          : "B&N Press (monthly total)"
        : "Imported title";

    const out = [];
    const errors = [];
    let skippedZero = 0;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => !c)) continue;

      const firstCell = String(row[0] || "").toLowerCase();
      if (/^(total|totals|sum|grand total|subtotal|total\s*\(net\))/i.test(firstCell)) continue;
      if (/total royalty:/i.test(row.join(" "))) continue;

      const rawDate = cell(row, dateIdx);
      const date = parseDateLoose(rawDate, { defaultYear: context.year });

      let title = cell(row, titleIdx);
      if (normalizeHeaderKey(title) === "title" || normalizeHeaderKey(rawDate) === "date") continue;
      if (normalizeHeaderKey(rawDate) === "month") continue;

      let royalty = parseMoney(cell(row, royaltyIdx));
      const units = parseInt(String(cell(row, unitsIdx) || "0").replace(/,/g, ""), 10) || 0;
      const kenp = parseInt(String(cell(row, kenpIdx) || "0").replace(/,/g, ""), 10) || 0;

      if (!royalty && unitRoyaltyIdx != null && units) {
        royalty = +(parseMoney(cell(row, unitRoyaltyIdx)) * units).toFixed(2);
      }

      let rowPlatform = plat;
      const platCell = cell(row, platIdx);
      if (platCell) {
        const found = PLATFORMS.find(
          (p) =>
            p.id === platCell.toLowerCase() ||
            p.name.toLowerCase() === platCell.toLowerCase() ||
            p.short.toLowerCase() === platCell.toLowerCase()
        );
        if (found) rowPlatform = found.id;
      }

      if (!date) {
        // Ignore non-data junk after the table
        if (!rawDate || rawDate.length > 40) continue;
        const preview = rawDate ? `"${rawDate.slice(0, 40)}"` : "(empty)";
        errors.push(`Row ${r + 1}: could not parse date ${preview}`);
        continue;
      }

      // Monthly summaries: skip pure zero months (noise)
      if (isMonthlySummary && !royalty && !units && !kenp) {
        skippedZero++;
        continue;
      }

      if (!royalty && !units && !kenp) {
        errors.push(`Row ${r + 1}: no royalty/units/KENP`);
        continue;
      }

      let finalRoyalty = royalty;
      let type = "sale";
      const royaltyType = cell(row, royaltyTypeIdx).toLowerCase();
      // KDP: KENP / KU page reads
      if (
        (kenp > 0 && units === 0) ||
        /kenp|page\s*read|kdp\s*select|ku\b|kindle\s*unlimited/i.test(royaltyType)
      ) {
        type = "ku";
        if (kenp > 0 && !finalRoyalty) finalRoyalty = +(kenp * 0.004).toFixed(2);
      }

      // Format: Format/Binding column, else KDP "Royalty Type" (eBook Royalty, Paperback Royalty…)
      // Never use Royalty % (70%, 35%, etc.) — normalizeFormat rejects those.
      let formatRaw = cell(row, formatIdx) || "";
      if (!formatRaw && royaltyType) formatRaw = royaltyType;
      if (type === "ku") {
        formatRaw = formatRaw || "ku";
      }
      let format = global.WideLedgerData.normalizeFormat(formatRaw);
      if (type === "ku") format = "ku";

      // For month-only rows, label with month name
      if (isMonthlySummary && !title) {
        title = `${defaultTitle} — ${rawDate}${context.year ? " " + context.year : ""}`;
      }

      out.push({
        id: uid("r"),
        date,
        platformId: rowPlatform,
        bookId: null,
        title: title || defaultTitle,
        identifier: normalizeIdentifier(cell(row, identifierIdx)),
        royalty: finalRoyalty,
        units,
        kenp,
        type,
        format,
        currency: "USD",
      });
    }

    if (!out.length) {
      const hint =
        errors[0] ||
        "No importable rows found. For B&N monthly reports, need Month + Units Sold + Total Royalty and a year line.";
      return {
        ok: false,
        error: hint + (errors.length > 1 ? ` (+${errors.length - 1} more)` : ""),
        rows: [],
        errors,
        mapping,
      };
    }

    const skipNote = skippedZero ? `, ${skippedZero} zero months skipped` : "";
    const errNote = errors.length ? `, ${errors.length} row(s) skipped` : "";

    return {
      ok: true,
      rows: out,
      platformId: plat,
      errors,
      isNative,
      mapping,
      message: `Imported ${out.length} royalty row(s)${skipNote}${errNote}.`,
    };
  }

  const EXPORT_GUIDES = [
    {
      id: "kdp",
      title: "Amazon KDP",
      url: "https://kdpreports.amazon.com/orders",
      urlVerified: true,
      body:
        "kdpreports.amazon.com → Orders (left menu) → Choose a date → Lifetime → download (.xlsx). " +
        "That file has several sheets: Combined Sales, per-format Royalty sheets (eBook/Paperback/Hardcover/Audiobook), KENP, Orders Processed, Summary, etc. WideLedger detects this shape and combines the per-format Royalty + KENP sheets for you — you don't need to pick one or sum them yourself. " +
        "Why KDP numbers often disagree: dashboard “estimated royalties” ≠ Orders export ≠ Prior Months’ Royalties (what actually gets paid) ≠ bank deposit. Free promos, refunds, marketplace currency, and KENP timing all differ. " +
        "For cash actually paid, use Reports → Prior Months' Royalties instead; for unit/order history, use Orders (Lifetime).",
    },
    {
      id: "kobo",
      title: "Kobo Writing Life",
      url: "https://writinglife.kobo.com/",
      urlVerified: true,
      body:
        "writinglife.kobo.com → My Account → Payment Information. This is where Kobo posts the official monthly sales reports (uploaded ~25th of each month, for the prior month) — download them individually or grab your whole history at once. " +
        "The Dashboard's own CSV export (under Book Titles) is a real-time estimate and leaves out some transaction types (promo codes, OverDrive library loans, Kobo Plus reads). For numbers that match what you're paid, use the Payment Information reports, not the dashboard export.",
    },
    {
      id: "d2d",
      title: "Draft2Digital",
      url: "https://www.draft2digital.com/reports/raw_sales_data/",
      urlVerified: true,
      body:
        "draft2digital.com → Author Dashboard → My Reports → Raw Sales Data. Pick a reporting period (month) and download as CSV. D2D already aggregates Apple, B&N, Kobo, libraries, and more — tag rows as D2D here, and skip importing those same stores separately if you also distribute to them directly, or you'll double-count. " +
        "Note the report's “Verified” column: unverified rows are early estimates D2D hasn't finalized yet.",
    },
    {
      id: "apple",
      title: "Apple Books",
      url: "https://www.apple.com/itunes/go/itunesconnect/salesReports",
      urlVerified: false, // sourced from Apple's own support docs, but not click-tested by anyone yet
      body:
        "authors.apple.com (App Store Connect) → Sales and Trends → filter by date range → download as a flat file. Reporting updates daily, but Apple pays out roughly 30–45 days after the month closes, so a very recent range will look smaller than what eventually settles. " +
        "If you distribute to Apple Books through D2D or another aggregator instead of going direct, import their combined report and skip this one to avoid double-counting.",
    },
    {
      id: "bn",
      title: "Barnes & Noble Press",
      url: "https://press.barnesandnoble.com/",
      urlVerified: true,
      body:
        "press.barnesandnoble.com → Sales Reporting → pick a report type (Sales by Month, Sales by Year, Custom Date, etc.) → Export Excel Sheet at the top of the results page. Monthly reports look like: preamble “Sales by Month - 2024”, then columns Month / Units Sold / Total Royalty. WideLedger maps December → 2024-12-01 and skips $0 months. Set platform to B&N Press. Skip if B&N is only via Draft2Digital.",
    },
    {
      id: "google",
      title: "Google Play Books",
      url: "https://play.google.com/books/publish/",
      urlVerified: true,
      body:
        "play.google.com/books/publish/ → Reports (left menu). For the number that matches what you're actually paid, open the Google Play earnings reports section and click Download next to your payment profile. For an itemized, filterable CSV (by date/title/country), use the sales report section instead and click Export report.",
    },
    {
      id: "ingram",
      title: "IngramSpark",
      url: "https://myaccount.ingramspark.com/",
      urlVerified: true,
      body:
        "ingramspark.com → Reports → Sales → Ebook Sales / Print Sales (separately — they can't be combined into one export). Set a date range and pick Excel as the output format; this is the report built for dated history. " +
        "Reports → Compensation is a different report — it only shows one lump total per title for whichever period you pick, with no per-row date, so it can't be imported here even though it's the one most tax-season guides point you to. " +
        "Ingram pays on roughly a 90-day delay, so a given period's compensation reflects sales from about 3 months earlier.",
    },
    {
      id: "wideledger",
      title: "WideLedger format (best)",
      body: "Columns: date, platform, title, royalty, units, kenp. Example: 2026-03-01,kdp,Ember Protocol,12.40,4,0",
    },
  ];

  global.WideLedgerImport = {
    parseCSV,
    importRoyaltyCSV,
    workbookToCsvText,
    readWorkbook,
    previewImport,
    isExcelFile,
    classifyKdpSheet,
    buildKdpSmartPlan,
    importExpensesFile,
    EXPORT_GUIDES,
  };
})(window);
