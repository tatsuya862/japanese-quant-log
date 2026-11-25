'use strict';

const editionUrl = 'https://raw.githubusercontent.com/tatsuya862/japanese-quant-log/ai-news-data/latest.json';
const locale = 'ja-JP';
const jst = { timeZone: 'Asia/Tokyo' };
const editionDate = new Intl.DateTimeFormat(locale, { ...jst, year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const articleDate = new Intl.DateTimeFormat(locale, { ...jst, month: 'numeric', day: 'numeric' });
const element = id => document.getElementById(id);
const status = element('status');

function create(tag, label, className) {
  const node = document.createElement(tag);
  if (label) node.textContent = label;
  if (className) node.className = className;
  return node;
}

function isHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function link(label, url) {
  const anchor = create('a', label);
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function validEdition(data) {
  return data && typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
    && Number.isFinite(Date.parse(data.date))
    && Array.isArray(data.lives) && data.lives.length > 0
    && data.lives.every(live => typeof live?.title === 'string' && /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(live.url))
    && Array.isArray(data.articles) && data.articles.length >= 1 && data.articles.length <= 5
    && data.articles.every(article => article && isHttps(article.url) && Number.isFinite(Date.parse(article.published))
      && typeof article.title === 'string' && typeof article.source === 'string' && typeof article.reason === 'string'
      && typeof article.major === 'boolean' && typeof article.official === 'boolean')
    && data.articles.filter(article => article.major).length >= 1
    && data.articles.filter(article => article.major).length <= 2;
}

async function fetchEdition(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { cache: 'no-cache', credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('Edition unavailable');
    const data = await response.json();
    if (!validEdition(data)) throw new Error('Invalid edition');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function articleRow(article, index) {
  const row = create('li', '', 'item');
  const rank = create('span', String(index + 1), 'rank');
  rank.setAttribute('aria-hidden', 'true');
  const detail = create('article');
  const meta = create('div', '', 'meta-row');
  meta.append(create('p', articleDate.format(new Date(article.published)) + ' ・ ' + article.source, 'metadata'));
  if (article.major) meta.append(create('span', article.official ? '大手テック公式' : '大手テック', 'major'));
  const heading = create('h2');
  heading.append(link(article.title, article.url));
  detail.append(meta, heading, create('p', article.reason, 'reason'));
  row.append(rank, detail);
  return row;
}

function render(data) {
  const day = new Date(data.date + 'T00:00:00+09:00');
  element('edition-date').textContent = editionDate.format(day) + '版 ・ ' + data.articles.length + '本';
  element('lives').replaceChildren(...data.lives.map(live => {
    const row = create('li');
    row.append(link(live.title, live.url));
    return row;
  }));
  element('live-themes').hidden = false;
  element('articles').replaceChildren(...data.articles.map(articleRow));
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const isPrevious = data.date < today;
  status.textContent = isPrevious ? '現在読める直近の版を表示しています。'
    : data.reusedLives ? '前回確認できたライブ配信を選定の軸にしています。' : '';
}

async function load() {
  let latest = '';
  async function show(url, preferred) {
    const data = await fetchEdition(url);
    if (data.date > latest || (preferred && data.date === latest)) {
      latest = data.date;
      render(data);
    }
  }
  await Promise.allSettled([show('edition.json', false), show(editionUrl, true)]);
  if (!latest) status.textContent = 'ニュースを取得できませんでした。時間をおいて、ページを開き直してください。';
}

load();
