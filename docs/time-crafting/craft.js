"use strict";

const byId = (id) => document.getElementById(id);
const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
const kinds = new Map([["fixed", "固定"], ["priority", "優先"], ["life", "楽しみ・暮らし"], ["space", "余白"]]);
const storageKey = "quant-log-time-crafting-weekly-v1";
const status = byId("save-note");
const sheet = byId("sheet");
const editor = byId("editor");
const kindInput = byId("type");
const entryInput = byId("entry");
const dateLong = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "long" });
const dateRange = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" });
let monday = startOfWeek(new Date());
let weeks = load();
let showEarly = hasEarlyEntries(currentWeek());
let selectedSlot = null;

function moveDate(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

function startOfWeek(date) {
  return moveDate(date, -((date.getDay() + 6) % 7));
}

function dateKey(date) {
  return [date.getFullYear(), twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join("-");
}

function twoDigits(number) {
  return String(number).padStart(2, "0");
}

function timeRange(hour) {
  return twoDigits(hour) + ":00–" + twoDigits(hour + 2) + ":00";
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    status.textContent = "保存済みの予定を読み込めませんでした。";
    return {};
  }
}

function currentWeek() {
  const key = dateKey(monday);
  if (!weeks[key] || typeof weeks[key] !== "object") weeks[key] = { slots: {} };
  const week = weeks[key];
  if (!week.slots || typeof week.slots !== "object") week.slots = {};
  return week;
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(weeks));
    return true;
  } catch {
    status.textContent = "このブラウザーでは保存できません。ページを閉じる前に印刷できます。";
    return false;
  }
}

function getSlot(week, key) {
  const slot = week.slots[key];
  if (!slot || !kinds.has(slot.kind) || typeof slot.title !== "string") return null;
  return slot;
}

function hasEarlyEntries(week) {
  return Object.keys(week.slots).some(key => /^\d-[0246]$/.test(key) && getSlot(week, key));
}

function render() {
  const week = currentWeek();
  const today = dateKey(new Date());
  const days = weekdays.map((_, index) => moveDate(monday, index));
  const heads = byId("days");
  const times = byId("slots");
  heads.replaceChildren(heads.firstElementChild);
  let weekTotal = 0;
  days.forEach((date, index) => {
    const th = document.createElement("th");
    th.scope = "col";
    const dateIsToday = dateKey(date) === today;
    if (dateIsToday) th.classList.add("today");
    const day = document.createElement("span");
    day.className = "day-name";
    day.textContent = weekdays[index];
    const monthDay = document.createElement("span");
    monthDay.className = "day-date";
    monthDay.textContent = (date.getMonth() + 1) + "/" + date.getDate();
    const dayTotal = Object.keys(week.slots).filter(key => key.startsWith(index + "-") && getSlot(week, key)?.kind === "space").length * 2;
    weekTotal += dayTotal;
    const summary = document.createElement("small");
    summary.className = dayTotal ? "day-summary day-has-space" : "day-summary";
    summary.textContent = "余白 " + dayTotal + "h";
    th.append(day, monthDay, summary);
    heads.append(th);
  });
  times.replaceChildren();
  for (let hour = 0; hour < 24; hour += 2) {
    const row = document.createElement("tr");
    if (hour < 8) row.className = "early";
    const time = document.createElement("th");
    time.scope = "row";
    time.textContent = timeRange(hour);
    row.append(time);
    days.forEach((date, index) => {
      const key = index + "-" + hour;
      const slot = getSlot(week, key);
      const cell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot";
      button.dataset.slot = key;
      button.setAttribute("aria-label", dateLong.format(date) + " " + timeRange(hour) + " " +
        (slot ? (slot.kind === "space" ? "余白" : kinds.get(slot.kind) + " " + slot.title) : "空欄"));
      if (slot) {
        cell.dataset.kind = slot.kind;
        const label = document.createElement("span");
        label.className = "slot-tag";
        label.textContent = slot.kind === "life" ? "暮らし" : kinds.get(slot.kind);
        button.append(label);
        if (slot.kind !== "space") {
          const title = document.createElement("span");
          title.className = "slot-title";
          title.textContent = slot.title;
          button.append(title);
        }
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "empty";
        placeholder.textContent = "＋";
        placeholder.setAttribute("aria-hidden", "true");
        button.append(placeholder);
      }
      button.addEventListener("click", () => editSlot(key, date, hour));
      cell.append(button);
      row.append(cell);
    });
    times.append(row);
  }
  sheet.classList.toggle("show-early", showEarly);
  sheet.classList.toggle("has-early", hasEarlyEntries(week));
  byId("early").checked = showEarly;
  byId("week-range").textContent = dateRange.formatRange(monday, days[6]);
  byId("total").textContent = weekTotal;
}

function changeWeek(date) {
  monday = startOfWeek(date);
  showEarly = hasEarlyEntries(currentWeek());
  render();
}

function syncEditor() {
  const isSpace = kindInput.value === "space";
  entryInput.required = !isSpace;
  entryInput.disabled = isSpace;
  entryInput.parentElement.hidden = isSpace;
}

function editSlot(key, date, hour) {
  selectedSlot = key;
  const slot = getSlot(currentWeek(), key);
  kindInput.value = slot?.kind ?? "fixed";
  entryInput.value = slot?.title ?? "";
  entryInput.setCustomValidity("");
  byId("edit-when").textContent = dateLong.format(date) + " " + timeRange(hour);
  byId("clear").hidden = !slot;
  syncEditor();
  editor.showModal();
}

function finishEdit(message) {
  if (persist()) status.textContent = message;
  render();
  editor.close();
}

byId("previous").addEventListener("click", () => changeWeek(moveDate(monday, -7)));
byId("current").addEventListener("click", () => changeWeek(new Date()));
byId("next").addEventListener("click", () => changeWeek(moveDate(monday, 7)));
byId("early").addEventListener("change", (event) => {
  showEarly = event.target.checked;
  sheet.classList.toggle("show-early", showEarly);
});
byId("print").addEventListener("click", () => window.print());
kindInput.addEventListener("change", syncEditor);
entryInput.addEventListener("input", () => entryInput.setCustomValidity(""));
byId("cancel").addEventListener("click", () => editor.close());
byId("clear").addEventListener("click", () => {
  if (!selectedSlot) return;
  delete currentWeek().slots[selectedSlot];
  finishEdit("この時間枠を空欄に戻しました。");
});

byId("edit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedSlot || !kinds.has(kindInput.value)) return;
  const isSpace = kindInput.value === "space";
  const title = isSpace ? "" : entryInput.value.trim();
  if (!isSpace && !title) {
    entryInput.setCustomValidity("予定名を入力してください。");
    entryInput.reportValidity();
    return;
  }
  currentWeek().slots[selectedSlot] = { kind: kindInput.value, title };
  finishEdit(isSpace ? "2時間の余白を確保しました。" : "予定を保存しました。");
});

editor.addEventListener("close", () => {
  byId("slots").querySelector('[data-slot="' + selectedSlot + '"]')?.focus({ preventScroll: true });
  selectedSlot = null;
});

render();
