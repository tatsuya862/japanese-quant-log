const PROTOTYPE_ID = "white-space-calendar";
const PROTOTYPE_NAME = "White Space Calendar";
const STORAGE_KEY = "quant_log_white_space_calendar_v1";

const DAYS = [
  { key: "monday", label: "月曜日", short: "月" },
  { key: "tuesday", label: "火曜日", short: "火" },
  { key: "wednesday", label: "水曜日", short: "水" },
  { key: "thursday", label: "木曜日", short: "木" },
  { key: "friday", label: "金曜日", short: "金" },
  { key: "saturday", label: "土曜日", short: "土" },
  { key: "sunday", label: "日曜日", short: "日" }
];

const PURPOSE_LABELS = {
  recovery: "回復",
  thinking: "思考",
  creation: "創造",
  reflection: "内省"
};

const CATEGORY_LABELS = {
  side_business: "副業",
  investment_trading: "投資・トレード",
  learning: "学習",
  hobby: "趣味",
  dinner_meeting: "会食",
  family_life: "家族・生活",
  rest: "休息",
  chores: "雑務",
  other: "その他"
};

const initialSettings = DAYS.map((day) => ({
  day: day.key,
  wakeTime: "06:00",
  sleepTime: "23:00"
}));

const initialBlocks = [
  ...["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => ({
    id: `fixed-company-${day}`,
    title: "会社",
    day,
    startTime: "08:00",
    endTime: "17:00",
    type: "fixed",
    memo: "生活上の拘束時間"
  })),
  { id: "white-monday", title: "余白時間", day: "monday", startTime: "18:00", endTime: "20:00", type: "white_space", purpose: "reflection", memo: "週の入口で生活構造を見直す" },
  { id: "white-tuesday", title: "余白時間", day: "tuesday", startTime: "06:00", endTime: "08:00", type: "white_space", purpose: "thinking", memo: "情報を入れる前に考える" },
  { id: "white-wednesday", title: "余白時間", day: "wednesday", startTime: "20:00", endTime: "22:00", type: "white_space", purpose: "creation", memo: "創造のための静かな時間" },
  { id: "white-thursday", title: "余白時間", day: "thursday", startTime: "18:00", endTime: "20:00", type: "white_space", purpose: "recovery", memo: "回復を先に確保する" },
  { id: "white-friday", title: "余白時間", day: "friday", startTime: "06:00", endTime: "08:00", type: "white_space", purpose: "reflection", memo: "週末前の内省" },
  { id: "white-saturday", title: "余白時間", day: "saturday", startTime: "10:00", endTime: "12:00", type: "white_space", purpose: "creation", memo: "副業と創造の前に空白を置く" },
  { id: "white-sunday", title: "余白時間", day: "sunday", startTime: "10:00", endTime: "12:00", type: "white_space", purpose: "recovery", memo: "来週を詰める前に回復する" },
  { id: "free-monday-side", title: "副業", day: "monday", startTime: "20:00", endTime: "21:00", type: "free", category: "side_business", memo: "TOP3アクション" },
  { id: "free-wednesday-reading", title: "読書", day: "wednesday", startTime: "22:00", endTime: "23:00", type: "free", category: "learning", memo: "入力は1時間まで" },
  { id: "free-saturday-app", title: "アプリ案整理", day: "saturday", startTime: "14:00", endTime: "16:00", type: "free", category: "side_business", memo: "実装候補を絞る" },
  { id: "free-sunday-onsen", title: "温泉", day: "sunday", startTime: "14:00", endTime: "15:00", type: "free", category: "rest", memo: "休息も予定として守る" }
];

let blocks = [];
let settings = [];
let lastWarnings = [];

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function getDurationMinutes(block) {
  return timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
}

function getDurationHours(block) {
  return getDurationMinutes(block) / 60;
}

function isOverlapping(a, b) {
  if (a.day !== b.day) return false;
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(a.endTime) > timeToMinutes(b.startTime);
}

function hasConflict(newBlock, existingBlocks) {
  return existingBlocks.some((block) => block.id !== newBlock.id && isOverlapping(newBlock, block));
}

function getCountableBlocksByDay(day, targetBlocks = blocks) {
  return targetBlocks.filter((block) => block.day === day && block.type !== "fixed");
}

function getFreeBlocksByDay(day, targetBlocks = blocks) {
  return targetBlocks.filter((block) => block.day === day && block.type === "free");
}

function getWhiteSpaceBlocksByDay(day, targetBlocks = blocks) {
  return targetBlocks.filter((block) => block.day === day && block.type === "white_space");
}

function hasRequiredWhiteSpace(day, targetBlocks = blocks) {
  return getWhiteSpaceBlocksByDay(day, targetBlocks).some((block) => getDurationMinutes(block) === 120);
}

function getMissingWhiteSpaceDays(targetBlocks = blocks) {
  return DAYS
    .filter((day) => !hasRequiredWhiteSpace(day.key, targetBlocks))
    .map((day) => day.key);
}

function isWithinWakeSleep(day, startTime, endTime, targetSettings = settings) {
  const daySettings = targetSettings.find((item) => item.day === day);
  if (!daySettings) return false;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start >= timeToMinutes(daySettings.wakeTime) && end <= timeToMinutes(daySettings.sleepTime);
}

function findAvailableWhiteSpaceSlot(day, targetBlocks = blocks, targetSettings = settings) {
  if (getCountableBlocksByDay(day, targetBlocks).length >= 3) return null;

  const preferredSlots = [
    ["20:00", "22:00"],
    ["19:00", "21:00"],
    ["06:00", "08:00"],
    ["10:00", "12:00"],
    ["14:00", "16:00"]
  ];

  for (const [startTime, endTime] of preferredSlots) {
    const candidate = createBlock({ day, startTime, endTime, type: "white_space", purpose: "reflection" });
    if (isWithinWakeSleep(day, startTime, endTime, targetSettings) && !hasConflict(candidate, targetBlocks)) {
      return { startTime, endTime };
    }
  }

  const daySettings = targetSettings.find((item) => item.day === day);
  const startLimit = timeToMinutes(daySettings.wakeTime);
  const endLimit = timeToMinutes(daySettings.sleepTime);

  for (let start = startLimit; start + 120 <= endLimit; start += 30) {
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + 120);
    const candidate = createBlock({ day, startTime, endTime, type: "white_space", purpose: "reflection" });
    if (!hasConflict(candidate, targetBlocks)) {
      return { startTime, endTime };
    }
  }

  return null;
}

function autoPlaceWhiteSpaces(targetBlocks = blocks, targetSettings = settings) {
  const nextBlocks = [...targetBlocks];
  const failedDays = [];

  DAYS.forEach((day) => {
    if (hasRequiredWhiteSpace(day.key, nextBlocks)) return;
    const slot = findAvailableWhiteSpaceSlot(day.key, nextBlocks, targetSettings);
    if (!slot) {
      failedDays.push(day.label);
      return;
    }
    nextBlocks.push(createBlock({
      day: day.key,
      startTime: slot.startTime,
      endTime: slot.endTime,
      type: "white_space",
      purpose: "reflection",
      memo: "自動配置"
    }));
  });

  lastWarnings = failedDays.map((day) => `${day}に2時間の余白を自動配置できませんでした。`);
  return nextBlocks;
}

function createBlock(overrides) {
  return {
    id: `block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: overrides.type === "white_space" ? "余白時間" : "",
    day: "monday",
    startTime: "06:00",
    endTime: "08:00",
    type: "free",
    ...overrides
  };
}

function trackPrototypeEvent(eventName, params = {}) {
  const payload = {
    prototype_id: PROTOTYPE_ID,
    prototype_name: PROTOTYPE_NAME,
    ...params
  };

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...payload });
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored?.blocks) && Array.isArray(stored?.settings) && stored.settings.length) {
      blocks = stored.blocks;
      settings = stored.settings;
      return;
    }
  } catch (error) {
    console.warn("White Space Calendar storage load failed", error);
  }

  blocks = cloneData(initialBlocks);
  settings = cloneData(initialSettings);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ blocks, settings }));
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function validateTimeOrder(block) {
  if (timeToMinutes(block.endTime) <= timeToMinutes(block.startTime)) {
    return "終了時刻は開始時刻より後にしてください。";
  }
  return "";
}

function validateBlock(block) {
  if (block.type !== "white_space" && !block.title.trim()) {
    return "タイトルを入力してください。";
  }

  const timeOrderError = validateTimeOrder(block);
  if (timeOrderError) return timeOrderError;

  if (!isWithinWakeSleep(block.day, block.startTime, block.endTime, settings)) {
    return "起床時刻から就寝時刻までの間に配置してください。";
  }

  if (block.type === "white_space" && getDurationMinutes(block) !== 120) {
    return "余白時間は必ず連続2時間で設定してください。";
  }

  if (block.type !== "fixed" && getCountableBlocksByDay(block.day).length >= 3) {
    return "この日はすでに3ボックス使用しています。これ以上予定を追加できません。";
  }

  if (block.type === "free" && getFreeBlocksByDay(block.day).length >= 2) {
    return "自由予定は1日最大2つまでです。";
  }

  if (hasConflict(block, blocks)) {
    return "この時間帯は既存の予定と重複しています。";
  }

  return "";
}

function addBlock(block, eventName) {
  const error = validateBlock(block);
  if (error) {
    showMessage(error, "error");
    return;
  }

  blocks = [...blocks, block];
  saveState();
  trackPrototypeEvent(eventName, {
    block_type: block.type,
    category: block.category || block.purpose || "",
    day_of_week: block.day,
    action_type: "add"
  });
  showMessage("予定を追加しました。", "success");
  render();
}

function deleteBlock(blockId) {
  const block = blocks.find((item) => item.id === blockId);
  blocks = blocks.filter((item) => item.id !== blockId);
  saveState();
  trackPrototypeEvent("delete_block_click", {
    block_type: block?.type || "",
    category: block?.category || block?.purpose || "",
    day_of_week: block?.day || "",
    action_type: "delete"
  });
  render();
}

function showMessage(message, tone = "error") {
  const messageElement = document.querySelector("[data-validation-message]");
  messageElement.textContent = message;
  messageElement.dataset.tone = tone;
}

function clearMessage() {
  const messageElement = document.querySelector("[data-validation-message]");
  messageElement.textContent = "";
  messageElement.dataset.tone = "";
}

function dayLabel(dayKey) {
  return DAYS.find((day) => day.key === dayKey)?.label || dayKey;
}

function summarizeWeek() {
  const totals = blocks.reduce((summary, block) => {
    summary[block.type] += getDurationHours(block);
    if (block.type === "free") {
      summary.categories[block.category] = (summary.categories[block.category] || 0) + getDurationHours(block);
    }
    return summary;
  }, { fixed: 0, white_space: 0, free: 0, categories: {} });

  const missingDays = getMissingWhiteSpaceDays();
  const protectedDays = 7 - missingDays.length;
  const countableTotal = blocks.filter((block) => block.type !== "fixed").length;
  const capacityTotal = 21;

  return { totals, missingDays, protectedDays, countableTotal, capacityTotal };
}

function renderHeader() {
  const summary = summarizeWeek();
  document.querySelector("[data-week-period]").textContent = getWeekPeriodLabel();
  document.querySelector("[data-white-space-rate]").textContent = `${summary.protectedDays}/7日`;
  document.querySelector("[data-box-summary]").textContent = `${summary.countableTotal}/${summary.capacityTotal}枠`;
}

function getWeekPeriodLabel() {
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date) => `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  return `${format(monday)} - ${format(sunday)}`;
}

function renderCalendar() {
  const board = document.querySelector("[data-calendar-board]");
  const wakeStart = Math.min(...settings.map((item) => timeToMinutes(item.wakeTime)));
  const sleepEnd = Math.max(...settings.map((item) => timeToMinutes(item.sleepTime)));
  const slotCount = (sleepEnd - wakeStart) / 30;
  const rowHeight = 32;

  board.innerHTML = "";
  board.style.setProperty("--slot-count", slotCount);
  board.style.setProperty("--row-height", `${rowHeight}px`);
  board.style.gridTemplateRows = `52px repeat(${slotCount}, var(--row-height))`;

  const corner = document.createElement("div");
  corner.className = "wsc-calendar-corner";
  corner.textContent = "時間";
  board.appendChild(corner);

  DAYS.forEach((day, index) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "wsc-day-header";
    const countable = getCountableBlocksByDay(day.key).length;
    const hasWhiteSpace = hasRequiredWhiteSpace(day.key);
    dayHeader.style.gridColumn = String(index + 2);
    dayHeader.innerHTML = `
      <strong>${day.short}</strong>
      <span>${countable}/3枠</span>
      <em>${hasWhiteSpace ? "余白確保済み" : "余白未確保"}</em>
    `;
    board.appendChild(dayHeader);
  });

  for (let i = 0; i < slotCount; i += 1) {
    const minutes = wakeStart + i * 30;
    const label = document.createElement("div");
    label.className = "wsc-time-label";
    label.style.gridRow = String(i + 2);
    label.textContent = minutes % 60 === 0 ? minutesToTime(minutes) : "";
    board.appendChild(label);

    DAYS.forEach((day, dayIndex) => {
      const cell = document.createElement("div");
      cell.className = "wsc-calendar-cell";
      cell.style.gridColumn = String(dayIndex + 2);
      cell.style.gridRow = String(i + 2);
      board.appendChild(cell);
    });
  }

  blocks.forEach((block) => {
    const dayIndex = DAYS.findIndex((day) => day.key === block.day);
    const start = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);
    if (dayIndex < 0 || start < wakeStart || end > sleepEnd) return;

    const item = document.createElement("article");
    item.className = `wsc-block wsc-block-${block.type}`;
    item.style.gridColumn = String(dayIndex + 2);
    item.style.gridRow = `${2 + (start - wakeStart) / 30} / ${2 + (end - wakeStart) / 30}`;
    item.innerHTML = `
      <div>
        <span>${getBlockTypeLabel(block)}</span>
        <strong>${block.title}</strong>
        <small>${block.startTime}-${block.endTime}</small>
        <em>${getBlockMeta(block)}</em>
      </div>
      <button type="button" data-delete-block="${block.id}" aria-label="${block.title}を削除">削除</button>
    `;
    board.appendChild(item);
  });
}

function getBlockTypeLabel(block) {
  if (block.type === "fixed") return "固定";
  if (block.type === "white_space") return "余白";
  return "自由";
}

function getBlockMeta(block) {
  if (block.type === "white_space") return PURPOSE_LABELS[block.purpose] || "内省";
  if (block.type === "free") return CATEGORY_LABELS[block.category] || "その他";
  return block.memo || "拘束時間";
}

function renderWarnings() {
  const warningBox = document.querySelector("[data-warning-list]");
  const missingDays = getMissingWhiteSpaceDays().map(dayLabel);
  const warnings = [
    ...missingDays.map((day) => `${day}に2時間の余白がありません。`),
    ...lastWarnings
  ];

  warningBox.innerHTML = "";

  if (!warnings.length) {
    warningBox.innerHTML = "<p>すべての日で2時間の余白が確保されています。</p>";
    warningBox.dataset.state = "ok";
    return;
  }

  warningBox.dataset.state = "warning";
  warningBox.innerHTML = `
    <strong>余白未確保</strong>
    <ul>${warnings.map((warning) => `<li>${warning}</li>`).join("")}</ul>
  `;
}

function renderSummary() {
  const { totals, missingDays, protectedDays } = summarizeWeek();
  document.querySelector("[data-fixed-hours]").textContent = `${totals.fixed.toFixed(1)}h`;
  document.querySelector("[data-white-hours]").textContent = `${totals.white_space.toFixed(1)}h`;
  document.querySelector("[data-free-hours]").textContent = `${totals.free.toFixed(1)}h`;
  document.querySelector("[data-protected-days]").textContent = `${protectedDays}/7日`;
  document.querySelector("[data-missing-days]").textContent = missingDays.length ? missingDays.map(dayLabel).join("、") : "なし";

  const dayCounts = document.querySelector("[data-day-counts]");
  dayCounts.innerHTML = DAYS.map((day) => {
    const count = getCountableBlocksByDay(day.key).length;
    const tone = count >= 3 ? "full" : count === 0 ? "empty" : "normal";
    return `<li data-tone="${tone}"><span>${day.short}</span><strong>${count}/3</strong></li>`;
  }).join("");

  const categoryList = document.querySelector("[data-category-hours]");
  const categoryRows = Object.entries(CATEGORY_LABELS).map(([category, label]) => {
    const hours = blocks
      .filter((block) => block.type === "free" && block.category === category)
      .reduce((total, block) => total + getDurationHours(block), 0);
    return `<li><span>${label}</span><strong>${hours.toFixed(1)}h</strong></li>`;
  });
  categoryList.innerHTML = categoryRows.join("");

  const pressure = document.querySelector("[data-pressure-warning]");
  const fullDays = DAYS.filter((day) => getCountableBlocksByDay(day.key).length >= 3).map((day) => day.label);
  pressure.textContent = fullDays.length
    ? `${fullDays.join("、")}は3枠使用済みです。予定を追加する前に、減らせる予定がないか確認してください。`
    : "詰め込みすぎの警告はありません。";
}

function renderSettings() {
  const first = settings[0];
  document.querySelector("[name='wakeTime']").value = first.wakeTime;
  document.querySelector("[name='sleepTime']").value = first.sleepTime;
}

function render() {
  renderHeader();
  renderCalendar();
  renderWarnings();
  renderSummary();
  renderSettings();
}

function resetForms() {
  document.querySelectorAll("form[data-block-form]").forEach((form) => form.reset());
  document.querySelector("[name='fixedDay']").value = "monday";
  document.querySelector("[name='whiteDay']").value = "monday";
  document.querySelector("[name='freeDay']").value = "monday";
}

function bindForms() {
  document.querySelector("[data-fixed-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessage();
    const data = getFormData(event.currentTarget);
    addBlock(createBlock({
      title: data.fixedTitle.trim(),
      day: data.fixedDay,
      startTime: data.fixedStart,
      endTime: data.fixedEnd,
      type: "fixed",
      memo: data.fixedMemo.trim()
    }), "fixed_block_add");
  });

  document.querySelector("[data-white-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessage();
    const data = getFormData(event.currentTarget);
    addBlock(createBlock({
      title: "余白時間",
      day: data.whiteDay,
      startTime: data.whiteStart,
      endTime: data.whiteEnd,
      type: "white_space",
      purpose: data.whitePurpose,
      memo: data.whiteMemo.trim()
    }), "white_space_add");
  });

  document.querySelector("[data-free-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessage();
    const data = getFormData(event.currentTarget);
    addBlock(createBlock({
      title: data.freeTitle.trim(),
      day: data.freeDay,
      startTime: data.freeStart,
      endTime: data.freeEnd,
      type: "free",
      category: data.freeCategory,
      memo: data.freeMemo.trim()
    }), "free_block_add");
  });
}

function bindActions() {
  document.querySelector("[data-calendar-board]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-block]");
    if (!button) return;
    deleteBlock(button.dataset.deleteBlock);
  });

  document.querySelector("[data-auto-place]").addEventListener("click", () => {
    clearMessage();
    blocks = autoPlaceWhiteSpaces(blocks, settings);
    saveState();
    trackPrototypeEvent("auto_place_white_space_click", { action_type: "auto_place" });
    showMessage(lastWarnings.length ? "配置できない曜日があります。" : "未確保日の余白を自動配置しました。", lastWarnings.length ? "error" : "success");
    render();
  });

  document.querySelector("[data-reset]").addEventListener("click", () => {
    blocks = cloneData(initialBlocks);
    settings = cloneData(initialSettings);
    lastWarnings = [];
    saveState();
    resetForms();
    trackPrototypeEvent("reset_white_space_calendar_click", { action_type: "reset" });
    showMessage("初期状態に戻しました。", "success");
    render();
  });

  document.querySelector("[data-settings-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = getFormData(event.currentTarget);
    if (timeToMinutes(data.wakeTime) >= timeToMinutes(data.sleepTime)) {
      showMessage("終了時刻は開始時刻より後にしてください。", "error");
      return;
    }
    settings = DAYS.map((day) => ({ day: day.key, wakeTime: data.wakeTime, sleepTime: data.sleepTime }));
    saveState();
    showMessage("起床・就寝時刻を更新しました。", "success");
    render();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  bindForms();
  bindActions();
  render();
  trackPrototypeEvent("white_space_calendar_view", { action_type: "view" });
});
