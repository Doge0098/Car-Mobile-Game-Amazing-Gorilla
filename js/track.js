// Generación del circuito: trazado con desnivel, puentes, túneles, rampas, terreno y decorado.
import * as THREE from './vendor/three.module.min.js';
import { t as i18n } from './i18n.js';
import { rng } from './data.js';
import { PROPS, canvasTex, glowTex, merged } from './models.js';
import { buildScenery } from './scenery.js';
import { outlineInstanced } from './outline.js';

// circuitos en los que la bifurcación tiene preferencia sobre el atajo
const FORK_FIRST = {};
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d), cylG = (a, b, h, n = 6) => new THREE.CylinderGeometry(a, b, h, n);
// decorado propio de los mapas nuevos
const XPROPS = {
  cloudpuff: { scale: [1.2, 3.4], make: () => merged([[ico(2.2), 0xffffff, [0, 1.6, 0], [1.3, 0.8, 1]], [ico(1.6), 0xeef3ff, [2, 1.2, 0.4]], [ico(1.4), 0xeef3ff, [-1.9, 1.1, -0.3]], [ico(1.2), 0xffffff, [0.6, 2.6, -0.2]]]) },
  coral: { scale: [0.8, 2.3], tint: true, make: () => merged([
    [cylG(0.14, 0.24, 2.0), 0xffffff, [0, 1.0, 0]], [cylG(0.1, 0.16, 1.4), 0xffffff, [0.5, 1.4, 0], null, [0, 0, -0.7]], [cylG(0.1, 0.16, 1.2), 0xffffff, [-0.45, 1.2, 0.2], null, [0.3, 0, 0.8]],
    [ico(0.9), 0xfff0e0, [0.9, 0.4, -0.6], [1.2, 0.7, 1]], [ico(0.28, 0), 0xffffff, [0, 2.1, 0]], [ico(0.22, 0), 0xffffff, [0.95, 1.95, 0]]]) },
  seaweed: { scale: [0.8, 1.9], make: () => merged([[new THREE.ConeGeometry(0.16, 4.2, 5), 0x2ab56a, [0, 2.1, 0]], [new THREE.ConeGeometry(0.14, 3.2, 5), 0x35d47a, [0.5, 1.6, 0.2], null, [0, 0, -0.18]], [new THREE.ConeGeometry(0.14, 3.6, 5), 0x1f9a5a, [-0.4, 1.8, -0.3], null, [0.15, 0, 0.2]]]) },
};
const TAU = Math.PI * 2;

const LIQUID_VS = `varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const LIQUID_FS = `uniform float uTime; uniform vec3 uColor; uniform vec3 uColor2; uniform float uMode; uniform float uGlow;
uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uSunCol; uniform sampler2D uHeight; uniform vec3 uHInfo;
varying vec3 vW;
#include <fog_pars_fragment>
vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
vec2 voro(vec2 x, float t){ vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 o = hash2(n + g);
    o = 0.5 + 0.4 * sin(t + 6.2831 * o); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; } }
  return vec2(d1, d2 - d1); }
float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), f.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), f.x), f.y); }
#define WAVE(dx, dz, fr, sp, am) { float ph = dot(p, vec2(dx, dz)) * fr + uTime * sp; hgt += am * sin(ph); g += vec2(dx, dz) * (fr * am * cos(ph)); }
void main(){
  vec2 p = vW.xz; vec3 col; float alpha = 1.0;
  if (uMode > 4.5) {
    // vacío estelar: nebulosa suave y estrellas que titilan
    float n = vnoise(p * 0.012 + uTime * 0.01) * 0.6 + vnoise(p * 0.045 - uTime * 0.015) * 0.4;
    col = mix(uColor2, uColor, smoothstep(0.35, 0.9, n) * 0.55);
    vec2 sc = floor(p * 0.3), sf = fract(p * 0.3) - 0.5; float sh = hash1(sc);
    float st = step(0.8, sh) * smoothstep(0.2, 0.0, length(sf + (hash2(sc) - 0.5) * 0.55)) * (0.55 + 0.45 * sin(uTime * (1.5 + sh * 4.0) + sh * 40.0));
    col += vec3(0.85, 0.93, 1.0) * st * uGlow;
  } else if (uMode > 3.5) {
    // mar de nubes
    float n = vnoise(p * 0.02 + uTime * 0.02) * 0.6 + vnoise(p * 0.06 - uTime * 0.03) * 0.3 + vnoise(p * 0.17 + uTime * 0.05) * 0.1;
    col = mix(uColor2, uColor, smoothstep(0.3, 0.7, n)) + smoothstep(0.62, 0.9, n) * 0.12;
  } else if (uMode < 0.5 || uMode > 2.5) {
    // agua: olas, reflejo del cielo, destellos de sol, fondo visible en la orilla y espuma
    vec2 g = vec2(0.0); float hgt = 0.0;
    WAVE(0.8, 0.6, 0.11, 1.1, 0.5) WAVE(-0.5, 0.86, 0.19, 1.6, 0.3) WAVE(0.2, -0.98, 0.37, 2.3, 0.14) WAVE(-0.92, -0.38, 0.71, 3.1, 0.07)
    float rip = vnoise(p * 0.9 + uTime * vec2(0.4, 0.25)) - 0.5;
    vec3 n = normalize(vec3(-g.x - rip * 0.25, 1.0, -g.y + rip * 0.25));
    vec3 V = normalize(cameraPosition - vW);
    float th = texture2D(uHeight, (p + uHInfo.x * 0.5) / uHInfo.x * uHInfo.y + uHInfo.z).r;
    float depth = max(vW.y - th, 0.0);
    if (!gl_FrontFacing) {
      float c2 = 0.5 + 0.5 * sin(hgt * 3.0 + rip * 6.0);
      col = mix(uColor * 0.9, vec3(0.85, 0.97, 1.0), smoothstep(0.55, 1.0, c2) * 0.6); alpha = 0.92;
    } else {
      float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
      col = mix(uColor * 1.15 + 0.08, uColor2, smoothstep(0.0, 7.0, depth));
      col *= 0.9 + 0.16 * hgt;
      col = mix(col, uSky, clamp(fres, 0.0, 1.0) * 0.45);
      float spec = pow(max(dot(n, normalize(V + uSun)), 0.0), 140.0);
      col += uSunCol * spec * 1.6 * uGlow;
      col += smoothstep(0.3, 0.75, hgt + rip * 0.6) * 0.13;
      float edge = depth - 0.25 - 0.18 * sin(uTime * 1.4 + p.x * 0.21 + p.y * 0.17);
      float foam = smoothstep(0.55, 0.0, edge) * (0.55 + 0.45 * vnoise(p * 1.3 + uTime * 0.5));
      float foam2 = smoothstep(0.14, 0.0, abs(edge - 1.3)) * 0.45;
      col = mix(col, vec3(1.0), clamp(foam + foam2, 0.0, 1.0) * 0.9);
      alpha = max(mix(0.5, 0.97, smoothstep(0.0, 2.2, depth)), clamp(foam, 0.0, 1.0));
      if (uMode > 2.5) { vec2 v = voro(p * 0.5, uTime * 2.0); col += pow(max(0.0, 1.0 - v.x * 3.0), 4.0) * uGlow; }
    }
  } else if (uMode < 1.5) {
    vec2 v = voro(p * 0.045 + vec2(uTime * 0.02, -uTime * 0.015), uTime * 0.35);
    float crack = smoothstep(0.17, 0.0, v.y);
    float pulse = 0.75 + 0.25 * sin(uTime * 1.7 + v.x * 6.0);
    vec3 crust = mix(uColor2, uColor * 0.5, v.x);
    col = mix(crust, uColor * uGlow * pulse + vec3(0.9, 0.55, 0.08) * crack * uGlow * 0.6, crack * 0.85 + 0.12);
  } else {
    vec2 g = abs(fract(p * 0.05 + vec2(0.0, uTime * 0.12)) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + p.x * 0.02 + p.y * 0.02);
    col = uColor2 + uColor * line * uGlow * pulse;
  }
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

// cielo: degradado, sol con halo y nubes pintadas con sombreado por bandas
export const SKY_FS = `uniform vec3 top; uniform vec3 bottom; uniform float dim; uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol;
uniform vec3 uCloud; uniform vec3 uCloudShade; uniform float uCloudAmt; varying vec3 vP;
float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), f.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
void main(){ vec3 d = normalize(vP);
  float h = clamp(d.y * 1.6 + 0.08, 0.0, 1.0); h = pow(h, 0.7);
  vec3 col = mix(bottom, top, h);
  col += bottom * pow(1.0 - clamp(d.y, 0.0, 1.0), 10.0) * 0.18;
  float sd = max(dot(d, uSun), 0.0);
  col += uSunCol * (smoothstep(0.9975, 0.9988, sd) * 1.6 + pow(sd, 24.0) * 0.28 + pow(sd, 4.0) * 0.08);
  #ifdef CLOUDS
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.22) * 1.15 + uTime * vec2(0.006, 0.003);
    float n = fbm(uv * 1.5);
    float c = smoothstep(0.62 - uCloudAmt * 0.3, 0.78 - uCloudAmt * 0.2, n) * smoothstep(0.0, 0.2, d.y);
    float lit = clamp((n - fbm(uv * 1.5 + uSun.xz * 0.09)) * 5.0 + 0.62, 0.0, 1.0);
    lit = floor(lit * 3.0 + 0.5) / 3.0;
    col = mix(col, mix(uCloudShade, uCloud, lit) + uSunCol * pow(sd, 8.0) * 0.15, c * 0.92);
  }
  #endif
  gl_FragColor = vec4(col * dim, 1.0);
  #include <colorspace_fragment>
}`;

export function buildTrack(def, opts = {}) {
  const quality = opts.quality ?? 1, bloom = !!opts.bloom, shadows = !!opts.shadows, variant = opts.variant || null; // variant: 'mirror' | 'reverse'
  const th = def.theme, ex = def.extras, rand = rng(def.seed);
  const B = k => (bloom ? k : 1); // refuerzo de brillo: solo con resplandor activo
  const group = new THREE.Group();
  const disposables = [];
  const own = o => { disposables.push(o); return o; };
  const uTime = { value: 0 };

  // ---- Línea central (planta) ----
  const ctrl = [];
  const M = 140;
  for (let i = 0; i < M; i++) {
    const a = i / M * TAU;
    let r = 1;
    for (const [k, amp, ph] of def.waves) r += amp * Math.sin(k * (variant === 'reverse' ? -a : a) + ph);
    ctrl.push(new THREE.Vector3(Math.cos(a) * def.R * r, 0, Math.sin(a) * def.R * r * (variant ? -1 : 1)));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const length = curve.getLength();
  const N = Math.round(length / 3);
  const pts = curve.getSpacedPoints(N); pts.pop();
  const hw = def.width / 2, spacing = length / N;
  const fIdx = u => ((Math.floor(u * N) % N) + N) % N;
  // tramos especiales: cada tipo admite un rango o una lista de rangos
  const asList = r => (!r ? [] : Array.isArray(r[0]) ? r : [r]);
  const idxR = r => [fIdx(r[0]), fIdx(r[1])];
  const boats = asList(def.boat), glides = asList(def.glide), subs = asList(def.sub);
  const tunR = def.tunnel ? idxR(def.tunnel) : null, brR = def.bridge ? idxR(def.bridge) : null;
  const boatRs = boats.map(idxR), glRs = glides.map(idxR), subRs = subs.map(idxR);
  // factor de zona: 1 dentro del tramo y transición suave de E muestras fuera
  const zoneK1 = (i, r, E) => {
    if (!r) return 0;
    if (i >= r[0] && i <= r[1]) return 1;
    let d = i < r[0] ? r[0] - i : i - r[1]; d = Math.min(d, N - d);
    return 1 - smooth(0, E, d);
  };
  const zoneK = (i, rs, E) => { let k = 0; for (const r of rs) k = Math.max(k, zoneK1(i, r, E)); return k; };
  const inList = (i, rs) => rs.findIndex(r => i >= r[0] && i <= r[1]);
  // perfil de alturas: puntos de control unidos con una curva suave (pendiente cero en cada punto)
  const WL = th.liquidLevel + 0.12;
  const cps = (def.hills || [[0, 0], [1, 0]]).map(q => q.slice());
  for (const r of boats) cps.push([r[0] - 0.012, 0.6], [r[0], WL], [r[1], WL], [r[1] + 0.015, 0.6]);
  for (const r of glides) cps.push([r[0], r[2]], [r[1], r[3]]);
  for (const r of subs) cps.push([r[0], 1.0], [r[0] + r[2], th.liquidLevel - r[3]], [r[1] - r[2], th.liquidLevel - r[3]], [r[1], 1.0]);
  cps.sort((q, r) => q[0] - r[0]);
  const profile = u => {
    let k = 0; while (k < cps.length - 2 && u > cps[k + 1][0]) k++;
    const [u0, y0] = cps[k], [u1, y1] = cps[k + 1], t = Math.max(0, Math.min(1, (u - u0) / (u1 - u0 || 1)));
    return y0 + (y1 - y0) * (1 - Math.cos(Math.PI * t)) / 2;
  };

  const samples = [];
  for (let i = 0; i < N; i++) {
    const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    const u = i / N;
    let y = profile(u);
    if (brR && i >= brR[0] && i <= brR[1]) y += 4.5 * Math.sin(Math.PI * (i - brR[0]) / (brR[1] - brR[0])) ** 2;
    const kt = zoneK1(i, tunR, 8), kb = zoneK1(i, brR, 8), kw = zoneK(i, boatRs, 8), kg = zoneK(i, glRs, 6);
    const inBoat = inList(i, boatRs) >= 0, gi = inList(i, glRs), inSub = inList(i, subRs) >= 0 || def.deepAll;
    let air = 0;
    if (gi >= 0) { const r = glRs[gi], gl = glides[gi], t = (i - r[0]) / (r[1] - r[0]); air = Math.max(0, gl[2] + (gl[3] - gl[2]) * t + 7 * Math.sin(Math.PI * t) - y); }
    samples.push({
      x: pts[i].x, z: pts[i].z, y, tx, tz, nx: tz, nz: -tx, h: Math.atan2(tx, tz), curv: 0, slope: 0,
      kt, kb, kbT: zoneK1(i, brR, 16), tun: !!(tunR && i >= tunR[0] && i <= tunR[1]),
      // modo de vehículo del tramo, hueco sin carretera, altura de vuelo y excavado del terreno
      zone: inBoat ? 'boat' : gi >= 0 ? 'glide' : (inSub && y < th.liquidLevel - 1.2) ? 'sub' : null,
      noRoad: inBoat || gi >= 0, air, kz: Math.max(kw, kg, zoneK(i, subRs, 4)), cur: 0, curL: 0,
      carve: Math.max(zoneK1(i, brR, 16), zoneK(i, boatRs, 16), zoneK(i, glRs, 16)), deep: def.deepAll ? 1 : zoneK(i, subRs, 10),
      lim: hw + 8 - 5.6 * kt - 7.5 * kb - 5 * kw - 3 * kg,
    });
  }
  let maxCurv = 0;
  for (let i = 0; i < N; i++) {
    const a = samples[(i + N - 2) % N], b = samples[(i + 2) % N];
    let d = b.h - a.h; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    samples[i].curv = d / (4 * spacing); // >0 gira a la izquierda
    samples[i].slope = (samples[(i + 1) % N].y - samples[(i + N - 1) % N].y) / (2 * spacing);
    maxCurv = Math.max(maxCurv, Math.abs(samples[i].curv));
  }
  const special = s => s.kt > 0.02 || s.kb > 0.02 || s.kz > 0.02; // túnel, puente, tramos especiales o sus embudos
  const rampIdx = (def.ramps || []).map(fIdx);
  const nearRamp = i => rampIdx.some(r => { let d = Math.abs(i - r); d = Math.min(d, N - d); return d < 22; });

  // ---- Dónde cabe una bifurcación: una curva de carretera normal (puede tener una rampa en medio: el carril la esquiva) ----
  // El atajo y la bifurcación compiten por las pocas curvas libres; en los circuitos de FORK_FIRST elige primero la bifurcación.
  const FORK_LEN = 50, forkFirst = def.forkFirst ?? !!FORK_FIRST[def.id] ?? false;
  let shortcut = null, forkWin = null;
  const findFork = () => {
    if (def.noFork || def.deepAll) return null;
    let best = 0, bi = -1, bs = 1;
    for (let i = 40; i < N - FORK_LEN - 12; i += 2) { // (lejos de la salida y sus gradas)
      if (shortcut && i - 14 < shortcut.i1 && i + FORK_LEN + 14 > shortcut.i0) continue; // sin pisar el atajo
      let ok = true;
      for (let k = -6; k <= FORK_LEN + 6 && ok; k += 2) { const q = samples[i + k]; if (special(q) || q.tun) ok = false; } // las rampas no estorban: el carril pasa por su lado
      if (!ok) continue;
      let turn = 0; for (let k = 0; k < FORK_LEN; k += 2) turn += samples[i + k].curv;
      if (Math.abs(turn) > best) { best = Math.abs(turn); bi = i; bs = turn > 0 ? 1 : -1; }
    }
    return bi >= 0 && best > 0.05 ? { bi, bs } : null;
  };
  if (forkFirst) forkWin = findFork();

  // ---- Atajo: un trampolín en el arcén interior que lanza el coche por encima de la curva ----
  if (!def.noShortcut && !def.deepAll) { // (bajo el mar no hay trampolines)
    // se busca la curva libre (sin túnel, puente, agua ni rampas) donde más se ahorra; primero con saltos largos
    let span = 0, best = 0, bi = -1;
    for (const sp of [64, 52, 40, 30]) {
      let b = 0, at = -1;
      for (let i = 50; i < N - sp - 24; i += 2) {
        if (forkWin && i - 14 < forkWin.bi + FORK_LEN && i + sp + 14 > forkWin.bi) continue; // sin pisar la bifurcación
        // el despegue y el aterrizaje deben estar en carretera normal; por el aire se puede pasar sobre rampas y puentes,
        // pero no sobre túneles ni tramos de barco, vuelo o submarino
        let ok = true;
        for (let k = -8; k <= sp + 8 && ok; k += 4) {
          const q = samples[i + k], edge = k <= 8 || k >= sp - 8;
          if (q.tun || q.kt > 0.02 || q.kz > 0.02 || (edge && (special(q) || nearRamp(i + k)))) ok = false;
        }
        if (!ok) continue;
        const a0 = samples[i], b0 = samples[i + sp], save = sp * spacing - Math.hypot(b0.x - a0.x, b0.z - a0.z);
        let turn = 0; for (let k = 0; k < sp; k += 4) turn += samples[i + k].curv;
        if (save > b && Math.abs(turn) > 0.02) { b = save; at = i; }
      }
      if (b > best) { best = b; bi = at; span = sp; }
      if (best > 9) break;
    }
    if (bi >= 0 && best > 1) {
      let turn = 0; for (let k = 0; k < span; k += 4) turn += samples[bi + k].curv;
      const side = turn > 0 ? 1 : -1, a0 = samples[bi], b0 = samples[bi + span];
      shortcut = { i0: bi, i1: bi + span, side, lat: side * (hw + 4.6), ex: a0.x + a0.nx * side * (hw + 4.6), ez: a0.z + a0.nz * side * (hw + 4.6), ey: a0.y,
        lx: b0.x + b0.nx * side * (hw - 3), lz: b0.z + b0.nz * side * (hw - 3), ly: b0.y, lh: b0.h, llat: side * (hw - 3) };
      const pad = new THREE.Group(); pad.position.set(shortcut.ex, a0.y, shortcut.ez); pad.rotation.y = Math.atan2(shortcut.lx - shortcut.ex, shortcut.lz - shortcut.ez);
      // plataforma con muelle bajo un arco con cartel, y flechas en el arcén que llevan hasta ella
      const pm = new THREE.Mesh(own(merged([[cylG(2.6, 3.0, 0.5, 14), 0x2a2238, [0, 0.25, 0]], [cylG(0.16, 0.2, 6.4, 6), 0xf0f0f0, [-3.5, 3.2, 0]], [cylG(0.16, 0.2, 6.4, 6), 0xf0f0f0, [3.5, 3.2, 0]],
        [new THREE.BoxGeometry(7.4, 1.8, 0.24), 0x1a0b3a, [0, 5.7, 0]]])), own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
      pm.castShadow = shadows;
      const glow = new THREE.Mesh(own(cylG(2.2, 2.2, 0.12, 14)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x35e08a).multiplyScalar(B(2)) }))); glow.position.y = 0.56;
      const signT = own(canvasTex(256, 56, (c) => { c.fillStyle = '#35e08a'; c.fillRect(0, 0, 256, 56); c.fillStyle = '#1a0b3a'; c.font = 'italic 900 38px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(i18n('ATAJO') + ' »', 128, 30); }));
      const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(7, 1.5)), own(new THREE.MeshBasicMaterial({ map: signT, side: THREE.DoubleSide }))); sign.position.set(0, 5.7, -0.14); sign.rotation.y = Math.PI;
      const arrows = [];
      for (let k = 1; k <= 3; k++) {
        const q = samples[bi - k * 5], lat = side * (hw + 4.6 - k * 0.9), nxt = samples[bi - (k - 1) * 5], nl = side * (hw + 4.6 - (k - 1) * 0.9);
        const ax = q.x + q.nx * lat, az = q.z + q.nz * lat, hd = Math.atan2(nxt.x + nxt.nx * nl - ax, nxt.z + nxt.nz * nl - az);
        arrows.push([new THREE.ConeGeometry(1.25, 2.6, 3), 0xffffff, [ax, q.y + 0.14, az], [1, 1, 0.06], [Math.PI / 2, 0, -hd]]);
      }
      const am = new THREE.Mesh(own(merged(arrows)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x35e08a).multiplyScalar(B(1.8)) }))); group.add(am);
      pad.add(pm, glow, sign); group.add(pad); shortcut.glow = glow;
    }
  }

  let nearI = 0;
  // ---- Bifurcación: un carril estrecho que se separa por el interior de una curva y vuelve a unirse ----
  let fork = null;
  {
    if (!forkFirst) forkWin = findFork();
    if (forkWin) {
      const len = FORK_LEN, bi = forkWin.bi, bs = forkWin.bs;
      const fwid = 2.7, off = hw + 5.2, pos = [], uv = [], idx = [], cones = [];
      for (let j = 0; j <= len; j++) {
        const q = samples[bi + j], u = j / len, k = smooth(0, 0.24, u) * (1 - smooth(0.76, 1, u)), c = bs * off * k;
        q.fk = c; q.fw = fwid;
        pos.push(q.x + q.nx * (c + fwid), q.y + 0.05, q.z + q.nz * (c + fwid), q.x + q.nx * (c - fwid), q.y + 0.05, q.z + q.nz * (c - fwid));
        uv.push(0, j * 0.14, 1, j * 0.14);
        if (j < len) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        // conos en la mediana que separa los dos carriles
        if (k > 0.8 && j % 3 === 0) { const m = bs * (hw + 1.3); cones.push([new THREE.ConeGeometry(0.4, 1.0, 6), (j / 3) % 2 ? 0xffffff : 0xff7a1a, [q.x + q.nx * m, q.y + 0.5, q.z + q.nz * m]]); }
      }
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      // cartel de dos flechas donde se separan
      const q0 = samples[bi + 9], m0 = bs * (hw + 1.3), sx = q0.x + q0.nx * m0, sz = q0.z + q0.nz * m0;
      cones.push([cylG(0.09, 0.09, 3.2, 5), 0xf0f0f0, [sx, q0.y + 1.6, sz]]);
      const cm = new THREE.Mesh(own(merged(cones)), own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))); cm.castShadow = shadows; group.add(cm);
      const st = own(canvasTex(128, 56, (c) => { c.fillStyle = '#ffd21f'; c.fillRect(0, 0, 128, 56); c.fillStyle = '#1a0b3a'; c.font = '900 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('◀ ▶', 64, 30); }));
      const sg = new THREE.Mesh(own(new THREE.PlaneGeometry(3.2, 1.4)), own(new THREE.MeshBasicMaterial({ map: st, side: THREE.DoubleSide }))); sg.position.set(sx, q0.y + 3.2, sz); sg.rotation.y = q0.h + Math.PI; group.add(sg);
      fork = { i0: bi, i1: bi + len, side: bs, geo: g }; // la malla del carril se crea más abajo, con la textura de la carretera
    }
  }

  const distToTrack = (x, z, stride = 3) => {
    let best = 1e12;
    for (let i = 0; i < N; i += stride) { const s = samples[i], dx = x - s.x, dz = z - s.z, d = dx * dx + dz * dz; if (d < best) { best = d; nearI = i; } }
    return Math.sqrt(best);
  };

  // ---- Carretera ----
  const roadTex = own(canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = th.road; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.07})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    c.fillStyle = th.line;
    c.fillRect(8, 0, 7, h); c.fillRect(w - 15, 0, 7, h);
    c.globalAlpha = 0.85; c.fillRect(w / 2 - 4, 0, 8, h * 0.5);
    if (th.rainbow) { c.globalAlpha = 0.5; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 0, 7); c.fill(); } }
  }, true));
  const unlitRoad = !!(th.neon || th.rainbow);
  {
    const pos = [], uv = [], col = [], idx = [];
    const vRep = Math.round(length / 22), c = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const s = samples[i % N];
      pos.push(s.x + s.nx * hw, s.y, s.z + s.nz * hw, s.x - s.nx * hw, s.y, s.z - s.nz * hw);
      const v = i / N * vRep; uv.push(0, v, 1, v);
      if (th.rainbow) c.setHSL((i / N * 5) % 1, 0.9, 0.62); else c.setRGB(1, 1, 1);
      const k = th.neon ? B(1.7) : 1;
      col.push(c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k);
      if (i < N && !(s.noRoad && samples[(i + 1) % N].noRoad)) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mat = own(unlitRoad
      ? new THREE.MeshBasicMaterial({ map: roadTex, vertexColors: true })
      : new THREE.MeshLambertMaterial({ map: roadTex, vertexColors: true }));
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m);
    if (fork) { const fm = new THREE.Mesh(fork.geo, own(new THREE.MeshLambertMaterial({ map: roadTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))); fm.receiveShadow = true; group.add(fm); }
  }
  // ---- Pianos, arcenes y barreras ----
  const deckC = new THREE.Color(ex.deck), gC1 = new THREE.Color(th.ground), gC2 = new THREE.Color(th.ground2), tunC = new THREE.Color(ex.tunnelCol).multiplyScalar(0.55);
  {
    const pos = [], col = [], ca = new THREE.Color(th.curbA), cb = new THREE.Color(th.curbB), cw = 1.4;
    const bpos = [], bcol = [];
    const kC = th.neon ? B(1.6) : 1;
    for (let i = 0; i < N; i++) {
      const s = samples[i], e = samples[(i + 1) % N], c = (i >> 1) % 2 ? ca : cb;
      if (s.noRoad && e.noRoad) continue;
      for (const side of [1, -1]) {
        const i0 = hw * side, i1 = (hw + cw) * side;
        const p = [s.x + s.nx * i0, s.z + s.nz * i0, s.x + s.nx * i1, s.z + s.nz * i1, e.x + e.nx * i0, e.z + e.nz * i0, e.x + e.nx * i1, e.z + e.nz * i1];
        for (const k of [0, 2, 1, 1, 2, 3]) { pos.push(p[k * 2], (k < 2 ? s.y : e.y) + (k % 2 ? 0.1 : 0.03), p[k * 2 + 1]); col.push(c.r * kC, c.g * kC, c.b * kC); }
        // barrera / barandilla donde el borde se estrecha
        if (s.lim < hw + 7.6 && !s.tun && !e.tun && !s.noRoad && !e.noRoad) {
          const l0 = (s.lim + 1.4) * side, l1 = (e.lim + 1.4) * side;
          const q = [s.x + s.nx * l0, s.y, s.z + s.nz * l0, e.x + e.nx * l1, e.y, e.z + e.nz * l1];
          const cc = (i >> 1) % 2 ? ca : cb;
          for (const [a, top] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]) { bpos.push(q[a * 3], q[a * 3 + 1] + (top ? 1.15 : -0.1), q[a * 3 + 2]); bcol.push(cc.r * kC, cc.g * kC, cc.b * kC); }
        }
      }
    }
    const mk = (P, Cc) => {
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
      g.computeVertexNormals();
      const mat = own(th.neon ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m); return m;
    };
    mk(pos, col);
    if (bpos.length) mk(bpos, bcol).castShadow = shadows;
  }
  {
    // arcén a la altura de la carretera + faldón que baja hasta el terreno
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const s = samples[i % N], kb = s.kb;
      const a = hw + 1.4, b = Math.max(a + 0.4, s.lim + 3 - 1.3 * kb), cOut = b + 6 * (1 - kb) + 0.05, down = 4.6 - 3 * kb;
      c.copy(gC1).lerp(gC2, (Math.sin(i * 0.7) * 0.5 + 0.5) * 0.6 + rand() * 0.25).lerp(deckC, kb).lerp(tunC, s.kt);
      for (const side of [1, -1]) {
        for (const [lat, dy, sh] of [[a, -0.02, 1], [b, -0.02, 1], [cOut, -down, 0.72]]) {
          pos.push(s.x + s.nx * lat * side, s.y + dy, s.z + s.nz * lat * side); col.push(c.r * sh, c.g * sh, c.b * sh);
        }
      }
      if (i < N && !(s.noRoad && samples[(i + 1) % N].noRoad)) for (const o of [0, 3]) for (const j of [0, 1]) {
        const v = i * 6 + o + j, w = v + 6; idx.push(v, v + 1, w, v + 1, w + 1, w);
      }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, own(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    m.receiveShadow = true; group.add(m);
  }

  // ---- Terreno ----
  const ph = [rand() * 6, rand() * 6, rand() * 6, rand() * 6];
  const nz = (x, z) => Math.sin(x * 0.011 + ph[0]) * Math.cos(z * 0.013 + ph[1]) * 0.6
    + Math.sin(x * 0.027 + z * 0.021 + ph[2]) * 0.28 + Math.cos(z * 0.05 - x * 0.04 + ph[3]) * 0.12;
  let lastD = 0;
  const terrainH = (x, z, stride = 2) => {
    const d = lastD = distToTrack(x, z, stride), s = samples[nearI], cz = Math.max(s.carve, s.deep);
    let near = s.y - 0.9; near += (th.liquidLevel - 3.5 - near) * s.carve;
    let far = s.y * 0.55 + nz(x, z) * th.hills + th.hills * 0.22;
    if (cz > 0) far += (Math.min(far, th.liquidLevel - (s.deep > s.carve ? 5 : 2.5)) - far) * cz * (1 - smooth(70, 170, d));
    return near + (far - near) * smooth(hw + 17, hw + 85, d);
  };
  const tSize = 1900, tSeg = quality > 1.1 ? 190 : quality > 0.7 ? 150 : 100;
  let heightTex;
  {
    const g = own(new THREE.PlaneGeometry(tSize, tSize, tSeg, tSeg));
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3), hdata = new Uint16Array(P.count);
    for (let i = 0; i < P.count; i++) { const y = terrainH(P.getX(i), P.getZ(i)); P.setY(i, y); hdata[i] = THREE.DataUtils.toHalfFloat(y); }
    g.computeVertexNormals();
    // mapa de alturas para que el agua sepa su profundidad (orillas, espuma)
    heightTex = own(new THREE.DataTexture(hdata, tSeg + 1, tSeg + 1, THREE.RedFormat, THREE.HalfFloatType));
    heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
    const Nn = g.attributes.normal, c = new THREE.Color(), L = th.liquidLevel;
    const shoreC = new THREE.Color(th.shore ?? 0xe8d79a), rockC = new THREE.Color(th.rock ?? 0x8a8f7a), peakC = new THREE.Color(th.peak ?? th.ground);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), y = P.getY(i), steep = smooth(0.93, 0.74, Nn.getY(i));
      const n = nz(x * 2.3 + 40, z * 2.3 - 17) * 0.5 + 0.5;
      c.copy(gC1).lerp(gC2, Math.max(0, Math.min(1, n * 0.9 + (rand() - 0.5) * 0.25)));
      c.lerp(peakC, smooth(th.hills * 0.7, th.hills * 1.25, y) * 0.9).lerp(rockC, steep * 0.75).lerp(shoreC, smooth(2.4, 0.4, y - L));
      const dk = 1 - smooth(0, 9, L - y) * 0.4;
      col[i * 3] = c.r * dk; col[i * 3 + 1] = c.g * dk; col[i * 3 + 2] = c.b * dk;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // textura de detalle: manchas suaves que rompen el color liso
    const detail = own(canvasTex(128, 128, (cx, w, h) => {
      cx.fillStyle = '#f2f2f2'; cx.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { const r = 5 + Math.random() * 16, x = Math.random() * w, y = Math.random() * h; cx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.07)';
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { cx.beginPath(); cx.arc(x + ox, y + oy, r, 0, 7); cx.fill(); } }
      for (let i = 0; i < 260; i++) { cx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.06})`; cx.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 3); }
    }, true));
    detail.repeat.set(64, 64);
    const m = new THREE.Mesh(g, own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: detail })));
    m.receiveShadow = true; group.add(m);
  }
  // pilares del puente
  if (brR) {
    const parts = [], dk = deckC.clone().multiplyScalar(0.7).getHex();
    for (let i = brR[0] - 12; i <= brR[1] + 12; i += 7) {
      const s = samples[((i % N) + N) % N]; if (s.kbT < 0.5) continue;
      const bottom = th.liquidLevel - 5, hgt = s.y - 1.5 - bottom;
      for (const side of [1, -1]) parts.push([new THREE.BoxGeometry(2, hgt, 2), dk, [s.x + s.nx * (hw - 0.5) * side, bottom + hgt / 2, s.z + s.nz * (hw - 0.5) * side], null, [0, s.h, 0]]);
      parts.push([new THREE.BoxGeometry(def.width + 3.4, 1.4, 2.4), dk, [s.x, s.y - 2.2, s.z], null, [0, s.h, 0]]);
    }
    if (parts.length) {
      const m = new THREE.Mesh(own(merged(parts)), own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
      m.castShadow = shadows; group.add(m);
    }
  }

  // ---- Agua / lava / líquido animado ----
  const sunDir = new THREE.Vector3(0.7, 0.62, 0.5).normalize();
  const lc = new THREE.Color(th.liquid), lc2 = lc.clone();
  if (ex.liquidMode === 1) lc2.set(0x2a0c10); else if (ex.liquidMode === 2) lc2.set(0x0a0624); else if (ex.liquidMode === 4) lc2.set(0xc9d8ff); else if (ex.liquidMode === 5) lc2.set(0x05030f); else lc2.offsetHSL(0.02, 0.05, -0.2);
  const isWater = !ex.liquidMode || ex.liquidMode === 3;
  const liquidMat = own(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uColor: { value: lc }, uColor2: { value: lc2 }, uMode: { value: ex.liquidMode || 0 },
      uGlow: { value: th.liquidGlow ? B(1.9) : 1 },
      uSky: { value: new THREE.Color(th.skyBottom).lerp(new THREE.Color(th.skyTop), 0.35) }, uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(th.sun) },
      uHeight: { value: null }, uHInfo: { value: new THREE.Vector3(tSize, tSeg / (tSeg + 1), 0.5 / (tSeg + 1)) },
    }]),
    vertexShader: LIQUID_VS, fragmentShader: LIQUID_FS, fog: true, side: THREE.DoubleSide, transparent: isWater,
  }));
  liquidMat.uniforms.uHeight.value = heightTex;
  const liquid = new THREE.Mesh(own(new THREE.CircleGeometry(1150, 40)), liquidMat);
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = th.liquidLevel; liquid.renderOrder = -1;
  group.add(liquid);

  // ---- Cielo ----
  const cloudC = new THREE.Color(th.clouds);
  const skyMat = own(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, defines: quality > 0.6 && !th.space ? { CLOUDS: 1 } : {},
    uniforms: {
      top: { value: new THREE.Color(th.skyTop) }, bottom: { value: new THREE.Color(th.skyBottom) }, dim: { value: 1 }, uTime: { value: 0 },
      uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(th.sun).multiplyScalar(B(1.4)) },
      uCloud: { value: cloudC }, uCloudShade: { value: cloudC.clone().lerp(new THREE.Color(th.skyTop), 0.42) }, uCloudAmt: { value: th.cloudAmt ?? 0.5 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: SKY_FS,
  }));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(1500, 24, 14)), skyMat);
  sky.renderOrder = -10; group.add(sky);
  const sunMat = own(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(th.sun).multiplyScalar(B(1.2)), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const sun = new THREE.Sprite(sunMat); sun.scale.set(300, 300, 1); sun.position.copy(sunDir).multiplyScalar(1100); sky.add(sun);

  // nubes cercanas con volumen (más claras por arriba; en el espacio no hay)
  if (!th.space) {
    const g = own(new THREE.IcosahedronGeometry(1, 1)), P = g.attributes.position, cc = new Float32Array(P.count * 3);
    const shade = cloudC.clone().lerp(new THREE.Color(th.skyTop), 0.45), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) { c.copy(shade).lerp(cloudC, smooth(-0.5, 0.6, P.getY(i))); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const mat = own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    const count = 45, im = new THREE.InstancedMesh(g, mat, count), o = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < count / 3; i++) {
      const a = rand() * TAU, r = 460 + rand() * 560, y = 210 + rand() * 170, s = 30 + rand() * 34;
      for (let j = 0; j < 3; j++) {
        o.position.set(Math.cos(a) * r + (j - 1) * s * 1.1, y + (j === 1 ? s * 0.22 : 0), Math.sin(a) * r + (j - 1) * 9);
        const k = j === 1 ? 1.25 : 0.9; o.scale.set(s * 1.4 * k, s * 0.55 * k, s * k); o.updateMatrix(); im.setMatrixAt(n++, o.matrix);
      }
    }
    im.frustumCulled = false; group.add(im);
  }
  let farMesh = null;
  if (th.stars) {
    const pos = [];
    for (let i = 0; i < 500; i++) {
      const a = rand() * TAU, e = 0.1 + rand() * 1.4;
      pos.push(Math.cos(a) * Math.cos(e) * 1400, Math.sin(e) * 1400, Math.sin(a) * Math.cos(e) * 1400);
    }
    const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = own(new THREE.PointsMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(B(1.6)), size: 3.2, sizeAttenuation: false, fog: false, map: glowTex(), transparent: true, depthWrite: false }));
    sky.add(new THREE.Points(g, mat));
  }
  {
    // montañas en tres cordilleras con relieve iluminado: base difuminada, ladera y cumbre
    const pos = [], col = [];
    const base = new THREE.Color(th.mountains), fogC = new THREE.Color(th.fog), peak = new THREE.Color(th.peak ?? 0xffffff), c = new THREE.Color(), v = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (const [R, count, hMin, hMax, haze] of [[930, 22, 110, 230, 0.18], [1120, 20, 190, 360, 0.36], [1330, 16, 280, 480, 0.55]]) {
      for (let i = 0; i < count; i++) {
        const a = (i + rand() * 0.8) / count * TAU, r = R + rand() * 90, h = hMin + rand() * (hMax - hMin), w = h * (0.75 + rand() * 0.5);
        const g = new THREE.ConeGeometry(w, h, 6 + Math.floor(rand() * 3), 3).toNonIndexed(), P = g.attributes.position;
        q.setFromAxisAngle(up, rand() * TAU);
        for (let k = 0; k < P.count; k++) {
          v.fromBufferAttribute(P, k); const t = v.y / h + 0.5;
          v.x *= 1 + (rand() - 0.5) * 0.12; v.z *= 1 + (rand() - 0.5) * 0.12; v.applyQuaternion(q);
          pos.push(Math.cos(a) * r + v.x, v.y + h / 2 - 34, Math.sin(a) * r + v.z);
          c.copy(base).lerp(peak, smooth(0.62, 0.8, t)).lerp(fogC, Math.max(haze, smooth(0.3, 0.0, t)));
          col.push(c.r, c.g, c.b);
        }
        g.dispose();
      }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    farMesh = new THREE.Mesh(g, own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false })));
    group.add(farMesh);
  }

  // ---- Luces, sombras y niebla ----
  const hemi = new THREE.HemisphereLight(th.ambientSky, th.ambientGround, 1.12 * th.light);
  const dir = new THREE.DirectionalLight(th.sun, 1.95 * th.light); dir.position.copy(sunDir);
  group.add(hemi, dir, dir.target);
  if (shadows) {
    dir.castShadow = true;
    const sz = quality > 1.1 ? 4096 : quality > 0.7 ? 2048 : 1024;
    dir.shadow.mapSize.set(sz, sz);
    const sc = dir.shadow.camera; sc.left = sc.bottom = -62; sc.right = sc.top = 62; sc.near = 20; sc.far = 420; sc.updateProjectionMatrix();
    dir.shadow.bias = -0.0008; dir.shadow.normalBias = 0.35;
  }
  const fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);

  // ---- Decorado instanciado ----
  {
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (const [type, count0] of th.props) {
      const P = PROPS[type] || XPROPS[type]; if (!P) continue;
      const count = Math.round(count0 * (quality > 1.1 ? 1.4 : quality > 0.7 ? 1 : 0.55));
      const g = own(P.make());
      const mat = own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      if (P.glow) {
        // emisión proporcional al color del vértice: brillan las ventanas y cristales, no los muros
        mat.emissive.set(th.propGlow || 0x66ccff); mat.emissiveIntensity = B(1.5) * 0.55;
        mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'); };
      }
      const im = new THREE.InstancedMesh(g, mat, count);
      let n = 0, tries = 0;
      const small = type === 'flower' || type === 'shell';
      while (n < count && tries++ < count * 14) {
        const s0 = samples[Math.floor(rand() * N)], side = rand() > 0.5 ? 1 : -1;
        const off = hw + (small ? 4 : 19) + Math.pow(rand(), 1.8) * (small ? 30 : 150);
        const x = s0.x + s0.nx * off * side, z = s0.z + s0.nz * off * side;
        let y = terrainH(x, z);
        const s = samples[nearI], d = lastD;
        if ((s.carve > 0.02 || s.deep > 0.02) && d < 60) continue;
        if (s.kt > 0.02 && d < hw + 14) continue;
        if (small && d < s.lim + 2.4) { if (d < hw + 3 || s.fw) continue; y = s.y + 0.08; } else if (d < s.lim + 10) continue;
        if (!th.underwater && y < th.liquidLevel + 0.4) continue;
        if (shortcut && segDist(x, z, shortcut.ex, shortcut.ez, shortcut.lx, shortcut.lz) < 10) continue;
        const sc = P.scale[0] + rand() * (P.scale[1] - P.scale[0]);
        o.position.set(x, y - 0.1, z); o.rotation.set(0, rand() * TAU, 0);
        o.scale.set(sc, sc * (0.85 + rand() * 0.3), sc); o.updateMatrix();
        im.setMatrixAt(n, o.matrix);
        if (P.tint) c.setHSL(th.neon ? (rand() > 0.5 ? 0.86 : 0.52) + rand() * 0.06 : rand(), 0.95, 0.62);
        else { const b = 0.85 + rand() * 0.3; c.setRGB(b, b, b); }
        im.setColorAt(n, c); n++;
      }
      im.count = n; im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false; im.castShadow = shadows && !small; im.receiveShadow = false;
      group.add(im);
      if (opts.outline && !small && quality > 0.9) group.add(outlineInstanced(im));
    }
  }

  // ---- Señales de curva ----
  {
    const tex = own(canvasTex(128, 64, (c) => {
      c.fillStyle = '#ffd21f'; c.fillRect(0, 0, 128, 64);
      c.fillStyle = '#e01b2f';
      for (let i = 0; i < 3; i++) { const x = 100 - i * 40; c.beginPath(); c.moveTo(x, 6); c.lineTo(x - 26, 32); c.lineTo(x, 58); c.lineTo(x + 12, 58); c.lineTo(x - 14, 32); c.lineTo(x + 12, 6); c.fill(); }
      c.lineWidth = 6; c.strokeStyle = '#1c1c24'; c.strokeRect(0, 0, 128, 64);
    }));
    const g = own(new THREE.PlaneGeometry(5.5, 2.6));
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const list = [];
    for (let i = 0; i < N; i += 7) { const s = samples[i]; if (Math.abs(s.curv) > 0.0115 && !special(s)) list.push(s); }
    const im = new THREE.InstancedMesh(g, mat, Math.max(1, list.length)), o = new THREE.Object3D();
    o.rotation.order = 'YXZ';
    list.forEach((s, i) => {
      const side = s.curv > 0 ? -1 : 1; // exterior de la curva
      o.position.set(s.x + s.nx * (hw + 4.2) * side, s.y + 2.1, s.z + s.nz * (hw + 4.2) * side);
      o.rotation.set(0, s.h + Math.PI, s.curv > 0 ? 0 : Math.PI);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    });
    im.count = list.length; im.frustumCulled = false; group.add(im);
  }

  // ---- Salida / meta ----
  {
    const s = samples[0];
    const chk = own(canvasTex(128, 32, (c) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 16, y * 16, 16, 16); }
    }));
    const line = new THREE.Mesh(own(new THREE.PlaneGeometry(def.width, 3)), own(new THREE.MeshBasicMaterial({ map: chk })));
    line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2, s.h, 0);
    line.position.set(s.x, s.y + 0.04, s.z); group.add(line);
    const banner = own(canvasTex(512, 96, (c) => {
      for (let y = 0; y < 6; y++) for (let x = 0; x < 32; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 16, y * 16, 16, 16); }
      c.fillStyle = '#ff2f4a'; c.fillRect(130, 12, 252, 72);
      c.fillStyle = '#fff'; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('META', 256, 50);
    }));
    const gantry = new THREE.Group();
    const postM = own(new THREE.MeshLambertMaterial({ color: th.curbA }));
    const postG = own(new THREE.CylinderGeometry(0.4, 0.5, 9, 8));
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(postG, postM); p.position.set((hw + 2.4) * sd, 4.5, 0); p.castShadow = shadows; gantry.add(p); }
    const bn = new THREE.Mesh(own(new THREE.BoxGeometry(def.width + 5.6, 2.6, 0.5)), own(new THREE.MeshBasicMaterial({ map: banner })));
    bn.position.y = 8.2; bn.castShadow = shadows; gantry.add(bn);
    gantry.position.set(s.x, s.y, s.z); gantry.rotation.y = s.h; group.add(gantry);
  }

  // ---- Aceleradores (siguen la pendiente) ----
  const pads = [];
  const padTex = own(canvasTex(64, 64, (c) => {
    c.fillStyle = '#ff7a00'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#fff36a';
    for (let i = 0; i < 2; i++) { const y = 62 - i * 32; c.beginPath(); c.moveTo(6, y); c.lineTo(32, y - 22); c.lineTo(58, y); c.lineTo(58, y - 12); c.lineTo(32, y - 34); c.lineTo(6, y - 12); c.fill(); }
  }, true));
  {
    const pos = [], uv = [], idx = [];
    for (const f of [0.2, 0.46, 0.72, 0.93]) {
      const i0 = fIdx(f), lat = (rand() - 0.5) * hw * 0.9, base = pos.length / 3;
      for (let j = 0; j <= 3; j++) {
        const s = samples[(i0 + j) % N];
        pos.push(s.x + s.nx * (lat + 2.3), s.y + 0.06, s.z + s.nz * (lat + 2.3), s.x + s.nx * (lat - 2.3), s.y + 0.06, s.z + s.nz * (lat - 2.3));
        uv.push(0, j * 0.5, 1, j * 0.5);
        if (j < 3) { const a = base + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const sm = samples[(i0 + 1) % N];
      pads.push({ idx: (i0 + 1) % N, x: sm.x + sm.nx * lat, z: sm.z + sm.nz * lat });
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const mat = own(new THREE.MeshBasicMaterial({ map: padTex, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.2)), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    group.add(new THREE.Mesh(g, mat));
  }

  // acelerador en el carril de la bifurcación: el premio por atreverse con el carril estrecho
  if (fork) {
    const pos = [], uv = [], idx = [], j0 = fork.i0 + 23;
    for (let j = 0; j <= 3; j++) {
      const q = samples[j0 + j], c = q.fk;
      pos.push(q.x + q.nx * (c + 2.1), q.y + 0.1, q.z + q.nz * (c + 2.1), q.x + q.nx * (c - 2.1), q.y + 0.1, q.z + q.nz * (c - 2.1)); uv.push(0, j * 0.5, 1, j * 0.5);
      if (j < 3) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const sm = samples[j0 + 1]; pads.push({ idx: j0 + 1, x: sm.x + sm.nx * sm.fk, z: sm.z + sm.nz * sm.fk });
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    group.add(new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ map: padTex, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.2)), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }))));
  }

  const curTex = own(canvasTex(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64); c.fillStyle = 'rgba(40,200,255,.35)'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#dffcff';
    for (let i = 0; i < 2; i++) { const y = 62 - i * 32; c.beginPath(); c.moveTo(6, y); c.lineTo(32, y - 22); c.lineTo(58, y); c.lineTo(58, y - 10); c.lineTo(32, y - 32); c.lineTo(6, y - 10); c.fill(); }
  }, true));
  // ---- Rampas de salto ----
  const ramps = [];
  {
    const tex = own(canvasTex(64, 64, (c) => {
      c.fillStyle = '#1466ff'; c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#7ff0ff';
      for (let i = 0; i < 2; i++) { const y = 62 - i * 32; c.beginPath(); c.moveTo(6, y); c.lineTo(32, y - 22); c.lineTo(58, y); c.lineTo(58, y - 12); c.lineTo(32, y - 34); c.lineTo(6, y - 12); c.fill(); }
    }, true));
    tex.repeat.set(4, 1);
    const W = hw - 0.6, L = 7.5, H = 1.5;
    const top = own(new THREE.BufferGeometry());
    top.setAttribute('position', new THREE.Float32BufferAttribute([W, 0.05, 0, -W, 0.05, 0, W, H, L, -W, H, L], 3));
    top.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); top.setIndex([0, 1, 2, 1, 3, 2]);
    const sideG = own(new THREE.BufferGeometry());
    sideG.setAttribute('position', new THREE.Float32BufferAttribute([
      W, 0, 0, W, H, L, W, 0, L, -W, 0, 0, -W, 0, L, -W, H, L, W, 0, L, W, H, L, -W, H, L, W, 0, L, -W, H, L, -W, 0, L], 3));
    sideG.computeVertexNormals();
    const topM = own(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.25)), side: THREE.DoubleSide }));
    const sideM = own(new THREE.MeshLambertMaterial({ color: th.curbA, side: THREE.DoubleSide }));
    for (const i0 of rampIdx) {
      const s = samples[i0], gr = new THREE.Group();
      gr.rotation.order = 'YXZ'; gr.rotation.set(-Math.atan(s.slope), s.h, 0); gr.position.set(s.x, s.y, s.z);
      const sm = new THREE.Mesh(sideG, sideM); sm.castShadow = shadows;
      gr.add(new THREE.Mesh(top, topM), sm); group.add(gr);
      ramps.push({ idx: i0, x: s.x, z: s.z });
    }
    // rampa grande de lanzamiento del ala delta (solo visual: el vuelo lo marca el tramo)
    for (const r of glRs) {
      const s = samples[(r[0] - 3 + N) % N], gr = new THREE.Group();
      gr.rotation.order = 'YXZ'; gr.rotation.set(-Math.atan(s.slope), s.h, 0); gr.position.set(s.x, s.y, s.z); gr.scale.set(1, 1.5, 1.4);
      const sm = new THREE.Mesh(sideG, sideM); sm.castShadow = shadows;
      gr.add(new THREE.Mesh(top, topM), sm); group.add(gr);
    }
  }

  // ---- Corrientes: franjas que empujan hacia delante o hacia un lado (bajo el agua y en el mar) ----
  const currents = [];
  {
    const zoneIdx = []; samples.forEach((q, i) => { if ((q.zone === 'sub' || q.zone === 'boat') && !q.tun) zoneIdx.push(i); });
    const count = Math.min(8, Math.floor(zoneIdx.length / 55));
    const pos = [], uv = [], idx = [], len = 9;
    for (let n = 0; n < count; n++) {
      const i0 = zoneIdx[Math.floor((n + 0.5) / count * zoneIdx.length)], kind = n % 3 === 2 ? 'side' : 'fwd', lat = (rand() - 0.5) * hw * (kind === 'fwd' ? 1.1 : 0.2), w = kind === 'fwd' ? 2.6 : hw * 0.8, dirS = rand() > 0.5 ? 1 : -1;
      if (nearRamp(i0) || samples[(i0 + len) % N].zone !== samples[i0].zone) continue;
      const base = pos.length / 3;
      for (let j = 0; j <= len; j++) {
        const q = samples[(i0 + j) % N], up = q.zone === 'boat' ? 0.1 : 0.12;
        pos.push(q.x + q.nx * (lat + w), q.y + up, q.z + q.nz * (lat + w), q.x + q.nx * (lat - w), q.y + up, q.z + q.nz * (lat - w));
        if (kind === 'fwd') uv.push(0, j * 0.5, 1, j * 0.5); else uv.push(j * 0.5, dirS > 0 ? 0 : 1, j * 0.5, dirS > 0 ? 1 : 0);
        if (j < len) { const a = base + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        q.cur = kind === 'fwd' ? 1 : 0; q.curL = kind === 'side' ? dirS : 0;
      }
      currents.push({ i0, i1: i0 + len, lat, w, kind, dir: dirS });
    }
    if (pos.length) {
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ map: curTex, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.3)), transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
      m.renderOrder = 1; group.add(m);
    }
  }

  // ---- Aros de impulso (en el vuelo y bajo el agua) ----
  const rings = [];
  {
    const g = own(new THREE.TorusGeometry(3.4, 0.3, 8, 28)), cols = [0xffd21f, 0xff4fd8, 0x22e6ff];
    const addRing = (i, lat, up, n) => {
      const s = samples[i], x = s.x + s.nx * lat, z = s.z + s.nz * lat;
      const m = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[n % 3]).multiplyScalar(B(1.9)) })));
      m.position.set(x, s.y + s.air + up, z); m.rotation.y = s.h; group.add(m);
      rings.push({ idx: i, lat, x, z, y: s.y + s.air + up, up, air: s.air > 0, mesh: m, cd: new Float32Array(8) });
    };
    // en el vuelo los aros están a distinta altura: hay que subir o bajar para cogerlos
    // (en los vuelos cortos solo hay tiempo para dos)
    glRs.forEach(r => {
      const long = r[1] - r[0] > 48;
      (long ? [0.2, 0.5, 0.8] : [0.3, 0.72]).forEach((t, n) => addRing(Math.round(r[0] + (r[1] - r[0]) * t), [-2, 1.5, -1][n], (long ? [1.4, 3.8, -3.0] : [1.2, 3.6])[n], n));
    });
    subs.forEach((r, k) => { const a = fIdx(r[0] + r[2]), b = fIdx(r[1] - r[2]); [0.15, 0.5, 0.85].forEach((t, n) => addRing(Math.round(a + (b - a) * t), [2.5, -3, 1.5][n], 2.4, n + 1 + k)); });
    (def.ringsAt || []).forEach((u, n) => addRing(fIdx(u), [2.5, -3, 1.5, -1][n % 4], 2.4, n));
  }

  // ---- Cajas de objetos ----
  const itemBoxes = [];
  {
    const tex = own(canvasTex(64, 64, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 64);
      g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.35, '#ffd21f'); g.addColorStop(0.7, '#22e6ff'); g.addColorStop(1, '#7a5cff');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.strokeRect(3, 3, 58, 58);
      c.fillStyle = '#fff'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 32, 35);
    }));
    const g = own(new THREE.BoxGeometry(1.9, 1.9, 1.9));
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.35)), transparent: true, opacity: 0.92 }));
    for (const f of [0.08, 0.3, 0.55, 0.8]) {
      const idx = fIdx(f), s = samples[idx];
      for (const l of [-0.66, -0.22, 0.22, 0.66]) {
        const x = s.x + s.nx * l * hw, z = s.z + s.nz * l * hw;
        const m = new THREE.Mesh(g, mat); m.position.set(x, s.y + 1.5, z); group.add(m);
        itemBoxes.push({ x, z, y: s.y, idx, mesh: m, active: true, timer: 0, ph: rand() * 6 });
      }
    }
  }

  // ---- Plátanos ----
  const bananas = [];
  let bananaMesh;
  {
    const g = own(new THREE.TorusGeometry(0.55, 0.17, 6, 10, Math.PI * 1.1));
    const mat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe21f).multiplyScalar(B(1.25)) }));
    const groups = 13;
    for (let k = 0; k < groups; k++) {
      const base = Math.floor((k + 0.55) / groups * N), lat0 = (rand() - 0.5) * hw * 1.2;
      if (nearRamp(base)) continue;
      for (let j = 0; j < 4; j++) {
        const idx = (base + j * 3) % N, s = samples[idx], lat = lat0 + Math.sin(j * 0.9) * 1.5;
        const x = s.x + s.nx * lat, z = s.z + s.nz * lat;
        bananas.push({ x, z, px: x, pz: z, y: s.y + s.air, y0: s.y + s.air, idx, active: true, timer: 0 });
      }
    }
    bananaMesh = new THREE.InstancedMesh(g, mat, bananas.length);
    bananaMesh.frustumCulled = false; group.add(bananaMesh);
  }

  // ---- Charcos (salpican al pisarlos) ----
  const puddles = [];
  if (ex.puddle != null) {
    const g = own(new THREE.CircleGeometry(1, 18));
    const mat = own(new THREE.MeshBasicMaterial({ color: ex.puddle, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    let tries = 0;
    while (puddles.length < 7 && tries++ < 80) {
      const i = Math.floor((0.05 + rand() * 0.9) * N), s = samples[i];
      if (special(s) || nearRamp(i)) continue;
      const lat = (rand() - 0.5) * hw * 1.3, r = 2.4 + rand() * 1.6, gr = new THREE.Group();
      gr.rotation.order = 'YXZ'; gr.rotation.set(-Math.atan(s.slope), s.h, 0);
      const x = s.x + s.nx * lat, z = s.z + s.nz * lat; gr.position.set(x, s.y + 0.05, z);
      const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.scale.set(r, r * 1.5, 1); gr.add(m); group.add(gr);
      puddles.push({ x, z, idx: i, r: r * 1.2 });
    }
  }

  // ---- Público, banderas, vallas, túnel, farolas... ----
  const scenery = buildScenery({ def, th, ex, samples, N, hw, rand, own, group, B, quality, shadows, uTime, special, nearRamp, tunR, fIdx, boatRs, glRs, outline: !!opts.outline, terrainAt: (x, z) => terrainH(x, z) });

  // ---- Minimapa ----
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const s of samples) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); }

  const tmp = new THREE.Object3D(), baseHemi = hemi.intensity, baseDir = dir.intensity;
  const track = {
    def, group, fog, samples, N, length, spacing, hw, maxCurv, unlitRoad,
    pads, ramps, rings, itemBoxes, bananas, puddles, shortcut, fork, currents, variant, mini: { minX, maxX, minZ, maxZ }, liquidLevel: th.liquidLevel, farMesh,
    sunDir, hemi, dir, skyMat, baseFog: [th.fogNear, th.fogFar], fIdx,
    isFree: i => (!special(samples[i]) || (def.hazardInZones && !samples[i].tun && samples[i].kb < 0.02)) && !nearRamp(i),
    grid(i) {
      const row = Math.floor(i / 2), col = i % 2, idx = (N - 5 - row * 4 - col * 2 + N) % N;
      const s = samples[idx], lat = col ? -3.2 : 3.2;
      return { x: s.x + s.nx * lat, z: s.z + s.nz * lat, h: s.h, idx };
    },
    // altura de la carretera en un punto cercano a la muestra i
    yAt(x, z, i) { const s = samples[i]; return s.y + s.slope * ((x - s.x) * s.tx + (z - s.z) * s.tz); },
    locate(x, z, hint, range = 14) {
      let best = hint, bd = 1e12;
      for (let k = -range; k <= range; k++) {
        const i = ((hint + k) % N + N) % N, s = samples[i], dx = x - s.x, dz = z - s.z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    },
    // dim: 0..1 oscurece la luz (tormenta); focus: punto que siguen las sombras
    setLight(dim) {
      hemi.intensity = baseHemi * (1 - dim * 0.35); dir.intensity = baseDir * (1 - dim * 0.6);
      skyMat.uniforms.dim.value = 1 - dim * 0.4;
    },
    update(dt, t, camPos, focus) {
      uTime.value = t;
      sky.position.set(camPos.x, 0, camPos.z);
      padTex.offset.y = -(t * 2.2) % 1; curTex.offset.y = -(t * 1.6) % 1;
      if (shortcut) shortcut.glow.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      liquidMat.uniforms.uTime.value = t; skyMat.uniforms.uTime.value = t;
      liquid.position.set(camPos.x, th.liquidLevel + Math.sin(t * 0.8) * 0.12, camPos.z);
      if (shadows && focus) {
        // se ajusta a una rejilla para que las sombras no tiemblen
        const fx = Math.round(focus.x / 2) * 2, fz = Math.round(focus.z / 2) * 2;
        dir.target.position.set(fx, focus.y || 0, fz);
        dir.position.set(fx + sunDir.x * 200, (focus.y || 0) + sunDir.y * 200, fz + sunDir.z * 200);
      }
      for (let i = 0; i < rings.length; i++) { const r = rings[i]; r.mesh.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.06); r.mesh.rotation.z = t * 0.6 + i; }
      for (const b of itemBoxes) {
        if (!b.active) { b.timer -= dt; if (b.timer <= 0) { b.active = true; b.mesh.visible = true; } continue; }
        b.mesh.rotation.set(t * 1.3 + b.ph, t * 1.9 + b.ph, 0);
        b.mesh.position.y = b.y + 1.5 + Math.sin(t * 3 + b.ph) * 0.2;
      }
      for (let i = 0; i < bananas.length; i++) {
        const b = bananas[i];
        if (!b.active) { b.timer -= dt; if (b.timer <= 0) { b.active = true; b.px = b.x; b.pz = b.z; b.y = b.y0; } }
        tmp.position.set(b.px, b.active ? b.y + 1.1 + Math.sin(t * 4 + i) * 0.15 : -80, b.pz);
        tmp.rotation.set(0, t * 3 + i, 0.6); tmp.updateMatrix();
        bananaMesh.setMatrixAt(i, tmp.matrix);
      }
      bananaMesh.instanceMatrix.needsUpdate = true;
      scenery.update(dt, t, camPos);
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
      if (dir.shadow && dir.shadow.map) dir.shadow.map.dispose();
    },
  };
  return track;
}
