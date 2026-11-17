// Modelos 3D hechos por código: gorilas, coches temáticos, modos de vehículo y decorado.
// Cada pieza rígida se fusiona en una sola malla con color por vértice (pocas llamadas de dibujo) y lleva contorno cómic.
import * as THREE from './vendor/three.module.min.js';
import { addOutline, smoothNormals } from './outline.js';

let gradientMap = null;
function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const matCache = new Map();
export function toon(color, emissive = 0) {
  const key = color + '_' + emissive;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive, emissiveIntensity: emissive ? 0.9 : 0 }));
  }
  return matCache.get(key);
}
// materiales compartidos para las mallas fusionadas
export const toonVC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const toonVC2 = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side: THREE.DoubleSide });
const glowVC = new THREE.MeshBasicMaterial({ vertexColors: true });
const glassMat = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.26, depthWrite: false });

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const sphere = (r, d = 10) => geo('s' + r + '_' + d, () => new THREE.SphereGeometry(r, d, Math.max(6, d - 2)));
const box = (x, y, z) => geo('b' + x + '_' + y + '_' + z, () => new THREE.BoxGeometry(x, y, z));
const cyl = (a, b, h, s = 12) => geo('c' + a + '_' + b + '_' + h + '_' + s, () => new THREE.CylinderGeometry(a, b, h, s));
const capsule = (r, l) => geo('k' + r + '_' + l, () => new THREE.CapsuleGeometry(r, l, 4, 10));
const torus = (r, t, arc = Math.PI * 2) => geo('t' + r + '_' + t + '_' + arc, () => new THREE.TorusGeometry(r, t, 8, 18, arc));
const cone = (r, h, s = 10) => geo('n' + r + '_' + h + '_' + s, () => new THREE.ConeGeometry(r, h, s));
const HPI = Math.PI / 2;

function add(parent, geometry, material, pos, scale, rot) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

// Fusiona piezas [geometría, color, posición, escala, rotación] conservando normales suaves e índices.
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _be = new THREE.Euler(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bc = new THREE.Color();
export function bake(parts, glow = 1) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const [g0, color, p, s, r] of parts) {
    _be.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _bq.setFromEuler(_be);
    _bp.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0); _bs.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1);
    const g = g0.clone().applyMatrix4(_bm.compose(_bp, _bq, _bs));
    const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3;
    _bc.set(color).multiplyScalar(glow);
    for (let i = 0; i < n; i++) { pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); col.push(_bc.r, _bc.g, _bc.b); }
    if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx.push(base + I[i]); } else for (let i = 0; i < n; i++) idx.push(base + i);
    base += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return smoothNormals(out);
}
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
const tint = (c, to, k) => new THREE.Color(c).lerp(new THREE.Color(to), k).getHex();
// malla fusionada con (opcionalmente) su contorno
function part(parent, geometry, material, outline) {
  const m = new THREE.Mesh(geometry, material); parent.add(m);
  if (outline) addOutline(m);
  return m;
}

// ---------------- GORILA ----------------
const FACES = {
  neutral: [0, 0, 1.0, 0.28, 0, 1],
  happy: [-0.12, 0.02, 1.3, 0.95, 1, 1],
  angry: [0.5, -0.025, 1.25, 0.5, 1, 0.8],
  scared: [-0.42, 0.045, 0.75, 1.2, 0, 1.3],
  sad: [-0.45, 0, 0.9, 0.22, 0, 0.72],
  focus: [0.28, -0.015, 0.8, 0.22, 0, 0.88],
  dizzy: [-0.2, 0.02, 0.85, 0.85, 0, 1.15],
}; // [ángulo ceja, altura ceja, ancho boca, apertura boca, dientes, apertura ojo]
const DARK = 0x16161c, WHITE = 0xffffff;

const gorillaCache = new Map();
function gorillaGeos(ch, standing) {
  const key = ch.id + (standing ? '_s' : '');
  if (gorillaCache.has(key)) return gorillaCache.get(key);
  const fur = ch.fur, skin = ch.skin, acc = ch.accColor, furD = shade(fur, 0.72), skinD = shade(skin, 0.7);
  // --- tronco y piernas ---
  const t = [
    [sphere(0.62), fur, [0, 0.75, 0], [1.15, 1.1, 0.95]],
    [sphere(0.45), skin, [0, 0.84, 0.34], [1.1, 0.9, 0.5]],
    [sphere(0.3, 10), skin, [-0.2, 0.98, 0.38], [1, 0.8, 0.5]], [sphere(0.3, 10), skin, [0.2, 0.98, 0.38], [1, 0.8, 0.5]],
    [sphere(0.035, 6), DARK, [0, 0.52, 0.56]],
    [sphere(0.2, 8), furD, [0, 0.95, -0.5], [1.6, 1.8, 0.6]],
    [torus(0.34, 0.08), acc, [0, 1.25, 0.04], [1, 1, 0.9], [HPI + 0.15, 0, 0]],
    [cone(0.16, 0.34, 4), acc, [0.12, 1.08, 0.38], [1, 1, 0.4], [0.2, 0, Math.PI + 0.25]],
  ];
  for (const s of [-1, 1]) {
    if (standing) {
      t.push([capsule(0.19, 0.5), fur, [0.3 * s, -0.1, 0]], [sphere(0.2), skin, [0.3 * s, -0.62, 0.12], [1, 0.7, 1.4]]);
      for (let i = -1; i <= 1; i++) t.push([sphere(0.075, 8), skin, [0.3 * s + i * 0.11, -0.66, 0.36]]);
    } else {
      t.push([capsule(0.19, 0.5), fur, [0.32 * s, 0.26, 0.45], null, [1.35, 0, 0]], [sphere(0.2), skin, [0.32 * s, 0.2, 0.86], [1, 0.8, 1.3]]);
      for (let i = -1; i <= 1; i++) t.push([sphere(0.075, 8), skin, [0.32 * s + i * 0.11, 0.24, 1.1]]);
    }
  }
  // --- cabeza ---
  const h = [
    [sphere(0.46), fur, null, [1, 1.05, 1]], [sphere(0.3), fur, [0, 0.3, -0.06], [0.9, 0.95, 1.05]],
    [sphere(0.36), skin, [0, -0.02, 0.2], [1, 0.95, 0.72]], [sphere(0.24), skin, [0, -0.17, 0.36], [1.2, 0.82, 0.85]],
    [box(0.62, 0.11, 0.2), fur, [0, 0.14, 0.36]],
  ];
  for (const [x, y, z, r] of [[0, 0.62, 0.02, 0], [-0.13, 0.57, -0.02, 0.45], [0.13, 0.57, -0.02, -0.45]]) h.push([cone(0.09, 0.26, 6), furD, [x, y, z], null, [0.15, 0, r]]);
  for (const s of [-1, 1]) {
    h.push([sphere(0.03, 6), DARK, [0.06 * s, -0.11, 0.565]],
      [sphere(0.12, 8), skin, [0.46 * s, 0.02, -0.02], [0.6, 1, 1]], [sphere(0.065, 8), skinD, [0.5 * s, 0.02, 0.03], [0.5, 1, 1]],
      [sphere(0.2, 10), fur, [0.36 * s, -0.16, 0.12], [0.7, 1.1, 0.8]]);
    for (let i = 0; i < 2; i++) h.push([cone(0.06, 0.2, 5), furD, [0.4 * s, -0.3 - i * 0.07, 0.14 - i * 0.1], null, [0, 0, -2.4 * s]]);
  }
  switch (ch.acc) {
    case 'cap': h.push([sphere(0.47), acc, [0, 0.14, -0.02], [1.02, 0.75, 1.04]], [box(0.5, 0.05, 0.36), acc, [0, 0.24, 0.5]], [sphere(0.07, 8), WHITE, [0, 0.5, -0.02]]); break;
    case 'bow': for (const s of [-1, 1]) h.push([cone(0.17, 0.3, 8), acc, [0.17 * s, 0.56, 0], null, [0, 0, s * HPI]]); h.push([sphere(0.08, 8), acc, [0, 0.56, 0]]); break;
    case 'glasses': for (const s of [-1, 1]) h.push([box(0.22, 0.14, 0.05), acc, [0.15 * s, 0.03, 0.535]]); h.push([box(0.9, 0.04, 0.04), acc, [0, 0.06, 0.5]]); break;
    case 'headphones': h.push([torus(0.5, 0.05), acc, [0, 0.06, 0]]); for (const s of [-1, 1]) h.push([cyl(0.17, 0.17, 0.12), acc, [0.5 * s, 0.02, 0], null, [0, 0, HPI]]); break;
    case 'mohawk': for (let i = 0; i < 5; i++) h.push([cone(0.1, 0.34, 6), acc, [0, 0.5 - Math.abs(i - 1.5) * 0.04, 0.3 - i * 0.16], null, [-0.3 + i * 0.2, 0, 0]]); break;
    case 'crown':
      h.push([cyl(0.3, 0.26, 0.16, 10), acc, [0, 0.58, -0.03]]);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; h.push([cone(0.07, 0.2, 5), acc, [Math.sin(a) * 0.27, 0.74, Math.cos(a) * 0.27 - 0.03]]); }
      break;
  }
  // --- brazos con mano, dedos, pulgar y muñequera ---
  const arm = s => {
    const a = [[capsule(0.18, 0.62), fur, [0, -0.45, 0]], [sphere(0.24, 10), furD, [0, -0.1, 0], [1, 0.8, 1]], [sphere(0.2, 8), skin, [0, -0.93, 0]],
      [torus(0.19, 0.05), acc, [0, -0.74, 0], null, [HPI, 0, 0]], [capsule(0.055, 0.09), skin, [0.19 * s, -0.98, 0.08], null, [0.2, 0, 0.9 * s]]];
    for (let i = -1; i <= 1; i++) a.push([capsule(0.055, 0.1), skin, [i * 0.1, -1.1, 0.05], null, [0.25, 0, i * -0.18]]);
    return bake(a);
  };
  const G = { torso: bake(t), head: bake(h), armP: arm(1), armN: arm(-1) };
  gorillaCache.set(key, G); return G;
}
let faceG = null;
function faceGeos() {
  if (faceG) return faceG;
  faceG = {
    eye: bake([[sphere(0.09, 8), WHITE]]),
    pupil: bake([[sphere(0.048, 8), DARK], [sphere(0.016, 6), WHITE, [0.02, 0.02, 0.04]]]),
    brow: bake([[box(0.21, 0.05, 0.05), DARK]]),
    mouth: bake([[sphere(0.1, 8), 0x5a1420, null, [1, 1, 0.4]], [sphere(0.05, 8), 0xff7a9a, [0, -0.035, 0.02], [1.2, 0.6, 0.6]]]),
    teeth: bake([[box(0.17, 0.035, 0.04), WHITE, [0, 0.05, 0.03]]]),
  };
  return faceG;
}

export function makeGorilla(ch, override, standing = false) {
  const G = gorillaGeos(ch, standing), F = faceGeos(), M = override || toonVC, ol = !override;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  part(body, G.torso, M, ol);
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.05); body.add(head);
  part(head, G.head, M, ol);
  const face = new THREE.Group(); head.add(face);
  const eyes = [], pupils = [], brows = [];
  for (const s of [-1, 1]) {
    const e = part(face, F.eye, M); e.position.set(0.15 * s, 0.02, 0.43); eyes.push(e);
    const p = part(face, F.pupil, M); p.position.set(0.15 * s, 0.02, 0.5); pupils.push(p);
    const b = part(face, F.brow, M); b.position.set(0.15 * s, 0.135, 0.475); brows.push(b);
  }
  const mouth = part(face, F.mouth, M); mouth.position.set(0, -0.235, 0.535);
  const teeth = part(mouth, F.teeth, M);
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(0.64 * s, 1.15, 0.05); p.rotation.order = 'YXZ';
    part(p, s > 0 ? G.armP : G.armN, M, ol);
    body.add(p); arms.push(p);
  }
  g.userData = { body, head, face, armL: arms[1], armR: arms[0], eyes, pupils, brows, mouth, teeth, baseY: standing ? 0.85 : 0, face6: FACES.neutral.slice(), blink: Math.random() * 4 };
  return g;
}

// o: { steer, mode, speedK, face, look, throwK, taunt, dt }
// mode: drive | pound | cheer | dizzy | sad | trick | idle | dance | clap | wave
export function animateGorilla(g, t, o = {}) {
  const u = g.userData, { body, head, armL, armR } = u;
  const steer = o.steer || 0, mode = o.mode || 'drive', dt = o.dt || 0.016;
  // --- cara ---
  if (u.face.visible) {
    const target = FACES[o.face] || FACES.neutral, f = u.face6, k = Math.min(1, dt * 12);
    for (let i = 0; i < 6; i++) f[i] += (target[i] - f[i]) * k;
    u.blink -= dt; if (u.blink < -0.12) u.blink = 2 + Math.random() * 3.5;
    const eyeY = u.blink < 0 ? 0.12 : f[5];
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      u.brows[i].rotation.z = f[0] * s; u.brows[i].position.y = 0.135 + f[1];
      u.eyes[i].scale.y = eyeY; u.pupils[i].scale.y = Math.min(1, eyeY);
      u.pupils[i].position.x = 0.15 * s + (mode === 'dizzy' ? Math.cos(t * 14) * 0.03 : Math.max(-0.035, Math.min(0.035, -steer * 0.03 + (o.look || 0) * 0.02)));
      u.pupils[i].position.y = 0.02 + (mode === 'dizzy' ? Math.sin(t * 14) * 0.03 : 0);
    }
    u.mouth.scale.set(f[2], f[3], 1); u.teeth.visible = f[4] > 0.5;
  }
  // --- cuerpo ---
  const ax = -1.13, ay = 0.42;
  body.scale.setScalar(1);
  body.position.y = u.baseY + Math.sin(t * 14) * 0.012 * (0.3 + (o.speedK || 0));
  body.rotation.set(0, 0, -steer * 0.14);
  head.rotation.set(0, -steer * 0.35 + (o.look || 0), -steer * 0.1);
  if (mode === 'drive') {
    armL.rotation.set(ax + steer * 0.35, -ay, 0); armR.rotation.set(ax - steer * 0.35, ay, 0);
    if (o.taunt) { armL.rotation.set(-2.75, 0, -0.25 + Math.sin(t * 20) * 0.35); head.rotation.x = -0.2; }
    if (o.throwK > 0) { const q = Math.min(1, o.throwK); armR.rotation.set(-3.1 + q * 2.3, 0.15, 0.1); body.rotation.x = -0.15 + q * 0.3; }
  } else if (mode === 'pound') {
    const q = Math.sin(t * 26);
    armL.rotation.set(-0.9 + q * 0.5, -1.25, 0.2); armR.rotation.set(-0.9 - q * 0.5, 1.25, -0.2);
    head.rotation.x = -0.35 + Math.sin(t * 13) * 0.08;
    body.scale.setScalar(1.06 + Math.sin(t * 26) * 0.02);
  } else if (mode === 'cheer' || mode === 'trick') {
    const q = Math.sin(t * 9);
    armL.rotation.set(-2.9, 0, -0.35 + q * 0.3); armR.rotation.set(-2.9, 0, 0.35 - q * 0.3);
    body.position.y += Math.abs(Math.sin(t * 9)) * 0.14;
    head.rotation.set(-0.25, Math.sin(t * 4.5) * 0.3, 0);
  } else if (mode === 'dizzy') {
    armL.rotation.set(-2.2, 0, -0.9 + Math.sin(t * 20) * 0.3); armR.rotation.set(-2.2, 0, 0.9 - Math.sin(t * 20) * 0.3);
    head.rotation.set(Math.sin(t * 9) * 0.3, Math.cos(t * 9) * 0.5, 0);
  } else if (mode === 'sad') {
    if (u.baseY) { armL.rotation.set(0.1, 0, -0.12); armR.rotation.set(0.1, 0, 0.12); } else { armL.rotation.set(ax, -ay, 0); armR.rotation.set(ax, ay, 0); }
    head.rotation.set(0.45, Math.sin(t * 2) * 0.25, 0);
  } else if (mode === 'idle') {
    armL.rotation.set(Math.sin(t * 2) * 0.08, 0, -0.14); armR.rotation.set(-Math.sin(t * 2) * 0.08, 0, 0.14);
    head.rotation.set(0, Math.sin(t * 1.3) * 0.25, 0);
  } else if (mode === 'dance') {
    const q = Math.sin(t * 8);
    armL.rotation.set(-2.6 + q * 0.5, 0, -0.5 - q * 0.3); armR.rotation.set(-2.6 - q * 0.5, 0, 0.5 - q * 0.3);
    body.position.y += Math.abs(Math.sin(t * 8)) * 0.35; body.rotation.set(0, Math.sin(t * 4) * 0.6, q * 0.12);
    head.rotation.set(-0.2, 0, q * 0.2);
  } else if (mode === 'clap') {
    const q = Math.abs(Math.sin(t * 11));
    armL.rotation.set(-1.25, -0.2 - q * 0.75, 0); armR.rotation.set(-1.25, 0.2 + q * 0.75, 0);
    body.position.y += Math.abs(Math.sin(t * 5.5)) * 0.08; head.rotation.set(-0.1, Math.sin(t * 2) * 0.2, 0);
  } else if (mode === 'wave') {
    armL.rotation.set(-2.8, 0, -0.3 + Math.sin(t * 10) * 0.4); armR.rotation.set(0.05, 0, 0.14);
    head.rotation.set(-0.05, Math.sin(t * 2.4) * 0.2, 0.08);
  }
}

// ---------------- COCHES TEMÁTICOS ----------------
// Cada constructor devuelve { parts, glow, wheels: [[x, radio, z]], seat: altura del asiento }
const METAL = 0xc9d2e0, SEAT = 0x1c1c24, LIGHT = 0xfff6b0;
const cabin = (b, y, back = 0x2d2d3a) => {
  b.push([box(1.1, 0.5, 1.2), SEAT, [0, y + 0.2, -0.55]], [box(1.2, 0.8, 0.22), back, [0, y + 0.58, -1.15]], [cyl(0.04, 0.04, 0.8, 6), SEAT, [0, y + 0.43, 0.62], null, [-0.75, 0, 0]]);
};
const STD_WHEELS = [[1.08, 0.42, 1.3], [-1.08, 0.42, 1.3], [1.12, 0.48, -1.2], [-1.12, 0.48, -1.2]];
const KART_BUILD = {
  // Platanomóvil: carrocería con forma de plátano
  platano(c1) {
    const b = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, r = 0.2 + 0.62 * Math.sin(Math.PI * (0.05 + 0.9 * t)) ** 0.8; b.push([sphere(1, 10), c1, [0, 0.6 + (t - 0.42) ** 2 * 3.0, -2.5 + t * 5.3], [r * 1.2, r * 0.8, 0.55]]); }
    b.push([cone(0.2, 0.5, 8), 0x6a4020, [0, 1.66, 2.95], null, [1.0, 0, 0]], [cyl(0.09, 0.14, 0.5, 6), 0x4aa83a, [0, 1.25, -2.72], null, [-1.0, 0, 0]]);
    cabin(b, 0.62, 0x8a5a2a);
    return { parts: b, glow: [[sphere(0.12, 8), LIGHT, [0.3, 1.0, 2.35]], [sphere(0.12, 8), LIGHT, [-0.3, 1.0, 2.35]]], wheels: STD_WHEELS, seat: 0.62, hub: c1 };
  },
  // Cocodrilo Veloz: morro con dientes, ojos saltones y cola
  rayo(c1, c2) {
    const b = [], belly = tint(c1, 0xfff6b0, 0.55);
    b.push([capsule(0.8, 2.2), c1, [0, 0.72, -0.1], [1.15, 1, 0.62], [HPI, 0, 0]], [capsule(0.7, 2.0), belly, [0, 0.5, -0.1], [1.0, 1, 0.4], [HPI, 0, 0]],
      [box(1.15, 0.3, 1.5), c1, [0, 0.84, 2.0]], [sphere(0.58, 12), c1, [0, 0.84, 2.75], [1, 0.3, 0.7]],
      [box(1.0, 0.16, 1.4), c2, [0, 0.48, 1.95]], [sphere(0.5, 10), c2, [0, 0.48, 2.65], [1, 0.2, 0.6]], [box(0.92, 0.1, 1.3), 0xff6a8a, [0, 0.61, 1.95]],
      [cone(0.5, 1.7, 8), c1, [0, 0.78, -2.5], null, [-HPI - 0.15, 0, 0]], [cone(0.26, 0.9, 6), c1, [0, 1.02, -3.45], null, [-HPI - 0.55, 0, 0]]);
    for (const s of [-1, 1]) {
      for (let z = 1.4; z <= 2.61; z += 0.3) b.push([cone(0.07, 0.2, 5), WHITE, [0.5 * s, 0.6, z], null, [Math.PI, 0, 0]]);
      b.push([sphere(0.26, 10), c1, [0.4 * s, 1.1, 1.35]], [sphere(0.17, 10), WHITE, [0.42 * s, 1.16, 1.5]], [sphere(0.08, 8), DARK, [0.43 * s, 1.17, 1.64]],
        [sphere(0.05, 6), DARK, [0.2 * s, 1.0, 2.8]], [sphere(0.34, 8), c1, [0.95 * s, 0.55, 1.25]], [sphere(0.38, 8), c1, [1.0 * s, 0.6, -1.15]]);
    }
    for (let i = 0; i < 3; i++) b.push([cone(0.07, 0.2, 5), WHITE, [-0.3 + i * 0.3, 0.6, 2.72], null, [Math.PI, 0, 0]]);
    for (let i = 0; i < 5; i++) b.push([cone(0.17, 0.36, 4), c2, [0, 1.22 - i * 0.05, -1.4 - i * 0.42]]);
    cabin(b, 0.6, c2);
    return { parts: b, glow: [], wheels: STD_WHEELS, seat: 0.6, hub: belly };
  },
  // Barril Tanque: un barril con aros y dos escapes
  coco(c1, c2) {
    const b = [[cyl(0.95, 0.95, 3.3, 16), c1, [0, 0.98, 0.1], null, [HPI, 0, 0]], [cyl(0.8, 0.8, 0.1, 16), tint(c1, 0xffffff, 0.35), [0, 0.98, 1.78], null, [HPI, 0, 0]],
      [cyl(0.1, 0.14, 0.4, 8), METAL, [0, 0.72, 1.95], null, [HPI, 0, 0]], [box(1.15, 0.6, 1.3), c2, [0, 1.58, -0.5]]];
    for (const z of [-1.2, -0.4, 0.5, 1.4]) b.push([torus(0.97, 0.07), c2, [0, 0.98, z]]);
    for (const s of [-1, 1]) b.push([cyl(0.12, 0.16, 0.9, 8), METAL, [0.5 * s, 1.78, -1.5], null, [1.1, 0, 0]]);
    cabin(b, 1.08, c2);
    return { parts: b, glow: [[sphere(0.14, 8), LIGHT, [0.45, 1.0, 1.84]], [sphere(0.14, 8), LIGHT, [-0.45, 1.0, 1.84]]], wheels: [[1.2, 0.5, 1.3], [-1.2, 0.5, 1.3], [1.25, 0.56, -1.2], [-1.25, 0.56, -1.2]], seat: 1.08, hub: c1 };
  },
  // Cohete Cometa: fuselaje blanco, morro y aletas de color, tobera encendida
  cometa(c1, c2) {
    const b = [[cyl(0.78, 0.78, 3.0, 16), c2, [0, 1.0, -0.2], null, [HPI, 0, 0]], [cone(0.78, 1.5, 16), c1, [0, 1.0, 2.05], null, [HPI, 0, 0]], [sphere(0.16, 8), 0xff3b4a, [0, 1.0, 2.8]],
      [cyl(0.55, 0.4, 0.5, 12), METAL, [0, 1.0, -1.95], null, [HPI, 0, 0]], [box(0.08, 0.95, 1.1), c1, [0, 1.95, -1.55], null, [-0.35, 0, 0]]];
    for (const z of [1.25, -1.25]) b.push([torus(0.79, 0.06), c1, [0, 1.0, z]]);
    for (const s of [-1, 1]) b.push([box(0.95, 0.08, 1.1), c1, [1.05 * s, 0.75, -1.55], null, [0, 0.3 * s, -0.5 * s]], [cyl(0.24, 0.24, 0.07, 12), METAL, [0.78 * s, 1.1, 0.7], null, [0, 0, HPI]], [cyl(0.18, 0.18, 0.09, 12), 0x22e6ff, [0.79 * s, 1.1, 0.7], null, [0, 0, HPI]]);
    cabin(b, 1.02, c1);
    return { parts: b, glow: [[cone(0.42, 1.1, 10), 0xff8a1a, [0, 1.0, -2.7], null, [-HPI, 0, 0]], [cone(0.24, 0.7, 8), 0xffe45a, [0, 1.0, -2.5], null, [-HPI, 0, 0]]], wheels: STD_WHEELS, seat: 1.02, hub: c1 };
  },
  // Platillo Aurora: platillo volante con luces en el borde
  aurora(c1, c2) {
    const b = [[sphere(1, 16), c1, [0, 0.82, 0], [1.55, 0.36, 2.35]], [cyl(0.95, 1.2, 0.3, 16), shade(c1, 0.7), [0, 1.08, -0.25]], [cyl(0.03, 0.03, 0.9, 5), METAL, [0.7, 1.6, -1.3]]];
    const g = [[torus(1, 0.07), c2, [0, 0.82, 0], [1.56, 2.36, 1], [HPI, 0, 0]], [sphere(0.12, 8), c2, [0.7, 2.1, -1.3]], [cyl(1.15, 1.15, 0.05, 16), c2, [0, 0.44, 0], [1, 1, 1.6]]];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.push([sphere(0.11, 8), i % 2 ? 0xffe600 : 0xff4fd8, [Math.sin(a) * 1.45, 0.9, Math.cos(a) * 2.2]]); }
    cabin(b, 0.74, shade(c1, 0.6));
    return { parts: b, glow: g, wheels: [[1.2, 0.38, 1.25], [-1.2, 0.38, 1.25], [1.2, 0.4, -1.25], [-1.2, 0.4, -1.25]], seat: 0.74, hub: c2 };
  },
};
const kartCache = new Map();
function wheelGeo(r, hub) {
  return geo('wheel' + r + '_' + hub, () => {
    const w = [[cyl(1, 1, 0.42, 14), SEAT, null, [r, 1, r], [0, 0, HPI]], [cyl(0.5, 0.5, 0.46, 6), hub, null, [r, 1, r], [0, 0, HPI]]];
    for (const o of [-0.13, 0, 0.13]) w.push([torus(r, 0.035), 0x3a3a48, [o, 0, 0], null, [0, HPI, 0]]);
    return bake(w);
  });
}
function kartGeos(def, color) {
  const c1 = color || def.color, key = def.id + '_' + c1;
  if (kartCache.has(key)) return kartCache.get(key);
  const k = (KART_BUILD[def.id] || KART_BUILD.platano)(c1, def.color2);
  const K = { body: bake(k.parts), glow: k.glow.length ? bake(k.glow, 1.5) : null, wheels: k.wheels, seat: k.seat, hub: k.hub,
    steer: geo('steer', () => bake([[torus(0.27, 0.055), SEAT], [box(0.5, 0.05, 0.05), SEAT], [box(0.05, 0.5, 0.05), SEAT]])) };
  kartCache.set(key, K); return K;
}

export function makeKart(def, colorOverride, override) {
  const K = kartGeos(def, colorOverride), M = override || toonVC, ol = !override;
  const k = new THREE.Group(), bodyG = new THREE.Group(); k.add(bodyG);
  part(bodyG, K.body, M, ol);
  if (K.glow) part(bodyG, K.glow, override || glowVC);
  const wheel = part(bodyG, K.steer, M); wheel.position.set(0, K.seat + 0.69, 0.38); wheel.rotation.set(-0.75, 0, 0);
  const wheels = [];
  for (const [x, r, z] of K.wheels) {
    const pivot = new THREE.Group(); pivot.position.set(x, r, z);
    const spin = new THREE.Group(); pivot.add(spin);
    part(spin, wheelGeo(r, K.hub), M, ol);
    k.add(pivot); wheels.push({ pivot, spin, front: z > 0, x, y: r });
  }
  k.userData = { bodyG, wheels, wheel, seat: K.seat };
  return k;
}
// Coloca al gorila en el asiento del coche
export function mountGorilla(kart, gorilla) { gorilla.position.set(0, kart.userData.seat, -0.5); gorilla.scale.setScalar(0.95); return gorilla; }

export function animateKart(k, dt, speed, steer) {
  const u = k.userData;
  for (const w of u.wheels) {
    w.spin.rotation.x += speed * dt / 0.45;
    if (w.front) w.pivot.rotation.y = -steer * 0.4;
  }
  u.wheel.rotation.z = steer * 0.9;
}

// ---------------- MODOS DE VEHÍCULO (ala delta, barco, submarino) ----------------
let rigGeos = null;
function buildRigGeos() {
  const cols = [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a];
  // vela del ala delta: 8 paños de colores
  const pos = [], col = [], c = new THREE.Color();
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x0 = i * 1.05 * s, x1 = (i + 1) * 1.05 * s, sw = x => Math.abs(x) * 0.55, yy = x => -Math.abs(x) * 0.08;
    const a = [x0, yy(x0), 1.7 - sw(x0)], b = [x1, yy(x1), 1.7 - sw(x1)], d = [x0, yy(x0), -1.5 - sw(x0) * 0.25], e = [x1, yy(x1), -1.5 + (i === 3 ? 0.9 : 0) - sw(x1) * 0.25];
    for (const v of (s > 0 ? [a, d, b, b, d, e] : [a, b, d, b, e, d])) pos.push(v[0], v[1], v[2]);
    c.set(cols[i]); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
  }
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sail.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sail.computeVertexNormals();
  const frame = [[cyl(0.05, 0.05, 8.6, 6), METAL, [0, 3.52, 1.05], null, [0, 0, HPI]], [cyl(0.05, 0.05, 3.4, 6), METAL, [0, 3.5, -0.2], null, [HPI, 0, 0]], [cone(0.3, 1.4, 3), 0xff4fd8, [0, 3.45, -2.6], [1, 1, 0.15], [HPI, 0, 0]]];
  for (const s of [-1, 1]) frame.push([cyl(0.045, 0.045, 3.1, 6), METAL, [0.75 * s, 2.15, 0.2], null, [0.12, 0, -0.42 * s]], [cyl(0.03, 0.03, 4.4, 5), WHITE, [2.1 * s, 2.6, -0.4], null, [-0.2, 0, -1.12 * s]]);
  // barco: casco, flotadores y motor fueraborda
  const hull = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, HPI, HPI);
  const boat = [[hull, WHITE, [0, 0.66, 0.3], [1.6, 1.0, 3.35]], [hull, 0xff3b4a, [0, 0.68, 0.3], [1.65, 0.42, 3.4]], [torus(1.5, 0.11), 0xffd21f, [0, 0.7, 0.3], [1.06, 2.25, 1], [HPI, 0, 0]],
    [box(0.5, 1.0, 0.5), SEAT, [0, 0.75, -3.05]], [cyl(0.24, 0.24, 0.5, 10), 0xff3b4a, [0, 1.35, -3.05]], [cyl(0.03, 0.03, 2.2, 5), METAL, [0.95, 2.0, -2.3]], [cone(0.3, 0.6, 3), 0xffd21f, [0.67, 2.9, -2.3], [1, 1, 0.15], [0, 0, -HPI]]];
  for (const s of [-1, 1]) boat.push([capsule(0.3, 2.3), 0xff7a1a, [2.05 * s, 0.25, -0.2], null, [HPI, 0, 0]], [box(1.0, 0.1, 0.22), METAL, [1.45 * s, 0.6, 0.6]], [box(1.0, 0.1, 0.22), METAL, [1.45 * s, 0.6, -1.0]]);
  // submarino: aletas, timón, periscopio y aro de la cúpula
  const sub = [[torus(1.3, 0.1), 0xff7a1a, [0, 1.25, -0.2], [1, 1.25, 1], [HPI, 0, 0]], [box(0.1, 1.0, 0.9), 0xff7a1a, [0, 2.0, -2.4], null, [-0.3, 0, 0]],
    [cyl(0.4, 0.55, 0.6, 12), METAL, [0, 0.95, -3.0], null, [HPI, 0, 0]], [cyl(0.09, 0.09, 1.5, 8), METAL, [0.95, 2.9, -1.2]], [cyl(0.09, 0.09, 0.5, 8), METAL, [0.95, 3.6, -0.98], null, [HPI, 0, 0]]];
  for (const s of [-1, 1]) sub.push([box(1.3, 0.1, 0.9), 0xff7a1a, [1.9 * s, 0.85, -1.2], null, [0, 0.35 * s, 0.15 * s]], [torus(0.32, 0.06), METAL, [0.8 * s, 0.95, 2.6]]);
  const prop = []; for (let i = 0; i < 4; i++) prop.push([box(0.22, 0.9, 0.06), 0xff7a1a, [Math.sin(i * HPI) * 0.45, Math.cos(i * HPI) * 0.45, 0], null, [0, 0.3, -i * HPI]]);
  rigGeos = { sail, frame: bake(frame), boat: bake(boat), sub: bake(sub), prop: bake(prop),
    subGlow: bake([[sphere(0.3, 10), LIGHT, [0.8, 0.95, 2.55]], [sphere(0.3, 10), LIGHT, [-0.8, 0.95, 2.55]], [sphere(0.13, 8), 0x22e6ff, [0.95, 3.6, -0.72]]], 1.6),
    dome: new THREE.SphereGeometry(1.42, 18, 12) };
}
// Devuelve los accesorios de cada modo (ocultos); se cuelgan del coche y se muestran al transformarse.
export function makeModeRigs() {
  if (!rigGeos) buildRigGeos();
  const R = rigGeos, glider = new THREE.Group(), boat = new THREE.Group(), sub = new THREE.Group();
  const sail = new THREE.Mesh(R.sail, toonVC2); sail.position.set(0, 3.5, -0.3); sail.rotation.x = 0.1; glider.add(sail); part(glider, R.frame, toonVC, true);
  part(boat, R.boat, toonVC, true);
  part(sub, R.sub, toonVC, true); part(sub, R.subGlow, glowVC);
  const prop = part(sub, R.prop, toonVC); prop.position.set(0, 0.95, -3.4);
  const dome = new THREE.Mesh(R.dome, glassMat); dome.position.set(0, 1.75, -0.25); dome.scale.set(1, 1.05, 1.15); dome.renderOrder = 8; sub.add(dome);
  glider.visible = boat.visible = sub.visible = false;
  return { glider, boat, sub, prop };
}

// ---------------- DECORADO (geometrías fusionadas con color por vértice) ----------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export function merged(parts) {
  const pos = [], nor = [], col = [];
  for (const [g0, color, p, s, r] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    _q.setFromEuler(_e);
    _p.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
    _s.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    g.computeVertexNormals();
    _c.set(color);
    const P = g.attributes.position.array, Nn = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) {
      pos.push(P[i], P[i + 1], P[i + 2]);
      nor.push(Nn[i], Nn[i + 1], Nn[i + 2]);
      col.push(_c.r, _c.g, _c.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const C = (a, b, h, s = 7) => new THREE.CylinderGeometry(a, b, h, s);
const K = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const PI = Math.PI;

// Cada entrada: { geo(): geometría, tint: variación de color, glow, scale:[min,max] }
export const PROPS = {
  tree: { scale: [0.9, 1.7], make: () => merged([
    [C(0.45, 0.65, 4.5), 0x7a4a2a, [0, 2.2, 0]],
    [ico(2.6, 1), 0x1fb24a, [0, 6, 0], [1, 0.85, 1]],
    [ico(1.9, 1), 0x35d45c, [1.3, 7.3, 0.6]],
    [ico(1.7, 1), 0x56e36b, [-1.1, 7.6, -0.7]],
  ]) },
  palm: { scale: [0.9, 1.5], make: () => {
    const parts = [
      [C(0.3, 0.42, 3), 0xa87440, [0, 1.5, 0], null, [0, 0, 0.1]],
      [C(0.25, 0.3, 3), 0xb88450, [-0.45, 4.3, 0], null, [0, 0, 0.2]],
      [C(0.2, 0.25, 2.6), 0xc0905a, [-1.15, 6.9, 0], null, [0, 0, 0.32]],
    ];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * PI * 2;
      parts.push([ico(1, 1), i % 2 ? 0x2fd15a : 0x1fae48, [-1.55 + Math.cos(a) * 1.7, 7.9, Math.sin(a) * 1.7], [2.1, 0.16, 0.6], [0, -a, -0.35]]);
    }
    parts.push([ico(0.3, 0), 0x6a4020, [-1.4, 7.7, 0.3]], [ico(0.3, 0), 0x6a4020, [-1.75, 7.7, -0.2]]);
    return merged(parts);
  } },
  rock: { scale: [0.7, 2.4], make: () => merged([
    [new THREE.DodecahedronGeometry(1.4, 0), 0x9aa0b0, [0, 0.7, 0], [1.2, 0.8, 1]],
    [new THREE.DodecahedronGeometry(0.8, 0), 0x7f8597, [1.2, 0.4, 0.5]],
  ]) },
  flower: { scale: [0.8, 1.6], tint: true, make: () => {
    const parts = [[C(0.06, 0.06, 0.9, 5), 0x2a9a3a, [0, 0.45, 0]], [ico(0.16, 0), 0xffe14a, [0, 1, 0]]];
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; parts.push([ico(0.2, 0), 0xffffff, [Math.cos(a) * 0.28, 1, Math.sin(a) * 0.28], [1, 0.5, 1]]); }
    return merged(parts);
  } },
  mushroom: { scale: [0.8, 2.6], tint: true, make: () => merged([
    [C(0.35, 0.45, 1.4, 8), 0xfff3dd, [0, 0.7, 0]],
    [new THREE.SphereGeometry(1.2, 10, 6, 0, PI * 2, 0, PI / 2), 0xffffff, [0, 1.25, 0], [1, 0.75, 1]],
    [C(1.2, 1.2, 0.08, 10), 0xfff3dd, [0, 1.25, 0]],
  ]) },
  umbrella: { scale: [1, 1.4], tint: true, make: () => merged([
    [C(0.07, 0.07, 3.4, 5), 0xf0f0f0, [0, 1.7, 0]],
    [K(2.3, 0.9, 10), 0xffffff, [0, 3.5, 0]],
    [B(1.6, 0.12, 0.8), 0xffffff, [1.4, 0.3, 0.8]],
  ]) },
  shell: { scale: [0.6, 1.4], tint: true, make: () => merged([
    [ico(0.45, 1), 0xffffff, [0, 0.2, 0], [1, 0.5, 1.2]],
  ]) },
  lavarock: { scale: [0.9, 2.8], make: () => merged([
    [new THREE.DodecahedronGeometry(1.6, 0), 0x3a2630, [0, 1, 0], [1, 1.5, 1]],
    [new THREE.DodecahedronGeometry(0.9, 0), 0x2a1a24, [1.3, 0.5, 0.4]],
    [new THREE.OctahedronGeometry(0.5, 0), 0xff7a1a, [0.2, 2.7, 0], [1, 1.6, 1]],
    [new THREE.OctahedronGeometry(0.35, 0), 0xffc21f, [-0.9, 1.6, 0.6], [1, 1.5, 1]],
  ]) },
  deadtree: { scale: [0.9, 1.6], make: () => merged([
    [C(0.25, 0.5, 5), 0x2a1a20, [0, 2.5, 0]],
    [C(0.1, 0.2, 2.4), 0x2a1a20, [0.9, 4.2, 0], null, [0, 0, -0.9]],
    [C(0.1, 0.2, 2.0), 0x2a1a20, [-0.8, 3.4, 0.2], null, [0.2, 0, 0.9]],
    [C(0.08, 0.14, 1.6), 0x2a1a20, [0.1, 5.4, 0.4], null, [0.6, 0, 0.2]],
  ]) },
  crystal: { scale: [0.8, 2.6], tint: true, glow: true, make: () => merged([
    [new THREE.OctahedronGeometry(1, 0), 0xffffff, [0, 1.8, 0], [0.7, 2.2, 0.7]],
    [new THREE.OctahedronGeometry(0.6, 0), 0xffffff, [0.8, 0.9, 0.3], [0.7, 1.8, 0.7], [0, 0, -0.4]],
    [new THREE.OctahedronGeometry(0.5, 0), 0xffffff, [-0.7, 0.7, -0.2], [0.7, 1.6, 0.7], [0, 0, 0.5]],
  ]) },
  pine: { scale: [0.9, 1.8], make: () => merged([
    [C(0.35, 0.45, 2), 0x6a4630, [0, 1, 0]],
    [K(2.4, 3, 8), 0x1f9a5a, [0, 3, 0]],
    [K(1.9, 2.6, 8), 0x2ab56a, [0, 4.7, 0]],
    [K(1.3, 2.2, 8), 0xf4fbff, [0, 6.3, 0]],
  ]) },
  icecrystal: { scale: [0.8, 2.4], glow: true, make: () => merged([
    [new THREE.OctahedronGeometry(1, 0), 0x9fe6ff, [0, 1.8, 0], [0.7, 2.2, 0.7]],
    [new THREE.OctahedronGeometry(0.6, 0), 0xd6f6ff, [0.8, 0.9, 0.3], [0.7, 1.8, 0.7], [0, 0, -0.4]],
  ]) },
  snowman: { scale: [1, 1.5], make: () => merged([
    [ico(1.1, 1), 0xffffff, [0, 1, 0]],
    [ico(0.8, 1), 0xffffff, [0, 2.5, 0]],
    [ico(0.55, 1), 0xffffff, [0, 3.6, 0]],
    [K(0.12, 0.6, 6), 0xff7a1a, [0, 3.6, 0.7], null, [PI / 2, 0, 0]],
    [C(0.42, 0.42, 0.6, 8), 0x22222c, [0, 4.3, 0]],
    [C(0.65, 0.65, 0.07, 8), 0x22222c, [0, 4.02, 0]],
    [B(1.9, 0.25, 0.3), 0xff3b4a, [0, 3.1, 0.2]],
  ]) },
  building: { scale: [1, 2.6], tint: true, glow: true, make: () => {
    const parts = [[B(7, 16, 7), 0x1a1436, [0, 8, 0]]];
    for (let f = 0; f < 5; f++) for (const s of [-1, 1]) {
      parts.push([B(5.6, 0.7, 0.2), 0xffffff, [0, 2.5 + f * 2.8, 3.55 * s]]);
      parts.push([B(0.2, 0.7, 5.6), 0xffffff, [3.55 * s, 2.5 + f * 2.8, 0]]);
    }
    parts.push([B(7.4, 0.3, 7.4), 0xffffff, [0, 16.1, 0]]);
    return merged(parts);
  } },
  neonpole: { scale: [1, 1.5], tint: true, glow: true, make: () => merged([
    [C(0.15, 0.2, 7, 6), 0x2a2250, [0, 3.5, 0]],
    [new THREE.TorusGeometry(1, 0.16, 6, 14), 0xffffff, [0, 7.6, 0]],
    [ico(0.4, 0), 0xffffff, [0, 7.6, 0]],
  ]) },
  candytree: { scale: [0.9, 1.7], tint: true, make: () => merged([
    [C(0.3, 0.4, 4.5), 0xffffff, [0, 2.2, 0]],
    [ico(2.2, 1), 0xffffff, [0, 5.8, 0]],
    [ico(1.3, 1), 0xfff0a0, [1.5, 4.8, 0.3]],
    [ico(1.2, 1), 0xa0f0ff, [-1.4, 5, -0.4]],
  ]) },
  column: { scale: [1, 1.8], make: () => merged([
    [C(0.9, 0.9, 0.6, 10), 0xffffff, [0, 0.3, 0]],
    [C(0.6, 0.6, 7, 10), 0xfff6ff, [0, 4, 0]],
    [C(0.95, 0.7, 0.6, 10), 0xffffff, [0, 7.6, 0]],
    [ico(0.7, 1), 0xffd700, [0, 8.6, 0]],
  ]) },
};

// Texturas de canvas reutilizables
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

let _glowTex = null;
export function glowTex() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  return _glowTex;
}

let _shadowTex = null, _shadowMat = null;
export function blobShadow(size = 3.4) {
  if (!_shadowTex) _shadowTex = canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ map: _shadowTex, transparent: true, depthWrite: false, fog: false });
  const m = new THREE.Mesh(geo('shadow' + size, () => new THREE.PlaneGeometry(size, size * 1.35)), _shadowMat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.renderOrder = 2;
  return m;
}

// ---------------- OBSTÁCULOS VIVOS ----------------
const HAZARD_GEO = {
  barrel: () => merged([
    [C(1.05, 1.05, 2.1, 12), 0xa8643a, null, null, [PI / 2, 0, 0]],
    [C(1.1, 1.1, 0.2, 12), 0x3a2a22, [0, 0, 0.65], null, [PI / 2, 0, 0]], [C(1.1, 1.1, 0.2, 12), 0x3a2a22, [0, 0, -0.65], null, [PI / 2, 0, 0]],
    [C(0.5, 0.5, 2.14, 8), 0xffd21f, null, null, [PI / 2, 0, 0]],
  ]),
  crab: () => {
    const p = [[ico(0.9, 1), 0xff4a3a, [0, 0.65, 0], [1.35, 0.55, 0.95]]];
    for (const s of [-1, 1]) {
      p.push([ico(0.45, 1), 0xff7a4a, [1.55 * s, 0.85, 0.55], [1, 0.8, 1.2]], [C(0.07, 0.07, 0.5, 5), 0xff4a3a, [0.35 * s, 1.15, 0.35]],
        [ico(0.17, 0), 0xffffff, [0.35 * s, 1.45, 0.35]], [ico(0.08, 0), 0x111111, [0.35 * s, 1.47, 0.5]]);
      for (let i = 0; i < 3; i++) p.push([B(0.7, 0.12, 0.14), 0xd93a2a, [1.25 * s, 0.35, -0.5 + i * 0.4], null, [0, 0, -0.5 * s]]);
    }
    return merged(p);
  },
  penguin: () => merged([
    [ico(0.8, 1), 0x1c2238, [0, 1.0, 0], [0.9, 1.3, 0.9]], [ico(0.62, 1), 0xffffff, [0, 0.9, 0.3], [0.85, 1.25, 0.6]],
    [ico(0.5, 1), 0x1c2238, [0, 2.1, 0]], [K(0.16, 0.45, 6), 0xff9a1a, [0, 2.05, 0.55], null, [PI / 2, 0, 0]],
    [ico(0.1, 0), 0xffffff, [0.2, 2.25, 0.4]], [ico(0.1, 0), 0xffffff, [-0.2, 2.25, 0.4]],
    [B(0.16, 0.9, 0.5), 0x1c2238, [0.75, 1.1, 0], null, [0, 0, 0.35]], [B(0.16, 0.9, 0.5), 0x1c2238, [-0.75, 1.1, 0], null, [0, 0, -0.35]],
    [B(0.4, 0.12, 0.6), 0xff9a1a, [0.3, 0.06, 0.25]], [B(0.4, 0.12, 0.6), 0xff9a1a, [-0.3, 0.06, 0.25]],
  ]),
  drone: () => merged([
    [B(1.5, 0.9, 1.5), 0x6a4cff, [0, 1.4, 0]], [B(1.1, 0.3, 0.1), 0x16161c, [0, 1.5, 0.76]],
    [ico(0.2, 0), 0x22e6ff, [0.25, 1.5, 0.8]], [ico(0.2, 0), 0x22e6ff, [-0.25, 1.5, 0.8]],
    [C(0.04, 0.04, 0.7, 4), 0xdddddd, [0, 2.2, 0]], [ico(0.14, 0), 0xff2fd0, [0, 2.6, 0]],
    [C(0.6, 0.6, 0.06, 10), 0xff2fd0, [0.9, 1.95, 0.9]], [C(0.6, 0.6, 0.06, 10), 0xff2fd0, [-0.9, 1.95, 0.9]],
    [C(0.6, 0.6, 0.06, 10), 0xff2fd0, [0.9, 1.95, -0.9]], [C(0.6, 0.6, 0.06, 10), 0xff2fd0, [-0.9, 1.95, -0.9]],
  ]),
  star: () => {
    const p = [[ico(0.85, 1), 0xffe600, [0, 1.1, 0], [1, 1, 0.7]], [ico(0.12, 0), 0x16161c, [0.25, 1.25, 0.56]], [ico(0.12, 0), 0x16161c, [-0.25, 1.25, 0.56]]];
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + PI / 2; p.push([K(0.42, 1.0, 5), 0xffc400, [Math.cos(a) * 1.05, 1.1 + Math.sin(a) * 1.05, 0], [1, 1, 0.6], [0, 0, a - PI / 2]]); }
    return merged(p);
  },
  geyser: () => {
    const p = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; p.push([new THREE.DodecahedronGeometry(0.62, 0), i % 2 ? 0x3a2630 : 0x2a1a24, [Math.cos(a) * 1.9, 0.25, Math.sin(a) * 1.9], [1, 0.8 + (i % 3) * 0.3, 1]]); }
    return merged(p);
  },
  meteor: () => merged([[new THREE.DodecahedronGeometry(1.5, 0), 0x2a1a24, null], [new THREE.OctahedronGeometry(0.8, 0), 0xff7a1a, [0.8, 0.6, 0.5]], [new THREE.OctahedronGeometry(0.7, 0), 0xffc21f, [-0.7, -0.5, 0.6]]]),
};
const hazGeo = new Map();
let hazMat = null;
export function makeHazard(type) {
  if (!hazGeo.has(type)) hazGeo.set(type, HAZARD_GEO[type]());
  if (!hazMat) hazMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Mesh(hazGeo.get(type), hazMat); addOutline(m);
  return m;
}

// ---------------- TROFEO ----------------
export function makeTrophy(color = 0xffd21f) {
  const m = toon(color, 0x6a4a00), g = new THREE.Group();
  add(g, cyl(0.55, 0.65, 0.25, 14), toon(0x4a2a6a), [0, 0.12, 0]);
  add(g, cyl(0.12, 0.3, 0.55, 10), m, [0, 0.5, 0]);
  add(g, cyl(0.62, 0.22, 0.8, 16), m, [0, 1.15, 0]);
  add(g, torus(0.62, 0.06), m, [0, 1.55, 0], null, [PI / 2, 0, 0]);
  for (const s of [-1, 1]) add(g, torus(0.27, 0.06), m, [0.72 * s, 1.2, 0], [0.8, 1, 1]);
  add(g, sphere(0.16, 8), toon(0xff4fd8, 0xff4fd8), [0, 1.72, 0]);
  return g;
}
