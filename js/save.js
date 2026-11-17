// Guardado local (funciona sin conexión).
const KEY = 'amazing-gorilla-save-v1';

const defaults = () => ({
  bananas: 0,
  chars: ['bongo', 'tita'],
  karts: ['platano'],
  char: 'bongo',
  kart: 'platano',
  color: 0,
  // personalización (ver js/shop.js): lo comprado y lo elegido
  hats: ['none'], hat: 'none',
  wheels: ['std'], wheel: 'std',
  trails: ['fuego'], trail: 'fuego',
  horns: ['clasica'], horn: 'clasica',
  stickers: ['none'], sticker: 'none',
  dances: ['clasico'], dance: 'clasico',
  emotes: ['hola'], emote: 'hola',
  upgrades: { motor: 0, ruedas: 0, turbo: 0 }, // nivel 0-5 de cada mejora
  trophies: {},      // cupId_diff -> 1,2,3
  best: {},          // trackId -> mejor tiempo contrarreloj (s)
  ghosts: {},        // trackId -> array plano [x,z,h,...]
  stats: {},         // estadísticas de por vida (ver LIFETIME en js/meta.js): clave -> número
  achievements: {},  // id de logro -> 1 (conseguido y cobrado)
  tutorial: '',      // '' sin ofrecer · 'seen' ofrecido · 'done' completado
  rival: { char: '', level: 0, wins: 0, losses: 0 }, // rival personal: quién es y lo fuerte que corre
  medals: {},        // contrarreloj: circuito[:variante] -> 1 bronce, 2 plata, 3 oro
  bosses: {},        // id de jefe -> 1 (derrotado)
  daily: { done: 0, streak: 0 }, // reto diario: último día superado (AAAAMMDD) y racha de días seguidos
  settings: {
    controls: 'buttons', music: 0.6, sfx: 0.8, quality: 'alta', bloom: true, shadows: true, outline: true, haptics: true,
    btnSize: 'm', lefty: false, btnAlpha: 1, // tamaño (s/m/l), modo zurdo y opacidad de los botones táctiles
    autoQuality: true, autoQ: 0,             // calidad automática y pasos de reducción ya aplicados
    lang: '',                                // idioma: '' automático (el del móvil) · 'es' · 'en'
    battery: false, fps: false,              // ahorro de batería (30 FPS) y contador de FPS
    assistSteer: false, autoDrift: false,    // ayudas de conducción
  },
});

const OBJECTS = ['settings', 'upgrades', 'trophies', 'best', 'ghosts', 'stats', 'achievements', 'rival', 'medals', 'bosses', 'daily'];
const LISTS = ['chars', 'karts', 'hats', 'wheels', 'trails', 'horns', 'stickers', 'dances', 'emotes'];

export let save = defaults();

// Mezcla una partida guardada (quizá antigua) con los valores por defecto de todos los campos nuevos
function merge(d) {
  const base = defaults(), out = { ...base, ...d };
  for (const k of OBJECTS) out[k] = { ...base[k], ...(d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) ? d[k] : {}) };
  for (const k of LISTS) {
    out[k] = Array.isArray(d[k]) ? d[k].slice() : base[k];
    for (const id of base[k]) if (!out[k].includes(id)) out[k].unshift(id); // lo gratuito siempre está disponible
  }
  out.bananas = Math.max(0, Math.floor(+out.bananas || 0));
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) save = merge(JSON.parse(raw) || {});
    else if ((navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)) {
      // primera vez en un móvil modesto: se empieza con gráficos medios y sin sombras
      save.settings.quality = 'media'; save.settings.shadows = false;
    }
  } catch (e) { save = defaults(); }
  return save;
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {
    // Si no cabe (almacenamiento lleno), se descartan los fantasmas.
    try { save.ghosts = {}; localStorage.setItem(KEY, JSON.stringify(save)); } catch (e2) { /* sin almacenamiento */ }
  }
}

export function resetSave() {
  save = defaults();
  persist();
}

// ---------- Copia de seguridad ----------
// La partida viaja como un código de texto: «AGR» + versión + «.» + JSON en base64url + «.» + suma de control.
// Los fantasmas de la contrarreloj no se incluyen (abultan demasiado).
const CODE_V = 1, CODE_RE = /^AGR(\d+)\.([\w-]+)\.([0-9a-z]+)$/;
const sum = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

export function exportCode() {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...save, ghosts: {} }));
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  const body = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'AGR' + CODE_V + '.' + body + '.' + sum(body);
}

// Lee un código pegado por el jugador. Nunca lanza errores: devuelve { data } (partida lista para applyImport) o
// { error }: 'foreign' (no es un código del juego) · 'newer' (de una versión posterior) · 'broken' (incompleto o dañado)
export function importCode(text) {
  try {
    const code = String(text == null ? '' : text).replace(/\s+/g, ''), m = CODE_RE.exec(code);
    if (!m) return { error: /^AGR\d+\./.test(code) ? 'broken' : 'foreign' };
    if (+m[1] > CODE_V) return { error: 'newer' };
    if (sum(m[2]) !== m[3]) return { error: 'broken' };
    const bin = atob(m[2].replace(/-/g, '+').replace(/_/g, '/'));
    const d = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.bananas !== 'number' || !Array.isArray(d.chars)) return { error: 'broken' };
    // solo se aceptan los campos con el tipo que espera el juego; lo demás se queda con su valor por defecto
    const base = defaults(), same = (a, b) => typeof a === typeof b && Array.isArray(a) === Array.isArray(b);
    for (const k in d) if (k in base && !same(d[k], base[k])) delete d[k];
    for (const k of LISTS) if (d[k]) d[k] = d[k].filter(x => typeof x === 'string');
    if (d.settings) for (const k in d.settings) if (k in base.settings && !same(d.settings[k], base.settings[k])) delete d.settings[k];
    return { data: merge(d) };
  } catch (e) { return { error: 'broken' }; }
}

// Sustituye la partida por la importada. Se conservan los fantasmas de este dispositivo cuyo récord coincide.
export function applyImport(data) {
  for (const k in save.ghosts) if (data.best[k] === save.best[k]) data.ghosts[k] = save.ghosts[k];
  save = data;
  persist();
}
