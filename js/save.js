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
  upgrades: { motor: 0, ruedas: 0, turbo: 0 }, // nivel 0-5 de cada mejora
  trophies: {},      // cupId_diff -> 1,2,3
  best: {},          // trackId -> mejor tiempo contrarreloj (s)
  ghosts: {},        // trackId -> array plano [x,z,h,...]
  stats: {},         // estadísticas de por vida (ver LIFETIME en js/meta.js): clave -> número
  achievements: {},  // id de logro -> 1 (conseguido y cobrado)
  tutorial: '',      // '' sin ofrecer · 'seen' ofrecido · 'done' completado
  settings: {
    controls: 'buttons', music: 0.6, sfx: 0.8, quality: 'alta', bloom: true, shadows: true, outline: true, haptics: true,
    btnSize: 'm', lefty: false, btnAlpha: 1, // tamaño (s/m/l), modo zurdo y opacidad de los botones táctiles
    autoQuality: true, autoQ: 0,             // calidad automática y pasos de reducción ya aplicados
  },
});

const OBJECTS = ['settings', 'upgrades', 'trophies', 'best', 'ghosts', 'stats', 'achievements'];
const LISTS = ['chars', 'karts', 'hats', 'wheels', 'trails', 'horns'];

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
