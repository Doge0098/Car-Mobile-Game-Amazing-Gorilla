// Modelos 3D hechos por código: gorilas, coches y decorado.
import * as THREE from './vendor/three.module.min.js';

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

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const sphere = (r, d = 12) => geo('s' + r + '_' + d, () => new THREE.SphereGeometry(r, d, Math.max(6, d - 2)));
const box = (x, y, z) => geo('b' + x + '_' + y + '_' + z, () => new THREE.BoxGeometry(x, y, z));
const cyl = (a, b, h, s = 12) => geo('c' + a + '_' + b + '_' + h + '_' + s, () => new THREE.CylinderGeometry(a, b, h, s));
const capsule = (r, l) => geo('k' + r + '_' + l, () => new THREE.CapsuleGeometry(r, l, 4, 10));
const torus = (r, t) => geo('t' + r + '_' + t, () => new THREE.TorusGeometry(r, t, 8, 18));
const cone = (r, h, s = 10) => geo('n' + r + '_' + h + '_' + s, () => new THREE.ConeGeometry(r, h, s));

function add(parent, geometry, material, pos, scale, rot) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
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

export function makeGorilla(ch, override, standing = false) {
  const M = c => override || toon(c);
  const fur = M(ch.fur), skin = M(ch.skin), dark = M(0x16161c), white = M(0xffffff), accM = M(ch.accColor), inMouth = M(0x5a1420);
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);

  add(body, sphere(0.62), fur, [0, 0.75, 0], [1.15, 1.1, 0.95]);
  add(body, sphere(0.45), skin, [0, 0.84, 0.34], [1.1, 0.9, 0.5]);
  // piernas (sentado o de pie)
  for (const s of [-1, 1]) {
    if (standing) {
      add(body, capsule(0.19, 0.5), fur, [0.3 * s, -0.1, 0]);
      add(body, sphere(0.2), skin, [0.3 * s, -0.62, 0.12], [1, 0.7, 1.4]);
    } else {
      add(body, capsule(0.19, 0.5), fur, [0.32 * s, 0.26, 0.45], null, [1.35, 0, 0]);
      add(body, sphere(0.2), skin, [0.32 * s, 0.2, 0.86], [1, 0.8, 1.3]);
    }
  }
  // cabeza
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.05); body.add(head);
  add(head, sphere(0.46), fur, [0, 0, 0], [1, 1.05, 1]);
  add(head, sphere(0.3), fur, [0, 0.3, -0.06], [0.9, 0.95, 1.05]);
  add(head, sphere(0.36), skin, [0, -0.02, 0.2], [1, 0.95, 0.72]);
  add(head, sphere(0.24), skin, [0, -0.17, 0.36], [1.2, 0.82, 0.85]);
  add(head, box(0.62, 0.11, 0.2), fur, [0, 0.14, 0.36]);
  const eyes = [], pupils = [], brows = [];
  for (const s of [-1, 1]) {
    add(head, sphere(0.03, 6), dark, [0.06 * s, -0.11, 0.565]);
    eyes.push(add(head, sphere(0.09, 8), white, [0.15 * s, 0.02, 0.43]));
    pupils.push(add(head, sphere(0.048, 8), dark, [0.15 * s, 0.02, 0.5]));
    brows.push(add(head, box(0.21, 0.05, 0.05), dark, [0.15 * s, 0.135, 0.475]));
    add(head, sphere(0.12, 8), skin, [0.46 * s, 0.02, -0.02], [0.6, 1, 1]);
  }
  const mouth = new THREE.Group(); mouth.position.set(0, -0.235, 0.535); head.add(mouth);
  add(mouth, sphere(0.1, 8), inMouth, null, [1, 1, 0.4]);
  const teeth = add(mouth, box(0.17, 0.035, 0.04), white, [0, 0.05, 0.03]);
  // accesorios
  switch (ch.acc) {
    case 'cap':
      add(head, sphere(0.47), accM, [0, 0.14, -0.02], [1.02, 0.75, 1.04]);
      add(head, box(0.5, 0.05, 0.36), accM, [0, 0.24, 0.5]);
      break;
    case 'bow':
      for (const s of [-1, 1]) add(head, cone(0.17, 0.3, 8), accM, [0.17 * s, 0.56, 0], null, [0, 0, s * Math.PI / 2]);
      add(head, sphere(0.08, 8), accM, [0, 0.56, 0]);
      break;
    case 'glasses':
      for (const s of [-1, 1]) add(head, box(0.22, 0.14, 0.05), accM, [0.15 * s, 0.03, 0.535]);
      add(head, box(0.9, 0.04, 0.04), accM, [0, 0.06, 0.5]);
      break;
    case 'headphones':
      add(head, torus(0.5, 0.05), accM, [0, 0.06, 0], [1, 1, 1], [0, 0, 0]);
      for (const s of [-1, 1]) add(head, cyl(0.17, 0.17, 0.12), accM, [0.5 * s, 0.02, 0], null, [0, 0, Math.PI / 2]);
      break;
    case 'mohawk':
      for (let i = 0; i < 5; i++) add(head, cone(0.1, 0.34, 6), accM, [0, 0.5 - Math.abs(i - 1.5) * 0.04, 0.3 - i * 0.16], null, [-0.3 + i * 0.2, 0, 0]);
      break;
    case 'crown':
      add(head, cyl(0.3, 0.26, 0.16, 10), accM, [0, 0.58, -0.03]);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        add(head, cone(0.07, 0.2, 5), accM, [Math.sin(a) * 0.27, 0.74, Math.cos(a) * 0.27 - 0.03]);
      }
      break;
  }
  // brazos (pivote en el hombro)
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(0.64 * s, 1.15, 0.05);
    p.rotation.order = 'YXZ';
    add(p, capsule(0.18, 0.62), fur, [0, -0.45, 0]);
    add(p, sphere(0.2, 8), skin, [0, -0.93, 0]);
    body.add(p); arms.push(p);
  }
  g.userData = { body, head, armL: arms[1], armR: arms[0], eyes, pupils, brows, mouth, teeth, baseY: standing ? 0.85 : 0, face: FACES.neutral.slice(), blink: Math.random() * 4 };
  return g;
}

// o: { steer, mode, speedK, face, look, throwK, taunt, dt }
// mode: drive | pound | cheer | dizzy | sad | trick | idle | dance | clap | wave
export function animateGorilla(g, t, o = {}) {
  const u = g.userData, { body, head, armL, armR } = u;
  const steer = o.steer || 0, mode = o.mode || 'drive', dt = o.dt || 0.016;
  // --- cara ---
  const target = FACES[o.face] || FACES.neutral, f = u.face, k = Math.min(1, dt * 12);
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

// ---------------- COCHE ----------------
export function makeKart(def, colorOverride, override) {
  const M = (c, e) => override || toon(c, e);
  const c1 = M(colorOverride || def.color), c2 = M(def.color2), dark = M(0x1c1c24), metal = M(0xb9c2d0), white = M(0xffffff);
  const k = new THREE.Group();
  const bodyG = new THREE.Group(); k.add(bodyG);
  const sh = def.shape;
  const wide = sh === 2 ? 1.12 : 1, long = sh === 1 || sh === 3 ? 1.12 : 1;

  add(bodyG, box(1.7, 0.36, 3.0), c1, [0, 0.52, 0], [wide, 1, 1]);
  add(bodyG, box(1.15, 0.3, 0.95), c1, [0, 0.5, 1.85], [1, 1, long]);
  add(bodyG, cyl(0.58, 0.58, 0.3, 12), c1, [0, 0.5, 2.3 * (long > 1 ? 1.05 : 1)], [1, 1, 0.8]);
  add(bodyG, box(0.34, 0.03, 3.6), white, [0, 0.71, 0.35], [1, 1, long > 1 ? 1.05 : 1]);
  add(bodyG, box(1.95, 0.2, 0.26), c2, [0, 0.4, 2.2], [wide, 1, 1]);
  for (const s of [-1, 1]) {
    add(bodyG, box(0.38, 0.32, 1.5), c2, [1.0 * s * wide, 0.52, -0.05]);
    add(bodyG, sphere(0.13, 8), M(0xfff6b0, 0xffe680), [0.38 * s, 0.56, 2.52 * (long > 1 ? 1.05 : 1)]);
    add(bodyG, cyl(0.1, 0.13, 0.7, 8), metal, [0.42 * s, 0.95, -1.78], null, [1.25, 0, 0]);
  }
  add(bodyG, box(1.25, 0.95, 0.26), c2, [0, 1.08, -0.98]);
  add(bodyG, box(1.1, 0.5, 0.7), dark, [0, 0.88, -1.42]);
  add(bodyG, cyl(0.04, 0.04, 0.8, 6), dark, [0, 0.95, 0.72], null, [-0.75, 0, 0]);
  const wheel = add(bodyG, torus(0.27, 0.055), dark, [0, 1.22, 0.47], null, [-0.75, 0, 0]);

  // alerones según modelo
  if (sh === 0 || sh === 1 || sh === 4) {
    const w = sh === 1 ? 2.4 : 2.0;
    add(bodyG, box(w, 0.08, 0.55), c1, [0, 1.62, -1.72]);
    for (const s of [-1, 1]) add(bodyG, box(0.08, 0.5, 0.4), c2, [0.7 * s, 1.36, -1.7]);
    for (const s of [-1, 1]) add(bodyG, box(0.08, 0.3, 0.6), c2, [w / 2 * s, 1.68, -1.72]);
  }
  if (sh === 2) {
    add(bodyG, cyl(0.07, 0.07, 2.1, 8), metal, [0, 0.78, 2.42], null, [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) add(bodyG, cyl(0.06, 0.06, 0.5, 6), metal, [0.7 * s, 0.6, 2.4]);
    add(bodyG, box(1.5, 0.12, 0.9), c1, [0, 1.6, -1.2]);
  }
  if (sh === 3) {
    for (const s of [-1, 1]) add(bodyG, box(0.08, 0.75, 1.2), c1, [0.82 * s, 1.1, -1.35], null, [0.5, 0, s * -0.25]);
    add(bodyG, cone(0.3, 1.0, 8), c2, [0, 0.55, 2.9], null, [Math.PI / 2, 0, 0]);
  }
  if (sh === 4) {
    const glow = M(0x22e6ff, 0x22e6ff);
    for (const s of [-1, 1]) add(bodyG, box(0.07, 0.07, 3.0), glow, [0.86 * s, 0.72, 0]);
    add(bodyG, box(1.6, 0.06, 0.08), glow, [0, 1.67, -1.44]);
  }

  // ruedas
  const wheels = [];
  const rr = sh === 2 ? 0.56 : 0.48, fr = sh === 2 ? 0.5 : 0.42;
  const defs = [[1.08 * wide, fr, 1.3, fr], [-1.08 * wide, fr, 1.3, fr], [1.12 * wide, rr, -1.2, rr], [-1.12 * wide, rr, -1.2, rr]];
  for (const [x, y, z, r] of defs) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z);
    const spin = new THREE.Group(); pivot.add(spin);
    add(spin, cyl(1, 1, 0.42, 14), dark, null, [r, 1, r], [0, 0, Math.PI / 2]);
    add(spin, cyl(0.5, 0.5, 0.46, 6), c1, null, [r, 1, r], [0, 0, Math.PI / 2]);
    k.add(pivot); wheels.push({ pivot, spin, front: z > 0 });
  }
  k.userData = { bodyG, wheels, wheel };
  return k;
}

export function animateKart(k, dt, speed, steer) {
  const u = k.userData;
  for (const w of u.wheels) {
    w.spin.rotation.x += speed * dt / 0.45;
    if (w.front) w.pivot.rotation.y = -steer * 0.4;
  }
  u.wheel.rotation.z = steer * 0.9;
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
  return new THREE.Mesh(hazGeo.get(type), hazMat);
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
