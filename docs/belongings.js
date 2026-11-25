'use strict';

const storageKey = 'quant-log-belongings-v1';
const categories = ['服', '本', 'その他'];
const element = id => document.getElementById(id);
const search = element('search');
const filter = element('filter');
const editor = element('editor');
const editorTitle = element('editor-title');
const form = element('item-form');
const nameInput = element('name');
const categoryInput = element('category');
const placeInput = element('place');
const submitButton = element('submit-item');
const cancelButton = element('cancel-edit');
const formStatus = element('form-status');
const allView = element('all-view');
const candidateView = element('candidate-view');
const itemsList = element('items');
const empty = element('empty');
const notice = element('notice');
const undo = element('undo');
const confirmation = element('remove-confirm');

let items = [];
let candidateOnly = false;
let editingId = null;
let removalId = null;
let lastRemoved = null;

function normalized(value) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
}

function readItems() {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (!Array.isArray(saved) || saved.some(item => !item
    || typeof item.id !== 'string' || typeof item.name !== 'string'
    || typeof item.place !== 'string' || !categories.includes(item.category)
    || typeof item.candidate !== 'boolean')) {
    throw new Error('Invalid inventory data');
  }
  return saved;
}

function sameItem(first, second) {
  return first.category === second.category && normalized(first.name) === normalized(second.name);
}

function updateItems(change, status = notice) {
  try {
    const next = change(readItems());
    if (!next) return false;
    localStorage.setItem(storageKey, JSON.stringify(next));
    items = next;
    return true;
  } catch {
    status.textContent = 'このブラウザの持ち物を保存できませんでした。';
    return false;
  }
}

function refreshItems() {
  try {
    items = readItems();
  } catch {
    notice.textContent = 'このブラウザの保存内容を読み込めませんでした。';
  }
  render();
}

function resetEditor() {
  form.reset();
  formStatus.textContent = '';
  editingId = null;
  editorTitle.textContent = '持ち物を登録';
  submitButton.textContent = '登録';
  cancelButton.hidden = true;
  editor.open = false;
}

function edit(item) {
  editingId = item.id;
  editorTitle.textContent = '持ち物を編集';
  submitButton.textContent = '保存';
  cancelButton.hidden = false;
  formStatus.textContent = '';
  nameInput.value = item.name;
  categoryInput.value = item.category;
  placeInput.value = item.place;
  editor.open = true;
  nameInput.focus();
}

function toggleCandidate(item) {
  let candidate;
  if (updateItems(current => {
    const latest = current.find(entry => entry.id === item.id);
    if (!latest) {
      notice.textContent = 'この持ち物はすでに一覧から外れています。';
      return null;
    }
    candidate = !latest.candidate;
    return current.map(entry => entry.id === latest.id ? { ...entry, candidate } : entry);
  })) {
    notice.textContent = candidate ? '片づけ候補に入れました。' : '片づけ候補から外しました。';
    render();
  } else {
    refreshItems();
  }
}

function askRemoval(item) {
  removalId = item.id;
  confirmation.returnValue = '';
  element('remove-detail').textContent = `「${item.name}」を持ち物から外します。`;
  confirmation.showModal();
}

function makeAction(item, kind, label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.item = item.id;
  button.dataset.kind = kind;
  button.setAttribute('aria-label', `${label}　${item.name}`);
  button.addEventListener('click', () => handler(item));
  return button;
}

function itemRow(item) {
  const row = document.createElement('li');
  const heading = document.createElement('h2');
  heading.textContent = item.name;
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = item.place ? `${item.category} ・ ${item.place}` : item.category;
  if (item.candidate) {
    const tag = document.createElement('span');
    tag.className = 'candidate';
    tag.textContent = ' ・ 片づけ候補';
    meta.append(tag);
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(
    makeAction(item, 'edit', '編集', edit),
    makeAction(item, 'candidate', item.candidate ? '候補から外す' : '片づけ候補にする', toggleCandidate),
  );
  if (item.candidate) actions.append(makeAction(item, 'remove', '手放した', askRemoval));
  row.append(heading, meta, actions);
  return row;
}

function render() {
  const focused = document.activeElement;
  const restoreFocus = itemsList.contains(focused);
  const query = normalized(search.value);
  const selectedCategory = filter.value;
  const matching = items.filter(item => (
    (!candidateOnly || item.candidate)
    && (!selectedCategory || item.category === selectedCategory)
    && (normalized(item.name).includes(query) || normalized(item.place).includes(query))
  ));
  const candidates = items.filter(item => item.candidate).length;
  allView.textContent = `持ち物 ${items.length}件`;
  candidateView.textContent = `片づけ候補 ${candidates}件`;
  allView.setAttribute('aria-pressed', String(!candidateOnly));
  candidateView.setAttribute('aria-pressed', String(candidateOnly));
  itemsList.setAttribute('aria-label', candidateOnly ? '片づけ候補リスト' : '持ち物リスト');
  itemsList.replaceChildren(...matching.map(itemRow));
  empty.hidden = matching.length > 0;
  empty.textContent = query || selectedCategory ? '条件に合う持ち物が見つかりません。'
    : candidateOnly ? '片づけ候補はありません。' : '持ち物はまだ登録されていません。';
  if (restoreFocus) {
    const replacement = Array.from(itemsList.querySelectorAll('button')).find(button => (
      button.dataset.item === focused.dataset.item && button.dataset.kind === focused.dataset.kind
    ));
    (replacement ?? (candidateOnly ? candidateView : allView)).focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    formStatus.textContent = '持ち物の名前を入力してください。';
    nameInput.focus();
    return;
  }
  const isEdit = editingId !== null;
  const fields = { name, category: categoryInput.value, place: placeInput.value.trim() };
  const saved = updateItems(current => {
    if (current.some(item => item.id !== editingId && sameItem(item, fields))) {
      formStatus.textContent = `「${name}」はこの分類に登録済みです。`;
      return null;
    }
    if (!isEdit) return [...current, { ...fields, id: crypto.randomUUID(), candidate: false }];
    if (!current.some(item => item.id === editingId)) {
      formStatus.textContent = 'この持ち物はすでに一覧から外れています。';
      return null;
    }
    return current.map(item => item.id === editingId ? { ...item, ...fields } : item);
  }, formStatus);
  if (!saved) return;
  if (!isEdit) {
    candidateOnly = false;
    search.value = '';
    filter.value = '';
  }
  resetEditor();
  notice.textContent = isEdit ? '持ち物を更新しました。' : `「${name}」を登録しました。`;
  render();
  editorTitle.focus();
});

cancelButton.addEventListener('click', () => {
  resetEditor();
  editorTitle.focus();
});
search.addEventListener('input', render);
filter.addEventListener('change', render);
allView.addEventListener('click', () => {
  candidateOnly = false;
  render();
});
candidateView.addEventListener('click', () => {
  candidateOnly = true;
  render();
});
confirmation.addEventListener('close', () => {
  if (confirmation.returnValue !== 'remove') return;
  let removed;
  if (updateItems(current => {
    removed = current.find(item => item.id === removalId);
    return removed ? current.filter(item => item.id !== removalId) : null;
  })) {
    lastRemoved = removed;
    if (editingId === removed.id) resetEditor();
    notice.textContent = `「${removed.name}」を持ち物から外しました。`;
    undo.hidden = false;
    render();
    undo.focus();
  } else {
    refreshItems();
  }
});
undo.addEventListener('click', () => {
  if (!lastRemoved) return;
  if (updateItems(current => {
    if (current.some(item => item.id === lastRemoved.id || sameItem(item, lastRemoved))) {
      notice.textContent = '同じ持ち物がすでに登録されています。';
      return null;
    }
    return [...current, lastRemoved];
  })) {
    lastRemoved = null;
    notice.textContent = '持ち物と片づけ候補に戻しました。';
    undo.hidden = true;
    render();
    (candidateOnly ? candidateView : allView).focus();
  }
});
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refreshItems();
});
refreshItems();
