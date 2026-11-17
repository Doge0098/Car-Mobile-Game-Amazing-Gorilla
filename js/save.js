// Guardado local (funciona sin conexión).
const KEY = 'amazing-gorilla-save-v1';

const defaults = () => ({
  bananas: 0,
  chars: ['bongo', 'tita'],
  karts: ['platano'],
  char: 'bongo',
  kart: 'platano',
  color: 0,
  trophies: {},      // cupId_diff -> 1,2,3
  best: {},          // trackId -> mejor tiempo contrarreloj (s)
  ghosts: {},        // trackId -> array plano [x,z,h,...]
  settings: { controls: 'buttons', music: 0.6, sfx: 0.8, quality: 'alta', bloom: true, shadows: true, haptics: true },
});

export let save = defaults();

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const base = defaults();
      save = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
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
