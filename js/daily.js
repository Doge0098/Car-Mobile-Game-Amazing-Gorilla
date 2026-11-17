// Reto diario: cada día una carrera distinta (circuito, sentido y regla especial) elegida a partir de la fecha.
// Funciona sin conexión: solo depende del calendario del móvil.
import { TRACKS, rng } from './data.js';

export const DAILY_REWARD = 120, DAILY_STREAK_BONUS = 15, DAILY_STREAK_MAX = 7;

// opts: cambios que se aplican a la carrera (ver Race en race.js) · tod: hora del día · hard: rivales en difícil
export const DAILY_MODS = [
  { id: 'cocos', icon: '🥥', name: 'Lluvia de cocos', desc: 'Todas las cajas dan cocos teledirigidos.', opts: { forceItem: 'coco', boxRespawn: 1.6 } },
  { id: 'turbo', icon: '🍌', name: 'Turbo loco', desc: 'Todas las cajas dan turbos.', opts: { forceItem: 'turbo', boxRespawn: 1.6 } },
  { id: 'cascaras', icon: '🍂', name: 'Pista resbaladiza', desc: 'Todas las cajas dan cáscaras.', opts: { forceItem: 'peel', boxRespawn: 1.6 } },
  { id: 'barriles', icon: '🛢️', name: 'Barriles locos', desc: 'Todas las cajas dan barriles rodantes.', opts: { forceItem: 'barrel', boxRespawn: 1.6 } },
  { id: 'luna', icon: '🌙', name: 'Gravedad lunar', desc: 'Los saltos son mucho más largos.', opts: { gravityK: 0.4 } },
  { id: 'gigantes', icon: '🦍', name: 'Rivales gigantes', desc: 'Los rivales son enormes y corren en difícil.', opts: { rivalSize: 1.4 }, hard: true },
  { id: 'sprint', icon: '⚡', name: 'Sprint', desc: 'Una sola vuelta: no hay margen de error.', opts: { laps: 1 } },
  { id: 'maraton', icon: '🏃', name: 'Maratón', desc: 'Cinco vueltas.', opts: { laps: 5 } },
  { id: 'noche', icon: '🎆', name: 'Carrera nocturna', desc: 'De noche y con fuegos artificiales.', opts: {}, tod: 'night' },
];

export const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

// Reto del día: { key, track (id), variant, mod, tod }
export function dailyChallenge(d = new Date()) {
  const key = dayKey(d), r = rng(key * 13 + 7), pick = a => a[Math.floor(r() * a.length)];
  const track = pick(TRACKS), mod = pick(DAILY_MODS);
  return { key, track: track.id, variant: pick(['', '', 'mirror', 'reverse']), mod, tod: mod.tod || (track.theme.underwater ? '' : pick(['', '', 'dusk'])) };
}

// ¿Era ayer el último día completado? (para la racha)
export function isYesterday(key, d = new Date()) {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return key === dayKey(y);
}
