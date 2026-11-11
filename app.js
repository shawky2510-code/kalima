(() => {
'use strict';

/* =====================================================================
   Helpers
   ===================================================================== */
const CFG = window.APP_CONFIG || { storage: 'browser' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uniq = a => [...new Set(a)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const bytes = s => new TextEncoder().encode(s).length;
const base = c => (c || '').split('-')[0].toLowerCase();

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'disabled' || k === 'hidden') n[k] = !!v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}

const ICONS = {
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  copy: 'M9 9h11v11H9zM5 15V5h10',
  speaker: 'M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  x: 'M6 6l12 12M18 6L6 18',
  gear: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chev: 'M6 9l6 6 6-6',
  open: 'M5 12h14M13 6l6 6-6 6',
  paste: 'M9 4h6v3H9zM7 5H5v15h14V5h-2',
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name]); s.append(p);
  return s;
}

/* =====================================================================
   Settings and interface language
   ===================================================================== */
const store = {
  get(k, d) { try { const v = localStorage.getItem('kalima.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kalima.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const S = {
  set: Object.assign({
    ui: (navigator.language || 'en').startsWith('ar') ? 'ar' : 'en',
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    src: 'auto', tgt: 'ar', grammar: true, email: '',
  }, store.get('settings', {})),
  entries: [], cur: null, busy: false, selected: new Set(), detected: '',
};
const saveSettings = () => store.set('settings', S.set);
const t = (k, vars) => {
  let s = (window.I18N[S.set.ui] || {})[k] ?? window.I18N.en[k] ?? k;
  for (const [a, b] of Object.entries(vars || {})) s = s.replace('{' + a + '}', b);
  return s;
};

const LANGS = ('af sq am ar hy az eu be bn bs bg my ca ceb zh-CN zh-TW co hr cs da nl en eo et fi fr fy gl ka de el gu ht ha haw he hi ' +
  'hu is ig id ga it ja jv kn kk km rw ko ku ky lo la lv lt lb mk mg ms ml mt mi mr mn ne no ps fa pl pt pa ro ru sm gd sr st sn sd si sk sl ' +
  'so es su sw sv tl tg ta tt te th tr tk uk ur ug uz vi cy xh yi yo zu').split(' ');
const dnCache = {};
function langName(code, ui = S.set.ui) {
  if (!code || code === 'auto') return t('detect');
  try {
    dnCache[ui] ??= new Intl.DisplayNames([ui], { type: 'language' });
    const n = dnCache[ui].of(code === 'zh-CN' ? 'zh-Hans' : code === 'zh-TW' ? 'zh-Hant' : code);
    return n && n !== code ? n.charAt(0).toUpperCase() + n.slice(1) : code;
  } catch { return code; }
}
const nativeName = code => langName(code, base(code));
const normLang = c => { const b = base(c); return b === 'zh' ? 'zh-CN' : LANGS.includes(b) ? b : (b === 'nb' ? 'no' : b === 'iw' ? 'he' : b); };

function applyI18n() {
  document.documentElement.lang = S.set.ui;
  document.documentElement.dir = S.set.ui === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = S.set.theme;
  document.title = `${t('appName')} — ${t('tagline')}`;
  $$('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
  $$('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); n.setAttribute('aria-label', n.title); });
  $('#output').dataset.ph = t('outPh');
  $('#uiLangBtn').textContent = S.set.ui === 'ar' ? 'English' : 'العربية';
  $('#themeBtn').replaceChildren(icon(S.set.theme === 'dark' ? 'sun' : 'moon'));
  $('#storageNote').textContent = t(CFG.storage === 'server' ? 'storeServer' : 'storeBrowser');
  $('#dlCurrent').replaceChildren(downloadMenu(() => S.cur ? [S.cur] : [], true));
  $('#dlArchive').replaceChildren(downloadMenu(() => chosenEntries(), false));
  pickers.forEach(p => p.label());
  renderUsage(); renderResult(); renderArchive();
}

let toastTimer;
function toast(msg) {
  const n = $('#toast'); n.textContent = msg; n.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { n.hidden = true; }, 2600);
}

/* =====================================================================
   Archive storage: browser (IndexedDB) or the local server
   ===================================================================== */
const browserStore = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('kalima', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('archive', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('archive', mode); const out = fn(tx.objectStore('archive'));
      tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error);
    });
  },
  async all() { if (!this.db) await this.open(); return this.tx('readonly', s => s.getAll()); },
  put(e) { return this.tx('readwrite', s => s.put(e)); },
  remove(id) { return this.tx('readwrite', s => s.delete(id)); },
  clear() { return this.tx('readwrite', s => s.clear()); },
};
const api = async (method, path, body) => {
  const r = await fetch('/api/archive' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error('store'); return r.json();
};
const serverStore = {
  all: () => api('GET', ''),
  put: e => api('PUT', '/' + encodeURIComponent(e.id), e),
  remove: id => api('DELETE', '/' + encodeURIComponent(id)),
  clear: () => api('DELETE', ''),
};
const DB = CFG.storage === 'server' ? serverStore : browserStore;

async function saveEntry(e) {
  const i = S.entries.findIndex(x => x.id === e.id);
  if (i >= 0) S.entries[i] = e; else S.entries.push(e);
  try { await DB.put(e); } catch { toast(t('errStore')); }
  renderArchive();
}
async function removeEntries(ids) {
  for (const id of ids) { try { await DB.remove(id); } catch { toast(t('errStore')); } }
  S.entries = S.entries.filter(e => !ids.includes(e.id));
  ids.forEach(id => S.selected.delete(id));
  if (S.cur && ids.includes(S.cur.id)) { S.cur = null; renderResult(); }
  renderArchive();
}

/* =====================================================================
   Translation (MyMemory, free)
   ===================================================================== */
class AppError extends Error { constructor(kind, detail) { super(kind); this.kind = kind; this.detail = detail; } }
const decodeEntities = s => { const a = document.createElement('textarea'); a.innerHTML = s; return a.value; };

function addUsage(n) {
  const today = new Date().toISOString().slice(0, 10);
  const u = store.get('usage', {}); const cur = u.date === today ? u.chars : 0;
  store.set('usage', { date: today, chars: cur + n }); renderUsage();
}
function renderUsage() {
  const today = new Date().toISOString().slice(0, 10); const u = store.get('usage', {});
  const n = u.date === today ? u.chars : 0;
  $('#usage').textContent = t('usage', { n: n.toLocaleString(), max: (S.set.email ? 50000 : 5000).toLocaleString() });
}

async function mm(q, src, tgt) {
  const p = new URLSearchParams({ q, langpair: `${src === 'auto' ? 'autodetect' : src}|${tgt}` });
  if (S.set.email) p.set('de', S.set.email);
  let r, j;
  try { r = await fetch('https://api.mymemory.translated.net/get?' + p); } catch { throw new AppError('net'); }
  if (r.status === 429) throw new AppError('quota');
  try { j = await r.json(); } catch { throw new AppError('fail'); }
  const txt = (j.responseData && j.responseData.translatedText) || '';
  if (j.quotaFinished || String(j.responseStatus) === '429' || /MYMEMORY WARNING|USED ALL AVAILABLE/i.test(txt)) throw new AppError('quota');
  if (String(j.responseStatus) !== '200' || !txt) throw new AppError('fail', j.responseDetails || txt);
  addUsage(q.length);
  return { text: decodeEntities(txt), detected: normLang(j.responseData.detectedLanguage || ''), matches: Array.isArray(j.matches) ? j.matches : [] };
}

// Split long text into pieces the free service accepts (under 500 bytes), keeping line breaks.
function segment(text, max = 450) {
  const segs = [];
  for (const part of text.split(/(\s*\n\s*)/)) {
    if (!part) continue;
    if (/^\s*\n\s*$/.test(part)) { segs.push({ lit: true, t: part.replace(/[^\n]/g, '') }); continue; }
    const sents = part.match(/[^.!?。！？؟۔…]+[.!?。！？؟۔…]*\s*/g) || [part];
    let buf = '';
    const flush = () => { if (buf.trim()) segs.push({ t: buf.trim() }); buf = ''; };
    for (const s of sents) {
      if (bytes(buf + s) <= max) { buf += s; continue; }
      flush();
      if (bytes(s) <= max) { buf = s; continue; }
      for (const w of s.split(/(\s+)/)) {
        if (bytes(buf + w) > max) flush();
        if (bytes(w) > max) { for (const ch of Array.from(w)) { if (bytes(buf + ch) > max) flush(); buf += ch; } }
        else buf += w;
      }
    }
    flush();
  }
  return segs;
}

async function translate(text, src, tgt, onProgress) {
  const segs = segment(text); const todo = segs.filter(s => !s.lit);
  if (!todo.length) return { text: '', detected: '', matches: [] };
  let done = 0;
  const first = await mm(todo[0].t, src, tgt);
  todo[0].out = first.text; onProgress(++done, todo.length);
  const from = src === 'auto' ? (first.detected || 'auto') : src;
  let next = 1;
  const worker = async () => {
    while (next < todo.length) { const s = todo[next++]; s.out = (await mm(s.t, from, tgt)).text; onProgress(++done, todo.length); }
  };
  await Promise.all([worker(), worker(), worker()]);
  let out = '', prevText = false;
  for (const s of segs) {
    if (s.lit) { out += s.t; prevText = false; } else { out += (prevText ? ' ' : '') + s.out; prevText = true; }
  }
  return { text: out, detected: first.detected, matches: todo.length === 1 ? first.matches : [] };
}

/* =====================================================================
   Grammar and spelling (LanguageTool, free)
   ===================================================================== */
const LT = { ar: 'ar', ast: 'ast-ES', be: 'be-BY', br: 'br-FR', ca: 'ca-ES', da: 'da-DK', de: 'de-DE', el: 'el-GR', en: 'en-US', eo: 'eo',
  es: 'es', fa: 'fa', fr: 'fr', ga: 'ga-IE', gl: 'gl-ES', it: 'it', ja: 'ja-JP', km: 'km-KH', nl: 'nl', no: 'no', pl: 'pl-PL', pt: 'pt-BR',
  ro: 'ro-RO', ru: 'ru-RU', sk: 'sk-SK', sl: 'sl-SI', sv: 'sv', ta: 'ta-IN', tl: 'tl-PH', uk: 'uk-UA', zh: 'zh-CN' };

async function lt(text, language) {
  const body = new URLSearchParams({ text, language });
  if (language === 'auto') body.set('preferredVariants', 'en-US,de-DE,pt-BR,ca-ES');
  const r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', body });
  if (!r.ok) throw new Error('lt'); return r.json();
}

function toFixes(text, matches) {
  const out = []; let end = 0;
  for (const m of [...matches].sort((a, b) => a.offset - b.offset)) {
    if (m.offset < end) continue; end = m.offset + m.length;
    const from = text.substr(m.offset, m.length);
    const alts = (m.replacements || []).map(x => x.value).filter(v => v !== from).slice(0, 4);
    const type = (m.rule && m.rule.issueType) || ''; const cat = (m.rule && m.rule.category && m.rule.category.id) || '';
    const before = text.slice(0, m.offset);
    const properNoun = type === 'misspelling' && /^\p{Lu}/u.test(from) && before.trim() && !/[.!?؟]\s*$/.test(before);
    const cosmetic = ['style', 'locale-violation', 'register'].includes(type) || ['TYPOGRAPHY', 'STYLE', 'REDUNDANCY'].includes(cat);
    out.push({ offset: m.offset, length: m.length, from, to: alts[0] ?? '', alts, msg: m.message || '', on: alts.length > 0 && !properNoun && !cosmetic && !(type === 'misspelling' && /\s/.test(from)) });
  }
  return out;
}

function applyFixes(text, fixes) {
  const parts = []; let pos = 0, out = '';
  for (const f of fixes || []) {
    if (!f.on || f.offset < pos) continue;
    const keep = text.slice(pos, f.offset); parts.push({ t: keep }); parts.push({ del: f.from, ins: f.to });
    out += keep + f.to; pos = f.offset + f.length;
  }
  parts.push({ t: text.slice(pos) }); out += text.slice(pos);
  return { text: out, parts };
}

async function grammar(text, src) {
  if (!S.set.grammar) return { fixes: [], gstate: 'off' };
  let language;
  if (src === 'auto') { if (text.split(/\s+/).length < 4) return { fixes: [], gstate: 'short' }; language = 'auto'; }
  else { language = LT[base(src)]; if (!language) return { fixes: [], gstate: 'unsupported' }; }
  try {
    const j = await lt(text.slice(0, 18000), language);
    if (language === 'auto') {
      const d = j.language && j.language.detectedLanguage;
      if (!d || d.confidence < 0.75 || base(d.code) !== base(j.language.code)) return { fixes: [], gstate: 'unsupported' };
    }
    return { fixes: toFixes(text, j.matches || []), gstate: 'ok' };
  } catch { return { fixes: [], gstate: 'error' }; }
}

async function checkOutput(entry) {
  const language = LT[base(entry.tgt)];
  if (!S.set.grammar || !language || entry.outFixes || entry.output.length > 18000) return;
  try {
    const j = await lt(entry.output, language);
    entry.outFixes = toFixes(entry.output, j.matches || []).filter(f => f.on);
    await saveEntry(entry);
    if (S.cur && S.cur.id === entry.id) renderOutCheck();
  } catch { /* the check is optional */ }
}

/* =====================================================================
   Dictionary (Free Dictionary API for English, Wiktionary for the rest)
   ===================================================================== */
function strip(html) {
  const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
  d.querySelectorAll('style,link,script,sup,.mw-empty-elt,.reference').forEach(n => n.remove());
  return d.body.textContent.replace(/\s+/g, ' ').trim();
}
async function wiktionary(word, lang) {
  for (const w of uniq([word, word.toLowerCase()])) {
    try {
      const r = await fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(w.replace(/ /g, '_')));
      if (!r.ok) continue;
      const arr = (await r.json())[base(lang)]; if (!arr) continue;
      const groups = arr.map(g => ({
        pos: g.partOfSpeech || '',
        defs: (g.definitions || []).map(d => ({
          d: strip(d.definition),
          ex: (d.parsedExamples || []).slice(0, 1).map(x => strip(x.example) + (x.translation ? ' — ' + strip(x.translation) : '')).filter(Boolean),
        })).filter(d => d.d).slice(0, 4),
        syn: [], ant: [],
      })).filter(g => g.defs.length).slice(0, 4);
      if (groups.length) return { word: w, lang: base(lang), groups, source: 'Wiktionary' };
    } catch { /* try next */ }
  }
  return null;
}
async function englishDict(word) {
  try {
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase()));
    if (!r.ok) return null;
    const j = await r.json(); if (!Array.isArray(j) || !j.length) return null;
    const ph = j.flatMap(e => e.phonetics || []);
    const groups = (j[0].meanings || []).slice(0, 4).map(m => ({
      pos: m.partOfSpeech || '',
      defs: (m.definitions || []).slice(0, 4).map(d => ({ d: d.definition, ex: d.example ? [d.example] : [] })),
      syn: uniq([...(m.synonyms || []), ...(m.definitions || []).flatMap(d => d.synonyms || [])]).slice(0, 8),
      ant: uniq([...(m.antonyms || []), ...(m.definitions || []).flatMap(d => d.antonyms || [])]).slice(0, 8),
    })).filter(g => g.defs.length);
    if (!groups.length) return null;
    return { word: j[0].word, lang: 'en', groups, source: 'Free Dictionary API',
      phonetic: j[0].phonetic || (ph.find(p => p.text) || {}).text || '', audio: (ph.find(p => p.audio) || {}).audio || '' };
  } catch { return null; }
}
const lookup = async (word, lang) => (base(lang) === 'en' && await englishDict(word)) || wiktionary(word, lang);

const cleanWord = s => s.trim().replace(/^[\s"'“”«»(]+|[\s"'“”«».,!?؟;:)]+$/g, '');
const isWord = s => !/\n/.test(s) && s.length <= 40 && s.trim().split(/\s+/).length <= 3;
const kindOf = s => isWord(s) ? 'word' : (/\n/.test(s.trim()) || s.length > 220 || (s.match(/[.!?؟。]\s+\S/g) || []).length >= 2) ? 'paragraph' : 'sentence';

// The free service is weak on single words, so choose the best candidates from everything it returns.
function pickWord(text, tr) {
  const word = cleanWord(text).toLowerCase(); const scored = new Map();
  for (const m of tr.matches) {
    if (typeof m.segment !== 'string' || cleanWord(m.segment).toLowerCase() !== word || !m.translation) continue;
    const q = Number(m.quality) || 30, usage = Math.min(Number(m['usage-count']) || 0, 20);
    decodeEntities(String(m.translation)).split(/[\/,،;؛|]/).map(cleanWord).forEach((piece, i) => {
      const k = piece.toLowerCase();
      if (!piece || k === word || piece.length > 40 || /[():\d]/.test(piece)) return;
      const score = q * (Number(m.match) || 0) + usage - i * 5;
      if (!scored.has(k) || scored.get(k).score < score) scored.set(k, { piece, score });
    });
  }
  const list = [...scored.values()].sort((a, b) => b.score - a.score).map(x => x.piece);
  const fallback = cleanWord(tr.text);
  if (!list.length) return { main: tr.text, alts: [] };
  if (fallback && fallback.toLowerCase() !== word && !list.some(x => x.toLowerCase() === fallback.toLowerCase()) && !/[\/():]/.test(fallback)) list.push(fallback);
  return { main: list[0], alts: list.slice(1, 9) };
}

async function buildDict(text, src, tgt, main, alts) {
  const word = cleanWord(text);
  const [srcEntry, tgtEntry] = await Promise.all([
    src === 'auto' ? null : lookup(word, src),
    isWord(main) ? lookup(cleanWord(main), tgt) : null,
  ]);
  return { word, main, alts, srcEntry, tgtEntry, defTr: null };
}

/* =====================================================================
   Speech and clipboard
   ===================================================================== */
function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  if (!text.trim()) return toast(t('nothingToSay'));
  const u = new SpeechSynthesisUtterance(text.slice(0, 3000));
  if (lang && lang !== 'auto') {
    u.lang = lang;
    const v = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(base(lang)));
    if (v) u.voice = v;
  }
  speechSynthesis.speak(u);
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); }
  catch { const a = el('textarea', {}, s); document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); }
  toast(t('copied'));
}

/* =====================================================================
   Language pickers
   ===================================================================== */
const pickers = [];
function makePicker(root, { auto, get, set }) {
  const text = el('span'); const btn = el('button', { class: 'langbtn', type: 'button' }, text, icon('chev'));
  const q = el('input', { type: 'search' }); const ul = el('ul', { role: 'listbox' });
  const pop = el('div', { class: 'langpop', hidden: true }, q, ul);
  root.append(btn, pop);
  const close = () => { pop.hidden = true; };
  const choose = code => { set(code); close(); pickers.forEach(p => p.label()); btn.focus(); };
  function fill() {
    const f = q.value.trim().toLowerCase(); ul.replaceChildren();
    const codes = [...LANGS].sort((a, b) => langName(a).localeCompare(langName(b), S.set.ui));
    for (const c of (auto ? ['auto'] : []).concat(codes)) {
      const name = langName(c), nat = c === 'auto' ? '' : nativeName(c);
      if (f && !(name.toLowerCase().includes(f) || nat.toLowerCase().includes(f) || c.toLowerCase() === f)) continue;
      ul.append(el('li', { role: 'option', class: c === get() ? 'sel' : '', 'data-code': c, onclick: () => choose(c) },
        el('span', {}, name), nat && nat !== name ? el('small', {}, nat) : null));
    }
    if (!ul.children.length) ul.append(el('li', { class: 'muted' }, t('noLang')));
    else ul.firstChild.classList.add('hi');
  }
  btn.addEventListener('click', () => {
    const wasHidden = pop.hidden; pickers.forEach(p => p.close());
    if (wasHidden) { pop.hidden = false; q.value = ''; q.placeholder = t('searchLang'); fill(); q.focus(); }
  });
  q.addEventListener('input', fill);
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const li = $('li[data-code]', ul); if (li) choose(li.dataset.code); }
    if (e.key === 'Escape') { close(); btn.focus(); }
  });
  const p = { close, root, label() {
    const c = get();
    text.textContent = c === 'auto' && S.detected ? `${t('detect')} · ${langName(S.detected)}` : langName(c);
  } };
  pickers.push(p); return p;
}

/* =====================================================================
   Download tools
   ===================================================================== */
function downloadMenu(getList, up) {
  const d = el('details', { class: 'menu' + (up ? ' up' : '') },
    el('summary', { class: 'ghost' }, icon('download'), t('download')),
    el('div', { class: 'items' }, ['txt', 'csv', 'doc', 'pdf', 'json'].map(f =>
      el('button', { type: 'button', onclick: () => { d.open = false; exportEntries(getList(), f); } }, t('fmt' + f[0].toUpperCase() + f.slice(1))))));
  return d;
}
const fmtDate = ts => new Date(ts).toLocaleString(S.set.ui === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const dictLines = e => {
  const out = []; const d = e.dict; if (!d) return out;
  if (d.alts && d.alts.length) out.push(`${t('otherTranslations')}: ${d.alts.join('، ')}`);
  for (const [entry, label] of [[d.srcEntry, t('meaningsOf')], [d.tgtEntry, t('aboutTranslation')]]) {
    if (!entry) continue;
    out.push(`${label} «${entry.word}»${entry.phonetic ? ' ' + entry.phonetic : ''}:`);
    for (const g of entry.groups) {
      g.defs.forEach((x, i) => out.push(`  ${g.pos ? '[' + g.pos + '] ' : ''}${i + 1}. ${x.d}${x.ex[0] ? ' — ' + t('example') + ': ' + x.ex[0] : ''}`));
      if (g.syn && g.syn.length) out.push(`  ${t('synonyms')}: ${g.syn.join(', ')}`);
      if (g.ant && g.ant.length) out.push(`  ${t('antonyms')}: ${g.ant.join(', ')}`);
    }
  }
  return out;
};
function saveFile(name, mime, content) {
  const a = el('a', { href: URL.createObjectURL(new Blob([content], { type: mime })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function docHtml(list) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dir = S.set.ui === 'ar' ? 'rtl' : 'ltr';
  const body = list.map(e => `
    <div class="e"><p class="m">${esc(fmtDate(e.ts))} · ${esc(langName(e.src))} → ${esc(langName(e.tgt))} · ${esc(t('kind_' + e.kind))}</p>
    <p><b>${esc(t('lblOriginal'))}</b></p><p dir="auto" class="x">${esc(e.input)}</p>
    ${e.corrected !== e.input ? `<p><b>${esc(t('lblCorrected'))}</b></p><p dir="auto" class="x">${esc(e.corrected)}</p>` : ''}
    <p><b>${esc(t('lblTranslation'))}</b></p><p dir="auto" class="x t">${esc(e.output)}</p>
    ${dictLines(e).map(l => `<p dir="auto" class="d">${esc(l)}</p>`).join('')}</div>`).join('');
  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="${S.set.ui}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(t('exportTitle'))}</title>
<style>body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;font-size:12pt;color:#1f2a2e;margin:28px}h1{font-size:18pt;color:#0f766e}
.e{border-top:1px solid #ccc;padding:10px 0;page-break-inside:avoid}.m{color:#68767b;font-size:10pt}.x{white-space:pre-wrap;margin:2px 0 10px}
.t{color:#0f766e;font-weight:bold}.d{font-size:10.5pt;margin:2px 0;white-space:pre-wrap}p{margin:4px 0}</style></head>
<body><h1>${esc(t('exportTitle'))}</h1>${body}</body></html>`;
}
function exportEntries(list, fmt) {
  if (!list.length) return toast(t('archEmpty'));
  list = [...list].sort((a, b) => b.ts - a.ts);
  const name = `kalima-${list.length === 1 ? 'translation' : 'archive'}-${new Date().toISOString().slice(0, 10)}`;
  if (fmt === 'json') return saveFile(name + '.json', 'application/json', JSON.stringify({ app: 'kalima', version: 1, entries: list }, null, 2));
  if (fmt === 'txt') {
    const txt = list.map(e => [
      `${fmtDate(e.ts)} | ${langName(e.src)} → ${langName(e.tgt)} | ${t('kind_' + e.kind)}`,
      `${t('lblOriginal')}:`, e.input,
      ...(e.corrected !== e.input ? [`${t('lblCorrected')}:`, e.corrected] : []),
      `${t('lblTranslation')}:`, e.output, ...dictLines(e),
    ].join('\r\n')).join('\r\n\r\n' + '-'.repeat(50) + '\r\n\r\n');
    return saveFile(name + '.txt', 'text/plain;charset=utf-8', '\ufeff' + txt.replace(/\r?\n/g, '\r\n'));
  }
  if (fmt === 'csv') {
    const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const rows = [[t('lblDate'), t('lblFrom'), t('lblTo'), t('lblType'), t('lblOriginal'), t('lblCorrected'), t('lblTranslation'), t('otherTranslations'), t('lblFav')]]
      .concat(list.map(e => [fmtDate(e.ts), langName(e.src), langName(e.tgt), t('kind_' + e.kind), e.input, e.corrected, e.output, (e.dict && e.dict.alts || []).join(' | '), e.fav ? '★' : '']));
    return saveFile(name + '.csv', 'text/csv;charset=utf-8', '\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n'));
  }
  if (fmt === 'doc') return saveFile(name + '.doc', 'application/msword', '\ufeff' + docHtml(list));
  if (fmt === 'pdf') {
    const f = el('iframe', { style: 'position:fixed;width:0;height:0;border:0;opacity:0', 'aria-hidden': 'true' });
    f.srcdoc = docHtml(list);
    f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
    document.body.append(f);
  }
}
async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    const list = Array.isArray(j) ? j : j.entries;
    if (!Array.isArray(list)) throw 0;
    let n = 0;
    for (const e of list) {
      if (!e || typeof e.input !== 'string' || typeof e.output !== 'string') continue;
      const clean = { id: String(e.id || uid()), ts: Number(e.ts) || Date.now(), srcSel: String(e.srcSel || e.src || 'auto'), src: String(e.src || 'auto'),
        tgt: String(e.tgt || 'en'), input: e.input, corrected: typeof e.corrected === 'string' ? e.corrected : e.input, output: e.output,
        kind: ['word', 'sentence', 'paragraph'].includes(e.kind) ? e.kind : kindOf(e.input), fav: !!e.fav,
        fixes: Array.isArray(e.fixes) ? e.fixes : [], gstate: String(e.gstate || 'off'), dict: e.dict && typeof e.dict === 'object' ? e.dict : null, outFixes: null };
      await saveEntry(clean); n++;
    }
    toast(t('imported', { n }));
  } catch { toast(t('importBad')); }
}

/* =====================================================================
   Rendering: result, grammar, dictionary
   ===================================================================== */
const note = (cls, text) => el('p', { class: 'note ' + cls }, cls === 'ok' ? icon('check') : null, text);

function renderResult() {
  const e = S.cur; const out = $('#output');
  out.textContent = e ? e.output : '';
  out.lang = e ? e.tgt : ''; out.classList.toggle('big', !!e && e.kind === 'word');
  $('#input').classList.toggle('big', isWord($('#input').value) && $('#input').value.length > 0);
  $('#favBtn').classList.toggle('on', !!(e && e.fav));
  renderGrammar(); renderOutCheck(); renderDict();
}

function renderGrammar() {
  const card = $('#grammarCard'); const e = S.cur;
  if (!e || e.gstate === 'off') { card.hidden = true; return; }
  card.hidden = false; card.replaceChildren(el('h3', {}, t('grammarTitle')));
  if (e.gstate !== 'ok') { card.append(note('muted', t({ unsupported: 'grammarUnsupported', short: 'grammarShort', error: 'grammarError' }[e.gstate] || 'grammarError'))); return; }
  if (!e.fixes.length) { card.append(note('ok', t('grammarClean'))); return; }
  const { parts } = applyFixes(e.input, e.fixes);
  card.append(el('div', { class: 'small muted' }, t('correctedText')),
    el('div', { class: 'corrected', dir: 'auto' }, parts.map(p => p.t != null ? p.t : [el('del', {}, p.del), p.ins ? el('ins', {}, p.ins) : null])),
    el('div', { class: 'small muted' }, t('fixesHint')),
    el('ul', { class: 'fixes' }, e.fixes.map(f => el('li', {},
      f.alts.length ? el('input', { type: 'checkbox', checked: f.on, 'aria-label': f.from, onchange: ev => { f.on = ev.target.checked; refix(); } }) : el('span'),
      el('span', { class: 'chg', dir: 'auto' }, f.alts.length ? [el('del', {}, f.from), ' → ', el('ins', {}, f.to || '∅')] : [el('del', {}, f.from), ` (${t('noSuggestion')})`]),
      el('span', { class: 'msg', dir: 'auto' }, f.msg),
      f.alts.length > 1 ? el('span', { class: 'chips' }, f.alts.map(a =>
        el('button', { type: 'button', class: 'chip' + (a === f.to && f.on ? ' on' : ''), onclick: () => { f.to = a; f.on = true; refix(); } }, a))) : null))));
}
let refixTimer;
function refix() { renderGrammar(); clearTimeout(refixTimer); refixTimer = setTimeout(() => run(true), 700); }

function renderOutCheck() {
  const card = $('#outCheckCard'); const e = S.cur;
  if (!e || !e.outFixes) { card.hidden = true; return; }
  card.hidden = false; card.replaceChildren(el('h3', {}, t('outCheckTitle')));
  if (!e.outFixes.length) { card.append(note('ok', t('outCheckClean'))); return; }
  card.append(el('div', { class: 'small muted' }, t('outCheckSome')),
    el('ul', { class: 'fixes' }, e.outFixes.map((f, i) => el('li', {},
      el('button', { type: 'button', class: 'chip', onclick: () => applyOutFix(i) }, t('apply')),
      el('span', { class: 'chg', dir: 'auto' }, el('del', {}, f.from), ' → ', el('ins', {}, f.to || '∅')),
      el('span', { class: 'msg', dir: 'auto' }, f.msg)))));
}
function applyOutFix(i) {
  const e = S.cur, f = e.outFixes[i];
  e.output = e.output.slice(0, f.offset) + f.to + e.output.slice(f.offset + f.length);
  const delta = f.to.length - f.length;
  e.outFixes.splice(i, 1); e.outFixes.forEach(x => { if (x.offset > f.offset) x.offset += delta; });
  saveEntry(e); renderResult();
}

function entryBlock(entry, defTr, clickable) {
  return entry.groups.map(g => [
    g.pos ? el('div', {}, el('span', { class: 'pos' }, g.pos)) : null,
    el('ol', {}, g.defs.map(x => el('li', { dir: 'auto' }, x.d,
      defTr && defTr[x.d] ? el('span', { class: 'tr', dir: 'auto' }, defTr[x.d]) : null,
      x.ex[0] ? el('span', { class: 'ex', dir: 'auto' }, x.ex[0]) : null))),
    ...[['syn', 'synonyms'], ['ant', 'antonyms']].map(([k, label]) => g[k] && g[k].length ? el('div', { class: 'rel' },
      el('span', { class: 'muted' }, t(label) + ':'), g[k].map(w => clickable
        ? el('button', { type: 'button', class: 'chip', onclick: () => { $('#input').value = w; onInput(); run(); } }, w)
        : el('span', { class: 'chip' }, w))) : null),
  ]);
}
function renderDict() {
  const card = $('#dictCard'); const e = S.cur;
  if (!e || e.kind !== 'word' || !e.dict) { card.hidden = true; return; }
  const d = e.dict; card.hidden = false;
  const src = d.srcEntry, tg = d.tgtEntry;
  card.replaceChildren(...el('div', {},
    el('h3', {}, t('dictTitle')),
    el('div', { class: 'dicthead' },
      el('span', { class: 'hw', dir: 'auto' }, d.word),
      src && src.phonetic ? el('span', { class: 'ph' }, src.phonetic) : null,
      el('button', { class: 'icon', type: 'button', title: t('listen'), onclick: () => src && src.audio ? new Audio(src.audio).play().catch(() => speak(d.word, e.src)) : speak(d.word, e.src) }, icon('speaker')),
      el('span', { class: 'muted flip' }, icon('open')),
      el('span', { class: 'hw', dir: 'auto', style: 'color:var(--accent)' }, d.main)),
    d.alts.length ? [el('h4', {}, t('otherTranslations')), el('div', { class: 'rel' }, d.alts.map(a =>
      el('button', { type: 'button', class: 'chip', title: t('copy'), onclick: () => copyText(a) }, a)))] : null,
    src ? [el('h4', {}, `${t('meaningsOf')} «${src.word}»`), entryBlock(src, d.defTr, true),
      base(e.tgt) !== 'en' && !d.defTr ? el('button', { type: 'button', class: 'ghost', style: 'margin-top:8px', onclick: translateMeanings },
        t('translateMeanings', { lang: langName(e.tgt) })) : null] : null,
    tg ? [el('h4', {}, `${t('aboutTranslation')} «${tg.word}»`), entryBlock(tg, null, false)] : null,
    !src && !tg && !d.alts.length ? note('muted', t('noDict')) : null,
    src || tg ? el('div', { class: 'small muted src' }, `${t('source')}: ${uniq([src && src.source, tg && tg.source].filter(Boolean)).join(', ')}`) : null).childNodes);
}
async function translateMeanings(ev) {
  const e = S.cur; ev.target.disabled = true;
  const defs = e.dict.srcEntry.groups.flatMap(g => g.defs.map(x => x.d)).slice(0, 6); const map = {};
  try {
    for (const d of defs) map[d] = (await translate(d, 'en', e.tgt, () => {})).text;
    e.dict.defTr = map; await saveEntry(e); renderDict();
  } catch (err) { showError(err); ev.target.disabled = false; }
}

/* =====================================================================
   Main action
   ===================================================================== */
function showError(err) {
  const n = $('#error');
  if (!err) { n.hidden = true; return; }
  n.textContent = err.kind === 'quota' ? t('errQuota') : err.kind === 'net' ? t('errNet')
    : t('errFail') + (err.detail ? ` (${String(err.detail).slice(0, 140)})` : '.');
  n.hidden = false;
}
function setBusy(b, msg) {
  S.busy = b; $('#goBtn').disabled = b; $('#status').textContent = b ? (msg || t('translating')) : '';
}

async function run(reuse, retried) {
  if (S.busy) return;
  reuse = reuse === true && !!S.cur;
  const raw = reuse ? S.cur.input : $('#input').value.trim();
  if (!raw) { $('#input').focus(); return; }
  const srcSel = reuse ? S.cur.srcSel : S.set.src, tgt = reuse ? S.cur.tgt : S.set.tgt;
  if (srcSel === tgt) return toast(t('sameLang'));
  showError(null); setBusy(true, S.set.grammar && !reuse ? t('checking') : '');
  try {
    let fixes, gstate;
    if (reuse) ({ fixes, gstate } = S.cur); else ({ fixes, gstate } = await grammar(raw, srcSel));
    const corrected = applyFixes(raw, fixes).text;
    const old = S.entries.find(e => e.input === raw && e.srcSel === srcSel && e.tgt === tgt);
    let entry;
    if (old && old.corrected === corrected && old.output) {
      entry = { ...old, fixes, gstate, ts: Date.now() };          // already translated: reuse it, no allowance spent
    } else {
      setBusy(true);
      const tr = await translate(corrected, srcSel, tgt, (d, n) => { if (n > 1) $('#status').textContent = `${t('translating')} ${d}/${n}`; });
      const src = srcSel === 'auto' ? (tr.detected || 'auto') : srcSel;
      const kind = kindOf(raw);
      if (kind === 'word' && srcSel === 'auto' && tr.detected) {     // ask again with the detected language: it returns more candidates
        try { const again = await mm(cleanWord(corrected), tr.detected, tgt); tr.matches = again.matches; tr.text = again.text; } catch { /* keep the first answer */ }
      }
      const pick = kind === 'word' ? pickWord(corrected, tr) : null;
      entry = { id: old ? old.id : uid(), ts: Date.now(), srcSel, src, tgt, input: raw, corrected, output: pick ? pick.main : tr.text,
        kind, fav: old ? old.fav : false, fixes, gstate, dict: null, outFixes: null };
      S.cur = entry; S.detected = srcSel === 'auto' ? tr.detected : ''; pickers.forEach(p => p.label()); renderResult();
      if (pick) entry.dict = await buildDict(corrected, src, tgt, pick.main, pick.alts).catch(() => null);
    }
    S.cur = entry; S.detected = srcSel === 'auto' && entry.src !== 'auto' ? entry.src : ''; pickers.forEach(p => p.label());
    renderResult(); await saveEntry(entry);
    checkOutput(entry);
  } catch (err) {
    if (err instanceof AppError && /DISTINCT/i.test(err.detail || '')) {
      // The text is already in the target language: switch the target and try once more.
      if (srcSel === 'auto' && !reuse && !retried) {
        S.set.tgt = tgt === 'en' ? 'ar' : 'en'; saveSettings(); pickers.forEach(p => p.label());
        S.busy = false; await run(false, true); return;
      }
      toast(t('sameLang'));
    } else showError(err instanceof AppError ? err : new AppError('fail', err && err.message));
  }
  finally { setBusy(false); }
}

function openEntry(e) {
  S.cur = e; S.set.src = e.srcSel; S.set.tgt = e.tgt; S.detected = e.srcSel === 'auto' && e.src !== 'auto' ? e.src : ''; saveSettings();
  $('#input').value = e.input; onInput(); showError(null); pickers.forEach(p => p.label());
  renderResult(); showView('translate'); window.scrollTo({ top: 0 });
}

/* =====================================================================
   Archive view
   ===================================================================== */
function filteredEntries() {
  const f = $('#archSearch').value.trim().toLowerCase(), pair = $('#archLang').value, fav = $('#archFav').checked;
  return S.entries.filter(e => (!fav || e.fav) && (!pair || `${e.src}>${e.tgt}` === pair) &&
    (!f || e.input.toLowerCase().includes(f) || e.output.toLowerCase().includes(f))).sort((a, b) => b.ts - a.ts);
}
const chosenEntries = () => { const l = filteredEntries(); const s = l.filter(e => S.selected.has(e.id)); return s.length ? s : l; };

function renderArchive() {
  $('#archCount').textContent = S.entries.length;
  const sel = $('#archLang'), prev = sel.value;
  const pairs = uniq(S.entries.map(e => `${e.src}>${e.tgt}`)).sort();
  sel.replaceChildren(el('option', { value: '' }, t('allLangs')), ...pairs.map(p => el('option', { value: p }, p.split('>').map(c => langName(c)).join(' → '))));
  sel.value = pairs.includes(prev) ? prev : '';
  const list = filteredEntries(); const box = $('#archList');
  const nSel = list.filter(e => S.selected.has(e.id)).length;
  $('#archInfo').textContent = nSel ? t('archInfoSel', { n: list.length, s: nSel }) : t('archInfo', { n: list.length });
  $('#selAll').checked = list.length > 0 && nSel === list.length;
  $('#delSelLabel').textContent = nSel ? t('deleteSel', { n: nSel }) : t('deleteAll');
  $('#delSelBtn').disabled = !list.length;
  if (!list.length) { box.replaceChildren(el('div', { class: 'empty' }, t(S.entries.length ? 'archNoMatch' : 'archEmpty'))); return; }
  box.replaceChildren(...list.map(e => el('article', { class: 'entry' },
    el('input', { type: 'checkbox', checked: S.selected.has(e.id), 'aria-label': t('selectAll'),
      onchange: ev => { ev.target.checked ? S.selected.add(e.id) : S.selected.delete(e.id); renderArchive(); } }),
    el('div', { class: 'meta' }, el('span', { class: 'badge' }, t('kind_' + e.kind)), el('span', {}, `${langName(e.src)} → ${langName(e.tgt)}`), el('span', {}, fmtDate(e.ts))),
    el('div', { class: 'acts' },
      el('button', { class: 'icon' + (e.fav ? ' on' : ''), title: t('favourite'), onclick: () => { e.fav = !e.fav; saveEntry(e); if (S.cur && S.cur.id === e.id) renderResult(); } }, icon('star')),
      el('button', { class: 'icon flip', title: t('open'), onclick: () => openEntry(e) }, icon('open')),
      el('button', { class: 'icon', title: t('delete'), onclick: () => { if (confirm(t('confirmDel', { n: 1 }))) removeEntries([e.id]); } }, icon('trash'))),
    el('div', { class: 'texts', onclick: () => openEntry(e) }, el('p', { dir: 'auto' }, e.input), el('p', { dir: 'auto' }, e.output)))));
}

function showView(v) {
  $('#view-translate').hidden = v !== 'translate'; $('#view-archive').hidden = v !== 'archive';
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'archive') renderArchive();
}

/* =====================================================================
   Wiring
   ===================================================================== */
function onInput() {
  const v = $('#input').value;
  $('#charCount').textContent = `${v.length.toLocaleString()} / 10,000`;
  $('#input').classList.toggle('big', v.length > 0 && isWord(v));
}

async function init() {
  $$('i[data-icon]').forEach(i => i.replaceWith(icon(i.dataset.icon)));
  makePicker($('#srcPick'), { auto: true, get: () => S.set.src, set: c => { S.set.src = c; S.detected = ''; saveSettings(); } });
  makePicker($('#tgtPick'), { auto: false, get: () => S.set.tgt, set: c => { S.set.tgt = c; saveSettings(); } });
  $('#grammarToggle').checked = S.set.grammar;
  applyI18n(); onInput();

  $$('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#uiLangBtn').addEventListener('click', () => { S.set.ui = S.set.ui === 'ar' ? 'en' : 'ar'; saveSettings(); applyI18n(); });
  $('#themeBtn').addEventListener('click', () => { S.set.theme = S.set.theme === 'dark' ? 'light' : 'dark'; saveSettings(); applyI18n(); });
  $('#settingsBtn').addEventListener('click', () => { $('#emailInput').value = S.set.email; $('#settingsDlg').showModal(); });
  $('#settingsSave').addEventListener('click', () => { const i = $('#emailInput'); S.set.email = i.checkValidity() ? i.value.trim() : ''; saveSettings(); renderUsage(); toast(t('saved')); });
  $('#grammarToggle').addEventListener('change', e => { S.set.grammar = e.target.checked; saveSettings(); });

  $('#input').addEventListener('input', onInput);
  $('#input').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
  $('#goBtn').addEventListener('click', () => run());
  $('#clearBtn').addEventListener('click', () => { $('#input').value = ''; onInput(); S.cur = null; S.detected = ''; showError(null); pickers.forEach(p => p.label()); renderResult(); $('#input').focus(); });
  $('#pasteBtn').addEventListener('click', async () => { try { $('#input').value = (await navigator.clipboard.readText()).slice(0, 10000); onInput(); } catch { $('#input').focus(); } });
  $('#speakIn').addEventListener('click', () => speak($('#input').value, S.cur ? S.cur.src : S.set.src));
  $('#speakOut').addEventListener('click', () => speak(S.cur ? S.cur.output : '', S.set.tgt));
  $('#copyBtn').addEventListener('click', () => S.cur && copyText(S.cur.output));
  $('#favBtn').addEventListener('click', () => { if (!S.cur) return; S.cur.fav = !S.cur.fav; saveEntry(S.cur); renderResult(); });
  $('#swapBtn').addEventListener('click', () => {
    const from = S.set.src === 'auto' ? (S.detected || (S.cur && S.cur.src !== 'auto' ? S.cur.src : '')) : S.set.src;
    if (!from) return;
    const out = S.cur ? S.cur.output : '';
    S.set.src = S.set.tgt; S.set.tgt = from; S.detected = ''; saveSettings();
    if (out) { $('#input').value = out; onInput(); S.cur = null; renderResult(); }
    pickers.forEach(p => p.label());
  });

  ['input', 'change'].forEach(ev => { $('#archSearch').addEventListener(ev, renderArchive); });
  $('#archLang').addEventListener('change', renderArchive);
  $('#archFav').addEventListener('change', renderArchive);
  $('#selAll').addEventListener('change', e => { filteredEntries().forEach(x => e.target.checked ? S.selected.add(x.id) : S.selected.delete(x.id)); renderArchive(); });
  $('#delSelBtn').addEventListener('click', () => {
    const l = filteredEntries(); const s = l.filter(e => S.selected.has(e.id)); const ids = (s.length ? s : l).map(e => e.id);
    if (ids.length && confirm(t('confirmDel', { n: ids.length }))) removeEntries(ids);
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });

  document.addEventListener('click', e => {
    pickers.forEach(p => { if (!p.root.contains(e.target)) p.close(); });
    $$('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
  });

  try { S.entries = (await DB.all()) || []; } catch { S.entries = []; toast(t('errStore')); }
  renderArchive();
}
init();
})();
