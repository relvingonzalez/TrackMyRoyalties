/**
 * TrackMyRoyalties — main UI controller
 */
(function () {
  const D = window.WideLedgerData;
  const Imp = window.WideLedgerImport;
  const Charts = window.WideLedgerCharts;
  const PIcons = window.WideLedgerPlatformIcons;
  const Brand = window.Brand;

  let state = D.loadState();
  let pendingImport = null;
  let pendingExpenseImport = null;
  let currentPage = "dashboard";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function money(n) {
    return D.formatMoney(n, state.currency);
  }

  function getFilters() {
    const range = $("#range-select")?.value || "30d";
    const platformId = $("#platform-select")?.value || "all";
    const from = $("#range-from")?.value || "";
    const to = $("#range-to")?.value || "";
    return { range, platformId, from, to };
  }

  function persist() {
    D.saveState(state);
  }

  function exportVault() {
    const vault = {
      ...state,
      [`_${Brand.slug}`]: {
        format: `${Brand.slug}-vault`,
        version: 1,
        exportedAt: new Date().toISOString(),
      },
    };
    downloadBlob(JSON.stringify(vault, null, 2), `${Brand.slug}-vault-${Date.now()}.json`, "application/json");
    toast("Vault exported — save this file to move devices.");
    const st = $("#vault-status");
    if (st) st.textContent = "Vault downloaded. Keep it private: it holds your sales data.";
  }

  async function importVaultFile(file) {
    if (!file) return;
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      toast("Not a valid JSON vault.");
      return;
    }
    if (!data || (data.royalties == null && data.books == null)) {
      toast(`File does not look like a ${Brand.name} vault.`);
      return;
    }
    if (!confirm("Replace all data on this device with the vault file?")) return;
    state = { ...D.defaultState(), ...data };
    delete state._wideledger; // pre-rebrand export marker, harmless if present
    delete state[`_${Brand.slug}`];
    state.isDemo = !!data.isDemo;
    persist();
    toast("Vault restored");
    const st = $("#vault-status");
    if (st) st.textContent = "Restored.";
    refreshAll();
  }

  // ---------- Views ----------
  function showLanding() {
    $("#view-landing").classList.remove("hidden");
    $("#view-app").classList.add("hidden");
  }

  function showApp() {
    $("#view-landing").classList.add("hidden");
    $("#view-app").classList.remove("hidden");
    state.firstVisit = false;
    persist();
    refreshAll();
  }

  function enterApp() {
    if (!state.books.length && !state.royalties.length) {
      // empty start is fine
    }
    showApp();
  }

  function updateDemoChrome() {
    const banner = $("#demo-banner");
    const restoreBtn = $("#btn-restore-pre-demo");
    const topDemo = $("#btn-load-demo");
    const settingsHint = $("#demo-settings-hint");
    const settingsDemo = $("#btn-load-demo-settings");

    const onDemo = !!state.isDemo;
    banner?.classList.toggle("hidden", !onDemo);

    const snap = D.loadPreDemoSnapshot();
    if (restoreBtn) {
      restoreBtn.hidden = !(onDemo && snap);
    }

    // While on demo, use the banner instead
    topDemo?.classList.toggle("hidden", onDemo);

    if (settingsHint) {
      if (onDemo) {
        settingsHint.textContent = "Demo data is loaded. Use “Remove demo / clear sales data” or the banner to get back to a blank (or previous) workspace.";
      } else if (snap) {
        settingsHint.textContent = "A snapshot of data from before the last demo load is still available until you clear it.";
      } else {
        settingsHint.textContent = "Demo is sample data only — remove it anytime before importing your CSVs.";
      }
    }

    if (settingsDemo) {
      settingsDemo.classList.toggle("hidden", onDemo);
    }
  }

  async function loadDemo() {
    if (state.isDemo) {
      toast("Demo is already loaded. Use the banner to remove it first.");
      return;
    }

    const hasReal =
      !state.isDemo &&
      ((state.royalties && state.royalties.length) ||
        (state.expenses && state.expenses.length) ||
        (state.books && state.books.length));

    if (hasReal) {
      const ok = confirm(
        "Load demo data?\n\nYour current royalties/expenses will be saved as a snapshot so you can restore them."
      );
      if (!ok) return;
      D.snapshotBeforeDemo(state);
    }

    const keepCurrency = state.currency;
    const keepShowKenp = state.showKenp;
    const keepCompact = state.compactMode;

    state = D.generateDemoData();
    state.currency = keepCurrency;
    state.showKenp = keepShowKenp;
    state.compactMode = keepCompact;
    state.isDemo = true;

    persist();
    showApp();
    updateDemoChrome();
    toast(
      D.loadPreDemoSnapshot()
        ? "Demo loaded. Use the banner to restore your previous data or remove demo."
        : "Demo loaded. Use the yellow banner to remove it when you're done."
    );
  }

  async function clearDemoData() {
    if (!state.isDemo && !(state.royalties?.length || state.expenses?.length || state.books?.length)) {
      toast("Nothing to clear.");
      return;
    }

    const msg = state.isDemo
      ? "Remove all demo royalties, expenses, and titles?\n\nYour settings stay. You’ll get an empty workspace for real imports."
      : "Clear all royalties, expenses, and titles on this device?\n\nSettings stay. This cannot be undone unless you exported a vault.";

    if (!confirm(msg)) return;

    state = D.clearCatalogData(state);
    persist();
    updateDemoChrome();
    refreshAll();
    toast("Cleared. Ready for your real data (Import or vault).");
  }

  async function restorePreDemo() {
    const snap = D.loadPreDemoSnapshot();
    if (!snap?.state) {
      toast("No previous data snapshot found.");
      return;
    }
    if (!confirm("Restore the data you had before loading demo?\n\nCurrent demo numbers will be discarded.")) {
      return;
    }

    state = {
      ...D.defaultState(),
      ...state,
      ...snap.state,
      isDemo: false,
      firstVisit: false,
    };
    D.clearPreDemoSnapshot();
    persist();
    updateDemoChrome();
    refreshAll();
    toast("Your previous data is restored.");
  }

  // ---------- Navigation ----------
  function navigate(page) {
    currentPage = page;
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.nav === page));
    $$(".page").forEach((p) => p.classList.add("hidden"));
    const el = $(`#page-${page}`);
    if (el) el.classList.remove("hidden");
    $("#sidebar")?.classList.remove("open");
    renderPage(page);
  }

  function renderPage(page) {
    if (page === "dashboard") renderDashboard();
    if (page === "platforms") renderPlatforms();
    if (page === "books") renderBooks();
    if (page === "expenses") renderExpenses();
    if (page === "import") renderImport();
    if (page === "tax") renderTax();
    if (page === "settings") renderSettings();
  }

  async function refreshAll() {
    fillPlatformSelects();
    updateDemoChrome();
    renderPage(currentPage);
  }

  function fillPlatformSelects() {
    const opts =
      `<option value="all">All platforms</option>` +
      D.PLATFORMS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    const ps = $("#platform-select");
    if (ps) {
      const cur = ps.value || "all";
      ps.innerHTML = opts;
      ps.value = cur;
    }
    const ip = $("#import-platform");
    if (ip) {
      ip.innerHTML = D.PLATFORMS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    }
    const mp = $("#manual-platform");
    if (mp) {
      mp.innerHTML = D.PLATFORMS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    }
  }

  // ---------- Dashboard ----------
  function renderDashboard() {
    const filters = getFilters();
    const agg = D.aggregate(state, filters);
    const prevFilters = { ...filters };
    // rough previous period for delta: same length shifted
    const bounds = D.rangeBounds(filters.range, filters.from, filters.to);
    const days = Math.max(1, Math.round((bounds.end - bounds.start) / 86400000));
    const prevEnd = new Date(bounds.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);
    const prevAgg = D.aggregate(state, {
      range: "custom",
      platformId: filters.platformId,
      from: prevStart.toISOString().slice(0, 10),
      to: prevEnd.toISOString().slice(0, 10),
    });

    const deltaPct = (cur, prev) => {
      if (!prev) return null;
      return ((cur - prev) / Math.abs(prev)) * 100;
    };

    const kpis = [
      {
        label: "Gross royalties",
        value: money(agg.income),
        delta: deltaPct(agg.income, prevAgg.income),
        accent: "#d4a84b",
      },
      {
        label: "Expenses & ads",
        value: money(agg.spend),
        delta: deltaPct(agg.spend, prevAgg.spend),
        accent: "#f07178",
        invertDelta: true,
      },
      {
        label: "Net profit",
        value: money(agg.net),
        delta: deltaPct(agg.net, prevAgg.net),
        accent: agg.net >= 0 ? "#3ecf8e" : "#f07178",
      },
      {
        label: "Units sold",
        value: D.formatInt(agg.units),
        delta: deltaPct(agg.units, prevAgg.units),
        accent: "#6cb6ff",
      },
    ];
    if (state.showKenp) {
      kpis.push({
        label: "KENP pages",
        value: D.formatInt(agg.kenp),
        delta: deltaPct(agg.kenp, prevAgg.kenp),
        accent: "#b794f6",
      });
      kpis.push({
        label: "KU royalties",
        value: money(agg.kuIncome),
        delta: null,
        accent: "#ed8936",
      });
    }

    $("#kpi-grid").innerHTML = kpis
      .map((k) => {
        let deltaHtml = "";
        if (k.delta != null && Number.isFinite(k.delta)) {
          const up = k.invertDelta ? k.delta < 0 : k.delta >= 0;
          const cls = up ? "up" : "down";
          const arrow = k.delta >= 0 ? "↑" : "↓";
          deltaHtml = `<div class="delta ${cls}">${arrow} ${Math.abs(k.delta).toFixed(0)}% vs prior period</div>`;
        } else {
          deltaHtml = `<div class="delta">Selected range</div>`;
        }
        return `<div class="kpi" style="--accent:${k.accent}"><div class="label">${k.label}</div><div class="value">${k.value}</div>${deltaHtml}</div>`;
      })
      .join("");

    const platObj = filters.platformId === "all" ? null : D.PLATFORMS.find((p) => p.id === filters.platformId);
    const platLabel = platObj ? platObj.name : "all platforms";
    $("#dashboard-subtitle").textContent = `${platLabel} · ${filters.range}`;

    const logoEl = $("#dashboard-platform-logo");
    if (platObj) {
      const wordmark = PIcons.wordmarkSrc(platObj.id);
      logoEl.innerHTML = wordmark
        ? `<img src="${wordmark}" alt="${platObj.name}" />`
        : (() => {
            const icon = PIcons.iconMarkup(platObj.id);
            const tightCls = icon.tight ? " tight" : "";
            return icon.type === "svg"
              ? `<div class="dashboard-platform-icon${tightCls}" style="color:${platObj.color}">${icon.markup}</div>`
              : `<div class="dashboard-platform-icon${tightCls}"><img src="${icon.src}" alt="${platObj.name}" /></div>`;
          })();
      logoEl.hidden = false;
    } else {
      logoEl.innerHTML = "";
      logoEl.hidden = true;
    }

    Charts.renderIncomeChart("chart-income", agg.daily, money, state.chartAnnotations);
    renderAnnotationList();
    Charts.renderPlatformChart("chart-platforms", agg.byPlatform, D.PLATFORMS, money);
    Charts.renderPnLChart("chart-pnl", agg.daily, money);

    // Re-bucket through normalizeFormat so old bad imports (e.g. "70%") collapse to Unknown
    const fmtMerged = {};
    Object.entries(agg.byFormat || {}).forEach(([id, v]) => {
      const nid = D.normalizeFormat(id);
      if (!fmtMerged[nid]) fmtMerged[nid] = { royalty: 0, units: 0, kenp: 0, rows: 0 };
      fmtMerged[nid].royalty += v.royalty || 0;
      fmtMerged[nid].units += v.units || 0;
      fmtMerged[nid].kenp += v.kenp || 0;
      fmtMerged[nid].rows += v.rows || 0;
    });
    Charts.renderFormatChart("chart-format", fmtMerged, D.formatLabel, money);

    const fmtList = Object.entries(fmtMerged)
      .map(([id, v]) => ({ id, ...v }))
      .filter((f) => f.royalty > 0 || f.units > 0)
      .sort((a, b) => b.royalty - a.royalty);
    const fmtRoyaltyTotal = fmtList.reduce((s, f) => s + f.royalty, 0);
    const fmtUnitsTotal = fmtList.reduce((s, f) => s + f.units, 0);
    const known = fmtList.filter((f) => f.id !== "unknown");
    $("#format-breakdown").innerHTML =
      (fmtList.length
        ? `<div class="list-row format-total-row">
            <div><div><strong>All formats</strong></div><div class="meta">${D.formatInt(fmtUnitsTotal)} units · ${money(fmtRoyaltyTotal)} royalties</div></div>
            <div class="amount">${money(fmtRoyaltyTotal)}</div>
          </div>`
        : "") +
        (fmtList
          .map((f) => {
            const share =
              fmtRoyaltyTotal > 0 ? Math.round((f.royalty / fmtRoyaltyTotal) * 100) : 0;
            return `
      <div class="list-row">
        <div>
          <div><strong>${escapeHtml(D.formatLabel(f.id))}</strong></div>
          <div class="meta">${money(f.royalty)} · ${D.formatInt(f.units)} units · ${share}% of total</div>
        </div>
        <div class="amount">${money(f.royalty)}</div>
      </div>`;
          })
          .join("") ||
          `<p class="muted tiny">No format tags yet.</p>`) +
        (known.length === 0 && fmtList.length
          ? `<p class="muted tiny" style="margin-top:0.65rem">Formats show as Unknown because the file was imported using royalty <em>rates</em> (70%, 35%…) instead of ebook/paperback. <strong>Clear KDP rows and re-import</strong> — we now read Royalty Type / Format correctly.</p>`
          : "");

    const tops = Object.values(agg.byBook)
      .sort((a, b) => b.royalty - a.royalty)
      .slice(0, 8);
    $("#top-titles").innerHTML =
      tops
        .map(
          (t) => `
      <div class="list-row">
        <div>
          <div>${escapeHtml(t.title)}</div>
          <div class="meta">${escapeHtml([t.series, t.penName, t.format].filter(Boolean).join(" · ")) || "—"}</div>
        </div>
        <div class="amount">${money(t.royalty)}</div>
      </div>`
        )
        .join("") || `<p class="muted">No royalties in this range. Import a report or load demo data.</p>`;

    $("#insights-list").innerHTML = buildInsights(agg, filters)
      .map((s) => `<li>${s}</li>`)
      .join("");
  }

  function buildInsights(agg, filters) {
    const tips = [];
    if (!agg.royaltyCount) {
      tips.push("No royalty rows yet. Use <strong>Import</strong> or load <strong>demo data</strong> to explore.");
      return tips;
    }

    const platEntries = Object.entries(agg.byPlatform).sort((a, b) => b[1].royalty - a[1].royalty);
    if (platEntries.length) {
      const top = D.PLATFORMS.find((p) => p.id === platEntries[0][0]);
      const share = ((platEntries[0][1].royalty / agg.income) * 100).toFixed(0);
      tips.push(
        `<strong>${top?.name || platEntries[0][0]}</strong> is ${share}% of royalties in this range — filter to that platform to dig in.`
      );
    }

    if (agg.spend > 0) {
      const margin = ((agg.net / agg.income) * 100).toFixed(0);
      if (agg.net < 0) {
        tips.push(
          `You're at a <strong>loss of ${money(Math.abs(agg.net))}</strong> after expenses. Check ads ROI on the Expenses page — a common r/selfpublish pain point.`
        );
      } else {
        tips.push(
          `Net margin is about <strong>${margin}%</strong> after expenses and ads (true profit, not just dashboard royalties).`
        );
      }
    } else {
      tips.push(
        `No expenses logged yet. Authors who only track income often overestimate profit — add covers, editing, and ad spend.`
      );
    }

    if (agg.kuIncome > 0 && state.showKenp) {
      const kuShare = ((agg.kuIncome / agg.income) * 100).toFixed(0);
      tips.push(`Kindle Unlimited is roughly <strong>${kuShare}%</strong> of royalties (${D.formatInt(agg.kenp)} KENP).`);
    }

    const ebook = agg.byFormat?.ebook?.royalty || 0;
    const paper = agg.byFormat?.paperback?.royalty || 0;
    if (ebook + paper > 0) {
      tips.push(
        `Format dollars: <strong>${money(ebook)} ebook</strong> vs <strong>${money(paper)} paperback</strong> in this range (see By format).`
      );
    }

    if (filters.platformId === "all" && platEntries.length > 3) {
      tips.push(`You're wide across <strong>${platEntries.length} stores</strong>. Use the platform filter to avoid double-counting if D2D + direct overlap.`);
    }

    return tips.slice(0, 5);
  }

  // ---------- Chart annotations ----------
  function renderAnnotationList() {
    const box = $("#chart-annotations-list");
    if (!box) return;
    const list = state.chartAnnotations || [];
    box.innerHTML = list
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((a) => `<span class="annotation-chip">${a.date} · ${escapeHtml(a.label)}<button type="button" data-annotation-id="${a.id}" title="Remove">&times;</button></span>`)
      .join("");
    $$("button[data-annotation-id]", box).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.chartAnnotations = (state.chartAnnotations || []).filter((a) => a.id !== btn.dataset.annotationId);
        persist();
        renderDashboard();
      });
    });
  }

  function openAnnotationModal() {
    openModal(
      "Add chart annotation",
      `<form id="annotation-form" class="form-grid" style="grid-template-columns:1fr">
        <label class="field"><span>Date</span><input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}" /></label>
        <label class="field"><span>Label</span><input type="text" name="label" required placeholder="e.g. BookBub feature" maxlength="40" /></label>
      </form>`,
      `<button type="button" class="btn ghost" data-close>Cancel</button>
       <button type="button" class="btn primary" id="annotation-save">Save</button>`
    );
    $("#annotation-save").onclick = () => {
      const fd = new FormData($("#annotation-form"));
      const label = String(fd.get("label") || "").trim();
      const date = fd.get("date");
      if (!label || !date) return toast("Date and label are required");
      state.chartAnnotations = state.chartAnnotations || [];
      state.chartAnnotations.push({ id: D.uid("an"), date, label });
      persist();
      closeModal();
      renderDashboard();
    };
    $$("[data-close]").forEach((b) => (b.onclick = closeModal));
  }

  // ---------- Platforms ----------
  function renderPlatforms() {
    const filters = getFilters();
    const agg = D.aggregate(state, { ...filters, platformId: "all" });

    $("#platform-cards").innerHTML = D.PLATFORMS.map((p) => {
      const stats = agg.byPlatform[p.id] || { royalty: 0, units: 0, kenp: 0, spend: 0, net: 0 };
      const conn = state.connectedPlatforms[p.id];
      const selected = filters.platformId === p.id;
      const icon = PIcons.iconMarkup(p.id);
      const iconInner = icon.type === "svg" ? icon.markup : `<img src="${icon.src}" alt="${p.name}" />`;
      return `
        <article class="platform-card ${selected ? "selected" : ""}" data-platform="${p.id}">
          <div class="pc-top">
            <div class="pc-icon${icon.tight ? " tight" : ""}" style="color:${p.color}">${iconInner}</div>
            <div>
              <h3>${p.name}</h3>
              <div class="meta muted tiny">${state.royalties.some((r) => r.platformId === p.id) ? "In use" : "Available"}</div>
            </div>
          </div>
          <div class="stats">
            <div><div class="stat-label">Royalties</div><div class="stat-value">${money(stats.royalty)}</div></div>
            <div><div class="stat-label">Units</div><div class="stat-value">${D.formatInt(stats.units)}</div></div>
            <div><div class="stat-label">Spend</div><div class="stat-value">${money(stats.spend)}</div></div>
            <div><div class="stat-label">Net</div><div class="stat-value" style="color:${stats.net >= 0 ? "var(--green)" : "var(--red)"}">${money(stats.net)}</div></div>
          </div>
          <div class="status ${conn?.connected ? "connected" : ""}">
            ${conn?.connected ? `Connected · last import ${conn.lastImport}` : "Not connected — import a report"}
          </div>
          <div class="muted tiny" style="margin-top:0.35rem">Click → dashboard for this store only</div>
        </article>`;
    }).join("");

    const generalEl = $("#platform-general-spend");
    if (generalEl) {
      generalEl.textContent =
        agg.generalSpend > 0
          ? `Plus ${money(agg.generalSpend)} in general expenses not tied to one platform (editing, ISBNs, tools…) — set a Platform when adding an expense to attribute it here.`
          : "";
    }

    $$("#platform-cards .platform-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.platform;
        // Ensure options exist, then select this platform (not toggle / not All)
        fillPlatformSelects();
        const sel = document.getElementById("platform-select");
        if (sel) {
          sel.value = id;
          // If option missing for any reason, add it
          if (sel.value !== id) {
            const p = D.PLATFORMS.find((x) => x.id === id);
            if (p) {
              const opt = document.createElement("option");
              opt.value = id;
              opt.textContent = p.name;
              sel.appendChild(opt);
              sel.value = id;
            }
          }
        }
        currentPage = "dashboard";
        $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.nav === "dashboard"));
        $$(".page").forEach((p) => p.classList.add("hidden"));
        document.getElementById("page-dashboard")?.classList.remove("hidden");
        document.getElementById("sidebar")?.classList.remove("open");
        renderDashboard();
      });
    });
  }

  // ---------- Books ----------
  function renderBooks() {
    const filters = getFilters();
    const agg = D.aggregate(state, filters);
    const byBook = Object.values(agg.byBook).sort((a, b) => b.royalty - a.royalty);

    // Merge catalog books with zero sales
    const seen = new Set(byBook.map((b) => b.bookId));
    state.books.forEach((b) => {
      if (!seen.has(b.id)) {
        byBook.push({
          bookId: b.id,
          title: b.title,
          series: b.series,
          penName: b.penName,
          format: b.format,
          royalty: 0,
          units: 0,
          kenp: 0,
        });
      }
    });

    const FORMAT_CHOICES = ["ebook", "paperback", "hardcover", "audiobook", "unknown"];
    const tbody = $("#books-table tbody");
    tbody.innerHTML =
      byBook
        .map((b) => {
          const isRealBook = state.books.some((x) => x.id === b.bookId);
          const catalogBook = isRealBook ? state.books.find((x) => x.id === b.bookId) : null;
          const fmtCell = isRealBook
            ? `<select class="book-format-select" data-book-id="${b.bookId}">
                 ${FORMAT_CHOICES.map((f) => `<option value="${f}" ${D.normalizeFormat(b.format) === f ? "selected" : ""}>${D.formatLabel(f)}</option>`).join("")}
               </select>`
            : `${escapeHtml(D.formatLabel(b.format)) || "—"} <span class="meta">(not in catalog — import-only)</span>`;
          const tags = catalogBook?.tags?.length
            ? `<div class="tag-chips">${catalogBook.tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>`
            : "";
          const titleCell = isRealBook
            ? `<button type="button" class="link-btn book-edit-btn" data-book-id="${b.bookId}">${escapeHtml(b.title)}</button>${tags}`
            : `${escapeHtml(b.title)}${tags}`;
          return `<tr>
        <td>${titleCell}</td>
        <td>${escapeHtml(b.series || "—")}</td>
        <td>${escapeHtml(b.penName || "—")}</td>
        <td>${fmtCell}</td>
        <td class="num">${D.formatInt(b.units)}</td>
        <td class="num">${money(b.royalty)}</td>
        <td class="num">${state.showKenp ? D.formatInt(b.kenp) : "—"}</td>
        <td>${isRealBook ? `<button type="button" class="btn ghost sm book-merge-btn" data-book-id="${b.bookId}">Merge into…</button>` : ""}</td>
      </tr>`;
        })
        .join("") || `<tr><td colspan="8" class="muted">No titles yet.</td></tr>`;

    $$(".book-merge-btn", tbody).forEach((btn) => {
      btn.addEventListener("click", () => openMergeBookModal(btn.dataset.bookId));
    });

    $$(".book-edit-btn", tbody).forEach((btn) => {
      btn.addEventListener("click", () => openBookModal(btn.dataset.bookId));
    });

    renderReadThrough();

    $$(".book-format-select", tbody).forEach((sel) => {
      sel.addEventListener("change", () => {
        const bookId = sel.dataset.bookId;
        const fmt = sel.value;
        const book = state.books.find((x) => x.id === bookId);
        if (!book) return;
        book.format = fmt;
        let touched = 0;
        state.royalties.forEach((r) => {
          if (r.bookId === bookId && r.type !== "ku") {
            r.format = fmt;
            touched++;
          }
        });
        persist();
        toast(`"${book.title}" set to ${D.formatLabel(fmt)} — updated ${touched} sale row${touched === 1 ? "" : "s"}.`);
        renderBooks();
      });
    });
  }

  /**
   * Read-through: what share of Book 1's buyers stuck around for Book 2, Book 3, etc.
   * Approximated from lifetime unit totals (no per-reader data exists to measure this
   * directly) — always all-time, independent of the dashboard's date filter, since a partial
   * window makes the ratio meaningless. Chained by *title*, not by catalog book id — an
   * ebook and paperback of the same title are format variants of one rung, not two separate
   * books in the chain, so their units are combined. Ordered by the optional "Book # in
   * series" field (from whichever format-variant has it set); titles without one sort after
   * numbered ones, alphabetically among themselves.
   */
  function renderReadThrough() {
    const panel = $("#read-through-panel");
    const body = $("#read-through-body");
    if (!panel || !body) return;

    const unitsByBook = {};
    state.royalties.forEach((r) => {
      if (!r.bookId) return;
      unitsByBook[r.bookId] = (unitsByBook[r.bookId] || 0) + (r.units || 0);
    });

    // Group catalog entries by (series, title) so format variants merge into one rung.
    const bySeries = {};
    state.books.forEach((b) => {
      const series = (b.series || "").trim();
      if (!series) return;
      bySeries[series] = bySeries[series] || {};
      const key = b.title.trim().toLowerCase();
      if (!bySeries[series][key]) {
        bySeries[series][key] = { title: b.title, seriesNumber: null, units: 0 };
      }
      const entry = bySeries[series][key];
      entry.units += unitsByBook[b.id] || 0;
      if (b.seriesNumber != null && entry.seriesNumber == null) entry.seriesNumber = b.seriesNumber;
    });

    const seriesNames = Object.keys(bySeries).filter((s) => Object.keys(bySeries[s]).length > 1);
    if (!seriesNames.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    body.innerHTML = seriesNames
      .sort((a, b) => a.localeCompare(b))
      .map((series) => {
        const titles = Object.values(bySeries[series]).sort((a, b) => {
          if (a.seriesNumber != null && b.seriesNumber != null) return a.seriesNumber - b.seriesNumber;
          if (a.seriesNumber != null) return -1;
          if (b.seriesNumber != null) return 1;
          return a.title.localeCompare(b.title);
        });
        const firstUnits = titles[0].units;
        const rows = titles
          .map((t, i) => {
            const label = t.seriesNumber != null ? `Book ${t.seriesNumber}` : `#${i + 1}`;
            const pct = i === 0 ? null : firstUnits > 0 ? (t.units / firstUnits) * 100 : null;
            const pctCell =
              i === 0
                ? '<span class="muted tiny">baseline</span>'
                : pct == null
                ? '<span class="muted tiny">—</span>'
                : `<strong style="color:${pct >= 50 ? "var(--green)" : pct >= 25 ? "var(--gold)" : "var(--red)"}">${pct.toFixed(0)}%</strong>`;
            return `<div class="readthrough-row">
              <div class="readthrough-label">${label} · ${escapeHtml(t.title)}</div>
              <div class="readthrough-units">${D.formatInt(t.units)} units</div>
              <div class="readthrough-pct">${pctCell}</div>
            </div>`;
          })
          .join("");
        return `<div class="readthrough-series">
          <h4>${escapeHtml(series)}</h4>
          ${rows}
        </div>`;
      })
      .join("");
  }

  /**
   * Merge two catalog entries that are really the same book — usually because different
   * platforms report the title slightly differently (subtitle, series tag, punctuation) and
   * no ASIN/ISBN was available in that report to match on automatically. Reassigns every
   * royalty row from the source book onto the target, combines known identifiers, and
   * removes the now-empty source entry. Only offers other books with the same format,
   * since merging across formats would corrupt the format breakdown.
   */
  function openMergeBookModal(sourceId) {
    const source = state.books.find((b) => b.id === sourceId);
    if (!source) return;
    const sourceFmt = D.normalizeFormat(source.format);
    const candidates = state.books.filter((b) => b.id !== sourceId && D.normalizeFormat(b.format) === sourceFmt);

    if (!candidates.length) {
      toast("No other book with the same format to merge into yet.");
      return;
    }

    const options = candidates
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((b) => `<option value="${b.id}">${escapeHtml(b.title)}${b.series ? ` — ${escapeHtml(b.series)}` : ""}</option>`)
      .join("");

    openModal(
      `Merge "${source.title}"`,
      `<p class="muted" style="margin-top:0">All sales rows for "${escapeHtml(source.title)}" will move to whichever book you pick below, and "${escapeHtml(source.title)}" will be removed from the catalog. This can't be undone (export a vault backup first if unsure).</p>
       <label class="field">
         <span>Merge into</span>
         <select id="merge-target">${options}</select>
       </label>`,
      `<button type="button" class="btn ghost" data-close>Cancel</button>
       <button type="button" class="btn primary" id="merge-confirm">Merge</button>`
    );
    $$("[data-close]").forEach((b) => (b.onclick = closeModal));
    $("#merge-confirm")?.addEventListener("click", () => {
      const targetId = $("#merge-target")?.value;
      const target = state.books.find((b) => b.id === targetId);
      if (!target) return;

      let moved = 0;
      state.royalties.forEach((r) => {
        if (r.bookId === sourceId) {
          r.bookId = targetId;
          moved++;
        }
      });
      target.identifiers = Array.from(new Set([...(target.identifiers || []), ...(source.identifiers || [])]));
      state.books = state.books.filter((b) => b.id !== sourceId);

      persist();
      closeModal();
      toast(`Merged "${source.title}" into "${target.title}" — moved ${moved} sale row${moved === 1 ? "" : "s"}.`);
      renderBooks();
    });
  }

  // ---------- Expenses ----------
  function renderExpenses() {
    const filters = getFilters();
    const agg = D.aggregate(state, filters);

    const ads = Object.entries(agg.byCategory)
      .filter(([id]) => id.startsWith("ads_"))
      .reduce((s, [, v]) => s + v, 0);
    const production = Object.entries(agg.byCategory)
      .filter(([id]) => ["cover", "editing", "formatting", "isbn", "narration"].includes(id))
      .reduce((s, [, v]) => s + v, 0);

    $("#expense-kpis").innerHTML = [
      { label: "Total spend", value: money(agg.spend), accent: "#f07178" },
      { label: "Ad spend", value: money(ads), accent: "#ed8936" },
      { label: "Production", value: money(production), accent: "#6cb6ff" },
      {
        label: "Ad ROI (rough)",
        value: ads > 0 ? `${((agg.income / ads) * 100).toFixed(0)}%` : "—",
        accent: "#3ecf8e",
      },
    ]
      .map(
        (k) =>
          `<div class="kpi" style="--accent:${k.accent}"><div class="label">${k.label}</div><div class="value">${k.value}</div></div>`
      )
      .join("");

    Charts.renderExpenseChart("chart-expenses", agg.byCategory, D.EXPENSE_CATEGORIES, money);

    const list = [...agg.expenses].sort((a, b) => b.date.localeCompare(a.date));
    $("#expense-list").innerHTML =
      list
        .map((e) => {
          const cat = D.EXPENSE_CATEGORIES.find((c) => c.id === e.categoryId);
          const plat = e.platformId ? D.PLATFORMS.find((p) => p.id === e.platformId) : null;
          const platTag = plat ? ` · <span style="color:${plat.color}">${escapeHtml(plat.name)}</span>` : "";
          return `<div class="list-row">
            <div>
              <div>${escapeHtml(cat?.name || e.categoryId)}</div>
              <div class="meta">${e.date} · ${escapeHtml(e.note || "")}${platTag}</div>
            </div>
            <div class="amount neg">−${money(e.amount)}</div>
            <div class="row-actions">
              <button type="button" class="btn ghost sm expense-edit-btn" data-expense-id="${e.id}">Edit</button>
              <button type="button" class="btn ghost sm expense-remove-btn" data-expense-id="${e.id}">Remove</button>
            </div>
          </div>`;
        })
        .join("") || `<p class="muted">No expenses in range.</p>`;

    $$(".expense-edit-btn", $("#expense-list")).forEach((btn) => {
      btn.addEventListener("click", () => openExpenseModal(btn.dataset.expenseId));
    });
    $$(".expense-remove-btn", $("#expense-list")).forEach((btn) => {
      btn.addEventListener("click", () => removeExpense(btn.dataset.expenseId));
    });
  }

  function removeExpense(id) {
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense) return;
    const cat = D.EXPENSE_CATEGORIES.find((c) => c.id === expense.categoryId);
    if (!confirm(`Remove this ${cat?.name || expense.categoryId} expense of ${money(expense.amount)} from ${expense.date}? This can't be undone.`)) return;
    state.expenses = state.expenses.filter((e) => e.id !== id);
    persist();
    toast("Expense removed");
    renderExpenses();
  }

  // ---------- Import ----------
  /**
   * Opens a report deep link. On desktop (pywebview), the embedded window has no login
   * session and target="_blank" mostly just does nothing there — route through the Python
   * bridge instead so it opens in the user's real, already-logged-in system browser. On the
   * web app, a normal new tab works fine.
   */
  function openExternalUrl(url) {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.open_external) {
      window.pywebview.api.open_external(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  function renderImport() {
    $("#export-guides").innerHTML = Imp.EXPORT_GUIDES.map((g) => {
      const linkBtn = g.url
        ? `<button type="button" class="btn ghost sm export-guide-link" data-url="${escapeHtml(g.url)}">
             Go to report ↗${g.urlVerified === false ? ' <span class="tiny muted">(unverified link)</span>' : ""}
           </button>`
        : "";
      const wordmark = PIcons.wordmarkSrc(g.id);
      const logo = wordmark ? `<img class="guide-wordmark" src="${wordmark}" alt="${g.title}" />` : "";

      const stepsHtml =
        g.steps && g.steps.length
          ? `<ol class="guide-steps">${g.steps.map((s) => `<li>${s}</li>`).join("")}</ol>`
          : "";
      const noteHtml = g.note ? `<p class="guide-note">${g.note}</p>` : "";
      const caveatHtml = g.caveat
        ? `<p class="guide-caveat"><strong>Heads up:</strong> ${g.caveat}</p>`
        : "";
      const confidenceHtml =
        g.confidence === "likely"
          ? `<p class="guide-confidence">⚠️ This platform changed its dashboard recently — steps below are the right general path, but an exact button label may have shifted. See the note below if something doesn't match.</p>`
          : "";

      return `<details><summary>${g.title}</summary>${logo}${confidenceHtml}${stepsHtml}${noteHtml}${caveatHtml}${linkBtn}</details>`;
    }).join("");
    $$(".export-guide-link", $("#export-guides")).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openExternalUrl(btn.dataset.url);
      });
    });

    const form = $("#manual-entry");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      const dateInput = form.querySelector('[name="date"]');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    }

    updateReplaceControl();
    renderImportSummary();
  }

  /** Existing-data table under the importer — lets someone see, and clear/replace, what's loaded per store. */
  function renderImportSummary() {
    const panel = document.getElementById("import-summary-panel");
    const box = document.getElementById("import-summary");
    if (!panel || !box) return;

    const rows = D.importSummary(state);
    panel.hidden = rows.length === 0;
    if (!rows.length) return;

    box.innerHTML = `<table class="data-table compact">
      <thead><tr><th>Platform</th><th class="num">Rows</th><th class="num">Royalties</th><th>Source file(s)</th><th>Last import</th><th></th></tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            const p = D.PLATFORMS.find((x) => x.id === r.platformId);
            const files = r.fileNames.length
              ? r.fileNames.slice(0, 2).join(", ") + (r.fileNames.length > 2 ? ` +${r.fileNames.length - 2} more` : "")
              : `<span class="muted">manual / older import</span>`;
            return `<tr>
              <td><span class="pill"><span class="dot" style="background:${p?.color || "#888"}"></span>${p?.name || r.platformId}</span></td>
              <td class="num">${D.formatInt(r.rows)}</td>
              <td class="num">${money(r.royalty)}</td>
              <td class="tiny">${files}</td>
              <td class="tiny">${r.lastImportedAt ? r.lastImportedAt.slice(0, 10) : "—"}</td>
              <td><button type="button" class="btn ghost sm" data-clear-platform="${r.platformId}">Clear</button></td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;

    $$("[data-clear-platform]", box).forEach((btn) => {
      btn.onclick = () => {
        const pid = btn.dataset.clearPlatform;
        const p = D.PLATFORMS.find((x) => x.id === pid);
        if (!confirm(`Remove all ${p?.name || pid} data from ${Brand.name}? This can't be undone — export a vault backup first if unsure.`)) return;
        D.removePlatformData(state, pid);
        persist();
        toast(`Cleared ${p?.name || pid}. Drop a new file to reload it.`);
        renderImport();
        updateReplaceControl();
      };
    });
  }

  /** Show/label the "replace instead of add" checkbox based on the platform currently selected in the importer. */
  function updateReplaceControl() {
    const wrap = document.getElementById("import-replace-wrap");
    const note = document.getElementById("import-replace-note");
    const checkbox = document.getElementById("import-replace");
    if (!wrap || !checkbox) return;
    const platformId = document.getElementById("import-platform")?.value;
    const existing = state.royalties.filter((r) => r.platformId === platformId);

    if (!existing.length) {
      wrap.hidden = true;
      checkbox.checked = false;
      return;
    }
    const total = existing.reduce((s, r) => s + (r.royalty || 0), 0);
    const p = D.PLATFORMS.find((x) => x.id === platformId);
    wrap.hidden = false;
    if (note) {
      note.textContent = `You already have ${existing.length} ${p?.name || platformId} rows (${money(total)}). Checking this replaces them with this file instead of adding on top — use this when re-uploading a corrected or updated report.`;
    }
  }

  function setImportReady(ready, statusText) {
    const btn = document.getElementById("import-run");
    const status = document.getElementById("import-status");
    if (btn) {
      if (ready) btn.removeAttribute("disabled");
      else btn.setAttribute("disabled", "disabled");
    }
    if (status && statusText != null) status.textContent = statusText;
  }

  function hideImportPreview() {
    const el = document.getElementById("import-preview");
    if (el) el.classList.add("hidden");
    document.getElementById("import-platform")?.removeAttribute("disabled");
  }

  function kdpMismatchHelp(platformId, stats) {
    if (platformId !== "kdp" && platformId !== "amazon") return "";
    return `
      <strong>If these totals don’t match KDP, it’s often the report — not a bug.</strong>
      <ul>
        <li><strong>Orders (Lifetime)</strong> = order history (can include free promos, pre-orders, estimated royalties). Not the same as “estimated royalties” on the main dashboard tile.</li>
        <li><strong>Prior Months’ Royalties</strong> = closer to what Amazon actually pays (finalized). Different number from Orders.</li>
        <li><strong>Payments / bank deposit</strong> = cash received (lags sales; withholding/tax).</li>
        <li><strong>Multiple Excel sheets</strong> are different views of the same period (by book, by format…). Import <em>one</em> detail sheet — never sum every tab.</li>
        <li>Marketplace currencies may not all be USD; ${Brand.name} stores the number as-is unless converted.</li>
        <li>Try another sheet in the dropdown above and watch the preview total change.</li>
      </ul>
      <span class="muted">Compare this preview’s <strong>Royalty total</strong> to the same figure inside Excel (select the royalty column → sum). If Excel sum ≠ preview, tell us — that’s a parser issue. If Excel sum = preview but ≠ KDP dashboard, use a different KDP report.</span>
    `;
  }

  /** "smart" (default, combine KDP per-format sheets) or "manual" (pick one sheet). */
  function getImportMode() {
    return document.getElementById("import-mode-manual")?.checked ? "manual" : "smart";
  }

  function renderKdpSmartPanel() {
    const banner = document.getElementById("import-kdp-smart");
    if (!banner) return;
    const smart = pendingImport?.kdpSmart;
    if (!smart) {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");

    const tbody = document.querySelector("#kdp-smart-table tbody");
    if (tbody) {
      const rowsHtml = smart.bySheet
        .map((s) => {
          const fmtLabel = s.included ? D.formatLabel(s.format) : "—";
          const cls = s.included ? "" : ' class="excluded-row"';
          const detail = s.included
            ? `<td>${escapeHtml(fmtLabel)}</td><td class="num">${D.formatInt(s.rowCount)}</td><td class="num">${money(s.royalty)}</td>`
            : `<td colspan="3" class="muted tiny">${escapeHtml(s.note || "Excluded")}</td>`;
          return `<tr${cls}><td>${escapeHtml(s.name)}</td>${detail}</tr>`;
        })
        .join("");
      const t = smart.totals;
      tbody.innerHTML =
        rowsHtml +
        `<tr class="format-total-row"><td><strong>Total (${t.sheetCount} sheet${t.sheetCount === 1 ? "" : "s"})</strong></td><td></td><td class="num"><strong>${D.formatInt(t.rowCount)}</strong></td><td class="num"><strong>${money(t.royalty)}</strong></td></tr>`;
    }

    const excludedEl = document.getElementById("kdp-smart-excluded");
    if (excludedEl) {
      excludedEl.textContent = smart.excluded.length
        ? `Not imported: ${smart.excluded.map((e) => e.name).join(", ")} — these repeat the numbers in the sheets above and would double-count if added too.`
        : "";
    }
  }

  function renderImportPreview() {
    const box = document.getElementById("import-preview");
    if (!box || !pendingImport) {
      hideImportPreview();
      return;
    }

    box.classList.remove("hidden");
    renderKdpSmartPanel();

    const smart = pendingImport.kdpSmart;
    const smartActive = !!smart && getImportMode() === "smart";

    // While smart mode is active, the import commits as "kdp" no matter what — lock the dropdown
    // so the replace-note above the Import button can't show a different platform than what's
    // actually about to happen. Unlocked again the moment manual mode is chosen.
    const platformSel = document.getElementById("import-platform");
    if (platformSel) {
      if (smartActive) {
        platformSel.value = "kdp";
        platformSel.setAttribute("disabled", "disabled");
      } else {
        platformSel.removeAttribute("disabled");
      }
    }

    const sheetWrap = document.getElementById("import-sheet-wrap");
    const tableWrap = document.getElementById("import-preview-table-wrap");

    if (smartActive) {
      // Smart mode: combined stats from every relevant sheet, skip the single-sheet table/picker.
      updateReplaceControl();
      if (sheetWrap) sheetWrap.hidden = true;
      if (tableWrap) tableWrap.hidden = true;

      pendingImport.preview = { ok: true, rows: smart.rows, platformId: "kdp" };

      const t = smart.totals;
      const statsEl = document.getElementById("import-preview-stats");
      const mapEl = document.getElementById("import-preview-map");
      const warnEl = document.getElementById("import-preview-warn");
      if (statsEl) {
        statsEl.innerHTML = [
          ["Sheets combined", D.formatInt(t.sheetCount)],
          ["Rows", D.formatInt(t.rowCount)],
          ["Royalty total", money(t.royalty)],
          ["Units", D.formatInt(t.units)],
          ["KENP", D.formatInt(t.kenp)],
          ["Date range", t.dateMin && t.dateMax ? `${t.dateMin} → ${t.dateMax}` : "—"],
        ]
          .map(([lbl, val]) => `<div class="stat"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`)
          .join("");
      }
      if (mapEl) mapEl.textContent = "Format for each row comes from its sheet name, not an in-file column.";
      if (warnEl) {
        warnEl.innerHTML = `
          <strong>Smart mode combines several sheets on purpose</strong> — that's different from the usual "pick one sheet" advice below, and is correct here because each sheet covers a different format (ebook/paperback/hardcover/audiobook/KENP), not the same sales viewed twice.
          <ul>
            <li><strong>Orders (Lifetime)</strong> can include free promos, pre-orders, or estimated royalties — this total may not match the main KDP dashboard tile.</li>
            <li><strong>Prior Months' Royalties</strong> report is closer to what Amazon actually pays out (finalized); Orders is unit/order history.</li>
            <li>Marketplace currencies may not all be USD; ${Brand.name} stores the number as-is unless converted.</li>
            <li>If a total looks off, switch to "Pick one sheet manually" above to inspect a single tab.</li>
          </ul>`;
      }

      const sheetNote = `${t.sheetCount} sheet${t.sheetCount === 1 ? "" : "s"} combined (auto)`;
      setImportReady(
        true,
        `Preview ready — royalty total ${money(t.royalty)} across ${t.rowCount} rows. ${sheetNote}. Compare to Excel/KDP, then Import.`
      );
      return;
    }

    if (tableWrap) tableWrap.hidden = false;

    const platformId = document.getElementById("import-platform")?.value || "kdp";
    const preview = Imp.previewImport(pendingImport.text, platformId);
    pendingImport.preview = preview;

    updateReplaceControl();

    // Sheet picker
    const sheetSel = document.getElementById("import-sheet");
    if (pendingImport.sheets && pendingImport.sheets.length > 1) {
      sheetWrap.hidden = false;
      const cur = pendingImport.sheetName;
      sheetSel.innerHTML = pendingImport.sheets
        .map(
          (s) =>
            `<option value="${escapeHtml(s.name)}" ${s.name === cur ? "selected" : ""}>${escapeHtml(s.name)} (~${s.rowCount} rows)</option>`
        )
        .join("");
    } else {
      sheetWrap.hidden = true;
    }

    const statsEl = document.getElementById("import-preview-stats");
    const mapEl = document.getElementById("import-preview-map");
    const warnEl = document.getElementById("import-preview-warn");
    const tbody = document.querySelector("#import-preview-table tbody");

    if (!preview.ok) {
      setImportReady(false, preview.error);
      statsEl.innerHTML = "";
      mapEl.textContent = preview.mapping
        ? `Headers seen: ${(preview.mapping.headers || []).slice(0, 15).join(", ")}`
        : "";
      warnEl.innerHTML = `<strong>Could not parse this sheet.</strong> ${escapeHtml(preview.error)} Try another Excel sheet or confirm columns include a date and royalty/units.`;
      tbody.innerHTML = "";
      return;
    }

    const s = preview.stats;
    statsEl.innerHTML = [
      ["Rows", D.formatInt(s.rowCount)],
      ["Royalty total", money(s.royalty)],
      ["Units", D.formatInt(s.units)],
      ["KENP", D.formatInt(s.kenp)],
      ["Titles", D.formatInt(s.titles)],
      ["Date range", s.dateMin && s.dateMax ? `${s.dateMin} → ${s.dateMax}` : "—"],
      ["KU rows", D.formatInt(s.kuRows)],
      ["$0 unit rows", D.formatInt(s.freeUnitRows)],
      ["Format unclear", D.formatInt(s.formatUnknownRows)],
    ]
      .map(
        ([lbl, val]) =>
          `<div class="stat"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`
      )
      .join("");

    const m = preview.mapping || {};
    mapEl.textContent = `Columns mapped — date: ${m.date || "?"} · title: ${m.title || "?"} · royalty: ${m.royalty || "?"} · units: ${m.units || "?"} · format: ${m.format || m.royaltyType || "?"} · kenp: ${m.kenp || "—"}`;

    const formatWarn =
      s.formatUnknownRows > 0
        ? `<strong>${s.formatUnknownRows} of ${s.rowCount} rows didn't state ebook/paperback/hardcover/audiobook.</strong>
           They'll import as "Unknown" — you can fix them in bulk afterwards on the <em>Books</em> page (each title has an editable format dropdown that re-tags every sale row for that title). This is usually the report's own layout, not a ${Brand.name} bug — some KDP marketplace views and B&amp;N monthly summaries don't include a format/binding column at all.`
        : "";
    warnEl.innerHTML = [kdpMismatchHelp(platformId, s), formatWarn].filter(Boolean).join("<hr style='border-color:var(--border);opacity:.4;margin:0.6rem 0'/>");

    tbody.innerHTML = preview.sample
      .map(
        (r) => `<tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml((r.title || "").slice(0, 48))}${r.format ? ` <span class="meta">(${escapeHtml(D.formatLabel(r.format))})</span>` : ""}</td>
        <td class="num">${D.formatInt(r.units)}</td>
        <td class="num">${money(r.royalty)}</td>
        <td>${escapeHtml(r.type)}</td>
      </tr>`
      )
      .join("");

    const sheetNote = pendingImport.sheetName ? ` Sheet: “${pendingImport.sheetName}”.` : "";
    setImportReady(
      true,
      `Preview ready — royalty total ${money(s.royalty)} across ${s.rowCount} rows.${sheetNote} Compare to Excel/KDP, then Import.`
    );
  }

  /** Read a File into { name, text, sheets, sheetName, sizeKb }, handling both CSV/TSV/TXT and Excel. */
  /** Content fingerprint of the raw file bytes (not the parsed text) — used to recognize
   * "this exact file was already imported" regardless of platform tag or parse path. */
  async function hashFile(file) {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function readFileToPayload(file) {
    const name = file.name || "report";
    const sizeKb = Math.round(file.size / 1024);
    const hash = await hashFile(file);

    if (Imp.isExcelFile && Imp.isExcelFile(name, file.type)) {
      if (typeof XLSX === "undefined") {
        throw new Error("Excel library still loading — wait a second and choose the file again (needs network once).");
      }
      const buf = await file.arrayBuffer();
      const wbInfo = Imp.readWorkbook(buf);
      const kdpSmart =
        wbInfo.sheets.length > 1 && Imp.buildKdpSmartPlan ? Imp.buildKdpSmartPlan(wbInfo.sheets) : null;
      return {
        name,
        text: wbInfo.text,
        sheetName: wbInfo.bestSheetName,
        sheets: wbInfo.sheets,
        kdpSmart: kdpSmart && kdpSmart.ok ? kdpSmart : null,
        sizeKb,
        hash,
      };
    }

    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsText(file);
    });
    if (!text.trim()) throw new Error(`${name} looks empty.`);
    return { name, text, sheets: null, sheetName: null, sizeKb, hash };
  }

  async function handleFile(file) {
    if (!file) {
      setImportReady(false, "No file selected.");
      hideImportPreview();
      return;
    }
    setImportReady(false, `Reading ${file.name || "file"}…`);
    hideImportPreview();
    const smartRadio = document.getElementById("import-mode-smart");
    if (smartRadio) smartRadio.checked = true; // reset to recommended mode for each new file
    try {
      pendingImport = await readFileToPayload(file);
      // Suggest "kdp" once, on first load, since a multi-sheet workbook shaped like this is a KDP
      // export — but this only sets the *default*; it never overrides a platform you pick afterward.
      if (pendingImport.kdpSmart) {
        const platformSel = document.getElementById("import-platform");
        if (platformSel) platformSel.value = "kdp";
      }
      renderImportPreview();
    } catch (err) {
      pendingImport = null;
      hideImportPreview();
      const msg = err && err.message ? err.message : "Could not read that file.";
      setImportReady(false, msg);
      toast(msg);
    }
  }

  /**
   * Multiple files dropped/selected at once: read + auto-detect each platform from its
   * headers (same detector the single-file path uses when no platform is forced), then
   * let the person confirm/adjust platform + replace-vs-add per file in one dialog.
   * This is the practical version of "just reload and it grabs everything" — the app
   * still never logs into any store, but you can drag your whole Downloads folder in.
   */
  async function handleFiles(fileList) {
    const files = [...fileList];
    if (files.length <= 1) return handleFile(files[0]);

    setImportReady(false, `Reading ${files.length} files…`);
    hideImportPreview();

    const results = [];
    for (const file of files) {
      try {
        const payload = await readFileToPayload(file);
        const parsed = Imp.importRoyaltyCSV(payload.text, null); // null → auto-detect platform from headers
        results.push({
          name: payload.name,
          text: payload.text,
          hash: payload.hash,
          sheetName: payload.sheetName,
          ok: parsed.ok,
          error: parsed.error,
          platformId: parsed.platformId || "other",
          rows: parsed.rows || [],
        });
      } catch (err) {
        results.push({ name: file.name, ok: false, error: err.message || "Could not read file." });
      }
    }
    openBulkImportModal(results);
  }

  /** Shared commit path for both single-file and bulk import — normalizes rows, matches/creates books, tracks the batch. */
  function commitImportRows(rows, platformId, { fileName, sheetName, replace, fileHash }) {
    if (replace) D.removePlatformData(state, platformId);

    const batchId = D.uid("batch");
    rows.forEach((r) => {
      r.platformId = platformId;
      r.batchId = batchId;
      const fmt = D.normalizeFormat(r.format || (r.type === "ku" ? "ku" : "unknown"));
      r.format = fmt;

      // Prefer matching by ASIN/ISBN — report titles vary by platform (subtitles, series
      // tags, punctuation) even for the exact same book, but the identifier doesn't.
      // Fall back to title+format text match when no identifier is present in the report.
      let book = null;
      if (r.identifier) {
        book = state.books.find((b) => (b.identifiers || []).includes(r.identifier));
      }
      if (!book) {
        book = state.books.find(
          (b) => b.title.toLowerCase() === (r.title || "").toLowerCase() && D.normalizeFormat(b.format) === fmt
        );
      }
      if (!book && r.title) {
        book = { id: D.uid("b"), title: r.title, series: "", penName: "", format: fmt === "unknown" ? "ebook" : fmt, identifiers: [] };
        state.books.push(book);
      }
      if (book) {
        if (!book.identifiers) book.identifiers = [];
        if (r.identifier && !book.identifiers.includes(r.identifier)) book.identifiers.push(r.identifier);
        r.bookId = book.id;
      }
      state.royalties.push(r);
    });

    const royaltyTotal = rows.reduce((s, r) => s + (r.royalty || 0), 0);
    D.addImportBatch(state, {
      id: batchId,
      platformId,
      fileName: fileName || "manual",
      fileHash: fileHash || null,
      kind: "royalty",
      sheetName: sheetName || null,
      importedAt: new Date().toISOString(),
      rowCount: rows.length,
      royaltyTotal,
    });
    state.connectedPlatforms[platformId] = {
      connected: true,
      lastImport: new Date().toISOString().slice(0, 10),
      method: "csv",
    };
    return { rowCount: rows.length, royaltyTotal };
  }

  function openBulkImportModal(results) {
    const platformOptions = (selected) =>
      D.PLATFORMS.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${p.name}</option>`).join("");

    const rowsHtml = results
      .map((r, i) => {
        if (!r.ok) {
          return `<div class="list-row bulk-row bulk-row-error">
            <div><div>${escapeHtml(r.name)}</div><div class="meta" style="color:var(--red)">${escapeHtml(r.error || "Could not parse this file.")}</div></div>
          </div>`;
        }
        const total = r.rows.reduce((s, x) => s + (x.royalty || 0), 0);
        const existing = state.royalties.filter((x) => x.platformId === r.platformId);
        const dupBatch = D.findImportBatchByHash(state, r.hash, "royalty");
        const dupWarning = dupBatch
          ? `<div class="meta" style="color:var(--red)">⚠️ This exact file was already imported on ${escapeHtml(dupBatch.importedAt.slice(0, 10))} (${dupBatch.rowCount} rows) — importing again will duplicate rows unless you check Replace below.</div>`
          : "";
        return `<div class="list-row bulk-row" data-bulk-index="${i}">
          <div style="flex:1;min-width:0">
            <div>${escapeHtml(r.name)}${r.sheetName ? ` <span class="meta">(${escapeHtml(r.sheetName)})</span>` : ""}</div>
            <div class="meta">${r.rows.length} rows · ${money(total)}</div>
            ${dupWarning}
            ${existing.length ? `<label class="field checkbox tiny" style="margin:0.35rem 0 0"><input type="checkbox" class="bulk-replace" data-idx="${i}" /><span>Replace ${existing.length} existing rows for this platform</span></label>` : ""}
          </div>
          <select class="bulk-platform" data-idx="${i}" style="width:auto">${platformOptions(r.platformId)}</select>
        </div>`;
      })
      .join("");

    const okCount = results.filter((r) => r.ok).length;
    openModal(
      `Import ${results.length} files`,
      `<p class="muted" style="margin-top:0">Platform was guessed from each file's column headers — check them before importing, especially anything marked "Other".</p>${rowsHtml}`,
      `<button type="button" class="btn secondary" data-close>Cancel</button>
       <button type="button" class="btn primary" id="bulk-import-confirm" ${okCount ? "" : "disabled"}>Import ${okCount} file${okCount === 1 ? "" : "s"}</button>`
    );
    $$("[data-close]").forEach((b) => (b.onclick = closeModal));
    $("#bulk-import-confirm")?.addEventListener("click", () => {
      let filesImported = 0;
      let rowsImported = 0;
      const allRows = [];
      results.forEach((r, i) => {
        if (!r.ok) return;
        const sel = document.querySelector(`.bulk-platform[data-idx="${i}"]`);
        const chk = document.querySelector(`.bulk-replace[data-idx="${i}"]`);
        const platformId = sel ? sel.value : r.platformId;
        const replace = chk ? chk.checked : false;
        const res = commitImportRows(r.rows, platformId, { fileName: r.name, sheetName: r.sheetName, replace, fileHash: r.hash });
        filesImported++;
        rowsImported += res.rowCount;
        allRows.push(...r.rows);
      });
      persist();
      closeModal();
      const message = `Imported ${filesImported} file${filesImported === 1 ? "" : "s"}, ${rowsImported} rows total.` + widenRangeToShowImport(allRows);
      toast(message);
      renderImport();
      navigate("dashboard");
    });
  }

  /**
   * After an import, make sure the currently-selected date range actually shows what was
   * just imported — otherwise "Last 30 days" (the default) silently hides most of a
   * historical report and it looks like the import lost data when it didn't.
   * Returns an extra sentence to append to the success toast, or "" if no change was needed.
   */
  function widenRangeToShowImport(importedRows) {
    if (!importedRows.length) return "";
    const sel = document.getElementById("range-select");
    if (!sel) return "";
    const dates = importedRows.map((r) => r.date).filter(Boolean).sort();
    const earliest = dates[0];
    const bounds = D.rangeBounds(sel.value, $("#range-from")?.value, $("#range-to")?.value);
    const earliestDate = new Date(earliest + "T12:00:00");
    if (earliestDate >= bounds.start) return ""; // already in view, leave the user's chosen range alone

    if (sel.value === "all") return "";
    sel.value = "all";
    $("#custom-range")?.classList.add("hidden");
    return ` Switched the date range to "All time" so you can see it.`;
  }

  function runImport() {
    if (!pendingImport) return;

    const smart = pendingImport.kdpSmart;
    const smartActive = !!smart && getImportMode() === "smart";
    const platformId = smartActive ? "kdp" : document.getElementById("import-platform")?.value;

    let result;
    let sheetNameForBatch;
    if (smartActive) {
      // Combined per-format sheets — use the already-built rows directly, don't re-parse from pendingImport.text
      // (pendingImport.text is just the auto-picked "best" single sheet and would silently drop the rest).
      result = { ok: true, rows: smart.rows, platformId: "kdp" };
      sheetNameForBatch = `${smart.totals.sheetCount} sheets (auto)`;
    } else {
      // Re-parse to attach platform + fresh ids for the currently selected sheet/platform
      result = Imp.importRoyaltyCSV(pendingImport.text, platformId);
      sheetNameForBatch = pendingImport.sheetName;
    }

    if (!result.ok) {
      document.getElementById("import-status").textContent = result.error;
      toast(result.error);
      return;
    }

    const replace = document.getElementById("import-replace")?.checked && !document.getElementById("import-replace-wrap")?.hidden;
    const total = result.rows.reduce((s, r) => s + (r.royalty || 0), 0);
    const dupBatch = D.findImportBatchByHash(state, pendingImport.hash, "royalty");
    const dupWarning = dupBatch
      ? `\n\n⚠️ This exact file was already imported on ${dupBatch.importedAt.slice(0, 10)} (${dupBatch.rowCount} rows). Importing again will add duplicate rows${replace ? "" : " unless you check “Replace existing data” above"}.`
      : "";
    const confirmMsg =
      (replace
        ? `Replace all existing ${D.PLATFORMS.find((p) => p.id === (result.platformId || platformId))?.name || platformId} data with these ${result.rows.length} rows totaling ${money(total)}?\n\nThis deletes the previously imported rows for this platform first.`
        : `Import ${result.rows.length} rows totaling ${money(total)}?\n\nIf this doesn’t match your store dashboard, cancel and try another sheet/report.`) + dupWarning;
    if (!confirm(confirmMsg)) return;

    commitImportRows(result.rows, result.platformId || platformId, {
      fileName: pendingImport.name,
      sheetName: sheetNameForBatch,
      replace,
      fileHash: pendingImport.hash,
    });

    persist();
    let message = `Imported ${result.rows.length} row(s) totaling ${money(total)}.`;
    message += widenRangeToShowImport(result.rows);
    pendingImport = null;
    const fileInput = document.getElementById("import-file");
    if (fileInput) fileInput.value = "";
    hideImportPreview();
    setImportReady(false, message);
    toast(message);
    navigate("dashboard");
  }

  // ---------- Expense import (CSV/Excel) ----------
  function guessExpenseCategoryId(raw) {
    if (!raw) return "other";
    const r = String(raw).toLowerCase().trim();
    const exact = D.EXPENSE_CATEGORIES.find((c) => c.id === r);
    if (exact) return exact.id;
    const byName = D.EXPENSE_CATEGORIES.find(
      (c) => c.name.toLowerCase() === r || c.name.toLowerCase().includes(r) || r.includes(c.name.toLowerCase())
    );
    return byName ? byName.id : "other";
  }

  function hideExpenseImportPreview() {
    document.getElementById("expense-import-preview")?.classList.add("hidden");
    document.getElementById("expense-import-run")?.setAttribute("disabled", "disabled");
  }

  async function handleExpenseFile(file) {
    if (!file) return;
    const status = document.getElementById("expense-import-status");
    if (status) status.textContent = `Reading ${file.name || "file"}…`;
    hideExpenseImportPreview();
    try {
      const payload = await readFileToPayload(file);
      const result = Imp.importExpensesFile(payload.text);
      if (!result.ok) {
        if (status) status.textContent = result.error;
        toast(result.error);
        pendingExpenseImport = null;
        return;
      }
      pendingExpenseImport = { name: file.name, rows: result.rows, allHaveDates: result.allHaveDates, hash: payload.hash };
      renderExpenseImportPreview();
      const dupBatch = D.findImportBatchByHash(state, payload.hash, "expense");
      if (dupBatch && status) {
        status.textContent = `⚠️ This exact file was already imported on ${dupBatch.importedAt.slice(0, 10)} (${dupBatch.rowCount} rows) — importing again will add duplicates.`;
      }
    } catch (err) {
      const msg = String(err?.message || err);
      if (status) status.textContent = msg;
      toast(msg);
    }
  }

  function updateExpenseImportTotals() {
    const trs = $$("#expense-import-table tbody tr");
    let total = 0;
    trs.forEach((tr) => {
      const cost = parseFloat(tr.querySelector(".exp-cost")?.value || "0");
      if (Number.isFinite(cost)) total += cost;
    });
    const countEl = document.getElementById("expense-import-count");
    const totalEl = document.getElementById("expense-import-total");
    if (countEl) countEl.textContent = D.formatInt(trs.length);
    if (totalEl) totalEl.textContent = money(total);
    const btn = document.getElementById("expense-import-run");
    if (btn) {
      if (trs.length > 0) btn.removeAttribute("disabled");
      else btn.setAttribute("disabled", "disabled");
    }
  }

  function renderExpenseImportPreview() {
    const box = document.getElementById("expense-import-preview");
    if (!box || !pendingExpenseImport) {
      hideExpenseImportPreview();
      return;
    }
    box.classList.remove("hidden");

    const yearWrap = document.getElementById("expense-import-year-wrap");
    const yearSel = document.getElementById("expense-import-year");
    if (!pendingExpenseImport.allHaveDates) {
      if (yearWrap) yearWrap.hidden = false;
      if (yearSel && !yearSel.dataset.filled) {
        const nowYear = new Date().getFullYear();
        const opts = [];
        for (let y = nowYear; y >= nowYear - 8; y--) opts.push(y);
        yearSel.innerHTML = opts.map((y) => `<option value="${y}">${y}</option>`).join("");
        yearSel.dataset.filled = "1";
      }
    } else if (yearWrap) {
      yearWrap.hidden = true;
    }

    const catOptions = D.EXPENSE_CATEGORIES.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    const platOptions =
      `<option value="" selected>General</option>` +
      D.PLATFORMS.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    const tbody = document.querySelector("#expense-import-table tbody");
    tbody.innerHTML = pendingExpenseImport.rows
      .map((r, i) => {
        const catId = guessExpenseCategoryId(r.categoryRaw);
        const options = catOptions.replace(`value="${catId}"`, `value="${catId}" selected`);
        return `<tr data-idx="${i}">
          <td><input type="text" class="exp-item" value="${escapeHtml(r.item)}" /></td>
          <td><input type="number" class="exp-cost" step="0.01" value="${r.cost.toFixed(2)}" /></td>
          <td>${r.date ? escapeHtml(r.date) : '<span class="muted tiny">uses year above</span>'}</td>
          <td><select class="exp-cat">${options}</select></td>
          <td><select class="exp-plat">${platOptions}</select></td>
          <td><button type="button" class="btn ghost sm exp-remove">Remove</button></td>
        </tr>`;
      })
      .join("");

    $$(".exp-cost", tbody).forEach((inp) => inp.addEventListener("input", updateExpenseImportTotals));
    $$(".exp-remove", tbody).forEach((btn) =>
      btn.addEventListener("click", () => {
        btn.closest("tr")?.remove();
        updateExpenseImportTotals();
      })
    );

    updateExpenseImportTotals();
  }

  function runExpenseImport() {
    if (!pendingExpenseImport) return;
    const yearSel = document.getElementById("expense-import-year");
    const fallbackYear = yearSel ? yearSel.value : String(new Date().getFullYear());
    const tbody = document.querySelector("#expense-import-table tbody");
    const trs = $$("tr", tbody);
    if (!trs.length) {
      toast("No rows left to import.");
      return;
    }

    const dupBatch = D.findImportBatchByHash(state, pendingExpenseImport.hash, "expense");
    if (dupBatch) {
      const ok = confirm(
        `This exact file was already imported on ${dupBatch.importedAt.slice(0, 10)} (${dupBatch.rowCount} expenses). Import it again anyway? This will add duplicate expenses.`
      );
      if (!ok) return;
    }

    const batchId = D.uid("batch");
    let count = 0;
    let total = 0;
    trs.forEach((tr) => {
      const idx = Number(tr.dataset.idx);
      const original = pendingExpenseImport.rows[idx];
      const item = tr.querySelector(".exp-item")?.value?.trim() || "Expense";
      const cost = parseFloat(tr.querySelector(".exp-cost")?.value || "0");
      const categoryId = tr.querySelector(".exp-cat")?.value || "other";
      const platformId = tr.querySelector(".exp-plat")?.value || null;
      if (!Number.isFinite(cost) || cost <= 0) return;
      const date = (original && original.date) || `${fallbackYear}-01-01`;
      state.expenses.push({
        id: D.uid("e"),
        date,
        categoryId,
        platformId,
        amount: cost,
        note: item,
        bookId: null,
        recurring: false,
        batchId,
      });
      count++;
      total += cost;
    });

    if (!count) {
      toast("No valid rows to import — check the cost column.");
      return;
    }

    D.addImportBatch(state, {
      id: batchId,
      platformId: null,
      fileName: pendingExpenseImport.name,
      fileHash: pendingExpenseImport.hash,
      kind: "expense",
      sheetName: null,
      importedAt: new Date().toISOString(),
      rowCount: count,
      royaltyTotal: total,
    });

    persist();
    pendingExpenseImport = null;
    const fileInput = document.getElementById("expense-import-file");
    if (fileInput) fileInput.value = "";
    hideExpenseImportPreview();
    const message = `Imported ${count} expense(s) totaling ${money(total)}.`;
    const status = document.getElementById("expense-import-status");
    if (status) status.textContent = message;
    toast(message);
    navigate("expenses");
  }

  // ---------- Tax ----------
  function renderTax() {
    const yearSel = $("#tax-year");
    const years = new Set(state.royalties.map((r) => r.date.slice(0, 4)));
    state.expenses.forEach((e) => years.add(e.date.slice(0, 4)));
    if (!years.size) years.add(String(new Date().getFullYear()));
    const sorted = [...years].sort().reverse();
    const cur = yearSel.value || sorted[0];
    yearSel.innerHTML = sorted.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearSel.value = sorted.includes(cur) ? cur : sorted[0];

    const year = yearSel.value;
    const yearRoyalties = state.royalties.filter((r) => r.date.startsWith(year));
    const yearExpenses = state.expenses.filter((e) => e.date.startsWith(year));
    const income = yearRoyalties.reduce((s, r) => s + r.royalty, 0);
    const spend = yearExpenses.reduce((s, e) => s + e.amount, 0);

    $("#tax-summary").innerHTML = [
      { label: `${year} royalties`, value: money(income), accent: "#d4a84b" },
      { label: `${year} expenses`, value: money(spend), accent: "#f07178" },
      { label: `${year} net`, value: money(income - spend), accent: "#3ecf8e" },
      { label: "Rows", value: `${yearRoyalties.length} / ${yearExpenses.length}`, accent: "#6cb6ff" },
    ]
      .map(
        (k) =>
          `<div class="kpi" style="--accent:${k.accent}"><div class="label">${k.label}</div><div class="value">${k.value}</div></div>`
      )
      .join("");

    const panel = $("#tax-detail-panel");
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      months[key] = { month: key, royalty: 0, expense: 0 };
    }
    yearRoyalties.forEach((r) => {
      const k = r.date.slice(0, 7);
      if (months[k]) months[k].royalty += r.royalty;
    });
    yearExpenses.forEach((e) => {
      const k = e.date.slice(0, 7);
      if (months[k]) months[k].expense += e.amount;
    });

    const table = `<table class="data-table"><thead><tr><th>Month</th><th class="num">Royalties</th><th class="num">Expenses</th><th class="num">Net</th></tr></thead><tbody>
      ${Object.values(months)
        .map(
          (m) =>
            `<tr><td>${m.month}</td><td class="num">${money(m.royalty)}</td><td class="num">${money(m.expense)}</td><td class="num">${money(m.royalty - m.expense)}</td></tr>`
        )
        .join("")}
    </tbody></table>`;

    $("#tax-monthly").innerHTML = table;
  }

  function exportCSV() {
    const lines = ["date,platform,title,type,royalty,units,kenp"];
    state.royalties.forEach((r) => {
      lines.push(
        [r.date, r.platformId, csvEscape(r.title), r.type, r.royalty, r.units, r.kenp].join(",")
      );
    });
    lines.push("");
    lines.push("date,category,amount,note");
    state.expenses.forEach((e) => {
      lines.push([e.date, e.categoryId, e.amount, csvEscape(e.note || "")].join(","));
    });
    downloadBlob(lines.join("\n"), `${Brand.slug}-export-${Date.now()}.csv`, "text/csv");
    toast("CSV downloaded.");
  }

  function exportJSON() {
    downloadBlob(JSON.stringify(state, null, 2), `${Brand.slug}-backup-${Date.now()}.json`, "application/json");
    toast("JSON backup downloaded.");
  }

  // ---------- Settings ----------
  function renderSettings() {
    $("#currency-select").value = state.currency || "USD";
    $("#show-kenp").checked = !!state.showKenp;
    $("#compact-mode").checked = !!state.compactMode;
  }

  // ---------- Modals ----------
  function openModal(title, bodyHtml, footHtml) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHtml;
    $("#modal-foot").innerHTML = footHtml || "";
    $("#modal-root").classList.remove("hidden");
  }

  function closeModal() {
    $("#modal-root").classList.add("hidden");
  }

  function openExpenseModal(editId) {
    const existing = editId ? state.expenses.find((e) => e.id === editId) : null;
    const cats = D.EXPENSE_CATEGORIES.map(
      (c) => `<option value="${c.id}" ${existing?.categoryId === c.id ? "selected" : ""}>${c.name}</option>`
    ).join("");
    const platOptions =
      `<option value="">— General (not tied to one platform) —</option>` +
      D.PLATFORMS.map((p) => `<option value="${p.id}" ${existing?.platformId === p.id ? "selected" : ""}>${p.name}</option>`).join("");
    openModal(
      existing ? "Edit expense" : "Add expense",
      `<form id="expense-form" class="form-grid" style="grid-template-columns:1fr">
        <label class="field"><span>Date</span><input type="date" name="date" required value="${existing?.date || new Date().toISOString().slice(0, 10)}" /></label>
        <label class="field"><span>Category</span><select name="categoryId">${cats}</select></label>
        <label class="field"><span>Platform</span><select name="platformId">${platOptions}</select></label>
        <label class="field"><span>Amount (USD)</span><input type="number" name="amount" step="0.01" min="0" required value="${existing?.amount ?? ""}" /></label>
        <label class="field"><span>Note</span><input type="text" name="note" placeholder="e.g. AMS Ember Protocol" value="${escapeHtml(existing?.note || "")}" /></label>
      </form>`,
      `<button type="button" class="btn ghost" data-close>Cancel</button>
       <button type="button" class="btn primary" id="expense-save">Save</button>`
    );
    $("#expense-save").onclick = () => {
      const form = $("#expense-form");
      const fd = new FormData(form);
      const amount = parseFloat(fd.get("amount"));
      if (!amount) return toast("Enter an amount");
      const fields = {
        date: fd.get("date"),
        categoryId: fd.get("categoryId"),
        platformId: fd.get("platformId") || null,
        amount,
        note: fd.get("note") || "",
      };
      if (existing) {
        Object.assign(existing, fields);
      } else {
        state.expenses.push({
          id: D.uid("e"),
          ...fields,
          bookId: null,
          recurring: false,
        });
      }
      persist();
      closeModal();
      toast(existing ? "Expense updated" : "Expense added");
      renderExpenses();
    };
    $$("[data-close]").forEach((b) => (b.onclick = closeModal));
  }

  /** Comma-separated text -> trimmed, de-duped, non-empty tag array. */
  function parseTagList(raw) {
    return Array.from(
      new Set(
        String(raw || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
  }

  function openBookModal(editId) {
    const existing = editId ? state.books.find((b) => b.id === editId) : null;
    openModal(
      existing ? "Edit title" : "Add title",
      `<form id="book-form" class="form-grid" style="grid-template-columns:1fr">
        <label class="field"><span>Title</span><input type="text" name="title" required value="${escapeHtml(existing?.title || "")}" /></label>
        <label class="field"><span>Series</span><input type="text" name="series" value="${escapeHtml(existing?.series || "")}" /></label>
        <label class="field"><span>Book # in series (optional)</span><input type="number" name="seriesNumber" min="1" step="1" value="${existing?.seriesNumber ?? ""}" /></label>
        <label class="field"><span>Pen name</span><input type="text" name="penName" value="${escapeHtml(existing?.penName || "")}" /></label>
        <label class="field"><span>Format</span>
          <select name="format">
            ${["ebook", "paperback", "hardcover", "audiobook"]
              .map((f) => `<option value="${f}" ${existing?.format === f ? "selected" : ""}>${D.formatLabel(f)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field"><span>Tags (comma-separated)</span><input type="text" name="tags" placeholder="box-set, trilogy, 2024-release" value="${escapeHtml((existing?.tags || []).join(", "))}" /></label>
        <label class="field"><span>Aliases (comma-separated)</span><input type="text" name="aliases" placeholder="alternate titles, e.g. a UK edition name" value="${escapeHtml((existing?.aliases || []).join(", "))}" /></label>
      </form>`,
      `<button type="button" class="btn ghost" data-close>Cancel</button>
       <button type="button" class="btn primary" id="book-save">Save</button>`
    );
    $("#book-save").onclick = () => {
      const fd = new FormData($("#book-form"));
      const title = String(fd.get("title") || "").trim();
      if (!title) return toast("Title required");
      const seriesNumberRaw = fd.get("seriesNumber");
      const seriesNumber = seriesNumberRaw ? parseInt(seriesNumberRaw, 10) : null;
      const fields = {
        title,
        series: String(fd.get("series") || ""),
        seriesNumber: Number.isFinite(seriesNumber) ? seriesNumber : null,
        penName: String(fd.get("penName") || ""),
        format: String(fd.get("format") || "ebook"),
        tags: parseTagList(fd.get("tags")),
        aliases: parseTagList(fd.get("aliases")),
      };
      if (existing) {
        Object.assign(existing, fields);
      } else {
        state.books.push({ id: D.uid("b"), ...fields });
      }
      persist();
      closeModal();
      toast(existing ? "Title updated" : "Title added");
      renderBooks();
    };
    $$("[data-close]").forEach((b) => (b.onclick = closeModal));
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function csvEscape(s) {
    const t = String(s);
    if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Landing platforms ----------
  function renderLandingPlatforms() {
    const el = $("#landing-platforms");
    if (!el) return;
    el.innerHTML = D.PLATFORMS.map(
      (p) => `<span class="pill"><span class="dot" style="background:${p.color}"></span>${p.name}</span>`
    ).join("");
  }

  // ---------- Events ----------
  function bindEvents() {
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-action]");
      if (t) {
        const action = t.dataset.action;
        if (action === "load-demo") loadDemo();
        if (action === "enter-app") enterApp();
      }
      const nav = e.target.closest("[data-nav]");
      if (nav) navigate(nav.dataset.nav);
    });

    $("#btn-clear-demo")?.addEventListener("click", clearDemoData);
    $("#btn-clear-demo-settings")?.addEventListener("click", clearDemoData);
    $("#btn-restore-pre-demo")?.addEventListener("click", restorePreDemo);

    $("#menu-toggle")?.addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
    });

    $("#range-select")?.addEventListener("change", () => {
      const v = $("#range-select").value;
      $("#custom-range").classList.toggle("hidden", v !== "custom");
      renderPage(currentPage);
    });

    $("#range-from")?.addEventListener("change", () => renderPage(currentPage));
    $("#range-to")?.addEventListener("change", () => renderPage(currentPage));
    $("#platform-select")?.addEventListener("change", () => renderPage(currentPage));

    $("#add-expense-btn")?.addEventListener("click", () => openExpenseModal());
    $("#goto-expense-import-btn")?.addEventListener("click", () => {
      navigate("import");
      const section = document.getElementById("expense-dropzone")?.closest("section.panel");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        section.classList.add("highlight-pulse");
        setTimeout(() => section.classList.remove("highlight-pulse"), 1800);
      }
    });
    $("#add-book-btn")?.addEventListener("click", () => openBookModal());
    $("#add-annotation-btn")?.addEventListener("click", openAnnotationModal);
    $("#modal-close")?.addEventListener("click", closeModal);
    $("#modal-root")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-root") closeModal();
    });

    const drop = document.getElementById("dropzone");
    const fileInput = document.getElementById("import-file");

    // Desktop WebViews often grey out .xlsx if accept= is too narrow — keep MIME + wildcard
    if (fileInput) {
      fileInput.setAttribute(
        "accept",
        [
          ".csv",
          ".tsv",
          ".txt",
          ".xlsx",
          ".xls",
          ".xlsm",
          "text/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
          "*/*",
        ].join(",")
      );
    }

    // Click uses the real <input type="file"> overlay (see CSS) — no programmatic .click()
    fileInput?.addEventListener("change", () => {
      const fs = fileInput.files;
      if (fs && fs.length > 1) handleFiles(fs);
      else if (fs && fs[0]) handleFile(fs[0]);
      // Reset so the same file can be chosen again
      try {
        fileInput.value = "";
      } catch {
        /* ignore */
      }
    });

    // Drag-and-drop still works on the zone
    ["dragenter", "dragover"].forEach((ev) => {
      drop?.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.add("dragover");
      });
      fileInput?.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        drop?.classList.add("dragover");
      });
    });
    ["dragleave"].forEach((ev) => {
      drop?.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("dragover");
      });
    });
    const onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop?.classList.remove("dragover");
      const fs = e.dataTransfer?.files;
      if (fs && fs.length > 1) handleFiles(fs);
      else if (fs && fs[0]) handleFile(fs[0]);
    };
    drop?.addEventListener("drop", onDrop);
    fileInput?.addEventListener("drop", onDrop);

    document.getElementById("import-run")?.addEventListener("click", (e) => {
      e.preventDefault();
      runImport();
    });

    // Expense CSV/Excel import — same dropzone pattern as the royalty importer above
    const expenseDrop = document.getElementById("expense-dropzone");
    const expenseFileInput = document.getElementById("expense-import-file");
    if (expenseFileInput) {
      expenseFileInput.setAttribute(
        "accept",
        [
          ".csv",
          ".tsv",
          ".txt",
          ".xlsx",
          ".xls",
          ".xlsm",
          "text/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
          "*/*",
        ].join(",")
      );
    }
    expenseFileInput?.addEventListener("change", () => {
      const f = expenseFileInput.files?.[0];
      if (f) handleExpenseFile(f);
      try {
        expenseFileInput.value = "";
      } catch {
        /* ignore */
      }
    });
    ["dragenter", "dragover"].forEach((ev) => {
      expenseDrop?.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        expenseDrop.classList.add("dragover");
      });
      expenseFileInput?.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        expenseDrop?.classList.add("dragover");
      });
    });
    ["dragleave"].forEach((ev) => {
      expenseDrop?.addEventListener(ev, (e) => {
        e.preventDefault();
        expenseDrop.classList.remove("dragover");
      });
    });
    const onExpenseDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      expenseDrop?.classList.remove("dragover");
      const f = e.dataTransfer?.files?.[0];
      if (f) handleExpenseFile(f);
    };
    expenseDrop?.addEventListener("drop", onExpenseDrop);
    expenseFileInput?.addEventListener("drop", onExpenseDrop);
    document.getElementById("expense-import-run")?.addEventListener("click", (e) => {
      e.preventDefault();
      runExpenseImport();
    });

    document.getElementById("import-sheet")?.addEventListener("change", (e) => {
      if (!pendingImport?.sheets) return;
      const name = e.target.value;
      const sheet = pendingImport.sheets.find((s) => s.name === name);
      if (!sheet) return;
      pendingImport.sheetName = name;
      pendingImport.text = sheet.csv;
      renderImportPreview();
    });

    document.getElementById("import-platform")?.addEventListener("change", () => {
      if (pendingImport?.text) renderImportPreview();
      updateReplaceControl();
    });

    document.getElementById("import-mode-smart")?.addEventListener("change", () => {
      if (pendingImport) renderImportPreview();
    });
    document.getElementById("import-mode-manual")?.addEventListener("change", () => {
      if (pendingImport) renderImportPreview();
    });

    $("#manual-entry")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const platformId = fd.get("platform");
      const title = String(fd.get("title") || "Manual entry");
      let book = state.books.find((b) => b.title.toLowerCase() === title.toLowerCase());
      if (!book && title !== "Manual entry") {
        book = { id: D.uid("b"), title, series: "", penName: "", format: "ebook" };
        state.books.push(book);
      }
      state.royalties.push({
        id: D.uid("r"),
        date: fd.get("date"),
        platformId,
        bookId: book?.id || null,
        title,
        royalty: parseFloat(fd.get("royalty")) || 0,
        units: parseInt(fd.get("units"), 10) || 0,
        kenp: parseInt(fd.get("kenp"), 10) || 0,
        type: parseInt(fd.get("kenp"), 10) > 0 && !(parseInt(fd.get("units"), 10) > 0) ? "ku" : "sale",
        currency: "USD",
      });
      state.connectedPlatforms[platformId] = {
        connected: true,
        lastImport: fd.get("date"),
        method: "manual",
      };
      persist();
      toast("Royalty entry added");
      e.target.reset();
      const dateInput = e.target.querySelector('[name="date"]');
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
      navigate("dashboard");
    });

    $("#tax-year")?.addEventListener("change", renderTax);
    $("#export-csv")?.addEventListener("click", exportCSV);
    $("#export-json")?.addEventListener("click", exportJSON);

    $("#vault-export")?.addEventListener("click", exportVault);
    $("#vault-import")?.addEventListener("change", (e) => {
      importVaultFile(e.target.files?.[0]);
      e.target.value = "";
    });

    $("#currency-select")?.addEventListener("change", (e) => {
      state.currency = e.target.value;
      persist();
      refreshAll();
    });
    $("#show-kenp")?.addEventListener("change", (e) => {
      state.showKenp = e.target.checked;
      persist();
      refreshAll();
    });
    $("#compact-mode")?.addEventListener("change", (e) => {
      state.compactMode = e.target.checked;
      persist();
      document.body.classList.toggle("compact", state.compactMode);
    });

    $("#export-backup")?.addEventListener("click", exportVault);
    $("#restore-backup")?.addEventListener("change", (e) => {
      importVaultFile(e.target.files?.[0]);
      e.target.value = "";
    });
    $("#reset-data")?.addEventListener("click", async () => {
      if (confirm(`Delete all local ${Brand.name} data on this device?`)) {
        state = D.defaultState();
        state.firstVisit = false;
        persist();
        toast("Data cleared");
        await refreshAll();
      }
    });
  }

  function migrateDemoFlag() {
    // Older builds didn't set isDemo; recognize stock sample titles
    if (state.isDemo) return;
    if (!state.books?.length || !state.royalties?.length) return;
    const demoTitles = new Set([
      "Ember Protocol",
      "Glass Orchard",
      "Night Market Heist",
      "Letters from the Salt Flats",
      "Winter of Quiet Engines",
    ]);
    const hits = state.books.filter((b) => demoTitles.has(b.title)).length;
    if (hits >= 3 && hits === state.books.length) {
      state.isDemo = true;
      D.saveState(state);
    }
  }

  // ---------- Boot ----------
  // Manually bumped on each meaningful change. Only used as a fallback for the plain web/PWA
  // app, which has no server able to inject a real build stamp the way the desktop app does
  // (see desktop/app.py's compute_build_stamp) — if the sidebar already shows a real stamp,
  // this leaves it alone rather than overwriting it with a less precise hardcoded value.
  const CLIENT_BUILD_FALLBACK = "2026-10-20 (free, no paywall)";

  async function boot() {
    renderLandingPlatforms();
    bindEvents();
    migrateDemoFlag();
    fillPlatformSelects();
    updateDemoChrome();

    const buildEl = document.getElementById("build-stamp");
    if (buildEl && buildEl.textContent.includes("unknown")) {
      buildEl.textContent = "build: " + CLIENT_BUILD_FALLBACK;
    }

    if (state.firstVisit && !state.royalties.length) {
      showLanding();
    } else {
      showApp();
    }

    // Avoid SW caching old paywall during active development
    if ("serviceWorker" in navigator && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
