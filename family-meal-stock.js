(() => {
  "use strict";

  const categories = ["野菜", "素", "肉", "魚", "チルド"];
  const recipes = {
    curry: [
      ["野菜", "玉ねぎ"], ["野菜", "にんじん"], ["野菜", "じゃがいも"], ["肉", "カレー用の肉"],
      ["素", "カレールウ 甘口", "おばあちゃん用"], ["素", "カレールウ 辛口", "家族用"],
    ],
    stew: [
      ["野菜", "玉ねぎ"], ["野菜", "にんじん"], ["野菜", "じゃがいも"], ["肉", "鶏肉"],
      ["素", "シチューのルウ", "共通"],
    ],
    mapo: [
      ["チルド", "豆腐"], ["肉", "ひき肉"], ["素", "麻婆豆腐の素", "共通"],
    ],
    "twice-cooked": [
      ["野菜", "キャベツ"], ["野菜", "ピーマン"], ["肉", "豚肉"], ["素", "回鍋肉の素", "共通"],
    ],
  };
  const storageKey = "quant-log-family-meal-stock-v1";
  const byId = (id) => document.getElementById(id);
  const menu = byId("prep-menu");
  const feedback = byId("stock-status");
  const controls = new Map();
  const testMode = new URLSearchParams(window.location.search).has("test");

  function create(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function getStorage() {
    return testMode ? window.sessionStorage : window.localStorage;
  }

  function load() {
    try {
      return JSON.parse(getStorage().getItem(storageKey)) ?? {};
    } catch {
      feedback.textContent = "保存済みの在庫を読み込めませんでした。";
      return {};
    }
  }

  function keyOf(category, name) {
    return category + "|" + name.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  }

  function cleanValue(category, value) {
    if (category === "素") return Number.isInteger(value) && value >= 0 && value <= 99 ? value : null;
    return typeof value === "boolean" ? value : null;
  }

  const saved = load();
  const inventory = new Map();
  for (const [category, name] of [...Object.values(recipes).flat(), ["魚", "鮭"], ["チルド", "ポテトサラダ"]]) {
    inventory.set(keyOf(category, name), { category, name, value: null });
  }
  if (Array.isArray(saved.items)) {
    for (const item of saved.items) {
      if (!item || !categories.includes(item.category) || typeof item.name !== "string") continue;
      const name = item.name.trim().slice(0, 40);
      if (name) inventory.set(keyOf(item.category, name), { category: item.category, name, value: cleanValue(item.category, item.value) });
    }
  }
  if (Object.hasOwn(recipes, saved.menu)) menu.value = saved.menu;

  function persist() {
    try {
      getStorage().setItem(storageKey, JSON.stringify({ menu: menu.value, items: [...inventory.values()] }));
      return true;
    } catch {
      feedback.textContent = "このブラウザーに保存できませんでした。";
      return false;
    }
  }

  function syncControl(input, item) {
    const value = item.value === null ? "" : String(item.value);
    if (input.value !== value) input.value = value;
  }

  function updateItem(item, value, message) {
    item.value = value;
    if (persist()) feedback.textContent = message;
    for (const input of controls.get(item) ?? []) syncControl(input, item);
    renderShopping();
  }

  function stockControl(item) {
    const wrapper = create("span", "", "stock-control");
    const isSauce = item.category === "素";
    const input = create(isSauce ? "input" : "select");
    input.setAttribute("aria-label", item.name + (isSauce ? "の残り袋数" : "の在庫"));
    if (isSauce) {
      input.type = "number";
      input.min = "0";
      input.max = "99";
      input.step = "1";
      input.inputMode = "numeric";
      input.placeholder = "未確認";
      wrapper.append(input, create("span", "袋"));
    } else {
      for (const [value, text] of [["", "未確認"], ["true", "ある"], ["false", "ない"]]) input.append(new Option(text, value));
      wrapper.append(input);
    }
    syncControl(input, item);
    if (!controls.has(item)) controls.set(item, []);
    controls.get(item).push(input);
    input.addEventListener(isSauce ? "input" : "change", () => {
      if (!input.checkValidity()) return;
      const value = input.value === "" ? null : isSauce ? Number(input.value) : input.value === "true";
      updateItem(item, value, "在庫を更新しました。");
    });
    if (isSauce) input.addEventListener("change", () => input.reportValidity());
    return wrapper;
  }

  function stockRow(item, audience) {
    const row = create("li");
    const name = create("span", item.name);
    if (audience) name.append(create("small", audience, "stock-person"));
    row.append(name, stockControl(item));
    return row;
  }

  function renderShopping() {
    const list = byId("shopping-list");
    const current = recipes[menu.value].map(([category, name, audience]) => ({ item: inventory.get(keyOf(category, name)), audience }));
    const missing = current.filter(({ item }) => item.value === false || item.value === 0);
    const unknown = current.filter(({ item }) => item.value === null);
    byId("prep-status").textContent = !missing.length && !unknown.length
      ? "必要なものは揃っています。"
      : "不足 " + missing.length + "件 ／ 要確認 " + unknown.length + "件";
    const rows = [...missing, ...unknown].map(({ item, audience }) => {
      const isUnknown = item.value === null;
      const row = create("li");
      row.dataset.state = isUnknown ? "unknown" : "missing";
      const label = create("span", item.name);
      const note = isUnknown ? "要確認" : item.category === "素" ? "買う：1袋" : "買う";
      label.append(create("small", audience ? audience + " · " + note : note));
      row.append(label);
      if (!isUnknown) {
        const bought = create("button", "買った");
        bought.type = "button";
        bought.setAttribute("aria-label", item.name + "を買った");
        bought.addEventListener("click", () => updateItem(item, item.category === "素" ? 1 : true, item.name + "の在庫を更新しました。"));
        row.append(bought);
      }
      return row;
    });
    list.replaceChildren(...rows);
  }

  function group(label, rows) {
    const block = create("div", "", "stock-group");
    const list = create("ul", "", "stock-list");
    list.append(...rows);
    block.append(create("h3", label), list);
    return block;
  }

  function render() {
    controls.clear();
    const ingredients = [];
    const sauces = [];
    for (const [category, name, audience] of recipes[menu.value]) {
      const row = stockRow(inventory.get(keyOf(category, name)), audience);
      (category === "素" ? sauces : ingredients).push(row);
    }
    byId("recipe-checklist").replaceChildren(group("共通の具材", ingredients), group("味付け・料理の素", sauces));
    const items = [...inventory.values()];
    byId("stock-list").replaceChildren(...categories.map(category => group(category,
      items.filter(item => item.category === category).map(item => stockRow(item)))));
    renderShopping();
  }

  const category = byId("stock-category");
  const name = byId("stock-name");
  for (const item of categories) category.append(new Option(item, item));

  byId("stock-form").addEventListener("submit", event => {
    event.preventDefault();
    const title = name.value.trim();
    if (!title || !categories.includes(category.value)) return;
    const key = keyOf(category.value, title);
    if (inventory.has(key)) {
      feedback.textContent = "同じ食材は登録済みです。";
      return;
    }
    inventory.set(key, { category: category.value, name: title, value: null });
    if (persist()) feedback.textContent = title + "を在庫一覧に追加しました。";
    name.value = "";
    render();
  });

  menu.addEventListener("change", () => {
    feedback.textContent = "";
    persist();
    render();
  });

  render();
})();
