// Idiomas: el español es el texto base y sirve de clave; lang_en.js contiene las traducciones al inglés.
// La página se traduce sola: un observador revisa cada texto que aparece, así el resto del código escribe siempre en español.
import { save } from './save.js';
import { EN as EN_BASE, EN_PATTERNS as PATTERNS_BASE, EN_WORDS } from './lang_en.js';
import { EN_CUSTOM, EN_CUSTOM_PATTERNS } from './lang_en_custom.js';
import { EN_CUP4 } from './lang_en_cup4.js';
import { EN_SHARE, EN_SHARE_PATTERNS } from './lang_en_share.js';

// Las tablas de cada bloque del juego se unen en una sola
const EN = Object.assign({}, EN_BASE, EN_CUSTOM, EN_CUP4, EN_SHARE);
const EN_PATTERNS = [...PATTERNS_BASE, ...EN_CUSTOM_PATTERNS, ...EN_SHARE_PATTERNS];

export function lang() {
  const l = save.settings.lang;
  if (l === 'es' || l === 'en') return l;
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

// Plantillas con huecos: 'Vuelta {n}' -> expresión regular que captura cada hueco
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = EN_PATTERNS.map(([es, en]) => {
  const names = [];
  const re = new RegExp('^' + es.split(/(\{\w+\})/).map(p => { const m = /^\{(\w+)\}$/.exec(p); if (m) { names.push(m[1]); return '(.+?)'; } return esc(p); }).join('') + '$');
  return { re, en, names };
});
const WORDS = EN_WORDS.map(([es, en]) => [new RegExp('(^|[^\\p{L}])' + esc(es) + '(?![\\p{L}])', 'gu'), en]);
const cache = new Map();
const HAS_LETTER = /\p{L}/u;

// Traduce un texto completo al inglés: coincidencia exacta, plantilla con huecos o palabras sueltas
function toEn(s) {
  if (!HAS_LETTER.test(s)) return s;
  let out = cache.get(s);
  if (out !== undefined) return out;
  out = EN[s];
  if (out === undefined) for (const p of PATTERNS) {
    const m = p.re.exec(s);
    if (m) { out = p.en; p.names.forEach((n, i) => { out = out.split('{' + n + '}').join(toEn(m[i + 1])); }); break; }
  }
  if (out === undefined) {
    out = s; for (const [re, en] of WORDS) out = out.replace(re, (m, pre) => pre + en);
    if (out === s && typeof window !== 'undefined' && window.__i18nMiss) window.__i18nMiss.add(s); // solo en las pruebas
  }
  if (cache.size > 3000) cache.clear();
  cache.set(s, out);
  return out;
}

// Traduce un texto del código; {clave} se sustituye por vars.clave
export function t(es, vars) {
  let s = lang() === 'en' ? toEn(es) : es;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

// ---------- Traducción automática de la página ----------
let on = false, observer = null;
const skip = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !el || el.closest('[data-noi18n], script, style'); };
function trNode(n) {
  const v = n.nodeValue;
  if (n.__en === v) return;                 // ya traducido
  const key = v.trim(); if (!key) return;
  n.__es = v;
  const e = toEn(key);
  n.__en = e === key ? v : v.replace(key, e);
  if (n.__en !== v) n.nodeValue = n.__en;
}
function walk(root, fn) {
  if (root.nodeType === 3) { if (!skip(root)) fn(root); return; }
  if (root.nodeType !== 1 || skip(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) if (!skip(n)) fn(n);
}
function apply() {
  const en = lang() === 'en';
  document.documentElement.lang = en ? 'en' : 'es';
  if (en === on) return;
  on = en;
  if (en) walk(document.body, trNode);
  else walk(document.body, n => { if (n.__es !== undefined && n.nodeValue === n.__en) n.nodeValue = n.__es; n.__en = undefined; });
}

export function initI18n() {
  apply();
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(list => {
    if (!on) return;
    for (const m of list) {
      if (m.type === 'characterData') { if (!skip(m.target)) trNode(m.target); }
      else for (const n of m.addedNodes) walk(n, trNode);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function setLang(l) { save.settings.lang = l; apply(); }
