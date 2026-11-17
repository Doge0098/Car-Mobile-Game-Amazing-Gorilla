// Idiomas: el español es el texto base y sirve de clave; EN contiene las traducciones al inglés.
import { save } from './save.js';
import { EN } from './lang_en.js';

export function lang() {
  const l = save.settings.lang;
  if (l === 'es' || l === 'en') return l;
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

// Traduce un texto; {clave} se sustituye por vars.clave
export function t(es, vars) {
  let s = lang() === 'en' ? (EN[es] ?? es) : es;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

// Nombre o descripción de un dato (personaje, coche, mapa...) en el idioma actual: usa el campo con sufijo En si existe
export function L(obj, key = 'name') { return lang() === 'en' ? (obj[key + 'En'] ?? EN[obj[key]] ?? obj[key]) : obj[key]; }

// Traduce los textos fijos de la página (nodos de texto y atributos) guardando el original
export function translateDom(root = document.body) {
  const en = lang() === 'en', w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.__es === undefined) { const k = n.nodeValue.trim(); if (!k) continue; n.__es = n.nodeValue; n.__key = k; }
    const tr = en ? EN[n.__key] : null;
    n.nodeValue = tr ? n.__es.replace(n.__key, tr) : n.__es;
  }
  document.documentElement.lang = en ? 'en' : 'es';
}
