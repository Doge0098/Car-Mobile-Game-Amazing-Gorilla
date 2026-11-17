// Progresión: misiones de cada carrera, logros y estadísticas de por vida. Todo va guiado por datos.
import { CHARACTERS, KARTS, CUPS, TRACKS } from './data.js';
import { HATS, STICKERS, DANCES, EMOTES, UPGRADES, UPGRADE_MAX, upgradeLevel } from './shop.js';
import { BOSSES } from './boss.js';

// ---------- Medallas de la contrarreloj ----------
// MEDAL_REF: tiempo (s) de una vuelta limpia de referencia en cada circuito; de él salen oro, plata y bronce.
// (medido con el gorila y el coche iniciales; con mejor coche o buenos derrapes se baja de ahí)
export const MEDAL_REF = { selva: 92.9, playa: 91.4, volcan: 93.6, hielo: 91.2, neon: 89.7, arcoiris: 90.3, nubes: 93.3, oceano: 102.7, abismo: 92.3, desierto: 96.1, fabrica: 96.4, estacion: 97 };
export const MEDAL_NAMES = ['', 'Bronce', 'Plata', 'Oro'], MEDAL_REWARD = [0, 20, 40, 80];
// Devuelve [oro, plata, bronce] en segundos, o null si el circuito no tiene tiempos (el circuito sorpresa)
export function medalTimes(trackId) {
  const ref = MEDAL_REF[trackId];
  return ref ? [Math.round(ref * 97.5) / 100, Math.round(ref * 103) / 100, Math.round(ref * 110) / 100] : null;
}

// Sustituye {clave} en un texto: fill('Recoge {n} plátanos', { n: 20 })
export const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
const mmss = t => { const m = Math.floor(t / 60), s = Math.floor(t - m * 60); return m + ':' + (s < 10 ? '0' : '') + s; };

// ---------- Misiones (se eligen al empezar cada carrera) ----------
// Lo que ofrece cada modo: 'rivals' (hay posiciones) e 'items' (hay cajas de objetos).
// null = sin misiones. Un modo que no esté en la lista usa DEFAULT_CAPS.
// 'laps' (hay vueltas y meta) y 'course' (aros y turbos del suelo de los circuitos normales).
export const MODE_CAPS = {
  race: ['rivals', 'items', 'laps', 'course'], cup: ['rivals', 'items', 'laps', 'course'], time: ['laps', 'course'],
  elim: ['rivals', 'items', 'course'], stunt: ['rivals', 'items', 'course'], battle: ['rivals', 'items'], fever: ['rivals', 'items'], tutorial: null,
};
const DEFAULT_CAPS = ['rivals', 'items', 'laps', 'course'];
export const MISSION_COUNT = { default: 3, time: 2 };  // misiones por carrera según el modo
export const MISSION_REWARD_K = { default: 1, time: 0.6 }; // multiplicador del premio según el modo
// Velocidad media (unidades/s) con la que se calcula el tiempo objetivo de la misión 'par'
export const PAR_SPEED = { default: 62, time: 66 };

// Contexto c: { st (estadísticas del jugador), pos, total, time, par, finished, started }
// n + value: se cumple cuando value(c) >= n (y se muestra el progreso). done: condición propia. fail: ya no se puede cumplir.
// needs: lo que debe ofrecer el modo · group: como mucho una misión de cada grupo por carrera
export const MISSIONS = [
  { id: 'podium', group: 'pos', needs: ['rivals'], reward: 25, text: 'Termina entre los 3 primeros', done: c => c.finished && c.pos <= 3 },
  { id: 'win', group: 'pos', needs: ['rivals'], reward: 40, text: 'Gana la carrera', done: c => c.finished && c.pos === 1 },
  { id: 'lead', group: 'pos', needs: ['rivals'], reward: 25, text: 'Ponte en cabeza en algún momento', done: c => c.st.bestPos === 1 },
  { id: 'bananas', reward: 25, n: 20, text: 'Recoge {n} plátanos', value: c => c.st.bananas },
  { id: 'tricks', reward: 30, n: 3, text: 'Haz {n} trucos en las rampas', value: c => c.st.tricks },
  { id: 'rings', needs: ['course'], reward: 30, n: 6, text: 'Pasa por {n} aros', value: c => c.st.rings },
  { id: 'turbos', reward: 30, n: 4, text: 'Consigue {n} mini-turbos derrapando', value: c => c.st.miniturbos },
  { id: 'pads', needs: ['course'], reward: 25, n: 4, text: 'Pisa {n} turbos del suelo', value: c => c.st.pads },
  { id: 'start', reward: 25, text: 'Consigue la salida turbo', done: c => c.st.startBoost, fail: c => c.started && !c.st.startBoost },
  { id: 'onroad', reward: 30, n: 3, text: 'No te salgas de la pista más de {n} s seguidos', done: c => c.finished && c.st.offMax <= 3, fail: c => c.st.offMax > 3 },
  { id: 'par', needs: ['laps'], reward: 35, text: 'Termina en menos de {par}', done: c => c.finished && c.time <= c.par, fail: c => c.time > c.par },
  { id: 'nohits', needs: ['rivals'], reward: 40, text: 'No recibas ningún golpe', done: c => c.finished && c.st.hitsTaken === 0, fail: c => c.st.hitsTaken > 0 },
  { id: 'items', needs: ['items'], reward: 25, n: 3, text: 'Usa {n} objetos', value: c => c.st.items },
  { id: 'drafts', needs: ['rivals', 'laps'], reward: 30, n: 2, text: 'Consigue {n} rebufos', value: c => c.st.drafts || 0 },
  { id: 'hits', needs: ['rivals', 'items'], reward: 35, n: 2, text: 'Golpea a tus rivales {n} veces', value: c => c.st.hitsDealt },
];

const perMode = (table, mode) => (mode in table ? table[mode] : table.default);

// Tiempo objetivo de la misión 'par' para este circuito
export const parTime = (mode, trackLength, laps) => Math.round(laps * trackLength / perMode(PAR_SPEED, mode));

// Elige las misiones de una carrera: [{ def, text, reward, done, failed, told }]
export function pickMissions(mode, par = 0, rand = Math.random) {
  const caps = mode in MODE_CAPS ? MODE_CAPS[mode] : DEFAULT_CAPS;
  if (!caps) return [];
  const pool = MISSIONS.filter(m => (m.needs || []).every(n => caps.includes(n)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [], groups = new Set(), count = perMode(MISSION_COUNT, mode), k = perMode(MISSION_REWARD_K, mode);
  for (const def of pool) {
    if (out.length >= count) break;
    if (def.group) { if (groups.has(def.group)) continue; groups.add(def.group); }
    out.push({ def, text: fill(def.text, { n: def.n, par: mmss(par) }), reward: Math.max(5, Math.round(def.reward * k / 5) * 5), done: false, failed: false, told: false });
  }
  return out;
}

const isDone = (def, c) => (def.done ? def.done(c) : def.value(c) >= def.n);

// Actualiza el estado de las misiones. Devuelve la primera que se acaba de cumplir (para avisar) o null.
export function updateMissions(list, c) {
  let fresh = null;
  for (const m of list) {
    m.done = !!isDone(m.def, c);
    m.failed = !m.done && (c.finished || !!(m.def.fail && m.def.fail(c)));
    if (m.done && !m.told) { m.told = true; if (!fresh) fresh = m; }
  }
  return fresh;
}
// Progreso para mostrar («7/20») o cadena vacía si la misión no cuenta nada
export const missionProgress = (m, c) => (m.def.value ? Math.min(m.def.n, m.def.value(c)) + '/' + m.def.n : '');
export const missionsReward = list => list.reduce((a, m) => a + (m.done ? m.reward : 0), 0);

// ---------- Estadísticas de por vida ----------
// fmt: 'time' = segundos mostrados como horas y minutos
export const LIFETIME = [
  { id: 'races', name: 'Carreras terminadas' },
  { id: 'wins', name: 'Victorias' },
  { id: 'podiums', name: 'Podios' },
  { id: 'perfect', name: 'Carreras perfectas' },
  { id: 'golds', name: 'Copas de oro' },
  { id: 'trials', name: 'Contrarrelojes' },
  { id: 'records', name: 'Récords batidos' },
  { id: 'missions', name: 'Misiones cumplidas' },
  { id: 'bananas', name: 'Plátanos recogidos' },
  { id: 'earned', name: 'Plátanos ganados' },
  { id: 'tricks', name: 'Trucos' },
  { id: 'rings', name: 'Aros atravesados' },
  { id: 'miniturbos', name: 'Mini-turbos' },
  { id: 'startBoosts', name: 'Salidas turbo' },
  { id: 'items', name: 'Objetos usados' },
  { id: 'hits', name: 'Golpes a rivales' },
  { id: 'shortcuts', name: 'Atajos usados' },
  { id: 'drafts', name: 'Rebufos' },
  { id: 'goldMedals', name: 'Medallas de oro' },
  { id: 'bosses', name: 'Jefes derrotados' },
  { id: 'dailies', name: 'Retos diarios superados' },
  { id: 'rivalWins', name: 'Victorias contra tu rival' },
  { id: 'elimWins', name: 'Eliminaciones ganadas' },
  { id: 'battleWins', name: 'Batallas ganadas' },
  { id: 'time', name: 'Tiempo en pista', fmt: 'time' },
];
export const stat = (save, id) => +(save.stats && save.stats[id]) || 0;
export function addStat(save, id, n = 1) { save.stats[id] = stat(save, id) + n; }
export function statText(save, def) {
  const v = stat(save, def.id);
  if (def.fmt !== 'time') return String(Math.round(v));
  const h = Math.floor(v / 3600), m = Math.floor(v / 60) % 60;
  return h ? h + ' h ' + m + ' min' : m + ' min';
}

// Suma una carrera terminada a las estadísticas. r: { mode, pos, st, time, missions (cumplidas), record }
export function recordRace(save, r) {
  const caps = r.mode in MODE_CAPS ? MODE_CAPS[r.mode] : DEFAULT_CAPS, st = r.st;
  if (!caps) return; // el tutorial no cuenta
  if (caps.includes('rivals')) {
    addStat(save, 'races');
    if (r.pos === 1) addStat(save, 'wins');
    if (r.pos <= 3) addStat(save, 'podiums');
    if (r.pos === 1 && st.hitsTaken === 0) addStat(save, 'perfect');
    if (r.pos === 1 && r.mode === 'elim') addStat(save, 'elimWins');
    if (r.pos === 1 && r.mode === 'battle') addStat(save, 'battleWins');
  } else {
    addStat(save, 'trials');
    if (r.record) addStat(save, 'records');
  }
  addStat(save, 'bananas', st.bananas); addStat(save, 'tricks', st.tricks); addStat(save, 'rings', st.rings);
  addStat(save, 'miniturbos', st.miniturbos); addStat(save, 'items', st.items); addStat(save, 'hits', st.hitsDealt);
  if (st.startBoost) addStat(save, 'startBoosts');
  addStat(save, 'shortcuts', st.shortcuts || 0); addStat(save, 'drafts', st.drafts || 0);
  addStat(save, 'missions', r.missions || 0); addStat(save, 'time', r.time || 0);
}

// ---------- Logros ----------
// value(save): progreso actual · goal: meta (número o función, para que crezca con el contenido) · reward: plátanos
const goldCups = save => CUPS.filter(c => Object.keys(save.trophies).some(k => k.startsWith(c.id + '_') && save.trophies[k] === 1)).length;
const maxUpgrade = save => Math.max(...UPGRADES.map(u => upgradeLevel(save, u.id)));
export const ACHIEVEMENTS = [
  { id: 'first', icon: '🏁', name: 'Primera carrera', desc: 'Termina una carrera', goal: 1, reward: 20, value: s => stat(s, 'races') },
  { id: 'win1', icon: '🥇', name: 'Primera victoria', desc: 'Gana una carrera', goal: 1, reward: 40, value: s => stat(s, 'wins') },
  { id: 'win10', icon: '🏆', name: 'Campeón', desc: 'Gana 10 carreras', goal: 10, reward: 150, value: s => stat(s, 'wins') },
  { id: 'win30', icon: '🌟', name: 'Leyenda de la selva', desc: 'Gana 30 carreras', goal: 30, reward: 400, value: s => stat(s, 'wins') },
  { id: 'podium15', icon: '🎉', name: 'Habitual del podio', desc: 'Sube al podio 15 veces', goal: 15, reward: 120, value: s => stat(s, 'podiums') },
  { id: 'perfect', icon: '💎', name: 'Carrera perfecta', desc: 'Gana sin recibir ningún golpe', goal: 1, reward: 100, value: s => stat(s, 'perfect') },
  { id: 'bananas200', icon: '🍌', name: 'Recolector', desc: 'Recoge 200 plátanos en la pista', goal: 200, reward: 50, value: s => stat(s, 'bananas') },
  { id: 'bananas1000', icon: '🧺', name: 'Magnate bananero', desc: 'Recoge 1000 plátanos en la pista', goal: 1000, reward: 250, value: s => stat(s, 'bananas') },
  { id: 'tricks25', icon: '🌀', name: 'Acróbata', desc: 'Haz 25 trucos', goal: 25, reward: 80, value: s => stat(s, 'tricks') },
  { id: 'rings50', icon: '⭕', name: 'Rey de los aros', desc: 'Pasa por 50 aros', goal: 50, reward: 80, value: s => stat(s, 'rings') },
  { id: 'turbos60', icon: '💨', name: 'Derrapador', desc: 'Consigue 60 mini-turbos', goal: 60, reward: 80, value: s => stat(s, 'miniturbos') },
  { id: 'start10', icon: '🚦', name: 'Reflejos de mono', desc: 'Consigue 10 salidas turbo', goal: 10, reward: 60, value: s => stat(s, 'startBoosts') },
  { id: 'items50', icon: '🎁', name: 'Arsenal', desc: 'Usa 50 objetos', goal: 50, reward: 80, value: s => stat(s, 'items') },
  { id: 'hits30', icon: '🥥', name: 'Buena puntería', desc: 'Golpea a tus rivales 30 veces', goal: 30, reward: 100, value: s => stat(s, 'hits') },
  { id: 'shortcut10', icon: '🚀', name: 'Por el atajo', desc: 'Usa 10 atajos', goal: 10, reward: 60, value: s => stat(s, 'shortcuts') },
  { id: 'rival5', icon: '⚔️', name: 'Némesis', desc: 'Acaba 5 veces por delante de tu rival', goal: 5, reward: 120, value: s => stat(s, 'rivalWins') },
  { id: 'elim1', icon: '💥', name: 'Superviviente', desc: 'Gana una carrera de eliminación', goal: 1, reward: 80, value: s => stat(s, 'elimWins') },
  { id: 'battle1', icon: '🎈', name: 'Rey de los globos', desc: 'Gana una batalla de globos', goal: 1, reward: 80, value: s => stat(s, 'battleWins') },
  { id: 'drafts20', icon: '💨', name: 'A rebufo', desc: 'Consigue 20 rebufos', goal: 20, reward: 80, value: s => stat(s, 'drafts') },
  { id: 'boss1', icon: '👑', name: 'Cazajefes', desc: 'Derrota a un jefe', goal: 1, reward: 100, value: s => stat(s, 'bosses') },
  { id: 'bossAll', icon: '🦍', name: 'Rey de la jungla', desc: 'Derrota a todos los jefes', goal: () => BOSSES.filter(b => CUPS[b.cup]).length, reward: 400, value: s => BOSSES.filter(b => CUPS[b.cup] && s.bosses[b.id]).length },
  { id: 'daily7', icon: '📅', name: 'Constante', desc: 'Supera 7 retos diarios', goal: 7, reward: 200, value: s => stat(s, 'dailies') },
  { id: 'medalsAll', icon: '🥇', name: 'Contrarrelojista', desc: 'Consigue la medalla de oro en todos los circuitos', goal: () => TRACKS.length, reward: 500, value: s => TRACKS.filter(t => s.medals[t.id] === 3).length },
  { id: 'missions20', icon: '📋', name: 'Cumplidor', desc: 'Completa 20 misiones', goal: 20, reward: 100, value: s => stat(s, 'missions') },
  { id: 'gold1', icon: '🏅', name: 'Oro puro', desc: 'Gana una copa con trofeo de oro', goal: 1, reward: 150, value: goldCups },
  { id: 'goldAll', icon: '👑', name: 'Coleccionista de oro', desc: 'Consigue el oro en todas las copas', goal: () => CUPS.length, reward: 400, value: goldCups },
  { id: 'records', icon: '⏱️', name: 'Contra el reloj', desc: 'Marca un tiempo en todos los circuitos', goal: () => TRACKS.length, reward: 150, value: s => TRACKS.filter(t => s.best[t.id]).length },
  { id: 'chars', icon: '🦍', name: 'Toda la tropa', desc: 'Consigue todos los gorilas', goal: () => CHARACTERS.length, reward: 300, value: s => CHARACTERS.filter(c => s.chars.includes(c.id)).length },
  { id: 'karts', icon: '🏎️', name: 'Garaje lleno', desc: 'Consigue todos los coches', goal: () => KARTS.length, reward: 300, value: s => KARTS.filter(k => s.karts.includes(k.id)).length },
  { id: 'hats4', icon: '🎩', name: 'A la moda', desc: 'Compra 4 sombreros', goal: 4, reward: 100, value: s => HATS.filter(h => h.price > 0 && s.hats.includes(h.id)).length },
  { id: 'stickers3', icon: '🏷️', name: 'Tuneado', desc: 'Compra 3 pegatinas', goal: 3, reward: 80, value: s => STICKERS.filter(x => x.price > 0 && s.stickers.includes(x.id)).length },
  { id: 'dances', icon: '🕺', name: 'Rey de la pista', desc: 'Consigue todos los bailes', goal: () => DANCES.length, reward: 200, value: s => DANCES.filter(x => s.dances.includes(x.id)).length },
  { id: 'emotes4', icon: '😎', name: 'Expresivo', desc: 'Compra 4 gestos', goal: 4, reward: 80, value: s => EMOTES.filter(x => x.price > 0 && s.emotes.includes(x.id)).length },
  { id: 'upgradeMax', icon: '🔧', name: 'A tope', desc: 'Sube una mejora al nivel máximo', goal: UPGRADE_MAX, reward: 150, value: maxUpgrade },
];
export const achGoal = a => (typeof a.goal === 'function' ? a.goal() : a.goal);
export const achValue = (save, a) => Math.min(achGoal(a), a.value(save));
export const achDone = (save, a) => !!save.achievements[a.id];

// Marca y paga los logros recién conseguidos. Devuelve la lista de los nuevos.
export function checkAchievements(save) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id] || a.value(save) < achGoal(a)) continue;
    save.achievements[a.id] = 1; save.bananas += a.reward; addStat(save, 'earned', a.reward);
    fresh.push(a);
  }
  return fresh;
}
