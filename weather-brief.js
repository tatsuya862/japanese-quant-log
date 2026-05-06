const locations = [
  {
    name: "東京都新宿区",
    query: "新宿",
    current: 21,
    high: 22,
    low: 9,
    temps: [12, 12, 11, 10, 9, 10, 13, 15, 17, 19, 20, 21, 22, 22, 21, 21, 20, 18, 16]
  },
  {
    name: "東京都渋谷区",
    query: "渋谷",
    current: 22,
    high: 23,
    low: 10,
    temps: [13, 12, 12, 11, 10, 11, 14, 16, 18, 20, 21, 22, 23, 23, 22, 22, 20, 19, 17]
  },
  {
    name: "東京都中野区",
    query: "中野",
    current: 21,
    high: 22,
    low: 9,
    temps: [12, 11, 11, 10, 9, 10, 13, 15, 17, 18, 20, 21, 22, 22, 21, 21, 19, 18, 16]
  },
  {
    name: "東京都豊島区",
    query: "豊島",
    current: 21,
    high: 22,
    low: 10,
    temps: [13, 12, 12, 11, 10, 11, 13, 16, 18, 19, 20, 21, 22, 22, 22, 21, 20, 18, 17]
  },
  {
    name: "大阪府大阪市",
    query: "大阪",
    current: 24,
    high: 25,
    low: 14,
    temps: [16, 15, 15, 14, 14, 15, 17, 19, 21, 23, 24, 25, 25, 24, 24, 23, 22, 20, 19]
  },
  {
    name: "北海道札幌市",
    query: "札幌",
    current: 14,
    high: 16,
    low: 6,
    temps: [8, 7, 7, 6, 6, 7, 9, 11, 13, 14, 15, 16, 16, 15, 14, 14, 13, 11, 10]
  },
  {
    name: "福岡県福岡市",
    query: "福岡",
    current: 23,
    high: 24,
    low: 15,
    temps: [17, 16, 16, 15, 15, 16, 18, 20, 22, 23, 24, 24, 24, 24, 23, 23, 22, 20, 19]
  }
];

const chart = {
  left: 56,
  right: 864,
  top: 74,
  bottom: 466,
  min: -5,
  max: 35
};

const state = {
  selected: locations[0],
  cursorIndex: 15
};

const searchInput = document.querySelector("[data-location-search]");
const results = document.querySelector("[data-location-results]");
const title = document.querySelector("[data-location-title]");
const currentTemp = document.querySelector("[data-current-temp]");
const highTemp = document.querySelector("[data-high-temp]");
const lowTemp = document.querySelector("[data-low-temp]");
const linePath = document.querySelector("[data-chart-line]");
const areaPath = document.querySelector("[data-chart-area]");
const chartEl = document.querySelector("[data-chart]");
const cursorLine = document.querySelector("[data-cursor-line]");
const cursorDot = document.querySelector("[data-cursor-dot]");
const cursorBadge = document.querySelector("[data-cursor-badge]");
const cursorText = document.querySelector("[data-cursor-text]");
const locationPanel = document.querySelector("#location-panel");
const locationToggle = document.querySelector("[data-location-toggle]");

function xForIndex(index) {
  return chart.left + (index / 18) * (chart.right - chart.left);
}

function yForTemp(temp) {
  const ratio = (temp - chart.min) / (chart.max - chart.min);
  return chart.bottom - ratio * (chart.bottom - chart.top);
}

function createPoints(temps) {
  return temps.map((temp, index) => [xForIndex(index), yForTemp(temp), temp]);
}

function renderChart() {
  const points = createPoints(state.selected.temps);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${chart.right} ${chart.bottom} L${chart.left} ${chart.bottom} Z`;

  linePath.setAttribute("d", line);
  areaPath.setAttribute("d", area);
  updateCursor(state.cursorIndex);
}

function updateCursor(index) {
  state.cursorIndex = Math.max(0, Math.min(18, index));
  const temp = state.selected.temps[state.cursorIndex];
  const x = xForIndex(state.cursorIndex);
  const y = yForTemp(temp);
  const badgeX = Math.min(Math.max(x - 56, chart.left), chart.right - 112);
  const badgeY = Math.max(chart.top + 8, y - 58);

  cursorLine.setAttribute("d", `M${x.toFixed(1)} ${chart.top}V${chart.bottom}`);
  cursorDot.setAttribute("cx", x.toFixed(1));
  cursorDot.setAttribute("cy", y.toFixed(1));
  cursorBadge.setAttribute("transform", `translate(${badgeX.toFixed(1)} ${badgeY.toFixed(1)})`);
  cursorText.textContent = `${state.cursorIndex}:00 ${temp}°C`;
}

function renderLocation() {
  title.textContent = state.selected.name;
  currentTemp.textContent = state.selected.current;
  highTemp.textContent = state.selected.high;
  lowTemp.textContent = state.selected.low;
  renderChart();
}

function normalized(value) {
  return value.trim().toLowerCase();
}

function locationMatches(location, term) {
  if (!term) return true;
  return location.name.toLowerCase().includes(term) || location.query.toLowerCase().includes(term);
}

function renderResults() {
  const term = normalized(searchInput.value);
  const matches = locations.filter((location) => locationMatches(location, term)).slice(0, 5);
  const visible = matches.length > 0 ? matches : locations.slice(0, 5);

  results.innerHTML = "";
  visible.forEach((location) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = location.name;
    button.className = location.name === state.selected.name ? "is-selected" : "";
    button.addEventListener("click", () => {
      state.selected = location;
      searchInput.value = location.query;
      renderLocation();
      renderResults();
    });
    results.append(button);
  });

  const current = document.createElement("button");
  current.type = "button";
  current.textContent = "現在地を使用";
  current.addEventListener("click", () => {
    state.selected = locations[0];
    searchInput.value = "新宿";
    renderLocation();
    renderResults();
  });
  results.append(current);
}

searchInput.addEventListener("input", renderResults);

locationToggle.addEventListener("click", () => {
  const isOpen = locationPanel.classList.toggle("is-open");
  locationToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) searchInput.focus();
});

chartEl.addEventListener("pointerdown", (event) => {
  const rect = chartEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, x / rect.width));
  updateCursor(Math.round(ratio * 18));
});

renderLocation();
renderResults();
