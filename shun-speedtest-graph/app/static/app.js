const REFRESH_MS = 5 * 60 * 1000;
const POLL_MS = 2000;
let chart;
let pollTimer = null;

// ===== Filter state =====
let filterMode = "hours";  // "hours" | "date_range"
let currentHours = 6;
let fromDate = null;
let toDate = null;

// ===== Sort state =====
let currentSort = { col: "measured_at", dir: "desc" };
let cachedResults = [];

// ===== Utilities =====

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}

function parseUtc(s) {
  if (!s) return null;
  return new Date(s.replace(" ", "T") + "Z");
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Build query string from current filter state */
function buildApiParams() {
  if (filterMode === "date_range" && fromDate) {
    let p = `from_date=${fromDate}`;
    if (toDate) p += `&to_date=${toDate}`;
    return p;
  }
  return `hours=${currentHours}`;
}

// ===== Theme =====

function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("btn-theme").textContent = saved === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  document.getElementById("btn-theme").textContent = next === "dark" ? "☀️" : "🌙";
  renderChart(cachedResults);
}

// ===== Latest values =====

async function loadLatest() {
  try {
    const latest = await fetchJson("/api/results/latest");
    if (!latest || !latest.measured_at) {
      document.getElementById("latest-download").textContent = "-";
      document.getElementById("latest-upload").textContent = "-";
      document.getElementById("latest-ping").textContent = "-";
      document.getElementById("last-updated").textContent = "未測定";
      return;
    }
    document.getElementById("latest-download").textContent = fmt(latest.download_mbps);
    document.getElementById("latest-upload").textContent = fmt(latest.upload_mbps);
    document.getElementById("latest-ping").textContent = fmt(latest.ping_ms, 0);
    const d = parseUtc(latest.measured_at);
    document.getElementById("last-updated").textContent = d ? d.toLocaleString() : "-";
  } catch (e) {
    console.error(e);
  }
}

// ===== Stats (avg/max/min) =====

async function loadStats() {
  try {
    const data = await fetchJson(`/api/stats?${buildApiParams()}`);
    const s = data.stats || {};
    document.getElementById("avg-download").textContent = fmt(s.avg_download);
    document.getElementById("max-download").textContent = fmt(s.max_download);
    document.getElementById("min-download").textContent = fmt(s.min_download);
    document.getElementById("avg-upload").textContent   = fmt(s.avg_upload);
    document.getElementById("max-upload").textContent   = fmt(s.max_upload);
    document.getElementById("min-upload").textContent   = fmt(s.min_upload);
    document.getElementById("avg-ping").textContent     = fmt(s.avg_ping, 0);
    document.getElementById("max-ping").textContent     = fmt(s.max_ping, 0);
    document.getElementById("min-ping").textContent     = fmt(s.min_ping, 0);
  } catch (e) {
    console.error(e);
  }
}

// ===== Chart =====

function renderChart(rows) {
  const dlPoints   = rows.map(r => ({ x: parseUtc(r.measured_at), y: r.download_mbps }));
  const ulPoints   = rows.map(r => ({ x: parseUtc(r.measured_at), y: r.upload_mbps }));
  const pingPoints = rows.map(r => ({ x: parseUtc(r.measured_at), y: r.ping_ms }));

  const tickColor   = getCssVar("--chart-tick");
  const gridColor   = getCssVar("--chart-grid");
  const legendColor = getCssVar("--chart-legend");

  const ctx = document.getElementById("speed-chart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Download (Mbps)",
          data: dlPoints,
          borderColor: "#3ddc97",
          backgroundColor: "rgba(61,220,151,.15)",
          yAxisID: "y",
          tension: .25,
          pointRadius: 2,
        },
        {
          label: "Upload (Mbps)",
          data: ulPoints,
          borderColor: "#6aa8ff",
          backgroundColor: "rgba(106,168,255,.15)",
          yAxisID: "y",
          tension: .25,
          pointRadius: 2,
        },
        {
          label: "Ping (ms)",
          data: pingPoints,
          borderColor: "#ffb03a",
          backgroundColor: "rgba(255,176,58,.15)",
          yAxisID: "y1",
          tension: .25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: legendColor } },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          type: "time",
          time: { tooltipFormat: "yyyy-MM-dd HH:mm" },
          ticks: { color: tickColor },
          grid: { color: gridColor },
        },
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Speed (Mbps)", color: tickColor },
          ticks: { color: tickColor },
          grid: { color: gridColor },
          beginAtZero: true,
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Ping (ms)", color: tickColor },
          ticks: { color: tickColor },
          grid: { drawOnChartArea: false },
          beginAtZero: true,
        },
      },
    },
  });
}

// ===== Results table =====

function renderTable(rows) {
  const sorted = [...rows].sort((a, b) => {
    const mul = currentSort.dir === "asc" ? 1 : -1;
    const va = a[currentSort.col];
    const vb = b[currentSort.col];
    if (va < vb) return -1 * mul;
    if (va > vb) return  1 * mul;
    return 0;
  });

  const tbody = document.getElementById("results-tbody");
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">データがありません</td></tr>';
    document.getElementById("result-count").textContent = "0件";
    return;
  }

  tbody.innerHTML = sorted.map(r => {
    const d = parseUtc(r.measured_at);
    const ts = d ? d.toLocaleString() : r.measured_at;
    return `<tr>
      <td>${ts}</td>
      <td>${fmt(r.download_mbps)}</td>
      <td>${fmt(r.upload_mbps)}</td>
      <td>${fmt(r.ping_ms, 0)}</td>
    </tr>`;
  }).join("");

  document.getElementById("result-count").textContent = `${sorted.length}件`;
}

function updateSortHeaders() {
  document.querySelectorAll(".results-table th.sortable").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    const icon = th.querySelector(".sort-icon");
    if (icon) icon.textContent = "↕";
    if (th.dataset.col === currentSort.col) {
      th.classList.add(currentSort.dir === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

// ===== Load chart + table together =====

async function loadChartAndTable() {
  try {
    const data = await fetchJson(`/api/results?${buildApiParams()}`);
    cachedResults = data.results || [];
    renderChart(cachedResults);
    renderTable(cachedResults);
  } catch (e) {
    console.error(e);
  }
}

async function refresh() {
  await Promise.all([loadLatest(), loadChartAndTable(), loadStats()]);
}

// ===== Manual measurement =====

function setMeasuring(active) {
  const btn = document.getElementById("btn-measure");
  const icon = document.getElementById("measure-icon");
  const label = document.getElementById("measure-label");
  btn.disabled = active;
  btn.classList.toggle("measuring", active);
  icon.textContent = active ? "⏳" : "⚡";
  label.textContent = active ? "計測中…" : "今すぐ計測";
}

async function pollMeasureStatus() {
  try {
    const st = await fetchJson("/api/measure/status");
    if (!st.measuring) {
      clearInterval(pollTimer);
      pollTimer = null;
      setMeasuring(false);
      await refresh();
    }
  } catch (e) {
    console.error(e);
  }
}

async function triggerMeasure() {
  if (pollTimer) return;
  try {
    await fetchJson("/api/measure", { method: "POST" });
    setMeasuring(true);
    pollTimer = setInterval(pollMeasureStatus, POLL_MS);
  } catch (e) {
    if (e.message.includes("409")) {
      setMeasuring(true);
      pollTimer = setInterval(pollMeasureStatus, POLL_MS);
    } else {
      alert("計測の開始に失敗しました: " + e.message);
    }
  }
}

// ===== Date filter =====

function applyDateFilter() {
  const f = document.getElementById("from-date").value;
  const t = document.getElementById("to-date").value;
  if (!f) { alert("開始日を入力してください"); return; }
  filterMode = "date_range";
  fromDate = f;
  toDate = t || null;
  document.getElementById("range-tabs").classList.add("dimmed");
  document.querySelector(".date-filter").classList.add("active");
  Promise.all([loadChartAndTable(), loadStats()]);
}

function clearDateFilter() {
  filterMode = "hours";
  fromDate = null;
  toDate = null;
  document.getElementById("from-date").value = "";
  document.getElementById("to-date").value = "";
  document.getElementById("range-tabs").classList.remove("dimmed");
  document.querySelector(".date-filter").classList.remove("active");
  Promise.all([loadChartAndTable(), loadStats()]);
}

// ===== CSV download =====

function downloadCsv() {
  window.location.href = `/api/results/csv?${buildApiParams()}`;
}

// ===== Settings =====

async function loadSettings() {
  try {
    const s = await fetchJson("/api/settings");
    const label = document.getElementById("machine-name-label");
    if (s.machine_name) {
      label.textContent = s.machine_name;
      label.classList.add("visible");
    } else {
      label.textContent = "";
      label.classList.remove("visible");
    }
    document.getElementById("input-machine-name").value = s.machine_name || "";
    document.getElementById("btn-post-x").style.display = s.x_configured ? "" : "none";
  } catch (e) {
    console.error(e);
  }
}

async function saveSettings() {
  const machineName = document.getElementById("input-machine-name").value.trim();
  const xApiKey = document.getElementById("input-x-api-key").value.trim();
  const xApiSecret = document.getElementById("input-x-api-secret").value.trim();
  const xAccessToken = document.getElementById("input-x-access-token").value.trim();
  const xAccessTokenSecret = document.getElementById("input-x-access-token-secret").value.trim();

  const body = { machine_name: machineName };
  if (xApiKey) body.x_api_key = xApiKey;
  if (xApiSecret) body.x_api_secret = xApiSecret;
  if (xAccessToken) body.x_access_token = xAccessToken;
  if (xAccessTokenSecret) body.x_access_token_secret = xAccessTokenSecret;

  const statusEl = document.getElementById("settings-status");
  const saveBtn = document.getElementById("btn-settings-save");
  saveBtn.disabled = true;
  statusEl.textContent = "保存中…";

  try {
    await fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    statusEl.textContent = "保存しました";
    ["input-x-api-key", "input-x-api-secret", "input-x-access-token", "input-x-access-token-secret"]
      .forEach(id => { document.getElementById(id).value = ""; });
    await loadSettings();
    setTimeout(() => { statusEl.textContent = ""; }, 2500);
  } catch (e) {
    statusEl.textContent = "エラー: " + e.message;
  } finally {
    saveBtn.disabled = false;
  }
}

// ===== X post =====

async function postToX() {
  const btn = document.getElementById("btn-post-x");
  btn.disabled = true;
  try {
    const res = await fetchJson("/api/post-x", { method: "POST" });
    alert("Xへの投稿が完了しました！\n\n" + res.text);
  } catch (e) {
    alert("Xへの投稿に失敗しました: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ===== Modal =====

function openModal() { document.getElementById("modal-settings").classList.add("open"); }

function closeModal() {
  document.getElementById("modal-settings").classList.remove("open");
  document.getElementById("settings-status").textContent = "";
}

// ===== Event listeners =====

document.getElementById("btn-theme").addEventListener("click", toggleTheme);
document.getElementById("btn-measure").addEventListener("click", triggerMeasure);
document.getElementById("btn-post-x").addEventListener("click", postToX);
document.getElementById("btn-settings").addEventListener("click", openModal);
document.getElementById("btn-modal-close").addEventListener("click", closeModal);
document.getElementById("btn-settings-save").addEventListener("click", saveSettings);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

document.getElementById("btn-apply-date").addEventListener("click", applyDateFilter);
document.getElementById("btn-clear-date").addEventListener("click", clearDateFilter);
document.getElementById("btn-csv").addEventListener("click", downloadCsv);

// Range tabs
document.querySelectorAll("#range-tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    if (document.getElementById("range-tabs").classList.contains("dimmed")) return;
    document.querySelectorAll("#range-tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentHours = parseInt(btn.dataset.hours, 10);
    filterMode = "hours";
    Promise.all([loadChartAndTable(), loadStats()]);
  });
});

// Sort columns
document.querySelectorAll(".results-table th.sortable").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (currentSort.col === col) {
      currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
    } else {
      currentSort.col = col;
      currentSort.dir = "desc";
    }
    updateSortHeaders();
    renderTable(cachedResults);
  });
});

// ===== Init =====

initTheme();
updateSortHeaders();
loadSettings();
refresh();
setInterval(refresh, REFRESH_MS);
