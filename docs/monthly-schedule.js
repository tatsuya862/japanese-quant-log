'use strict';

const storageKey = 'quant-log-monthly-schedule-v1';
const categories = {
  self: '自分の予定',
  home: '家のこと',
  family: '家族のこと',
  meeting: '会議',
  volunteer: 'ボランティア',
};
const monthFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' });
const dayFormat = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
const element = id => document.getElementById(id);
const calendar = element('calendar');
const agenda = element('agenda');
const status = element('status');
const dialog = element('day-dialog');
const dayPanel = element('day-panel');
const form = element('event-form');
const nameInput = element('event-name');
const dateInput = element('event-date');
const timeInput = element('event-time');
const categoryInput = element('event-category');
const formStatus = element('form-status');

let month = firstOfMonth(new Date());
let events = [];
let activeDate = '';
let editingId = null;

function firstOfMonth(date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

function fromKey(key) {
  return new Date(`${key}T00:00:00`);
}

function validDate(key) {
  return typeof key === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(fromKey(key)) === key;
}

function readEvents() {
  const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (!Array.isArray(stored) || stored.some(event => !event || typeof event.id !== 'string'
    || typeof event.name !== 'string' || !validDate(event.date) || !Object.hasOwn(categories, event.category)
    || typeof event.time !== 'string' || (event.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time)))) {
    throw new Error('Invalid schedule data');
  }
  return stored;
}

function refreshEvents() {
  try {
    events = readEvents();
  } catch {
    status.textContent = 'このブラウザの予定を読み込めませんでした。';
  }
  renderMonth();
  if (dialog.open && !dayPanel.hidden) showDay();
}

function updateEvents(change) {
  try {
    const next = change(readEvents());
    if (!next) {
      formStatus.textContent = 'この予定はすでに削除されています。';
      return false;
    }
    localStorage.setItem(storageKey, JSON.stringify(next));
    events = next;
    return true;
  } catch {
    formStatus.textContent = 'このブラウザに予定を保存できませんでした。';
    return false;
  }
}

function compareEvents(a, b) {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'ja');
}

function create(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function dot(category) {
  const node = create('span', '', 'dot');
  node.dataset.category = category;
  return node;
}

function dayButton(date, dayEvents, today) {
  const key = dateKey(date);
  const button = create('button', '', 'day');
  button.type = 'button';
  button.dataset.date = key;
  button.setAttribute('aria-label', `${dayFormat.format(date)}、予定${dayEvents.length}件`);
  if (key === today) button.setAttribute('aria-current', 'date');
  button.append(create('span', String(date.getDate()), 'day-number'));
  for (const event of dayEvents.slice(0, 2)) {
    const label = create('span', [event.time, event.name].filter(Boolean).join(' '), 'event-preview');
    label.dataset.category = event.category;
    button.append(label);
  }
  if (dayEvents.length > 2) button.append(create('span', `ほか${dayEvents.length - 2}件`, 'day-count'));
  const dots = create('span', '', 'day-dots');
  for (const category of new Set(dayEvents.map(event => event.category))) dots.append(dot(category));
  button.append(dots);
  button.addEventListener('click', () => openDay(key));
  return button;
}

function makeEventList(dayEvents) {
  const list = create('ul', '', 'event-list');
  for (const event of dayEvents) {
    const row = create('li', '', 'event-row');
    row.dataset.category = event.category;
    const detail = create('div');
    detail.append(create('strong', event.name), create('p', `${event.time || '時刻なし'} ・ ${categories[event.category]}`, 'event-category'));
    const edit = create('button', '編集');
    edit.type = 'button';
    edit.setAttribute('aria-label', `${event.name}を編集`);
    edit.dataset.eventId = event.id;
    edit.addEventListener('click', () => openDay(event.date, event));
    row.append(detail, edit);
    list.append(row);
  }
  return list;
}

function renderMonth() {
  element('month-label').textContent = monthFormat.format(month);
  element('previous').disabled = month.getFullYear() === 1 && month.getMonth() === 0;
  element('next').disabled = month.getFullYear() === 9999 && month.getMonth() === 11;
  const prefix = dateKey(month).slice(0, 7);
  const byDate = new Map();
  const monthEvents = events.filter(event => event.date.startsWith(prefix)).sort(compareEvents);
  for (const event of monthEvents) {
    if (!byDate.has(event.date)) byDate.set(event.date, []);
    byDate.get(event.date).push(event);
  }
  const cells = document.createDocumentFragment();
  for (let index = 0; index < month.getDay(); index++) cells.append(create('span', '', 'outside'));
  const last = new Date(month);
  last.setMonth(last.getMonth() + 1, 0);
  const today = dateKey(new Date());
  for (let day = 1; day <= last.getDate(); day++) {
    const date = new Date(month);
    date.setDate(day);
    cells.append(dayButton(date, byDate.get(dateKey(date)) ?? [], today));
  }
  for (let index = last.getDay(); index < 6; index++) cells.append(create('span', '', 'outside'));
  calendar.replaceChildren(cells);

  agenda.replaceChildren();
  for (const [key, dayEvents] of byDate) {
    agenda.append(create('h3', dayFormat.format(fromKey(key))), makeEventList(dayEvents));
  }
  if (!byDate.size) agenda.append(create('p', 'この月の予定はまだありません。', 'empty'));
}

function showDay() {
  element('dialog-title').textContent = `${dayFormat.format(fromKey(activeDate))}の予定`;
  const matches = events.filter(event => event.date === activeDate).sort(compareEvents);
  element('day-events').replaceChildren(matches.length ? makeEventList(matches) : create('p', 'この日の予定はありません。', 'empty'));
  form.hidden = true;
  dayPanel.hidden = false;
}

function showForm(event) {
  editingId = event?.id ?? null;
  element('dialog-title').textContent = event ? '予定を編集' : '予定を追加';
  nameInput.value = event?.name ?? '';
  dateInput.value = event?.date ?? activeDate;
  timeInput.value = event?.time ?? '';
  categoryInput.value = event?.category ?? 'self';
  element('delete').hidden = !event;
  formStatus.textContent = '';
  dayPanel.hidden = true;
  form.hidden = false;
  nameInput.focus();
}

function openDay(key, event, addNow = false) {
  activeDate = key;
  if (event || addNow) showForm(event);
  else showDay();
  if (!dialog.open) dialog.showModal();
  if (!form.hidden) nameInput.focus();
}

function moveMonth(offset) {
  month.setMonth(month.getMonth() + offset);
  renderMonth();
}

function finish(message, key) {
  dialog.close();
  month = firstOfMonth(fromKey(key));
  renderMonth();
  status.textContent = message;
  calendar.querySelector(`[data-date="${key}"]`)?.focus({ preventScroll: true });
}

for (const [key, label] of Object.entries(categories)) {
  const legendItem = create('li');
  legendItem.append(dot(key), document.createTextNode(label));
  element('legend').append(legendItem);
  categoryInput.add(new Option(label, key));
}
element('previous').addEventListener('click', () => moveMonth(-1));
element('next').addEventListener('click', () => moveMonth(1));
element('current').addEventListener('click', () => {
  month = firstOfMonth(new Date());
  renderMonth();
});
element('add').addEventListener('click', () => {
  const today = new Date();
  const date = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth() ? today : month;
  openDay(dateKey(date), null, true);
});
element('add-on-day').addEventListener('click', () => showForm());
element('close-dialog').addEventListener('click', () => dialog.close());
element('cancel-edit').addEventListener('click', () => {
  showDay();
  element('add-on-day').focus();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const fields = { name: nameInput.value.trim(), date: dateInput.value, time: timeInput.value, category: categoryInput.value };
  if (!fields.name || !validDate(fields.date)) {
    formStatus.textContent = '予定名と日付を入力してください。';
    return;
  }
  if (updateEvents(current => {
    if (!editingId) return [...current, { id: crypto.randomUUID(), ...fields }];
    if (!current.some(item => item.id === editingId)) return null;
    return current.map(item => item.id === editingId ? { ...item, ...fields } : item);
  })) finish('予定を保存しました。', fields.date);
});
element('delete').addEventListener('click', () => {
  if (!editingId || !window.confirm('この予定を削除しますか？')) return;
  if (updateEvents(current => current.some(item => item.id === editingId)
    ? current.filter(item => item.id !== editingId) : null)) finish('予定を削除しました。', activeDate);
});
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refreshEvents();
});
refreshEvents();
