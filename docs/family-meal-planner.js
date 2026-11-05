const STORAGE_KEY = "quant-log-family-meal-note-v1";
const storage = new URLSearchParams(window.location.search).has("test") ? sessionStorage : localStorage;

const defaultMenus = [
  { name: "肉じゃが", tags: ["牛肉", "豚肉", "肉", "じゃがいも", "玉ねぎ"] },
  { name: "鶏の照り焼き", tags: ["鶏肉", "肉"] },
  { name: "豚の生姜焼き", tags: ["豚肉", "肉", "生姜"] },
  { name: "豆腐ハンバーグ", tags: ["豆腐", "ひき肉", "肉"] },
  { name: "親子丼", tags: ["鶏肉", "肉", "卵", "ごはん"] },
  { name: "そぼろ丼", tags: ["ひき肉", "肉", "卵", "ごはん"] },
  { name: "クリームシチュー", tags: ["鶏肉", "肉", "乳製品", "じゃがいも"] },
  { name: "野菜のそぼろあん", tags: ["ひき肉", "肉", "野菜"] },
  { name: "鮭の塩焼き", tags: ["鮭", "魚"] },
  { name: "さばの味噌煮", tags: ["さば", "魚", "味噌"] },
  { name: "白身魚の煮付け", tags: ["白身魚", "魚"] },
  { name: "鮭と野菜の蒸し焼き", tags: ["鮭", "魚", "野菜"] },
  { name: "かぼちゃのそぼろ煮", tags: ["かぼちゃ", "ひき肉", "肉"] },
  { name: "筑前煮", tags: ["鶏肉", "肉", "根菜", "しいたけ", "きのこ"] },
  { name: "厚揚げと野菜の煮物", tags: ["厚揚げ", "豆腐", "野菜"] },
  { name: "茶碗蒸し", tags: ["卵", "鶏肉", "肉", "しいたけ", "きのこ"] },
  { name: "うどん", tags: ["麺", "小麦"] },
  { name: "にゅうめん", tags: ["麺", "小麦"] },
  { name: "卵雑炊", tags: ["卵", "ごはん"] },
  { name: "おでん", tags: ["大根", "卵", "練り物", "魚"] },
  { name: "野菜たっぷり豚汁", tags: ["豚肉", "肉", "味噌", "野菜"] },
];

const elements = {
  constraintsForm: document.querySelector("#constraints-form"),
  neverEat: document.querySelector("#never-eat"),
  dislikes: document.querySelector("#dislikes"),
  constraintsStatus: document.querySelector("#constraints-status"),
  recordForm: document.querySelector("#record-form"),
  recordId: document.querySelector("#record-id"),
  mealDate: document.querySelector("#meal-date"),
  mealName: document.querySelector("#meal-name"),
  ate: document.querySelector("#ate"),
  left: document.querySelector("#left"),
  liked: document.querySelector("#liked"),
  recordSubmit: document.querySelector("#record-submit"),
  recordCancel: document.querySelector("#record-cancel"),
  recordStatus: document.querySelector("#record-status"),
  recordList: document.querySelector("#record-list"),
  generateWeek: document.querySelector("#generate-week"),
  weekStatus: document.querySelector("#week-status"),
  weekList: document.querySelector("#week-list"),
};

const emptyState = () => ({
  constraints: { neverEat: "", dislikes: "" },
  records: [],
  week: [],
});

function loadState() {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    return {
      ...emptyState(),
      ...saved,
      constraints: { ...emptyState().constraints, ...saved?.constraints },
      records: Array.isArray(saved?.records) ? saved.records : [],
      week: Array.isArray(saved?.week) ? saved.week : [],
    };
  } catch {
    return emptyState();
  }
}

let state = loadState();

function saveState() {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayString() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

function splitTerms(value) {
  return value
    .split(/[\s、，,]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function resetRecordForm() {
  elements.recordForm.reset();
  elements.recordId.value = "";
  elements.mealDate.value = todayString();
  elements.recordSubmit.textContent = "記録を追加";
  elements.recordCancel.hidden = true;
}

function renderRecords() {
  if (!state.records.length) {
    elements.recordList.innerHTML = '<p class="empty">まだ記録はありません。</p>';
    return;
  }

  const records = [...state.records].sort((a, b) => b.date.localeCompare(a.date));
  elements.recordList.innerHTML = records.map((record) => {
    const reactions = [
      record.ate ? "食べた" : "",
      record.left ? "残した" : "",
      record.liked ? "好評" : "",
    ].filter(Boolean);
    return `
      <article class="record-item">
        <time datetime="${escapeHtml(record.date)}">${escapeHtml(formatDate(record.date))}</time>
        <div>
          <h3>${escapeHtml(record.name)}</h3>
          <div class="badges">${reactions.map((reaction) => `<span class="badge">${reaction}</span>`).join("") || '<span class="badge">反応なし</span>'}</div>
        </div>
        <div class="record-actions">
          <button type="button" data-edit="${escapeHtml(record.id)}">編集</button>
          <button type="button" data-delete="${escapeHtml(record.id)}">削除</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderWeek() {
  elements.weekList.innerHTML = state.week.map((item) => `
    <li>
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
      <strong>${escapeHtml(item.name)}</strong>
    </li>
  `).join("");
}

function menuScore(menuName) {
  return state.records.reduce((score, record) => {
    if (record.name !== menuName) return score;
    return score + (record.liked ? 4 : 0) + (record.ate ? 1 : 0) - (record.left ? 3 : 0);
  }, 0);
}

function buildCandidates() {
  const blocked = splitTerms(`${state.constraints.neverEat} ${state.constraints.dislikes}`);
  const likedMenus = state.records
    .filter((record) => record.liked)
    .map((record) => ({ name: record.name, tags: [] }));
  const byName = new Map([...likedMenus, ...defaultMenus].map((menu) => [menu.name, menu]));

  return [...byName.values()]
    .filter((menu) => {
      const searchText = `${menu.name} ${menu.tags.join(" ")}`.toLowerCase();
      return !blocked.some((term) => searchText.includes(term));
    })
    .sort((a, b) => menuScore(b.name) - menuScore(a.name));
}

elements.constraintsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.constraints = {
    neverEat: elements.neverEat.value.trim(),
    dislikes: elements.dislikes.value.trim(),
  };
  saveState();
  elements.constraintsStatus.textContent = "条件を保存しました。次の提案から反映します。";
});

elements.recordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.ate.checked && !elements.left.checked && !elements.liked.checked) {
    elements.recordStatus.textContent = "食べた、残した、好評だった、のいずれかを選んでください。";
    return;
  }

  const record = {
    id: elements.recordId.value || (crypto.randomUUID?.() || String(Date.now())),
    date: elements.mealDate.value,
    name: elements.mealName.value.trim(),
    ate: elements.ate.checked,
    left: elements.left.checked,
    liked: elements.liked.checked,
  };
  const existingIndex = state.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = record;
    elements.recordStatus.textContent = "記録を更新しました。";
  } else {
    state.records.push(record);
    elements.recordStatus.textContent = "記録を追加しました。";
  }
  saveState();
  resetRecordForm();
  renderRecords();
});

elements.recordList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const record = state.records.find((item) => item.id === editButton.dataset.edit);
    if (!record) return;
    elements.recordId.value = record.id;
    elements.mealDate.value = record.date;
    elements.mealName.value = record.name;
    elements.ate.checked = record.ate;
    elements.left.checked = record.left;
    elements.liked.checked = record.liked;
    elements.recordSubmit.textContent = "記録を更新";
    elements.recordCancel.hidden = false;
    elements.recordStatus.textContent = "記録を編集中です。";
    elements.mealName.focus();
  }

  if (deleteButton) {
    const record = state.records.find((item) => item.id === deleteButton.dataset.delete);
    if (!record || !window.confirm(`「${record.name}」の記録を削除しますか？`)) return;
    state.records = state.records.filter((item) => item.id !== record.id);
    saveState();
    resetRecordForm();
    renderRecords();
    elements.recordStatus.textContent = "記録を削除しました。";
  }
});

elements.recordCancel.addEventListener("click", () => {
  resetRecordForm();
  elements.recordStatus.textContent = "編集を終了しました。";
});

elements.generateWeek.addEventListener("click", () => {
  const candidates = buildCandidates();
  if (!candidates.length) {
    elements.weekStatus.textContent = "登録した条件に合う候補がありません。条件を見直してください。";
    state.week = [];
    saveState();
    renderWeek();
    return;
  }

  const start = new Date(`${todayString()}T00:00:00`);
  state.week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      name: candidates[index % candidates.length].name,
    };
  });
  saveState();
  renderWeek();
  elements.weekStatus.textContent = "7日分を提案しました。日々の記録後に作り直すと、反応が反映されます。";
});

elements.neverEat.value = state.constraints.neverEat;
elements.dislikes.value = state.constraints.dislikes;
resetRecordForm();
renderRecords();
renderWeek();
