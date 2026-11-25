'use strict';

const storageKey = 'quant-log-household-budget-v1';
const categories = {
  food: '食品',
  daily: '日用品',
  medical: '医療費',
  communication: '通信費',
  insurance: '保険料',
  tax: '税金（国保税など）',
  personal: '自分のこと（習い事・交際費）',
};
const yenFormat = new Intl.NumberFormat('ja-JP');
const monthFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' });
const dateFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
const element = id => document.getElementById(id);
const startingDate = element('starting-date');
const startingAmount = element('starting-amount');
const matchDate = element('match-date');
const actualAmount = element('actual-amount');
const matchResult = element('match-result');
const dialog = element('entry-dialog');
const entryType = element('entry-type');
const entryDate = element('entry-date');
const entryAmount = element('entry-amount');
const entryCategory = element('entry-category');
const entryNote = element('entry-note');
const entryStatus = element('entry-status');
const status = element('status');
let ledger = { opening: null, check: null, entries: [] };
let month = firstOfMonth(new Date());
let editingId = null;

function dateKey(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromKey(key) {
  return new Date(`${key}T00:00:00`);
}

function firstOfMonth(date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function validDate(key) {
  return typeof key === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(fromKey(key)) === key;
}

function parseYen(value) {
  const clean = value.normalize('NFKC').trim().replace('−', '-');
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(clean)) return null;
  const amount = Number(clean.replaceAll(',', ''));
  return Number.isSafeInteger(amount) ? amount : null;
}

function yen(amount) {
  return `${yenFormat.format(amount)}円`;
}

function readLedger() {
  const data = JSON.parse(localStorage.getItem(storageKey) ?? '{"opening":null,"check":null,"entries":[]}');
  const validPoint = point => point === null || (point && validDate(point.date) && Number.isSafeInteger(point.amount));
  if (!data || !validPoint(data.opening) || !validPoint(data.check) || !Array.isArray(data.entries)
    || data.entries.some(entry => !entry || !validDate(entry.date) || !Number.isSafeInteger(entry.amount)
      || entry.amount <= 0 || typeof entry.id !== 'string' || typeof entry.note !== 'string'
      || (entry.type !== 'income' && (entry.type !== 'expense' || !Object.hasOwn(categories, entry.category))))) {
    throw new Error('Invalid ledger data');
  }
  return data;
}

function refreshLedger() {
  try {
    ledger = readLedger();
  } catch {
    status.textContent = 'このブラウザの家計簿を読み込めませんでした。';
  }
}

function updateLedger(change, feedback) {
  try {
    const next = change(readLedger());
    if (!next) return false;
    localStorage.setItem(storageKey, JSON.stringify(next));
    ledger = next;
    return true;
  } catch {
    feedback.textContent = 'このブラウザに保存できませんでした。';
    return false;
  }
}

function loadFields() {
  const today = dateKey(new Date());
  startingDate.value = ledger.opening?.date ?? today;
  startingAmount.value = ledger.opening ? String(ledger.opening.amount) : '';
  matchDate.value = ledger.check?.date ?? today;
  actualAmount.value = ledger.check ? String(ledger.check.amount) : '';
  element('starting').open = !ledger.opening;
}

function balanceOn(date) {
  if (!ledger.opening || !validDate(date) || date < ledger.opening.date) return null;
  let balance = BigInt(ledger.opening.amount);
  for (const entry of ledger.entries) {
    if (entry.date < ledger.opening.date || entry.date > date) continue;
    const amount = BigInt(entry.amount);
    balance += entry.type === 'income' ? amount : -amount;
  }
  return balance;
}

function renderBalance() {
  const date = matchDate.value;
  const balance = balanceOn(date);
  const difference = element('difference');
  element('starting-summary').textContent = ledger.opening
    ? `${dateFormat.format(fromKey(ledger.opening.date))}の開始残高　${yen(ledger.opening.amount)}`
    : '';
  element('book-balance').textContent = balance === null ? '―' : yen(balance);
  difference.textContent = '―';
  difference.className = '';
  matchResult.textContent = '';
  if (!ledger.opening) {
    matchResult.textContent = 'はじめに開始残高を設定してください。';
  } else if (!validDate(date) || date < ledger.opening.date) {
    matchResult.textContent = '記録を始めた日以降の照合日を選んでください。';
  } else if (ledger.check?.date === date && ledger.check.amount === parseYen(actualAmount.value)) {
    const delta = BigInt(ledger.check.amount) - balance;
    difference.textContent = `${delta > 0n ? '+' : ''}${yen(delta)}`;
    difference.className = delta === 0n ? 'match' : 'mismatch';
    matchResult.textContent = delta === 0n ? '帳簿と実際の残高が一致しています。'
      : `実際の残高が帳簿より${yen(delta < 0n ? -delta : delta)}${delta < 0n ? '少なく' : '多く'}なっています。`;
  }
}

function entryRow(entry) {
  const item = document.createElement('li');
  const description = document.createElement('div');
  const title = document.createElement('strong');
  const category = entry.type === 'income' ? '収入' : categories[entry.category];
  title.textContent = entry.note || category;
  const metadata = document.createElement('p');
  metadata.className = 'muted';
  const date = dateFormat.format(fromKey(entry.date));
  metadata.textContent = entry.note ? `${date} ・ ${category}` : date;
  const amount = document.createElement('span');
  amount.className = entry.type;
  amount.textContent = `${entry.type === 'income' ? '+' : '−'}${yen(entry.amount)}`;
  description.append(title, metadata, amount);
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = '編集';
  edit.setAttribute('aria-label', `${title.textContent}（${date}）を編集`);
  edit.addEventListener('click', () => openEntry(entry));
  item.append(description, edit);
  return item;
}

function renderMonth() {
  element('month-label').textContent = monthFormat.format(month);
  element('previous').disabled = month.getFullYear() === 1 && month.getMonth() === 0;
  element('next').disabled = month.getFullYear() === 9999 && month.getMonth() === 11;
  const prefix = dateKey(month).slice(0, 7);
  const entries = ledger.entries.filter(entry => entry.date.startsWith(prefix));
  let income = 0n;
  let expenses = 0n;
  for (const entry of entries) {
    if (entry.type === 'income') income += BigInt(entry.amount);
    else expenses += BigInt(entry.amount);
  }
  element('income-total').textContent = yen(income);
  element('expense-total').textContent = yen(expenses);
  element('empty').hidden = entries.length > 0;
  entries.reverse().sort((a, b) => b.date.localeCompare(a.date));
  element('entries').replaceChildren(...entries.map(entryRow));
}

function updateCategoryField() {
  const isExpense = entryType.value === 'expense';
  element('category-field').hidden = !isExpense;
  entryCategory.required = isExpense;
}

function openEntry(entry) {
  editingId = entry?.id ?? null;
  element('entry-title').textContent = entry ? '記録を編集' : '収入・支出を記録';
  entryType.value = entry?.type ?? 'expense';
  const today = dateKey(new Date());
  const displayedMonth = dateKey(month);
  entryDate.value = entry?.date ?? (today.startsWith(displayedMonth.slice(0, 7)) ? today : displayedMonth);
  entryAmount.value = entry ? String(entry.amount) : '';
  entryCategory.value = entry?.category || 'food';
  entryNote.value = entry?.note ?? '';
  entryStatus.textContent = '';
  element('delete-entry').hidden = !entry;
  updateCategoryField();
  dialog.showModal();
  entryAmount.focus();
}

function finishEntry(message, date) {
  dialog.close();
  month = firstOfMonth(fromKey(date));
  renderMonth();
  renderBalance();
  status.textContent = message;
  element('add-entry').focus({ preventScroll: true });
}

element('starting-form').addEventListener('submit', event => {
  event.preventDefault();
  const date = startingDate.value;
  const amount = parseYen(startingAmount.value);
  const feedback = element('starting-status');
  if (!validDate(date) || amount === null) {
    feedback.textContent = '日付と、1円単位の開始残高を入力してください。';
    return;
  }
  if (updateLedger(current => {
    if (current.entries.some(entry => entry.date < date)) {
      feedback.textContent = 'すでにある記録を含めるため、最も古い記録の日付以前を選んでください。';
      return null;
    }
    return { ...current, opening: { date, amount } };
  }, feedback)) {
    if (matchDate.value < date) {
      matchDate.value = date;
      actualAmount.value = '';
    }
    feedback.textContent = '';
    element('starting').open = false;
    status.textContent = '開始残高を保存しました。';
    renderBalance();
  }
});

element('match-form').addEventListener('submit', event => {
  event.preventDefault();
  const date = matchDate.value;
  const amount = parseYen(actualAmount.value);
  if (amount === null) {
    matchResult.textContent = '実際の残高を1円単位で入力してください。';
    return;
  }
  if (updateLedger(current => {
    if (!current.opening || !validDate(date) || date < current.opening.date) {
      matchResult.textContent = '開始残高を設定し、記録を始めた日以降を選んでください。';
      return null;
    }
    return { ...current, check: { date, amount } };
  }, matchResult)) renderBalance();
});
matchDate.addEventListener('input', () => {
  actualAmount.value = ledger.check?.date === matchDate.value ? String(ledger.check.amount) : '';
  renderBalance();
});
actualAmount.addEventListener('input', renderBalance);

for (const [key, label] of Object.entries(categories)) entryCategory.add(new Option(label, key));
entryType.addEventListener('change', updateCategoryField);
element('add-entry').addEventListener('click', () => openEntry());
element('close-entry').addEventListener('click', () => dialog.close());
element('entry-form').addEventListener('submit', event => {
  event.preventDefault();
  const date = entryDate.value;
  const amount = parseYen(entryAmount.value);
  const type = entryType.value;
  if (!validDate(date) || amount === null || amount <= 0) {
    entryStatus.textContent = '日付と、1円以上の整数の金額を入力してください。';
    return;
  }
  const fields = { date, amount, type, category: type === 'expense' ? entryCategory.value : '', note: entryNote.value.trim() };
  if (updateLedger(current => {
    if (current.opening && date < current.opening.date) {
      entryStatus.textContent = '記録を始める日以降の日付を選んでください。';
      return null;
    }
    if (!editingId) return { ...current, entries: [...current.entries, { ...fields, id: crypto.randomUUID() }] };
    if (!current.entries.some(entry => entry.id === editingId)) {
      entryStatus.textContent = 'この記録はすでに削除されています。';
      return null;
    }
    return { ...current, entries: current.entries.map(entry => entry.id === editingId ? { ...entry, ...fields } : entry) };
  }, entryStatus)) finishEntry('記録を保存しました。', date);
});
element('delete-entry').addEventListener('click', () => {
  if (!editingId || !window.confirm('この記録を削除しますか？')) return;
  if (updateLedger(current => ({ ...current, entries: current.entries.filter(entry => entry.id !== editingId) }), entryStatus)) {
    finishEntry('記録を削除しました。', dateKey(month));
  }
});
element('previous').addEventListener('click', () => {
  month.setMonth(month.getMonth() - 1);
  renderMonth();
});
element('current').addEventListener('click', () => {
  month = firstOfMonth(new Date());
  renderMonth();
});
element('next').addEventListener('click', () => {
  month.setMonth(month.getMonth() + 1);
  renderMonth();
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  refreshLedger();
  renderBalance();
  renderMonth();
});
refreshLedger();
loadFields();
renderBalance();
renderMonth();
