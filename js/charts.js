/**
 * Chart.js helpers
 */
(function (global) {
  const charts = {};

  const gridColor = "rgba(255,255,255,0.06)";
  const tickColor = "#8b97a8";

  function baseOptions(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: tickColor, boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: "#1a2430",
          titleColor: "#eef2f6",
          bodyColor: "#c5ced9",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { color: gridColor },
          border: { color: gridColor },
        },
        y: {
          ticks: { color: tickColor },
          grid: { color: gridColor },
          border: { color: gridColor },
        },
      },
      ...extra,
    };
  }

  function destroy(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function moneyTicks(currencyFmt) {
    return {
      callback(v) {
        return currencyFmt(v);
      },
    };
  }

  // Rough time value for any of the bucket-key shapes renderIncomeChart's x-axis can use
  // (YYYY-MM-DD daily, YYYY-MM monthly, YYYY-Wnn weekly) so an annotation's plain date can
  // be matched to the nearest plotted point regardless of which bucketing kicked in.
  function bucketKeyToTime(key) {
    const weekMatch = /^(\d{4})-W(\d{2})$/.exec(key);
    if (weekMatch) {
      const [, year, week] = weekMatch;
      return new Date(`${year}-01-01T00:00:00`).getTime() + (Number(week) - 1) * 7 * 86400000;
    }
    if (/^\d{4}-\d{2}$/.test(key)) return new Date(`${key}-01T00:00:00`).getTime();
    return new Date(`${key}T00:00:00`).getTime();
  }

  // Draws each annotation as a dashed vertical line + small label at the plotted point
  // nearest its date. Registered per-chart (not globally) so it never touches other charts.
  function annotationPlugin(points, annotations) {
    return {
      id: "wl-annotations",
      afterDraw(chart) {
        if (!annotations || !annotations.length) return;
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        ctx.save();
        annotations.forEach((a) => {
          const targetTime = bucketKeyToTime(a.date);
          let bestIdx = 0;
          let bestDiff = Infinity;
          points.forEach((p, i) => {
            const diff = Math.abs(bucketKeyToTime(p.date) - targetTime);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = i;
            }
          });
          const x = scales.x.getPixelForValue(bestIdx);
          ctx.strokeStyle = "rgba(212,168,75,0.55)";
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#d4a84b";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(a.label, Math.min(x + 4, chartArea.right - ctx.measureText(a.label).width - 4), chartArea.top + 10);
        });
        ctx.restore();
      },
    };
  }

  function renderIncomeChart(canvasId, daily, formatMoney, annotations) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === "undefined") return;

    // Bucket to weeks if many points
    let points = daily;
    if (daily.length > 60) {
      const buckets = {};
      daily.forEach((d) => {
        const week = d.date.slice(0, 7); // monthly for long ranges
        if (!buckets[week]) buckets[week] = { date: week, royalty: 0 };
        buckets[week].royalty += d.royalty;
      });
      points = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
    } else if (daily.length > 31) {
      const buckets = {};
      daily.forEach((d) => {
        const dt = new Date(d.date + "T12:00:00");
        const onejan = new Date(dt.getFullYear(), 0, 1);
        const week = Math.ceil(((dt - onejan) / 86400000 + onejan.getDay() + 1) / 7);
        const key = `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`;
        if (!buckets[key]) buckets[key] = { date: key, royalty: 0 };
        buckets[key].royalty += d.royalty;
      });
      points = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
    }

    charts[canvasId] = new Chart(el, {
      type: "line",
      data: {
        labels: points.map((p) => p.date),
        datasets: [
          {
            label: "Royalties",
            data: points.map((p) => +p.royalty.toFixed(2)),
            borderColor: "#d4a84b",
            backgroundColor: "rgba(212,168,75,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: points.length > 40 ? 0 : 3,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      plugins: [annotationPlugin(points, annotations)],
      options: baseOptions({
        scales: {
          x: {
            ticks: { color: tickColor, maxTicksLimit: 8 },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: tickColor, ...moneyTicks((v) => formatMoney(v).replace(/\.00$/, "")) },
            grid: { color: gridColor },
          },
        },
      }),
    });
  }

  function renderPlatformChart(canvasId, byPlatform, platforms, formatMoney) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === "undefined") return;

    const entries = Object.entries(byPlatform)
      .map(([id, v]) => {
        const p = platforms.find((x) => x.id === id);
        return { id, name: p?.short || id, color: p?.color || "#718096", royalty: v.royalty };
      })
      .filter((e) => e.royalty > 0)
      .sort((a, b) => b.royalty - a.royalty);

    charts[canvasId] = new Chart(el, {
      type: "doughnut",
      data: {
        labels: entries.map((e) => e.name),
        datasets: [
          {
            data: entries.map((e) => +e.royalty.toFixed(2)),
            backgroundColor: entries.map((e) => e.color),
            borderColor: "#161e28",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: tickColor, boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                return ` ${ctx.label}: ${formatMoney(ctx.raw)}`;
              },
            },
          },
        },
        cutout: "62%",
      },
    });
  }

  function renderPnLChart(canvasId, daily, formatMoney) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === "undefined") return;

    // Monthly buckets for clarity
    const buckets = {};
    daily.forEach((d) => {
      const m = d.date.slice(0, 7);
      if (!buckets[m]) buckets[m] = { royalty: 0, expense: 0 };
      buckets[m].royalty += d.royalty;
      buckets[m].expense += d.expense;
    });
    const months = Object.keys(buckets).sort();

    charts[canvasId] = new Chart(el, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          {
            label: "Income",
            data: months.map((m) => +buckets[m].royalty.toFixed(2)),
            backgroundColor: "rgba(62, 207, 142, 0.75)",
            borderRadius: 4,
          },
          {
            label: "Expenses",
            data: months.map((m) => +buckets[m].expense.toFixed(2)),
            backgroundColor: "rgba(240, 113, 120, 0.7)",
            borderRadius: 4,
          },
        ],
      },
      options: baseOptions({
        scales: {
          x: {
            ticks: { color: tickColor, maxTicksLimit: 10 },
            grid: { display: false },
          },
          y: {
            ticks: { color: tickColor, ...moneyTicks((v) => formatMoney(v).replace(/\.00$/, "")) },
            grid: { color: gridColor },
          },
        },
      }),
    });
  }

  const FORMAT_COLORS = {
    ebook: "#6cb6ff",
    paperback: "#d4a84b",
    hardcover: "#b794f6",
    audiobook: "#3ecf8e",
    ku: "#ed8936",
    unknown: "#718096",
  };

  function renderFormatChart(canvasId, byFormat, formatLabel, formatMoney) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === "undefined") return;

    const order = ["ebook", "paperback", "hardcover", "audiobook", "ku", "unknown"];
    const entries = Object.entries(byFormat || {})
      .map(([id, v]) => ({
        id,
        name: formatLabel ? formatLabel(id) : id,
        royalty: v.royalty || 0,
        units: v.units || 0,
        color: FORMAT_COLORS[id] || "#a0aec0",
      }))
      .filter((e) => e.royalty > 0 || e.units > 0)
      .sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return b.royalty - a.royalty;
      });

    const total = entries.reduce((s, e) => s + e.royalty, 0) || 1;

    if (!entries.length) {
      charts[canvasId] = new Chart(el, {
        type: "doughnut",
        data: {
          labels: ["No format data yet"],
          datasets: [{ data: [1], backgroundColor: ["#2d3748"], borderWidth: 0 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          cutout: "58%",
        },
      });
      return;
    }

    // Donut with legend that shows DOLLARS (not bare chart.js %)
    charts[canvasId] = new Chart(el, {
      type: "doughnut",
      data: {
        labels: entries.map((e) => {
          const pct = Math.round((e.royalty / total) * 100);
          return `${e.name}: ${formatMoney(e.royalty)} (${pct}%)`;
        }),
        datasets: [
          {
            data: entries.map((e) => +e.royalty.toFixed(2)),
            backgroundColor: entries.map((e) => e.color),
            borderColor: "#161e28",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: tickColor,
              boxWidth: 12,
              font: { size: 11 },
              padding: 10,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const e = entries[ctx.dataIndex];
                const pct = Math.round((e.royalty / total) * 100);
                return ` ${e.name}: ${formatMoney(e.royalty)} · ${e.units} units · ${pct}% of formats`;
              },
            },
          },
        },
        cutout: "55%",
      },
    });
  }

  function renderExpenseChart(canvasId, byCategory, categories, formatMoney) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === "undefined") return;

    const entries = Object.entries(byCategory)
      .map(([id, amount]) => {
        const c = categories.find((x) => x.id === id);
        return { name: c?.name || id, amount };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const colors = ["#d4a84b", "#f07178", "#6cb6ff", "#b794f6", "#3ecf8e", "#ed8936", "#4fd1c5", "#a0aec0"];

    charts[canvasId] = new Chart(el, {
      type: "bar",
      data: {
        labels: entries.map((e) => e.name),
        datasets: [
          {
            label: "Spend",
            data: entries.map((e) => +e.amount.toFixed(2)),
            backgroundColor: entries.map((_, i) => colors[i % colors.length]),
            borderRadius: 6,
          },
        ],
      },
      options: baseOptions({
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: tickColor, ...moneyTicks((v) => formatMoney(v).replace(/\.00$/, "")) },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: tickColor, font: { size: 10 } },
            grid: { display: false },
          },
        },
      }),
    });
  }

  global.WideLedgerCharts = {
    renderIncomeChart,
    renderPlatformChart,
    renderPnLChart,
    renderFormatChart,
    renderExpenseChart,
    destroy,
  };
})(window);
