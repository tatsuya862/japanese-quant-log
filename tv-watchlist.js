'use strict';

const feedUrl = 'https://raw.githubusercontent.com/dbghelp/JCOM-TV-EPG/refs/heads/main/jcom.xml';
const channels = {
  jcom_2_30720_32272: 'NHK総合・長野',
  jcom_2_30728_32273: 'NHK Eテレ長野',
  jcom_2_30736_32274: 'テレビ信州',
  jcom_2_30744_32275: '長野朝日放送',
  jcom_2_30752_32276: 'SBC信越放送',
  jcom_2_30760_32277: 'NBS長野放送',
};
const examples = ['VIVANT', '帰れマンデー', 'ぐるナイ'];
const storageKey = 'quant-log-tv-watchlist-v1';
const refreshInterval = 15 * 60 * 1000;
const pageSize = 20;
const japaneseTime = { timeZone: 'Asia/Tokyo' };
const dayLabel = new Intl.DateTimeFormat('ja-JP', { ...japaneseTime, month: 'numeric', day: 'numeric', weekday: 'short' });
const timeLabel = new Intl.DateTimeFormat('ja-JP', { ...japaneseTime, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const jstOffset = 9 * 60 * 60 * 1000;

const element = id => document.getElementById(id);
const addForm = element('add-form');
const titleInput = element('new-title');
const savedList = element('saved-list');
const exampleList = element('examples');
const saveStatus = element('save-status');
const guideDay = element('guide-day');
const guideChannel = element('guide-channel');
const guideSearch = element('guide-search');
const guideList = element('guide-list');
const guideStatus = element('guide-status');
const guideEmpty = element('guide-empty');
const refreshButton = element('refresh');
const moreButton = element('more');

let savedTitles = [];
let programs = [];
let checkedAt = 0;
let attemptedAt = 0;
let fetching = false;
let failed = false;
let visibleLimit = pageSize;

try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) {
    savedTitles = stored.filter(title => typeof title === 'string' && matchKey(title));
  }
} catch {
  saveStatus.textContent = 'このブラウザの保存内容を読み込めませんでした。';
}

function matchKey(value) {
  return value.normalize('NFKC').toLocaleLowerCase('ja').replace(/[\p{Z}\p{P}\p{S}\s]/gu, '');
}

function dayKey(time) {
  return new Date(time + jstOffset).toISOString().slice(0, 10);
}

function parseTime(value) {
  const parts = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}) ([+-]\d{2})(\d{2})$/.exec(value || '');
  if (!parts) return NaN;
  const [, year, month, day, hour, minute, second, zoneHour, zoneMinute] = parts;
  return Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${zoneHour}:${zoneMinute}`);
}

function parseGuide(xml, now) {
  // Filter the national feed before parsing to keep memory use down on phones.
  const nagano = xml.match(/<programme\b(?=[^>]*\bchannel=["']jcom_2_307)[^>]*>[\s\S]*?<\/programme>/g) || [];
  const schedule = new DOMParser().parseFromString(`<tv>${nagano.join('')}</tv>`, 'application/xml');
  if (schedule.querySelector('parsererror')) throw new Error('Invalid programme data');
  const result = [];
  for (const entry of schedule.querySelectorAll('programme')) {
    const channel = entry.getAttribute('channel');
    const title = entry.querySelector('title')?.textContent.trim();
    const start = parseTime(entry.getAttribute('start'));
    const end = parseTime(entry.getAttribute('stop'));
    if (Object.hasOwn(channels, channel) && title && Number.isFinite(start) && end > start && end > now) {
      result.push({ channel, title, start, end, key: matchKey(title) });
    }
  }
  if (!result.length || !result.some(program => program.start <= now)) {
    throw new Error('No current Nagano schedule');
  }
  return result.sort((a, b) => a.start - b.start || a.channel.localeCompare(b.channel));
}

function saveTitles(nextTitles, message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextTitles));
  } catch {
    saveStatus.textContent = 'このブラウザに保存できませんでした。';
    return false;
  }
  savedTitles = nextTitles;
  saveStatus.textContent = message;
  renderSaved(Date.now());
  renderGuide(Date.now());
  return true;
}

function addTitle(value) {
  const title = value.trim();
  const key = matchKey(title);
  if (!key) {
    saveStatus.textContent = '番組名を入力してください。';
    return false;
  }
  if (savedTitles.some(saved => matchKey(saved) === key)) {
    saveStatus.textContent = 'すでに保存しています。';
    return false;
  }
  return saveTitles([...savedTitles, title], `「${title}」を保存しました。`);
}

function button(label, accessibleLabel, onClick) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = label;
  control.setAttribute('aria-label', accessibleLabel);
  control.addEventListener('click', onClick);
  return control;
}

function row(title, note, action) {
  const item = document.createElement('li');
  item.className = 'row';
  const text = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = title;
  const detail = document.createElement('span');
  detail.className = 'airing';
  detail.textContent = note;
  text.append(name, detail);
  item.append(text, action);
  return item;
}

function airingLabel(program, now) {
  const time = timeLabel.format(program.start);
  const day = dayLabel.format(program.start);
  const status = program.start <= now ? '放送中 ・ ' : '';
  return `${status}${day} ${time} ・ ${channels[program.channel]}`;
}

function renderSaved(now) {
  const upcoming = savedTitles.map(title => {
    const key = matchKey(title);
    return { title, program: programs.find(program => program.end > now && program.key.includes(key)) };
  });
  upcoming.sort((a, b) => (a.program?.start ?? Infinity) - (b.program?.start ?? Infinity));
  const rows = upcoming.map(({ title, program }) => {
    let note = '取得した番組表に放送予定はありません';
    if (failed) note = program ? `前回取得 ・ ${airingLabel(program, now).replace(/^放送中 ・ /, '')}` : '放送予定を確認できません';
    else if (!checkedAt) note = '放送予定を確認中';
    else if (program) note = airingLabel(program, now);
    return row(title, note, button('削除', `${title}を削除`, () => {
      if (saveTitles(savedTitles.filter(saved => saved !== title), `「${title}」を削除しました。`)) {
        titleInput.focus();
      }
    }));
  });
  savedList.replaceChildren(...rows);
  const choices = examples.filter(title => !savedTitles.some(saved => matchKey(saved) === matchKey(title)));
  exampleList.replaceChildren(...choices.map(title => button(title, `${title}を追加`, () => {
    if (addTitle(title)) titleInput.focus();
  })));
}

function updateDays(now) {
  const selected = guideDay.value;
  const days = new Map();
  for (const program of programs) {
    if (program.end <= now) continue;
    const time = Math.max(program.start, now);
    days.set(dayKey(time), dayLabel.format(time));
  }
  guideDay.replaceChildren(new Option('今から先', ''), ...Array.from(days, ([key, label]) => new Option(label, key)));
  if (days.has(selected)) guideDay.value = selected;
}

function renderGuide(now) {
  const day = guideDay.value;
  const channel = guideChannel.value;
  const query = matchKey(guideSearch.value);
  const matches = programs.filter(program => (
    program.end > now
    && (!day || dayKey(Math.max(program.start, now)) === day)
    && (!channel || program.channel === channel)
    && program.key.includes(query)
  ));
  const savedKeys = new Set(savedTitles.map(matchKey));
  const rows = matches.slice(0, visibleLimit).map(program => {
    const isSaved = savedKeys.has(program.key);
    const action = button(isSaved ? '保存済み' : '保存', `${program.title}を${isSaved ? '保存済み' : '保存'}`, () => {
      if (addTitle(program.title)) {
        guideList.querySelectorAll('button')[Math.min(matches.indexOf(program) + 1, visibleLimit - 1)]?.focus();
      }
    });
    action.disabled = isSaved;
    const note = airingLabel(program, now);
    return row(program.title, failed ? note.replace(/^放送中 ・ /, '') : note, action);
  });
  guideList.replaceChildren(...rows);
  moreButton.hidden = matches.length <= visibleLimit;
  guideEmpty.textContent = checkedAt && !matches.length ? '条件に合う放送予定はありません。' : '';
}

function renderSchedule(now) {
  updateDays(now);
  renderSaved(now);
  renderGuide(now);
}

async function loadGuide() {
  if (fetching) return;
  fetching = true;
  attemptedAt = Date.now();
  refreshButton.disabled = true;
  guideStatus.textContent = '番組表を取得しています…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(feedUrl, { signal: controller.signal, cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('Programme feed unavailable');
    const xml = await response.text();
    const now = Date.now();
    programs = parseGuide(xml, now);
    checkedAt = now;
    failed = false;
    const lastProgram = programs.at(-1);
    guideStatus.textContent = `取得 ${dayLabel.format(now)} ${timeLabel.format(now)} ・ ${dayLabel.format(lastProgram.start)}までの放送予定`;
  } catch {
    failed = true;
    guideStatus.textContent = checkedAt
      ? `更新できませんでした。前回取得 ${dayLabel.format(checkedAt)} ${timeLabel.format(checkedAt)}`
      : '番組表を取得できませんでした。「更新」か下の番組表リンクをお試しください。';
  } finally {
    clearTimeout(timeout);
    fetching = false;
    refreshButton.disabled = false;
    renderSchedule(Date.now());
  }
}

addForm.addEventListener('submit', event => {
  event.preventDefault();
  if (addTitle(titleInput.value)) titleInput.value = '';
  titleInput.focus();
});
for (const [id, name] of Object.entries(channels)) guideChannel.add(new Option(name, id));
for (const [control, event] of [[guideDay, 'change'], [guideChannel, 'change'], [guideSearch, 'input']]) {
  control.addEventListener(event, () => {
    visibleLimit = pageSize;
    renderGuide(Date.now());
  });
}
moreButton.addEventListener('click', () => {
  const firstNewIndex = visibleLimit;
  visibleLimit += pageSize;
  renderGuide(Date.now());
  guideList.children[firstNewIndex]?.querySelector('button:not(:disabled)')?.focus();
});
refreshButton.addEventListener('click', loadGuide);
function tick() {
  if (document.hidden || fetching) return;
  const now = Date.now();
  if (now - attemptedAt >= refreshInterval) loadGuide();
  else if (!document.activeElement?.closest('.row, .examples, .filters')) renderSchedule(now);
}
document.addEventListener('visibilitychange', tick);
setInterval(tick, 60000);
renderSaved(Date.now());
loadGuide();
