const JMA_AREA_URL = "https://www.jma.go.jp/bosai/common/const/area.json";
const JMA_FORECAST_URL = "https://www.jma.go.jp/bosai/forecast/data/forecast";
const JMA_AMEDAS_LATEST_URL = "https://www.jma.go.jp/bosai/amedas/data/latest_time.txt";
const JMA_AMEDAS_POINT_URL = "https://www.jma.go.jp/bosai/amedas/data/point";

const chart = {
  left: 56,
  right: 864,
  top: 74,
  bottom: 466,
  min: -5,
  max: 35
};

const fallbackTemps = [12, 12, 11, 10, 9, 10, 13, 15, 17, 19, 20, 21, 22, 22, 21, 21, 20, 18, 16];

const state = {
  areas: null,
  locations: [],
  selected: null,
  forecast: null,
  cursorIndex: 15
};

const searchInput = document.querySelector("[data-location-search]");
const results = document.querySelector("[data-location-results]");
const title = document.querySelector("[data-location-title]");
const currentTemp = document.querySelector("[data-current-temp]");
const highTemp = document.querySelector("[data-high-temp]");
const lowTemp = document.querySelector("[data-low-temp]");
const condition = document.querySelector("[data-weather-condition]");
const source = document.querySelector("[data-weather-source]");
const mainIcon = document.querySelector("[data-main-icon]");
const weatherIcons = document.querySelectorAll("[data-weather-icon]");
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

function normalized(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function areaValue(section, code) {
  return state.areas?.[section]?.[code] || null;
}

function resolveLocation(code, city) {
  const class15 = areaValue("class15s", city.parent);
  const class10 = areaValue("class10s", class15?.parent);
  const office = areaValue("offices", class10?.parent);

  if (!class15 || !class10 || !office) return null;

  const labelPrefix = office.name.endsWith("都") || office.name.endsWith("府") || office.name.endsWith("県")
    ? office.name
    : `${office.name} `;

  return {
    code,
    name: city.name,
    label: `${labelPrefix}${city.name}`,
    query: city.name,
    class15,
    class10,
    office,
    officeCode: class10.parent,
    searchText: normalized(`${office.name}${class10.name}${class15.name}${city.name}`)
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`);
  return response.text();
}

function buildLocations() {
  const locations = Object.entries(state.areas.class20s)
    .map(([code, city]) => resolveLocation(code, city))
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));

  state.locations = locations;
  state.selected = locations.find((location) => location.name === "新宿区") || locations[0];
}

function locationMatches(location, term) {
  if (!term) return ["新宿区", "渋谷区", "大阪市", "札幌市"].includes(location.name);
  return location.searchText.includes(term);
}

function renderResults() {
  const term = normalized(searchInput.value);
  const matches = state.locations.filter((location) => locationMatches(location, term)).slice(0, 6);

  results.innerHTML = "";

  matches.forEach((location) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = location.label;
    button.className = state.selected?.code === location.code ? "is-selected" : "";
    button.addEventListener("click", async () => {
      state.selected = location;
      searchInput.value = location.name;
      renderResults();
      await loadForecastForSelected();
    });
    results.append(button);
  });

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "location-empty";
    empty.textContent = "該当する市区町村がありません";
    results.append(empty);
  }

  const current = document.createElement("button");
  current.type = "button";
  current.textContent = "現在地を使用";
  current.addEventListener("click", async () => {
    state.selected = state.locations.find((location) => location.name === "新宿区") || state.locations[0];
    searchInput.value = state.selected.name;
    renderResults();
    await loadForecastForSelected();
  });
  results.append(current);
}

function findForecastArea(timeSeries, code) {
  return timeSeries?.areas?.find((area) => area.area.code === code) || timeSeries?.areas?.[0] || null;
}

function findTempArea(tempSeries) {
  if (!tempSeries?.areas?.length) return null;
  const selectedName = state.selected.name.replace(/市|区|町|村/g, "");
  return tempSeries.areas.find((area) => selectedName && area.area.name.includes(selectedName))
    || tempSeries.areas.find((area) => state.selected.class10.name.includes(area.area.name))
    || tempSeries.areas[0];
}

function weatherIcon(codeOrText) {
  const value = String(codeOrText || "");
  if (value.startsWith("4") || value.includes("雪")) return "❄";
  if (value.startsWith("3") || value.includes("雨")) return "☂";
  if (value.startsWith("1") || value.includes("晴")) return "☀";
  if (value.startsWith("2") || value.includes("くもり") || value.includes("曇")) return "☁";
  return "☁";
}

function compactWeather(text) {
  return String(text || "天気未取得").replace(/\s+/g, " ").replace(/　+/g, " ");
}

function parseTemp(value) {
  const temp = Number(value);
  return Number.isFinite(temp) ? temp : null;
}

function buildTemperatureProfile(temps) {
  const valid = temps.map(parseTemp).filter((temp) => temp !== null);
  if (!valid.length) return fallbackTemps;

  const low = Math.min(...valid);
  const high = Math.max(...valid);
  const start = valid[0];
  const end = valid[valid.length - 1];
  const profile = [];

  for (let index = 0; index <= 18; index += 1) {
    const hourRatio = index / 18;
    const daylightCurve = Math.sin(Math.PI * Math.min(1, Math.max(0, (index - 5) / 13)));
    const base = start + (end - start) * hourRatio;
    const temp = Math.max(low, Math.min(high, base + (high - low) * 0.55 * daylightCurve));
    profile.push(Math.round(temp));
  }

  return profile;
}

function createPoints(temps) {
  return temps.map((temp, index) => [xForIndex(index), yForTemp(temp), temp]);
}

function renderChart(temps) {
  const points = createPoints(temps);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${chart.right} ${chart.bottom} L${chart.left} ${chart.bottom} Z`;

  linePath.setAttribute("d", line);
  areaPath.setAttribute("d", area);
  updateCursor(state.cursorIndex);
}

function updateCursor(index) {
  const temps = state.forecast?.temps || fallbackTemps;
  state.cursorIndex = Math.max(0, Math.min(18, index));
  const temp = temps[state.cursorIndex];
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

function formatReportTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}発表`;
}

function formatSource(forecast) {
  const office = forecast.officeName && forecast.officeName !== "気象庁"
    ? ` ${forecast.officeName}`
    : "";
  return `出典: 気象庁${office} / ${forecast.forecastAreaName} ${formatReportTime(forecast.reportDatetime)}`;
}

function renderForecast() {
  const forecast = state.forecast;
  title.textContent = state.selected.label;
  currentTemp.textContent = forecast.currentTemp ?? forecast.high ?? "--";
  highTemp.textContent = forecast.high ?? "--";
  lowTemp.textContent = forecast.low ?? "--";
  condition.textContent = forecast.weather;
  mainIcon.textContent = forecast.icon;
  weatherIcons.forEach((icon, index) => {
    icon.textContent = forecast.icons[index % forecast.icons.length] || forecast.icon;
  });
  source.textContent = formatSource(forecast);
  renderChart(forecast.temps);
}

async function fetchAmedasTemp(pointCode) {
  if (!pointCode) return null;
  try {
    const latestText = await fetchText(JMA_AMEDAS_LATEST_URL);
    const latestDate = new Date(latestText.trim());
    if (Number.isNaN(latestDate.getTime())) return null;

    for (let offset = 2; offset <= 5; offset += 1) {
      const target = new Date(latestDate.getTime() - offset * 60 * 60 * 1000);
      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, "0");
      const dd = String(target.getDate()).padStart(2, "0");
      const hh = String(target.getHours()).padStart(2, "0");
      const url = `${JMA_AMEDAS_POINT_URL}/${pointCode}/${yyyy}${mm}${dd}_${hh}.json`;

      try {
        const pointData = await fetchJson(url);
        const latestEntry = Object.values(pointData).reverse().find((entry) => Array.isArray(entry.temp));
        const temp = parseTemp(latestEntry?.temp?.[0]);
        if (temp !== null) return Math.round(temp);
      } catch {
        // Some latest_time values precede point-file publication. Try earlier files.
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function loadForecastForSelected() {
  if (!state.selected) return;

  title.textContent = state.selected.label;
  condition.textContent = "気象庁データを取得中";

  try {
    const forecastData = await fetchJson(`${JMA_FORECAST_URL}/${state.selected.officeCode}.json`);
    const report = forecastData[0];
    const weatherSeries = report.timeSeries[0];
    const popSeries = report.timeSeries[1];
    const tempSeries = report.timeSeries[2];
    const weatherArea = findForecastArea(weatherSeries, state.selected.class10.code);
    const popArea = findForecastArea(popSeries, state.selected.class10.code);
    const tempArea = findTempArea(tempSeries);
    const forecastTemps = tempArea?.temps || [];
    const profile = buildTemperatureProfile(forecastTemps);
    const currentObservedTemp = await fetchAmedasTemp(tempArea?.area?.code);
    const validTemps = forecastTemps.map(parseTemp).filter((temp) => temp !== null);
    const high = validTemps.length ? Math.max(...validTemps) : Math.max(...profile);
    const low = validTemps.length ? Math.min(...validTemps) : Math.min(...profile);
    const icon = weatherIcon(weatherArea?.weatherCodes?.[0] || weatherArea?.weathers?.[0]);

    state.forecast = {
      currentTemp: currentObservedTemp,
      high,
      low,
      temps: profile,
      weather: compactWeather(weatherArea?.weathers?.[0]),
      icon,
      icons: (weatherArea?.weatherCodes || weatherArea?.weathers || [icon]).map(weatherIcon),
      reportDatetime: report.reportDatetime,
      officeName: report.publishingOffice || state.selected.office.officeName || state.selected.office.name,
      forecastAreaName: weatherArea?.area?.name || state.selected.class10.name,
      pops: popArea?.pops || []
    };

    renderForecast();
  } catch (error) {
    console.error(error);
    condition.textContent = "気象庁データを取得できませんでした";
    source.textContent = "出典: 気象庁 / 通信状況を確認してください";
    state.forecast = { temps: fallbackTemps, high: "--", low: "--", icon: "☁", icons: ["☁"] };
    renderChart(fallbackTemps);
  }
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

async function init() {
  try {
    state.areas = await fetchJson(JMA_AREA_URL);
    buildLocations();
    searchInput.value = state.selected.name;
    renderResults();
    await loadForecastForSelected();
  } catch (error) {
    console.error(error);
    condition.textContent = "気象庁データを取得できませんでした";
    source.textContent = "出典: 気象庁 / 通信状況を確認してください";
    renderChart(fallbackTemps);
  }
}

init();
