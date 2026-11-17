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

// Accesorio propio de cada personaje (ch.acc): añade sus piezas a la cabeza h con el color acc
const ACC_BUILD = {
  cap(h, acc) { h.push([sphere(0.47), acc, [0, 0.14, -0.02], [1.02, 0.75, 1.04]], [box(0.5, 0.05, 0.36), acc, [0, 0.24, 0.5]], [sphere(0.07, 8), WHITE, [0, 0.5, -0.02]]); },
  bow(h, acc) { for (const s of [-1, 1]) h.push([cone(0.17, 0.3, 8), acc, [0.17 * s, 0.56, 0], null, [0, 0, s * HPI]]); h.push([sphere(0.08, 8), acc, [0, 0.56, 0]]); },
  glasses(h, acc) { for (const s of [-1, 1]) h.push([box(0.22, 0.14, 0.05), acc, [0.15 * s, 0.03, 0.535]]); h.push([box(0.9, 0.04, 0.04), acc, [0, 0.06, 0.5]]); },
  headphones(h, acc) { h.push([torus(0.5, 0.05), acc, [0, 0.06, 0]]); for (const s of [-1, 1]) h.push([cyl(0.17, 0.17, 0.12), acc, [0.5 * s, 0.02, 0], null, [0, 0, HPI]]); },
  mohawk(h, acc) { for (let i = 0; i < 5; i++) h.push([cone(0.1, 0.34, 6), acc, [0, 0.5 - Math.abs(i - 1.5) * 0.04, 0.3 - i * 0.16], null, [-0.3 + i * 0.2, 0, 0]]); },
  crown(h, acc) {
    h.push([cyl(0.3, 0.26, 0.16, 10), acc, [0, 0.58, -0.03]]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; h.push([cone(0.07, 0.2, 5), acc, [Math.sin(a) * 0.27, 0.74, Math.cos(a) * 0.27 - 0.03]]); }
  },
  // gafas de aviador subidas a la frente
  goggles(h, acc) {
    h.push([torus(0.41, 0.04), 0x5a3a22, [0, 0.27, -0.01], [1, 1.04, 1], [HPI, 0, 0]]);
    for (const s of [-1, 1]) h.push([cyl(0.125, 0.125, 0.09, 12), acc, [0.145 * s, 0.31, 0.37], null, [HPI - 0.4, 0, 0]], [cyl(0.085, 0.085, 0.1, 12), 0xbfefff, [0.145 * s, 0.313, 0.378], null, [HPI - 0.4, 0, 0]]);
  },
  // cinta en la frente con el nudo y dos puntas por detrás
  bandana(h, acc) {
    h.push([torus(0.43, 0.06), acc, [0, 0.23, -0.01], [1, 1.04, 0.8], [HPI, 0, 0]], [sphere(0.09, 8), acc, [0, 0.23, -0.47]]);
    for (const s of [-1, 1]) h.push([box(0.1, 0.34, 0.03), acc, [0.09 * s, 0.07, -0.52], null, [0.35, 0, 0.3 * s]]);
  },
};
const FACE_ACC = { glasses: 1 }; // accesorios de la cara: se conservan aunque lleve sombrero

// Sombreros de la tienda (id de HATS en shop.js): sustituyen al accesorio. La coronilla está en y ≈ 0.58.
const HAT_BUILD = {
  fiesta(h) {
    h.push([cone(0.24, 0.62, 12), 0xff4fd8, [0.02, 0.82, -0.05], null, [-0.1, 0, -0.08]], [torus(0.235, 0.045), WHITE, [0, 0.53, -0.03], null, [HPI, 0, 0]],
      [torus(0.16, 0.035), 0xffd21f, [0.01, 0.7, -0.04], null, [HPI, 0, 0]], [torus(0.09, 0.03), 0x22e6ff, [0.03, 0.9, -0.06], null, [HPI, 0, 0]], [sphere(0.09, 8), 0xffd21f, [0.045, 1.15, -0.08]]);
  },
  flor(h) {
    const c = [0.3, 0.46, 0.13];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; h.push([sphere(0.12, 8), 0xff5ec4, [c[0] + Math.cos(a) * 0.14, c[1] + Math.sin(a) * 0.14, c[2]], [1, 1, 0.45]]); }
    h.push([sphere(0.085, 8), 0xffe14a, [c[0], c[1], c[2] + 0.05]], [cone(0.09, 0.3, 4), 0x2fae4a, [c[0] + 0.2, c[1] - 0.2, c[2] - 0.04], [1, 1, 0.4], [0, 0, -2.2]]);
  },
  gorra(h) {
    h.push([sphere(0.47), 0x31b6ff, [0, 0.14, -0.02], [1.02, 0.75, 1.04]], [box(0.5, 0.05, 0.38), 0x1a6ad8, [0, 0.2, -0.56], null, [0.18, 0, 0]],
      [sphere(0.07, 8), WHITE, [0, 0.5, -0.02]], [box(0.3, 0.14, 0.04), WHITE, [0, 0.3, 0.45], null, [-0.35, 0, 0]]);
  },
  chistera(h) {
    h.push([cyl(0.5, 0.5, 0.05, 18), 0x22222c, [0, 0.5, -0.03]], [cyl(0.34, 0.3, 0.5, 18), 0x22222c, [0, 0.77, -0.03]], [cyl(0.315, 0.31, 0.11, 18), 0xff3b4a, [0, 0.585, -0.03]]);
  },
  pirata(h) {
    h.push([sphere(0.47), 0x22222c, [0, 0.24, -0.02], [1.03, 0.8, 1.03]], [cyl(0.66, 0.66, 0.07, 3), 0x22222c, [0, 0.4, -0.06]], [cyl(0.67, 0.67, 0.03, 3), 0xffd21f, [0, 0.4, -0.06]],
      [sphere(0.085, 8), WHITE, [0, 0.47, 0.43]], [box(0.07, 0.07, 0.04), WHITE, [0, 0.4, 0.46]]);
    for (const s of [-1, 1]) h.push([box(0.3, 0.045, 0.03), WHITE, [0, 0.45, 0.44], null, [-0.5, 0, 0.6 * s]]);
  },
  casco(h) {
    h.push([sphere(0.5), 0xff3b4a, [0, 0.2, -0.04], [1.03, 0.82, 1.06]], [sphere(0.5), WHITE, [0, 0.2, -0.04], [0.24, 0.84, 1.08]],
      [box(0.74, 0.15, 0.06), 0x22e6ff, [0, 0.4, 0.42], null, [-0.55, 0, 0]]);
    for (const s of [-1, 1]) h.push([cyl(0.16, 0.16, 0.1, 12), 0x22222c, [0.5 * s, -0.02, 0.02], null, [0, 0, HPI]]);
  },
  vikingo(h) {
    h.push([sphere(0.47), 0xaab4c4, [0, 0.2, -0.02], [1.03, 0.85, 1.05]], [torus(0.47, 0.05), 0xd9a11c, [0, 0.2, -0.02], [1.03, 1.05, 1], [HPI, 0, 0]], [sphere(0.08, 8), 0xd9a11c, [0, 0.61, -0.02]]);
    for (const s of [-1, 1]) h.push([cyl(0.075, 0.125, 0.36, 8), 0xfff3d6, [0.56 * s, 0.36, -0.02], null, [0, 0, -1.05 * s]], [cone(0.085, 0.36, 8), 0xfff3d6, [0.76 * s, 0.6, -0.02], null, [0, 0, -0.2 * s]]);
  },
  corona(h) {
    h.push([cyl(0.34, 0.3, 0.2, 12), 0xffd21f, [0, 0.6, -0.03]], [sphere(0.29), 0xc0183a, [0, 0.68, -0.03], [1, 0.62, 1]], [sphere(0.06, 8), 0xffd21f, [0, 0.89, -0.03]]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      h.push([cone(0.08, 0.24, 5), 0xffd21f, [sx * 0.31, 0.8, cz * 0.31 - 0.03]], [sphere(0.05, 6), i % 2 ? 0x22e6ff : 0xff3b4a, [sx * 0.335, 0.6, cz * 0.335 - 0.03]]);
    }
  },
};
const HAT_KEEPS_TUFTS = { flor: 1 }; // sombreros que dejan ver los mechones de la coronilla

// Geometrías del gorila en caché, por piezas: el tronco depende de la postura, la cabeza del sombrero
// (su clave lo incluye) y los brazos solo del personaje. Así un sombrero nuevo solo crea una cabeza.
const gorillaCache = new Map();
const gorillaPart = (key, make) => { let g = gorillaCache.get(key); if (!g) gorillaCache.set(key, g = make()); return g; };
function gorillaGeos(ch, standing, hat) {
  const hatFn = (hat && HAT_BUILD[hat]) || null;
  return {
    torso: gorillaPart(ch.id + (standing ? '_torso_s' : '_torso'), () => gorillaTorso(ch, standing)),
    head: gorillaPart(ch.id + '_head' + (hatFn ? '_' + hat : ''), () => gorillaHead(ch, hat, hatFn)),
    armP: gorillaPart(ch.id + '_armP', () => gorillaArm(ch, 1)), armN: gorillaPart(ch.id + '_armN', () => gorillaArm(ch, -1)),
  };
}
function gorillaTorso(ch, standing) {
  const fur = ch.fur, skin = ch.skin, acc = ch.accColor, furD = shade(fur, 0.72);
  // --- tronco y piernas ---
  const t = [
    [sphere(0.62), fur, [0, 0.75, 0], [1.15, 1.1, 0.95]],
    [sphere(0.45), skin, [0, 0.84, 0.34], [1.1, 0.9, 0.5]],
    [sphere(0.3, 10), skin, [-0.2, 0.98, 0.38], [1, 0.8, 0.5]], [sphere(0.3, 10), skin, [0.2, 0.98, 0.38], [1, 0.8, 0.5]],
    [sphere(0.035, 6), DARK, [0, 0.52, 0.56]],
    [sphere(0.2, 8), ch.back || furD, [0, 0.95, -0.5], [1.6, 1.8, 0.6]],
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
  return bake(t);
}
function gorillaHead(ch, hat, hatFn) {
  const fur = ch.fur, skin = ch.skin, acc = ch.accColor, furD = shade(fur, 0.72), skinD = shade(skin, 0.7);
  // --- cabeza ---
  const h = [
    [sphere(0.46), fur, null, [1, 1.05, 1]], [sphere(0.3), fur, [0, 0.3, -0.06], [0.9, 0.95, 1.05]],
    [sphere(0.36), skin, [0, -0.02, 0.2], [1, 0.95, 0.72]], [sphere(0.24), skin, [0, -0.17, 0.36], [1.2, 0.82, 0.85]],
    [box(0.62, 0.11, 0.2), fur, [0, 0.14, 0.36]],
  ];
  if (!hatFn || HAT_KEEPS_TUFTS[hat]) for (const [x, y, z, r] of [[0, 0.62, 0.02, 0], [-0.13, 0.57, -0.02, 0.45], [0.13, 0.57, -0.02, -0.45]]) h.push([cone(0.09, 0.26, 6), furD, [x, y, z], null, [0.15, 0, r]]);
  for (const s of [-1, 1]) {
    h.push([sphere(0.03, 6), DARK, [0.06 * s, -0.11, 0.565]],
      [sphere(0.12, 8), skin, [0.46 * s, 0.02, -0.02], [0.6, 1, 1]], [sphere(0.065, 8), skinD, [0.5 * s, 0.02, 0.03], [0.5, 1, 1]],
      [sphere(0.2, 10), fur, [0.36 * s, -0.16, 0.12], [0.7, 1.1, 0.8]]);
    for (let i = 0; i < 2; i++) h.push([cone(0.06, 0.2, 5), furD, [0.4 * s, -0.3 - i * 0.07, 0.14 - i * 0.1], null, [0, 0, -2.4 * s]]);
  }
  // accesorio del personaje o, si lleva uno, el sombrero de la tienda
  if (hatFn) hatFn(h, acc);
  if (ACC_BUILD[ch.acc] && (!hatFn || FACE_ACC[ch.acc])) ACC_BUILD[ch.acc](h, acc);
  return bake(h);
}
// --- brazo con mano, dedos, pulgar y muñequera ---
function gorillaArm(ch, s) {
  const fur = ch.fur, skin = ch.skin, acc = ch.accColor, furD = shade(fur, 0.72);
  const a = [[capsule(0.18, 0.62), fur, [0, -0.45, 0]], [sphere(0.24, 10), furD, [0, -0.1, 0], [1, 0.8, 1]], [sphere(0.2, 8), skin, [0, -0.93, 0]],
    [torus(0.19, 0.05), acc, [0, -0.74, 0], null, [HPI, 0, 0]], [capsule(0.055, 0.09), skin, [0.19 * s, -0.98, 0.08], null, [0.2, 0, 0.9 * s]]];
  for (let i = -1; i <= 1; i++) a.push([capsule(0.055, 0.1), skin, [i * 0.1, -1.1, 0.05], null, [0.25, 0, i * -0.18]]);
  return bake(a);
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

// hat: id de sombrero de la tienda (null o 'none' = el accesorio propio del personaje)
export function makeGorilla(ch, override, standing = false, hat = null) {
  const G = gorillaGeos(ch, standing, hat), F = faceGeos(), M = override || toonVC, ol = !override;
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
//  y los bailes de la tienda (DANCES en shop.js): robot | disco | molino | peonza
// userData.dance: baile fijo que manda sobre el modo pedido (vista previa del garaje)
export function animateGorilla(g, t, o = {}) {
  const u = g.userData, { body, head, armL, armR } = u;
  const steer = o.steer || 0, mode = u.dance || o.mode || 'drive', dt = o.dt || 0.016;
  // --- cara ---
  if (u.face.visible) {
    const target = FACES[u.dance ? 'happy' : o.face] || FACES.neutral, f = u.face6, k = Math.min(1, dt * 12);
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
  const ax = -1.13, ay = 0.42, sit = !u.baseY; // sentado en el coche (de pie, en el podio)
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
  } else if (mode === 'robot') {
    // robot: posturas secas que cambian a golpes (un brazo al frente, arriba, abajo...) y la cabeza gira a tirones
    const b = t * 3.2, i = Math.floor(b), k = Math.min(1, (b - i) * 4.5), e = k * k * (3 - 2 * k);
    const pose = (a, n) => a[(((i + n) % 4) + 4) % 4], mix = a => pose(a, -1) + (pose(a, 0) - pose(a, -1)) * e;
    armL.rotation.set(mix(ROBOT_L), 0, -0.12); armR.rotation.set(mix(ROBOT_R), 0, 0.12);
    head.rotation.set(0, mix(ROBOT_H), 0);
    body.rotation.set(0, mix(ROBOT_H) * (sit ? -0.15 : -0.45), mix(ROBOT_H) * 0.12);
    body.position.y += (1 - k) * 0.07;
  } else if (mode === 'disco') {
    // disco: un brazo señala al cielo y cruza hacia abajo al compás; cada dos compases cambia de brazo
    const b = t * 5.2, k = 0.5 + 0.5 * Math.max(-1, Math.min(1, Math.sin(b) * 2.4)), sd = Math.floor(b / (Math.PI * 4)) % 2 ? -1 : 1;
    const P = sd > 0 ? armR : armL, Q = sd > 0 ? armL : armR;
    P.rotation.set(-0.75 - 1.9 * k, 0, sd * (0.95 - 1.45 * k)); Q.rotation.set(0.35 * (2 * k - 1), 0, sd * 0.3);
    body.position.y += Math.abs(Math.sin(b)) * 0.1;
    body.rotation.set(0, sd * (0.5 - k) * (sit ? 0.25 : 0.7), sd * (k - 0.5) * 0.22);
    head.rotation.set(0.12 - 0.4 * k, sd * (0.5 - k) * 0.7, 0);
  } else if (mode === 'molino') {
    // molino: los brazos dan vueltas completas, uno detrás de otro (sentado se abren para no rozar el coche)
    const a = t * 7.5, op = sit ? 0.6 : 0.28;
    armL.rotation.set(-a, 0, op); armR.rotation.set(-a + Math.PI, 0, -op);
    body.position.y += Math.abs(Math.sin(a)) * 0.1;
    body.rotation.set(0, Math.sin(a * 0.5) * (sit ? 0.12 : 0.4), Math.sin(a) * 0.06);
    head.rotation.set(-0.15, Math.sin(a * 0.5) * 0.35, Math.sin(a) * 0.1);
  } else if (mode === 'peonza') {
    // peonza: salto con vuelta completa y brazos en cruz, y al caer los levanta (sentado el tronco solo se retuerce)
    const c = (t * 0.85) % 1, e = Math.min(1, c / 0.62), sp = e * e * (3 - 2 * e), jump = Math.sin(e * Math.PI), up = c > 0.62 ? Math.sin((c - 0.62) / 0.38 * Math.PI) : 0;
    armL.rotation.set(-2.9 * up, 0, 1.35 - 0.9 * up); armR.rotation.set(-2.9 * up, 0, -1.35 + 0.9 * up);
    body.position.y += jump * (sit ? 0.14 : 0.85) + up * 0.06;
    body.rotation.set(0, sit ? Math.sin(sp * Math.PI * 2) * 0.45 : sp * Math.PI * 2, 0);
    head.rotation.set(-0.15 - 0.2 * up, 0, Math.sin(t * 6) * 0.08);
  }
}
// posturas del baile del robot: giro de cada brazo (hacia delante) y de la cabeza
const ROBOT_L = [-1.57, -2.9, -1.57, -0.15], ROBOT_R = [-0.15, -1.57, -2.9, -1.57], ROBOT_H = [0.65, 0, -0.65, 0];

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
  // Piña Turbo: una piña tumbada, con la corona de hojas como alerón y dos escapes
  pina(c1, c2) {
    const b = [[sphere(1, 16), c1, [0, 0.9, 0.15], [1.08, 0.72, 2.25]]], dark = shade(c1, 0.7), leaf2 = shade(c2, 0.78);
    // rombos de la piel: filas de bultos alternadas (se dejan libres la cabina y la panza)
    for (let i = 0; i < 9; i++) {
      const t = -0.84 + i * 0.21, rad = Math.sqrt(1 - t * t), z = 0.15 + t * 2.25;
      for (let j = 0; j < 8; j++) {
        const a = -1.75 + (j + (i % 2) * 0.5) * 0.47, x = Math.sin(a) * 1.08 * rad, y = 0.9 + Math.cos(a) * 0.72 * rad;
        if (a > 1.8 || (Math.abs(x) < 0.7 && z > -1.45 && z < 1.0 && y > 1.2)) continue;
        b.push([sphere(0.13, 6), dark, [x, y, z], [1, 0.75, 1]]);
      }
    }
    for (const [ax, zs, n, len] of [[-1.15, 0.34, 5, 1.25], [-0.6, 0.38, 4, 1.05], [-0.15, 0.5, 3, 0.85]]) for (let i = 0; i < n; i++) {
      const az = (i - (n - 1) / 2) * zs;
      b.push([cone(0.24, len, 5), i % 2 ? leaf2 : c2, [-Math.sin(az) * 0.5, 1.25 + Math.cos(ax) * 0.5 * Math.cos(az), -2.0 + Math.sin(ax) * 0.5 * Math.cos(az)], [1, 1, 0.45], [ax, 0, az]]);
    }
    for (const s of [-1, 1]) b.push([cyl(0.11, 0.16, 0.9, 8), METAL, [0.8 * s, 0.62, -1.75], null, [HPI + 0.15, 0, 0]], [cyl(0.085, 0.085, 0.06, 8), DARK, [0.8 * s, 0.56, -2.2], null, [HPI + 0.15, 0, 0]]);
    cabin(b, 0.98, c2);
    return { parts: b, glow: [[sphere(0.13, 8), LIGHT, [0.4, 0.95, 2.2]], [sphere(0.13, 8), LIGHT, [-0.4, 0.95, 2.2]]],
      wheels: [[1.15, 0.44, 1.3], [-1.15, 0.44, 1.3], [1.18, 0.5, -1.15], [-1.18, 0.5, -1.15]], seat: 0.98, hub: c2 };
  },
  // Tiburón Feroz: morro con dientes, aleta dorsal, aletas laterales y cola
  tiburon(c1, c2) {
    const dark = shade(c1, 0.62), b = [
      [capsule(0.8, 2.3), c1, [0, 0.82, -0.2], [1.12, 1, 0.7], [HPI, 0, 0]], [capsule(0.74, 2.2), c2, [0, 0.5, -0.1], [1.1, 1, 0.55], [HPI, 0, 0]],
      [cone(0.8, 1.7, 14), c1, [0, 0.9, 2.2], [1.05, 1, 0.52], [HPI, 0, 0]], [cone(0.62, 1.5, 12), c2, [0, 0.48, 1.9], [1.05, 1, 0.32], [HPI - 0.16, 0, 0]],
      [box(0.62, 0.12, 1.2), 0x8a1a2a, [0, 0.66, 1.95], null, [-0.2, 0, 0]],
      [cone(0.5, 1.5, 8), c1, [0, 0.84, -2.55], [1, 1, 0.75], [-HPI, 0, 0]],
      [cone(0.55, 1.25, 4), c1, [0, 1.85, -1.85], [0.16, 1, 1], [-0.45, 0, 0]],
      [cone(0.42, 1.4, 4), c1, [0, 1.42, -3.15], [0.14, 1, 1], [-0.7, 0, 0]], [cone(0.34, 0.9, 4), c1, [0, 0.42, -3.1], [0.14, 1, 1], [-2.35, 0, 0]],
    ];
    for (const s of [-1, 1]) {
      // dientes a lo largo del borde del morro (que sube hacia la punta)
      for (let z = 1.45; z <= 2.66; z += 0.3) { const k = 1 - (z - 1.35) / 1.7; b.push([cone(0.075, 0.22, 5), WHITE, [0.84 * k * 0.66 * s, 0.86 - 0.416 * k * 0.72, z], null, [Math.PI, 0, 0]]); }
      for (let z = 1.9; z <= 2.51; z += 0.3) b.push([cone(0.06, 0.17, 5), WHITE, [(0.3 - (z - 1.9) * 0.3) * s, 0.5 + (z - 1.16) * 0.1, z]]);
      b.push([sphere(0.15, 10), WHITE, [0.62 * s, 1.08, 1.5]], [sphere(0.08, 8), DARK, [0.69 * s, 1.08, 1.6]], [box(0.34, 0.07, 0.12), dark, [0.62 * s, 1.25, 1.54], null, [0, 0, 0.5 * s]],
        [cone(0.42, 1.0, 4), c1, [1.2 * s, 0.5, 0.25], [0.14, 1, 1], [-0.35, 0, -1.85 * s]], [sphere(0.05, 6), DARK, [0.14 * s, 0.955, 2.75]]);
      for (let i = 0; i < 3; i++) b.push([box(0.04, 0.36, 0.07), dark, [0.9 * s, 0.86, 0.95 - i * 0.2], null, [0.25, 0, 0]]);
    }
    cabin(b, 0.76, dark);
    return { parts: b, glow: [], wheels: STD_WHEELS, seat: 0.76, hub: c2 };
  },
};

// Estilos de rueda de la tienda (id de WHEELS en shop.js)
// tire / hub / band: colores (por defecto, los del coche) · glow: aros luminosos · k: radio · w: anchura · knobs: tacos
const WHEEL_STYLES = {
  std: {},
  blancas: { tire: 0xf4f4f4, band: 0xb9c2d0 },
  oro: { tire: 0x2a2418, hub: 0xffd21f, band: 0xffd21f, cap: 0xffe45a },
  neon: { tire: 0x14141c, hub: 0x14141c, band: 0x14141c, glow: 0x22e6ff },
  monstruo: { tire: 0x1c1c24, band: 0x2c2c38, k: 1.24, w: 1.3, knobs: true },
};
const wheelStyle = id => WHEEL_STYLES[id] || WHEEL_STYLES.std;
const kartCache = new Map();
function wheelGeo(r, hub, style = 'std') {
  const S = wheelStyle(style);
  return geo('wheel' + r + '_' + hub + '_' + style, () => {
    const wd = 0.42 * (S.w || 1), w = [[cyl(1, 1, wd, 14), S.tire ?? SEAT, null, [r, 1, r], [0, 0, HPI]], [cyl(0.5, 0.5, wd + 0.04, 6), S.hub ?? hub, null, [r, 1, r], [0, 0, HPI]]];
    for (const o of [-0.31, 0, 0.31]) w.push([torus(r, 0.035), S.band ?? 0x3a3a48, [o * wd, 0, 0], null, [0, HPI, 0]]);
    if (S.cap != null) for (const s of [-1, 1]) w.push([cyl(0.22, 0.22, 0.04, 10), S.cap, [s * (wd / 2 + 0.03), 0, 0], [r, 1, r], [0, 0, HPI]]);
    if (S.knobs) for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      for (const s of [-1, 1]) w.push([box(wd * 0.42, 0.11, 0.2), 0x30303c, [s * wd * 0.26, Math.cos(a + s * 0.16) * r, Math.sin(a + s * 0.16) * r], null, [a + s * 0.16, 0, 0]]);
    }
    return bake(w);
  });
}
// aros luminosos del estilo neón (malla aparte, sin sombreado)
function wheelGlowGeo(r, style) {
  const S = wheelStyle(style);
  if (S.glow == null) return null;
  return geo('wheelglow' + r + '_' + style, () => {
    const wd = 0.42 * (S.w || 1), g = [];
    for (const s of [-1, 1]) g.push([torus(r * 0.74, 0.045), S.glow, [s * (wd / 2 + 0.015), 0, 0], null, [0, HPI, 0]], [cyl(0.16, 0.16, 0.03, 8), S.glow, [s * (wd / 2 + 0.03), 0, 0], [r, 1, r], [0, 0, HPI]]);
    g.push([torus(r * 1.005, 0.03), S.glow, null, null, [0, HPI, 0]]);
    return bake(g, 1.5);
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

// ---------------- PEGATINAS ----------------
// Dibujos de las pegatinas de la tienda (id de STICKERS en shop.js) en un lienzo de 128 unidades.
// Cada una es una lista de piezas [trazado SVG, color]: llevan borde blanco troquelado y contorno de tinta.
// Con un tercer valor la pieza es un detalle (solo relleno) y una función dibuja a mano sobre el lienzo.
const INK = '#1a0b3a';
const oval = (x, y, rx, ry) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
const starPath = (x, y, R, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - HPI, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + (x + Math.cos(a) * q).toFixed(1) + ' ' + (y + Math.sin(a) * q).toFixed(1); } return d + 'Z'; };
const STICKER_DRAW = {
  rayo: [['M78 6L28 72H58L44 122L100 50H70L90 6Z', '#ffd21f'], ['M80 14L44 64H60L72 14Z', '#fff6b0', 1]],
  llama: [['M64 6C72 30 104 46 104 80C104 104 86 122 64 122C42 122 24 104 24 80C24 62 34 52 40 38C46 50 52 54 58 50C62 38 58 22 64 6Z', '#ff4f1a'],
    ['M64 56C70 74 86 82 86 98C86 110 76 117 64 117C52 117 42 110 42 98C42 86 58 76 64 56Z', '#ffd21f', 1]],
  estrella: [[starPath(64, 68, 58, 25), '#ffd21f'], [starPath(64, 68, 34, 14.5), '#fff6b0', 1]],
  corazon: [['M64 116C12 80 6 46 24 26C40 10 58 18 64 34C70 18 88 10 104 26C122 46 116 80 64 116Z', '#ff3b6a'], [oval(40, 44, 10, 7), 'rgba(255,255,255,.6)', 1]],
  huella: [['M64 60C82 60 98 82 96 98C94 113 78 116 64 111C50 116 34 113 32 98C30 82 46 60 64 60Z', '#ff7a1a'],
    [oval(24, 56, 11, 14), '#ff7a1a'], [oval(47, 30, 11, 15), '#ff7a1a'], [oval(81, 30, 11, 15), '#ff7a1a'], [oval(104, 56, 11, 14), '#ff7a1a']],
  platano: [['M18 34C20 84 62 120 112 100C118 96 118 86 110 84C80 86 50 62 42 30C40 20 20 20 18 34Z', '#ffd21f'],
    ['M28 44C34 76 62 100 98 96C70 92 44 70 36 40Z', '#fff6b0', 1], [oval(30, 25, 10, 5), '#7a4a22', 1], [oval(113, 92, 5, 8), '#7a4a22', 1]],
  calavera: [['M64 8C36 8 16 28 16 54C16 70 24 81 36 87V104C36 111 40 116 47 116H81C88 116 92 111 92 104V87C104 81 112 70 112 54C112 28 92 8 64 8Z', '#f5f5f5'],
    [oval(45, 56, 12, 14), INK, 1], [oval(83, 56, 12, 14), INK, 1], ['M64 70L57 84H71Z', INK, 1], ['M51 98h4v18h-4ZM62 98h4v18h-4ZM73 98h4v18h-4Z', INK, 1]],
  dorsal: [[oval(64, 64, 56, 56), '#ffffff'], c => {
    c.font = 'italic 900 92px "Trebuchet MS", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 9; c.strokeStyle = INK; c.strokeText('7', 61, 70); c.fillStyle = '#e01b2f'; c.fillText('7', 61, 70);
  }],
};
// Material de cada pegatina (uno por dibujo, compartido por todos los coches que la lleven)
const stickerMats = new Map();
function stickerMat(id) {
  const parts = STICKER_DRAW[id]; if (!parts) return null;
  let m = stickerMats.get(id);
  if (!m) {
    const map = canvasTex(256, 256, c => {
      c.translate(128, 128); c.scale(1.48, 1.48); c.translate(-64, -64); c.lineJoin = c.lineCap = 'round'; // margen para los bordes
      const body = parts.filter(q => typeof q !== 'function' && !q[2]).map(q => [new Path2D(q[0]), q[1]]);
      for (const [w, col] of [[34, INK], [26, '#fff'], [8, INK]]) { c.lineWidth = w; c.strokeStyle = col; for (const [q] of body) c.stroke(q); }
      for (const [q, col] of body) { c.fillStyle = col; c.fill(q); }
      for (const q of parts) { if (typeof q === 'function') q(c); else if (q[2]) { c.fillStyle = q[1]; c.fill(new Path2D(q[0])); } }
    });
    m = new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    stickerMats.set(id, m);
  }
  return m;
}

// Dónde va la pegatina: en cada hueco (los dos lados y el capó) se lanzan rayos contra la carrocería hasta dar con
// la zona más despejada y de un solo color, y allí se amolda a la chapa una rejilla orientada según su normal.
// Así vale para cualquier coche sin posiciones a mano. Se calcula una sola vez por modelo y queda en caché.
const DECAL_SIZES = [0.9, 0.75, 0.62, 0.5], DECAL_N = 7, DECAL_LIFT = 0.022;
const DECAL_PROBE = [-0.42, -0.21, 0, 0.21, 0.42], DECAL_STEP = 0.1, DECAL_BAD = 0.03; // tanteo de la zona: rejilla de puntos, escalón que se tolera y nota máxima
const steps = (a, b, st) => { const o = []; for (let v = a; v <= b + 1e-6; v += st) o.push(v); return o; };
const DECAL_SLOTS = [1, -1].map(sd => ({
  // lado: se mira desde fuera y algo por encima; entre los ejes y sin arrimarse al piloto, mejor cuanto más hacia fuera y más alta
  dir: [-0.82 * sd, -0.57, 0], up: [0, 1, 0], aims: steps(-0.9, 1.1, 0.25).flatMap(z => steps(-0.2, 1.6, 0.1).map(y => [0, y, z])),
  zone: (x, y, z) => x * sd > 0.1 && z > -1.7 && z < 1.9,
  ok: (P, K) => P.x * sd > 0.3 && !(Math.abs(P.x) < 0.8 && P.y > K.seat + 0.15) && K.wheels.every(([, r, wz]) => (wz > 0 ? wz - P.z : P.z - wz) > r + 0.25),
  pref: P => 0.06 * Math.abs(P.z - 0.05) - 0.25 * Math.abs(P.x) - 0.1 * P.y,
})).concat({
  // capó: por delante del volante, en el eje del coche; el dibujo se lee de pie mirando el coche de frente
  dir: [0, -0.94, -0.34], up: [0, 0, -1], aims: steps(0.6, 2.6, 0.1).map(z => [0, 0.8, z]),
  zone: (x, y, z) => Math.abs(x) < 0.8 && z > 0.3,
  ok: P => P.z > 0.85 && Math.abs(P.x) < 0.2, pref: P => 0.05 * Math.abs(P.z - 1.6),
});
// Triángulos de la carrocería que ve un hueco (los que miran hacia él dentro de su zona), en una tabla plana para lanzar rayos deprisa.
// Por triángulo (DT números): un vértice, sus dos aristas, la normal, el color y el radio alrededor de su centro
const DT = 16;
function decalTris(geo, d, zone) {
  const P = geo.attributes.position.array, C = geo.attributes.color.array, I = geo.index.array, out = [];
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-9 || (nx * d.x + ny * d.y + nz * d.z) / l > 0.2 || !zone(P[a] + (ux + vx) / 3, P[a + 1] + (uy + vy) / 3, P[a + 2] + (uz + vz) / 3)) continue;
    out.push(P[a], P[a + 1], P[a + 2], ux, uy, uz, vx, vy, vz, nx / l, ny / l, nz / l, C[a], C[a + 1], C[a + 2], Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz)));
  }
  return new Float32Array(out);
}
// Copia en S los triángulos de T que pasan a menos de r del punto P (los únicos que pueden tocar los rayos de tanteo); devuelve cuántos números ocupa
function decalNear(T, S, P, r) {
  let n = 0;
  for (let i = 0; i < T.length; i += DT) {
    const x = T[i] + (T[i + 3] + T[i + 6]) / 3 - P.x, y = T[i + 1] + (T[i + 4] + T[i + 7]) / 3 - P.y, z = T[i + 2] + (T[i + 5] + T[i + 8]) / 3 - P.z, q = r + T[i + 15];
    if (x * x + y * y + z * z < q * q) { for (let j = 0; j < DT; j++) S[n + j] = T[i + j]; n += DT; }
  }
  return n;
}
// Rayo (origen o, dirección d) contra los n primeros números de la tabla: posición del triángulo más cercano por su cara vista, o -1.
// La distancia queda en decalCast.t
function decalCast(T, n, o, d, far) {
  let best = far, k = -1;
  for (let i = 0; i < n; i += DT) {
    const ux = T[i + 3], uy = T[i + 4], uz = T[i + 5], vx = T[i + 6], vy = T[i + 7], vz = T[i + 8];
    const px = d.y * vz - d.z * vy, py = d.z * vx - d.x * vz, pz = d.x * vy - d.y * vx, det = ux * px + uy * py + uz * pz;
    if (det < 1e-9) continue;
    const tx = o.x - T[i], ty = o.y - T[i + 1], tz = o.z - T[i + 2], u = tx * px + ty * py + tz * pz;
    if (u < 0 || u > det) continue;
    const qx = ty * uz - tz * uy, qy = tz * ux - tx * uz, qz = tx * uy - ty * ux, v = d.x * qx + d.y * qy + d.z * qz;
    if (v < 0 || u + v > det) continue;
    const t = (vx * qx + vy * qy + vz * qz) / det;
    if (t > 0 && t < best) { best = t; k = i; }
  }
  decalCast.t = best;
  return k;
}
// ¿Otra pintura? Un tono más claro o más oscuro del mismo color (los bultos de la piña, los relieves) cuenta como la misma
function repaint(S, i, T, j) {
  const m = Math.max(S[i], S[i + 1], S[i + 2], 1e-3), n = Math.max(T[j], T[j + 1], T[j + 2], 1e-3);
  return m < n * 0.5 || m > n * 2 || Math.abs(S[i] / m - T[j] / n) + Math.abs(S[i + 1] / m - T[j + 1] / n) + Math.abs(S[i + 2] / m - T[j + 2] / n) > 0.25;
}
const decalCache = new Map(), _dv = new THREE.Vector3(), _dw = new THREE.Vector3();
function decalGeo(def) {
  if (decalCache.has(def.id)) return decalCache.get(def.id);
  const K = kartGeos(def, null); // siempre con los colores de serie: así queda en el mismo sitio con cualquier pintura
  const n = DECAL_N, small = DECAL_SIZES[DECAL_SIZES.length - 1], dep = new Float32Array(n * n), pos = [], nor = [], uv = [], idx = [], spots = [];
  for (const slot of DECAL_SLOTS) {
    const d = new THREE.Vector3().fromArray(slot.dir).normalize(), up = new THREE.Vector3().fromArray(slot.up);
    const T = decalTris(K.body, d, slot.zone), S = new Float32Array(T.length);
    let sn = 0, tri = -1;
    const frame = (P, N) => { const U = new THREE.Vector3().crossVectors(up, N).normalize(); return { P, N, U, V: new THREE.Vector3().crossVectors(N, U) }; };
    const at = (f, u, v, h) => _dv.copy(f.P).addScaledVector(f.U, u).addScaledVector(f.V, v).addScaledVector(f.N, h);
    // profundidad de la chapa bajo un punto del plano de la pegatina (NaN si no hay); deja en `tri` el triángulo tocado
    const depth = (f, u, v) => { tri = decalCast(S, sn, at(f, u, v, 0.5), _dw.copy(f.N).negate(), 1); return tri < 0 ? NaN : decalCast.t - 0.5; };
    // el mismo marco, pero mirando según el plano medio de la chapa en un cuadrado de lado sz (m × m puntos)
    const level = (f, sz, m) => {
      const pts = []; let mu = 0, mv = 0, mw = 0, uu = 0, vv = 0, uw = 0, vw = 0, uvs = 0;
      for (let k = 0; k < m * m; k++) { const u = (k % m / (m - 1) - 0.5) * sz, v = (Math.floor(k / m) / (m - 1) - 0.5) * sz, w = depth(f, u, v); if (w === w) { pts.push([u, v, -w]); mu += u; mv += v; mw -= w; } }
      if (pts.length < 5) return f;
      for (const q of pts) { const u = q[0] - mu / pts.length, v = q[1] - mv / pts.length, w = q[2] - mw / pts.length; uu += u * u; vv += v * v; uvs += u * v; uw += u * w; vw += v * w; }
      const det = uu * vv - uvs * uvs; if (det < 1e-9) return f;
      const a = (uw * vv - vw * uvs) / det, b = (vw * uu - uw * uvs) / det; // pendiente del plano medio en cada eje
      return a * a + b * b < 0.0025 ? f : frame(f.P, f.N.clone().addScaledVector(f.U, -a).addScaledVector(f.V, -b).normalize());
    };
    // candidatas: donde caen los rayos de tanteo en una zona permitida, de la mejor a la peor situada
    const cands = [];
    for (const a of slot.aims) {
      const k = decalCast(T, T.length, _dw.fromArray(a).addScaledVector(d, -9), d, 20); if (k < 0) continue;
      const P = new THREE.Vector3().fromArray(a).addScaledVector(d, decalCast.t - 9);
      if (slot.ok(P, K) && Math.abs(T[k + 10] * up.y + T[k + 11] * up.z) < 0.98) cands.push({ P, k, pref: slot.pref(P), f: null });
    }
    cands.sort((a, b) => a.pref - b.pref);
    // gana el mayor tamaño que quepa en alguna y, a igual tamaño, la mejor situada; si no cabe en ninguna, la menos mala con el tamaño mínimo
    let best = null, size = small;
    for (const sz of DECAL_SIZES) {
      for (const c of cands) {
        if (best && best.fits && best.cost <= c.pref) break; // las que quedan ya no pueden mejorarla
        if (c.f === 0) continue;
        sn = decalNear(T, S, c.P, 0.85);
        if (!c.f) { // la primera vez se orienta según el plano medio de la chapa (los bultos y las aristas de una cara no cuentan)
          const f = level(frame(c.P, new THREE.Vector3(T[c.k + 9], T[c.k + 10], T[c.k + 11])), 0.5, 3);
          c.f = f.N.dot(d) > -0.5 || Math.abs(f.N.dot(up)) > 0.98 ? 0 : f; if (!c.f) continue;
        }
        // nota de la zona: lo que cae fuera de la chapa o sobre otra pintura (aros, ventanillas, dientes) y los escalones grandes
        let bad = 0;
        for (let q = 0; q < 25 && (bad < DECAL_BAD || sz === small); q++) {
          const w = depth(c.f, DECAL_PROBE[q % 5] * sz, DECAL_PROBE[Math.floor(q / 5)] * sz);
          bad += (tri < 0 || repaint(S, tri + 12, T, c.k + 12) ? 0.5 : Math.min(0.5, Math.max(0, Math.abs(w) - DECAL_STEP))) / 25;
        }
        const fits = bad < DECAL_BAD, cost = bad + c.pref;
        if ((fits || sz === small) && (!best || fits > best.fits || (fits === best.fits && cost < best.cost))) best = { f: c.f, cost, fits };
      }
      if (best && best.fits) { size = sz; break; }
    }
    if (!best) continue;
    // rejilla proyectada sobre la chapa, orientada según el plano medio de toda la pegatina
    const g = i => (i / (n - 1) - 0.5) * size;
    sn = decalNear(T, S, best.f.P, 0.85);
    const f = level(best.f, size, n);
    let sum = 0, cnt = 0;
    for (let k = 0; k < n * n; k++) { const w = dep[k] = depth(f, g(k % n), g(Math.floor(k / n))); if (w === w) { sum += w; cnt++; } }
    for (let k = 0; k < n * n; k++) if (dep[k] !== dep[k]) dep[k] = cnt ? sum / cnt : 0; // sin chapa debajo: a la altura media
    // no se mete en las grietas: se apoya en lo que sobresale (mínimo y media de los vecinos), sin hundirse nunca en la chapa
    const near = (src, min) => src.map((_, k) => {
      const i = k % n, j = (k - i) / n; let r = min ? 9 : 0, c = 0;
      for (let b = Math.max(0, j - 1); b <= Math.min(n - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(n - 1, i + 1); a++) { r = min ? Math.min(r, src[b * n + a]) : r + src[b * n + a]; c++; }
      return min ? r : r / c;
    });
    const soft = near(near(dep, true), false), base = pos.length / 3;
    for (let k = 0; k < n * n; k++) {
      const i = k % n, j = (k - i) / n; at(f, g(i), g(j), DECAL_LIFT - Math.min(soft[k], dep[k]));
      pos.push(_dv.x, _dv.y, _dv.z); nor.push(f.N.x, f.N.y, f.N.z); uv.push(i / (n - 1), j / (n - 1));
      if (i && j) idx.push(base + k - n - 1, base + k - n, base + k, base + k - n - 1, base + k, base + k - 1);
    }
    spots.push({ P: f.P.toArray(), N: f.N.toArray(), size });
  }
  let geo = null;
  if (idx.length) {
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    geo.userData.spots = spots; // dónde ha quedado cada pegatina (para las pruebas)
  }
  decalCache.set(def.id, geo);
  return geo;
}

// wheels: id de estilo de rueda de la tienda (null = estándar). Las ruedas grandes levantan la carrocería.
// sticker: id de pegatina de la tienda (null o 'none' = sin ella); el fantasma (override) no la lleva.
export function makeKart(def, colorOverride, override, wheels = null, sticker = null) {
  const K = kartGeos(def, colorOverride), M = override || toonVC, ol = !override, S = wheelStyle(wheels), wk = S.k || 1;
  const k = new THREE.Group(), bodyG = new THREE.Group(); k.add(bodyG);
  part(bodyG, K.body, M, ol);
  const sm = override ? null : stickerMat(sticker), sg = sm && decalGeo(def);
  if (sg) bodyG.add(new THREE.Mesh(sg, sm));
  if (K.glow) part(bodyG, K.glow, override || glowVC);
  const wheel = part(bodyG, K.steer, M); wheel.position.set(0, K.seat + 0.69, 0.38); wheel.rotation.set(-0.75, 0, 0);
  const list = [];
  let lift = 0;
  for (const [x, r0, z] of K.wheels) {
    const r = Math.round(r0 * wk * 1000) / 1000, px = x + Math.sign(x) * (wk - 1) * 0.55; lift = Math.max(lift, r - r0);
    const pivot = new THREE.Group(); pivot.position.set(px, r, z);
    const spin = new THREE.Group(); pivot.add(spin);
    part(spin, wheelGeo(r, K.hub, wheels || 'std'), M, ol);
    const glow = wheelGlowGeo(r, wheels); if (glow) part(spin, glow, override || glowVC);
    k.add(pivot); list.push({ pivot, spin, front: z > 0, x: px, y: r });
  }
  bodyG.position.y = lift;
  k.userData = { bodyG, wheels: list, wheel, seat: K.seat + lift };
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
  // --- Copa Galaxia: desierto ---
  cactus: { scale: [0.8, 1.7], make: () => merged([
    [C(0.42, 0.5, 4.6, 8), 0x3fae5a, [0, 2.3, 0]], [ico(0.44, 1), 0x4cc468, [0, 4.6, 0]],
    [C(0.26, 0.26, 1.2, 6), 0x38a052, [0.85, 2.4, 0], null, [0, 0, PI / 2]], [C(0.26, 0.28, 1.7, 6), 0x3fae5a, [1.4, 3.2, 0]], [ico(0.27, 1), 0x4cc468, [1.4, 4.05, 0]],
    [C(0.22, 0.22, 1.0, 6), 0x38a052, [-0.75, 1.6, 0], null, [0, 0, PI / 2]], [C(0.22, 0.24, 1.3, 6), 0x3fae5a, [-1.2, 2.2, 0]], [ico(0.23, 1), 0x4cc468, [-1.2, 2.85, 0]],
    [ico(0.2, 0), 0xff5ec4, [0.15, 4.98, 0.1]],
  ]) },
  mesa: { scale: [1.2, 3.2], make: () => merged([ // roca de cañón por estratos
    [C(2.2, 2.8, 2.2, 7), 0xc8703a, [0, 1.1, 0]], [C(1.9, 2.2, 1.6, 7), 0xe08a4a, [0.1, 3.0, 0]], [C(2.1, 1.9, 0.5, 7), 0xf0c080, [0.1, 4.05, 0]],
    [C(1.5, 1.9, 1.8, 7), 0xc8703a, [0.2, 5.2, 0.1]], [C(1.7, 1.5, 0.5, 7), 0xa85a30, [0.2, 6.35, 0.1]],
    [C(0.9, 1.2, 2.4, 6), 0xd07a42, [2.6, 1.2, 0.8]], [C(1.0, 0.9, 0.4, 6), 0xf0c080, [2.6, 2.6, 0.8]],
  ]) },
  drybush: { scale: [0.7, 1.5], make: () => merged([
    [ico(0.7, 0), 0xb89a4a, [0, 0.5, 0], [1.2, 0.7, 1]], [ico(0.5, 0), 0xa8843a, [0.7, 0.35, 0.3]], [ico(0.45, 0), 0xc8aa5a, [-0.6, 0.3, -0.3]],
    [C(0.03, 0.03, 1.1, 4), 0x7a5a2a, [0.2, 0.9, 0], null, [0, 0, -0.5]], [C(0.03, 0.03, 1.0, 4), 0x7a5a2a, [-0.2, 0.9, 0.1], null, [0.3, 0, 0.5]],
  ]) },
  // --- Copa Galaxia: fábrica de juguetes ---
  toyblock: { scale: [0.9, 2.1], make: () => merged([ // torre de cubos con tejado
    [B(2.6, 2.6, 2.6), 0xff3b4a, [0, 1.3, 0]], [B(2.2, 2.2, 2.2), 0xffd21f, [0.2, 3.7, 0.1], null, [0, 0.45, 0]], [B(1.8, 1.8, 1.8), 0x2b9dff, [0, 5.7, 0], null, [0, 0.15, 0]],
    [K(1.5, 1.7, 4), 0x35e08a, [0, 7.45, 0], null, [0, PI / 4 + 0.15, 0]], [B(2.2, 2.2, 2.2), 0x7a5cff, [2.9, 1.1, 0.6], null, [0, 0.3, 0]],
    [C(0.9, 0.9, 1.8, 10), 0xff7a1a, [-2.6, 0.9, -0.4]],
  ]) },
  toybrick: { scale: [0.9, 2], tint: true, make: () => { // ladrillos de construcción encajados
    const p = [[B(4, 1.7, 2), 0xffffff, [0, 0.85, 0]], [B(2, 1.7, 2), 0xfff0c0, [-1, 2.55, 0]]];
    for (const x of [1.5, 0.5]) for (const z of [-0.5, 0.5]) p.push([C(0.34, 0.34, 0.3, 8), 0xffffff, [x, 1.85, z]]);
    for (const x of [-1.5, -0.5]) for (const z of [-0.5, 0.5]) p.push([C(0.34, 0.34, 0.3, 8), 0xfff0c0, [x, 3.55, z]]);
    return merged(p);
  } },
  gear: { scale: [0.9, 1.9], tint: true, make: () => { // engranaje sobre un poste
    const p = [[C(0.28, 0.4, 2.6, 6), 0x6a6a7a, [0, 1.3, 0]], [C(1.5, 1.5, 0.5, 14), 0xffffff, [0, 3.8, 0], null, [PI / 2, 0, 0]], [C(0.5, 0.5, 0.7, 8), 0x6a6a7a, [0, 3.8, 0], null, [PI / 2, 0, 0]]];
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; p.push([B(0.6, 0.7, 0.5), 0xffffff, [Math.cos(a) * 1.75, 3.8 + Math.sin(a) * 1.75, 0], null, [0, 0, a + PI / 2]]); }
    return merged(p);
  } },
  crayon: { scale: [0.9, 1.9], tint: true, make: () => merged([ // ceras de colores clavadas en el suelo
    [C(0.5, 0.5, 4.4, 8), 0xffffff, [0, 2.2, 0]], [C(0.53, 0.53, 1.3, 8), 0xfff6d8, [0, 2.2, 0]], [K(0.5, 1.2, 8), 0xffffff, [0, 5.0, 0]],
    [C(0.42, 0.42, 3.2, 8), 0xdddddd, [1.3, 1.5, 0.4], null, [0.1, 0, -0.35]], [K(0.42, 1.0, 8), 0xdddddd, [2.04, 3.47, 0.6], null, [0.1, 0, -0.35]],
  ]) },
  toyball: { scale: [0.8, 1.9], tint: true, make: () => merged([
    [ico(1.2, 1), 0xffffff, [0, 1.2, 0]], [new THREE.TorusGeometry(1.2, 0.14, 6, 16), 0xfff6c0, [0, 1.2, 0], null, [PI / 2, 0, 0]],
    [new THREE.TorusGeometry(1.2, 0.14, 6, 16), 0xfff6c0, [0, 1.2, 0], null, [0, 0.6, 0]],
  ]) },
  spintop: { scale: [0.9, 1.8], tint: true, make: () => merged([ // peonza inclinada
    [K(1.1, 1.6, 10), 0xffffff, [0.2, 0.8, 0], null, [PI, 0, 0.25]], [C(1.15, 1.15, 0.4, 10), 0xfff6c0, [-0.03, 1.75, 0], null, [0, 0, 0.25]],
    [C(0.14, 0.14, 1.0, 6), 0xffffff, [-0.2, 2.42, 0], null, [0, 0, 0.25]], [ico(0.24, 0), 0xfff6c0, [-0.34, 2.98, 0]],
  ]) },
  // --- Copa Galaxia: estación espacial ---
  moonrock: { scale: [0.7, 2.6], make: () => merged([
    [new THREE.DodecahedronGeometry(1.3, 0), 0x8a8fb0, [0, 0.6, 0], [1.3, 0.75, 1]], [new THREE.DodecahedronGeometry(0.7, 0), 0x6a6f92, [1.2, 0.35, 0.4]],
    [new THREE.DodecahedronGeometry(0.45, 0), 0xa8aed0, [-1.1, 0.25, -0.5]],
  ]) },
  crater: { scale: [1, 2.6], make: () => merged([ // cráter: anillo bajo con el fondo oscuro
    [new THREE.TorusGeometry(2.4, 0.55, 5, 12), 0x9a9fc4, [0, 0.1, 0], [1, 1, 0.55], [PI / 2, 0, 0]], [C(2.3, 2.3, 0.12, 12), 0x4a4e72, [0, 0.12, 0]],
  ]) },
  stmodule: { scale: [1, 1.9], make: () => { // módulo habitable con cúpula, pasillo y cápsula
    const p = [[C(2.2, 2.4, 2.4, 10), 0xe8ecf8, [0, 1.2, 0]], [new THREE.SphereGeometry(2.2, 10, 6, 0, PI * 2, 0, PI / 2), 0xf6f8ff, [0, 2.4, 0]], [C(2.46, 2.46, 0.35, 10), 0xff7a1a, [0, 0.95, 0]],
      [B(1.0, 1.5, 0.3), 0x3a4262, [0, 0.95, 2.28]], [C(0.9, 0.9, 2.6, 8), 0xc8cce0, [3.3, 0.95, 0], null, [0, 0, PI / 2]], [C(1.3, 1.4, 1.9, 8), 0xe8ecf8, [5.3, 0.95, 0]],
      [C(1.34, 1.34, 0.3, 8), 0x2b9dff, [5.3, 1.5, 0]], [C(0.05, 0.05, 2.4, 4), 0xc8cce0, [0, 5.6, 0]], [ico(0.2, 0), 0xff3b4a, [0, 6.8, 0]]];
    for (let i = 0; i < 5; i++) { const a = 0.6 + i * 1.1; p.push([B(0.7, 0.5, 0.2), 0x7ff0ff, [Math.sin(a) * 2.25, 1.75, Math.cos(a) * 2.25], null, [0, a, 0]]); }
    return merged(p);
  } },
  antenna: { scale: [1, 1.8], make: () => merged([ // antena parabólica
    [B(0.9, 0.5, 0.9), 0x5a6088, [0, 0.25, 0]], [C(0.14, 0.24, 4.4, 6), 0x8a90b0, [0, 2.4, 0]], [C(1.7, 0.35, 0.8, 10), 0xeef2ff, [0, 4.9, 0.3], null, [0.7, 0, 0]],
    [C(0.05, 0.05, 1.5, 4), 0x8a90b0, [0, 5.55, 1.05], null, [0.7, 0, 0]], [ico(0.2, 0), 0xff7a1a, [0, 6.1, 1.5]],
  ]) },
  solarpanel: { scale: [1, 1.7], make: () => {
    const p = [[C(0.12, 0.18, 3, 6), 0x8a90b0, [0, 1.5, 0]], [B(0.3, 0.3, 5.6), 0xc8cce0, [0, 3.1, 0]]];
    for (const z of [-1.75, 1.75]) {
      p.push([B(2.6, 0.12, 3), 0x2a4ad8, [0, 3.2, z], null, [0, 0, 0.5]], [B(2.7, 0.16, 0.08), 0xd8e4ff, [0, 3.2, z], null, [0, 0, 0.5]]);
      for (const x of [-0.65, 0.65]) p.push([B(0.08, 0.16, 3.06), 0xd8e4ff, [x * Math.cos(0.5), 3.2 + x * Math.sin(0.5), z], null, [0, 0, 0.5]]);
    }
    return merged(p);
  } },
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
