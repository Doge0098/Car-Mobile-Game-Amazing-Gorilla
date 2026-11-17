// Variantes de los circuitos: hora del día (atardecer y noche) y el «Circuito sorpresa» generado al azar.
import * as THREE from './vendor/three.module.min.js';
import { TRACKS, rng } from './data.js';

const _a = new THREE.Color(), _b = new THREE.Color();
const mix = (a, b, k) => _a.set(a).lerp(_b.set(b), k).getHex();

// Devuelve el circuito con el tema cambiado a 'dusk' (atardecer) o 'night' (noche). Bajo el mar no cambia nada.
export function todDef(def, tod) {
  if (!tod || def.theme.underwater) return def;
  const th = def.theme;
  const theme = tod === 'night' ? {
    ...th, skyTop: 0x040a26, skyBottom: mix(th.skyBottom, 0x16245c, 0.85), fog: mix(th.fog, 0x0a1436, 0.8), fogNear: th.fogNear * 0.85, fogFar: th.fogFar * 0.9,
    sun: 0x9fb8ff, light: th.light * 0.52, ambientSky: mix(th.ambientSky, 0x3a50a0, 0.75), ambientGround: mix(th.ambientGround, 0x101838, 0.7),
    stars: true, cloudAmt: (th.cloudAmt ?? 0.5) * 0.6, clouds: 0x8a96c8, mountains: mix(th.mountains, 0x101a40, 0.6), night: true,
  } : {
    ...th, skyTop: 0x35287a, skyBottom: 0xff9a5a, fog: mix(th.fog, 0xff9a6a, 0.6), sun: 0xffa860, light: th.light * 0.88,
    ambientSky: mix(th.ambientSky, 0xffb080, 0.5), ambientGround: mix(th.ambientGround, 0x5a3a5a, 0.4), clouds: 0xffc8a0, mountains: mix(th.mountains, 0x6a3a6a, 0.5),
  };
  return { ...def, theme, tod };
}

// Circuito nuevo a partir de una semilla: trazado, desniveles y tramos especiales al azar, con el aspecto de uno de los mapas.
export function surpriseTrack(seed) {
  const r = rng(seed * 7919 + 17), pick = a => a[Math.floor(r() * a.length)];
  const base = pick(TRACKS.filter(t => !t.deepAll)); // el fondo marino necesita un circuito entero bajo el agua
  // planta: tres ondas, cada una con amplitud limitada para que no salgan curvas imposibles
  const k1 = 2 + Math.floor(r() * 2), k2 = k1 + 3, k3 = k2 + 3 + Math.floor(r() * 2);
  const waves = [[k1, 0.12 + r() * 0.04, r() * 6.28], [k2, (1.5 + r() * 0.6) / (k2 * k2), r() * 6.28], [k3, (2.2 + r() * 1.0) / (k3 * k3), r() * 6.28]];
  // la vuelta se reparte en seis tramos; cada uno lleva una cosa distinta (uno queda libre para atajos y bifurcaciones)
  const kinds = ['boat', 'glide', 'sub', 'tunnel', 'bridge', 'plain'];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const def = {
    id: 'sorpresa', name: 'Circuito Sorpresa', cup: -1, hidden: true, surprise: seed, look: base.id,
    R: 305 + Math.floor(r() * 26), width: 15 + Math.round(r() * 3) / 2, waves, seed: 100 + (seed % 899),
    theme: base.theme, music: { ...base.music, seed: base.music.seed + (seed % 50) }, extras: base.extras, gravity: base.gravity,
    hills: [[0, 0]], ramps: [], forkFirst: seed % 2 === 0,
  };
  const W = 0.145;
  kinds.forEach((kind, n) => {
    const a = 0.09 + n * W, low = kind === 'boat' || kind === 'sub' || kinds[n - 1] === 'boat' || kinds[n - 1] === 'sub';
    const launch = 8 + r() * 5; // altura de despegue del vuelo: el tramo llega ya subiendo para que la rampa no sea un muro
    def.hills.push([a, kind === 'glide' ? launch - 3.5 : low ? 0.8 + r() * 0.5 : 1.5 + r() * 4.5]);
    if (kind === 'boat') def.boat = [a + 0.03, a + 0.1];
    else if (kind === 'glide') def.glide = [a + 0.035, a + 0.095, launch, 2 + r() * 2.5];
    else if (kind === 'sub') def.sub = [a + 0.01, a + 0.135, 0.036, 5.5];
    else if (kind === 'tunnel') { def.tunnel = [a + 0.03, a + 0.1]; def.ramps.push(a + 0.127); }
    else if (kind === 'bridge') def.bridge = [a + 0.035, a + 0.105];
    else def.ramps.push(a + 0.012);
  });
  def.hills.push([0.965, 0.6], [1, 0]);
  def.ramps.sort((x, y) => x - y);
  return def;
}
