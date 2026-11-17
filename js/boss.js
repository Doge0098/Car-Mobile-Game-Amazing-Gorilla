// Jefes: un gorila gigante por copa, con su propio truco. Se le reta a un duelo de tres vueltas tras ganar un trofeo en su copa.
import * as THREE from './vendor/three.module.min.js';
import { makeHazard } from './models.js';

export const BOSS_REWARD = 300;
// power: 'barrels' (deja barriles) · 'fire' (deja llamas) · 'storm' (rayos que encogen) · 'all' (los tres)
export const BOSSES = [
  { id: 'barrilote', cup: 0, name: 'Don Barrilote', icon: '🛢️', power: 'barrels', tip: 'Deja barriles rodando por la pista: ¡esquívalos!', kart: 'coco', color: 4, size: 1.5,
    char: { id: 'barrilote', name: 'Don Barrilote', voice: 0.55, fur: 0x7a3a1a, skin: 0xe0b080, acc: 'bandana', accColor: 0xff3b4a, stats: { speed: 4, accel: 3, handling: 3 } } },
  { id: 'magmo', cup: 1, name: 'Magmo', icon: '🌋', power: 'fire', tip: 'Deja llamas en el asfalto: ¡no las pises!', kart: 'cometa', color: 1, size: 1.5,
    char: { id: 'magmo', name: 'Magmo', voice: 0.5, fur: 0x3a1614, skin: 0xff7a3c, acc: 'mohawk', accColor: 0xffd21f, stats: { speed: 4, accel: 3, handling: 3 } } },
  { id: 'tormenta', cup: 2, name: 'Capitán Tormenta', icon: '⛈️', power: 'storm', tip: 'Lanza rayos que te encogen: un escudo te protege.', kart: 'tiburon', color: 3, size: 1.5,
    char: { id: 'tormenta', name: 'Capitán Tormenta', voice: 0.6, fur: 0x4a5a8a, skin: 0xcfe0ff, acc: 'goggles', accColor: 0xffe600, stats: { speed: 4, accel: 3, handling: 3 } } },
  { id: 'cosmo', cup: 3, name: 'Rey Cosmo', icon: '☄️', power: 'all', tip: 'Domina los trucos de todos los demás jefes.', kart: 'aurora', color: 5, size: 1.55,
    char: { id: 'cosmo', name: 'Rey Cosmo', voice: 0.48, fur: 0x2a1a5a, skin: 0xc0a0ff, acc: 'crown', accColor: 0x22e6ff, stats: { speed: 4, accel: 3, handling: 3 } } },
];

const POWERS = ['barrels', 'fire', 'storm'];

// Barril que rueda despacio hacia atrás rebotando de lado a lado
function dropBarrel(race, b) {
  const holder = new THREE.Group(), m = makeHazard('barrel');
  m.castShadow = !!race.shadows; holder.add(m); race.scene.add(holder);
  race.barrels.push({ prog: b.prog - 3.5, lat: b.lat, vlat: (Math.random() < 0.5 ? 1 : -1) * (8 + Math.random() * 6), owner: b, age: 0, holder, mesh: m, sp: -10 });
}

// Fila de llamas a lo ancho de la pista, con un hueco por el que pasar
function dropFire(race, b) {
  const tr = race.track, s = tr.samples[((b.idx - 2) % tr.N + tr.N) % tr.N], gap = Math.floor(Math.random() * 3);
  if (!race.fireMat) race.fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a1a).multiplyScalar(race.glowK * 1.5) });
  for (let k = 0; k < 3; k++) {
    if (k === gap) continue;
    const lat = (k - 1) * tr.hw * 0.62 + (Math.random() - 0.5), x = s.x + s.nx * lat, z = s.z + s.nz * lat;
    const m = new THREE.Mesh(race.peelGeo, race.fireMat); m.scale.set(1.5, 3, 1.5); m.position.set(x, s.y + 0.8, z); race.scene.add(m);
    race.peels.push({ x, z, mesh: m, owner: b, age: 0, ttl: 10 });
  }
  while (race.peels.length > 20) race.scene.remove(race.peels.shift().mesh);
}

// Se llama en cada fotograma de carrera: decide cuándo usa el jefe su truco
export function bossTick(race, dt) {
  const b = race.boss, p = race.player;
  if (race.state !== 'racing' || b.finished || b.spinT > 0) return;
  if (b.warnT > 0) { // el rayo avisa antes de caer
    b.warnT -= dt;
    if (b.warnT <= 0) { b.item = 'bolt'; b.itemCount = 1; race.useItem(b); }
    return;
  }
  b.powT = (b.powT ?? 5) - dt;
  if (b.powT > 0) return;
  const gap = b.prog - p.prog; // > 0: el jefe va por delante
  if (gap < 0) { // va detrás: lanza un coco teledirigido
    if (gap > -60) { b.item = 'coco'; b.itemCount = 1; race.useItem(b); b.powT = 7 + Math.random() * 3; } else b.powT = 2;
    return;
  }
  if (gap > 75) { b.powT = 2; return; } // demasiado lejos para molestar
  let pow = b.bossDef.power; if (pow === 'all') pow = POWERS[Math.floor(Math.random() * 3)];
  if (pow === 'barrels') { dropBarrel(race, b); b.powT = 5.5 + Math.random() * 2.5; }
  else if (pow === 'fire') { dropFire(race, b); b.powT = 5.5 + Math.random() * 2.5; }
  else { b.warnT = 1.3; race.emit('bossWarn'); b.powT = 9 + Math.random() * 3; }
  b.poundT = 0.6; race.voice(b, 'roar');
}
