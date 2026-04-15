const REFRESH_MS = 5 * 60 * 1000;
let currentHours = 6;
let chart;

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}

function parseUtc(s) {
  // SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC; append Z for correct parsing.
  if (!s) return null;
  return new Date(s.replace(" ", "T") + "Z");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

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

async function loadChart(hours) {
  try {
    const data = await fetchJson(`/api/results?hours=${hours}`);
    const rows = data.results || [];
    const dlPoints = rows.map(r => ({ x: parseUtc(r.measured_at), y: r.download_mbps }));
    const ulPoints = rows.map(r => ({ x: parseUtc(r.measured_at), y: r.upload_mbps }));
    const pingPoints = rows.map(r => ({ x: parseUtc(r.measured_at), y: r.ping_ms }));

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
          legend: { labels: { color: "#e6edf7" } },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: {
            type: "time",
            time: { tooltipFormat: "yyyy-MM-dd HH:mm" },
            ticks: { color: "#8a97b4" },
            grid: { color: "rgba(255,255,255,.05)" },
          },
          y: {
            type: "linear",
            position: "left",
            title: { display: true, text: "Speed (Mbps)", color: "#8a97b4" },
            ticks: { color: "#8a97b4" },
            grid: { color: "rgba(255,255,255,.05)" },
            beginAtZero: true,
          },
          y1: {
            type: "linear",
            position: "right",
            title: { display: true, text: "Ping (ms)", color: "#8a97b4" },
            ticks: { color: "#8a97b4" },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
          },
        },
      },
    });
  } catch (e) {
    console.error(e);
  }
}

async function refresh() {
  await Promise.all([loadLatest(), loadChart(currentHours)]);
}

document.querySelectorAll(".range-tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentHours = parseInt(btn.dataset.hours, 10);
    loadChart(currentHours);
  });
});

refresh();
setInterval(refresh, REFRESH_MS);
