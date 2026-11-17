// Decoración del circuito: túnel, gradas con público, banderas, globos, vallas, arcos, farolas y fauna.
import * as THREE from './vendor/three.module.min.js';
import { merged, canvasTex, glowTex, PROPS } from './models.js';
import { addOutline, outlineInstanced } from './outline.js';

const VIVID = [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xff7a1a, 0x7a5cff, 0xff3b4a];
const ADS = [
  ['BANANA', 'COLA', '#ffd21f', '#ff7a1a', '#c0182c'],
  ['COCO', 'FUEL', '#22e6ff', '#1a6aff', '#ffffff'],
  ['GORILA', 'GYM', '#7a5cff', '#c04dff', '#ffe600'],
  ['TURBO', 'PLÁTANO', '#35e08a', '#0f9a5a', '#fff36a'],
  ['SELVA', 'TIRES', '#ff4fd8', '#b01a8a', '#ffffff'],
];

export function buildScenery(ctx) {
  const { th, ex, samples, N, hw, rand, own, group, B, quality, shadows, uTime, special, nearRamp, tunR, fIdx, boatRs, outline, terrainAt } = ctx;
  const boatR = boatRs[0] || null, subIdx = []; samples.forEach((q, i) => { if (q.zone === 'sub') subIdx.push(i); });
  const toy = ctx.def.id === 'fabrica'; // el tanque de pintura lleva juguetes en vez de corales
  const updaters = [];
  const S = i => samples[((i % N) + N) % N];
  const free = i => !special(S(i)) && !nearRamp(((i % N) + N) % N);
  const o = new THREE.Object3D(), col = new THREE.Color(), col2 = new THREE.Color();
  const lambert = (extra = {}) => own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra }));
  const addMesh = (g, m, cast = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadows && cast; group.add(mesh); return mesh; };

  // ---------- Túnel de cristal (estación espacial): tubo transparente con aros y luces ----------
  if (tunR && ex.tunnelGlass) {
    const J = 12, Rt = hw + 4.2, i0 = tunR[0], n = tunR[1] - tunR[0], gPos = [], gIdx = [], rPos = [], rCol = [], rIdx = [];
    const glow = new THREE.Color(ex.tunnelGlow).multiplyScalar(B(1.6)), frame = new THREE.Color(0xdfe4f4), accent = new THREE.Color(th.curbA);
    for (let k = 0; k <= n; k++) {
      const s = S(i0 + k);
      for (let j = 0; j <= J; j++) { const a = Math.PI * j / J; gPos.push(s.x + s.nx * Math.cos(a) * Rt, s.y - 0.5 + Math.sin(a) * Rt * 0.95, s.z + s.nz * Math.cos(a) * Rt); }
      if (k < n) for (let j = 0; j < J; j++) { const a = k * (J + 1) + j, b = a + J + 1; gIdx.push(a, b, a + 1, a + 1, b, b + 1); }
      if (k % 4 && k !== n) continue;
      // aro: una banda a lo largo de la pista, justo por fuera del cristal (los de las bocas, más anchos)
      const end = k === 0 || k === n, c = end ? accent : (k >> 2) % 2 ? glow : frame, w = end ? 1.3 : 0.45, base = rPos.length / 3, R = Rt + 0.12;
      for (const d of [-w, w]) for (let j = 0; j <= J; j++) { const a = Math.PI * j / J; rPos.push(s.x + s.tx * d + s.nx * Math.cos(a) * R, s.y - 0.5 + Math.sin(a) * R * 0.95, s.z + s.tz * d + s.nz * Math.cos(a) * R); rCol.push(c.r, c.g, c.b); }
      for (let j = 0; j < J; j++) { const a = base + j, b = a + J + 1; rIdx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const gg = own(new THREE.BufferGeometry()); gg.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3)); gg.setIndex(gIdx);
    const glass = new THREE.Mesh(gg, own(new THREE.MeshBasicMaterial({ color: ex.tunnelCol, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    glass.renderOrder = 2; group.add(glass);
    const rg = own(new THREE.BufferGeometry()); rg.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rCol, 3)); rg.setIndex(rIdx);
    group.add(new THREE.Mesh(rg, own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))));
  }

  // ---------- Túnel ----------
  if (tunR && !ex.tunnelGlass) {
    const J = 12, Rt = hw + 4.2, i0 = tunR[0], n = tunR[1] - tunR[0];
    const inPos = [], inCol = [], idx = [], outPos = [], outCol = [], outIdx = [];
    const dark = new THREE.Color(ex.tunnelCol).multiplyScalar(0.3), glow = new THREE.Color(ex.tunnelGlow).multiplyScalar(B(1.45));
    const rock = new THREE.Color(ex.tunnelCol), accent = new THREE.Color(th.curbA);
    for (let k = 0; k <= n; k++) {
      const s = S(i0 + k), lit = k % 5 === 2, end = k === 0 || k === n;
      for (let j = 0; j <= J; j++) {
        const a = Math.PI * j / J, ca = Math.cos(a), sa = Math.sin(a);
        inPos.push(s.x + s.nx * ca * Rt, s.y - 0.5 + sa * Rt * 0.95, s.z + s.nz * ca * Rt);
        if (lit && j >= 2 && j <= J - 2) col.copy(glow); else col.copy(dark).multiplyScalar(0.6 + 0.7 * sa);
        inCol.push(col.r, col.g, col.b);
        const ro = Rt + 1.7 + rand() * 1.7 + (end ? 1.3 : 0);
        outPos.push(s.x + s.nx * ca * ro, s.y - 0.5 + sa * ro * 0.95, s.z + s.nz * ca * ro);
        col.copy(end ? accent : rock).multiplyScalar(0.8 + rand() * 0.35); outCol.push(col.r, col.g, col.b);
      }
      if (k < n) for (let j = 0; j < J; j++) { const a = k * (J + 1) + j, b = a + J + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); outIdx.push(a, a + 1, b, a + 1, b + 1, b); }
    }
    // caras de las bocas (une el anillo interior con el exterior)
    const mouth = [];
    for (const k of [0, n]) for (let j = 0; j < J; j++) {
      const a = (k * (J + 1) + j) * 3, b = a + 3;
      const q = [inPos[a], inPos[a + 1], inPos[a + 2], inPos[b], inPos[b + 1], inPos[b + 2], outPos[b], outPos[b + 1], outPos[b + 2], outPos[a], outPos[a + 1], outPos[a + 2]];
      for (const v of [0, 1, 2, 0, 2, 3]) mouth.push(q[v * 3], q[v * 3 + 1], q[v * 3 + 2]);
    }
    const gi = own(new THREE.BufferGeometry());
    gi.setAttribute('position', new THREE.Float32BufferAttribute(inPos, 3)); gi.setAttribute('color', new THREE.Float32BufferAttribute(inCol, 3)); gi.setIndex(idx);
    group.add(new THREE.Mesh(gi, own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))));
    const go = own(new THREE.BufferGeometry());
    go.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3)); go.setAttribute('color', new THREE.Float32BufferAttribute(outCol, 3)); go.setIndex(outIdx);
    go.computeVertexNormals();
    addMesh(go, lambert({ side: THREE.DoubleSide }));
    const gm = own(new THREE.BufferGeometry());
    gm.setAttribute('position', new THREE.Float32BufferAttribute(mouth, 3)); gm.computeVertexNormals();
    addMesh(gm, own(new THREE.MeshLambertMaterial({ color: th.curbA, side: THREE.DoubleSide })), false);
  }

  // ---------- Gradas con público ----------
  {
    const parts = [], cA = th.curbA, cB = th.curbB, dk = new THREE.Color(ex.deck).multiplyScalar(0.75).getHex();
    for (let r = 0; r < 3; r++) parts.push([new THREE.BoxGeometry(22, r + 1, 1.7), r % 2 ? 0xffffff : cA, [0, (r + 1) / 2, r * 1.7 + 0.85]]);
    parts.push([new THREE.BoxGeometry(22, 5.6, 0.4), dk, [0, 2.8, 5.3]], [new THREE.BoxGeometry(22, 6, 5.5), dk, [0, -3, 2.75]]);
    for (let k = 0; k < 6; k++) parts.push([new THREE.BoxGeometry(23 / 6, 0.3, 6.8), k % 2 ? cA : cB, [-23 / 2 + (k + 0.5) * 23 / 6, 6.6, 2.6], null, [0.12, 0, 0]]);
    for (const sx of [-10.7, 10.7]) parts.push([new THREE.BoxGeometry(0.35, 6.3, 0.35), 0xffffff, [sx, 3.15, 0.2]]);
    const standG = own(merged(parts)), standM = lambert();
    const furG = own(merged([
      [new THREE.IcosahedronGeometry(0.36, 1), 0x5a3a26, [0, 1.3, 0]],
      [new THREE.IcosahedronGeometry(0.2, 0), 0xd9a680, [0, 1.2, -0.27], [1.1, 0.8, 0.8]],
      [new THREE.CylinderGeometry(0.11, 0.11, 0.85, 5), 0x4a2e1e, [0.5, 1.35, 0], null, [0, 0, -0.55]],
      [new THREE.CylinderGeometry(0.11, 0.11, 0.85, 5), 0x4a2e1e, [-0.5, 1.35, 0], null, [0, 0, 0.55]],
    ]));
    const shirtG = own(merged([
      [new THREE.CylinderGeometry(0.4, 0.5, 0.95, 7), 0xffffff, [0, 0.52, 0]],
      [new THREE.ConeGeometry(0.22, 0.6, 3), 0xffffff, [0.78, 1.95, 0], [1, 1, 0.2], [0, 0, -1.2]],
    ]));
    const spots = [[9, 1], [9, -1]];
    const mid = fIdx(0.5); if (free(mid)) spots.push([mid, S(mid).curv > 0 ? -1 : 1]);
    const perStand = 36, total = spots.length * perStand;
    const fur = new THREE.InstancedMesh(furG, lambert(), total), shirt = new THREE.InstancedMesh(shirtG, lambert(), total);
    const fans = [];
    spots.forEach(([i, side]) => {
      const s = S(i), yaw = Math.atan2(s.nx * side, s.nz * side), lat = (hw + 12.5) * side;
      const m = addMesh(standG, standM); m.receiveShadow = true;
      m.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); m.rotation.y = yaw; m.updateMatrix();
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) {
        const lx = -9.9 + c * 1.8 + (rand() - 0.5) * 0.4, lz = r * 1.7 + 0.85;
        const n = fans.length;
        fans.push({ x: m.position.x + lx * cy + lz * sy, y: s.y + r + 1, z: m.position.z - lx * sy + lz * cy, yaw, ph: rand() * 6.28, sp: 4 + rand() * 4, sc: 0.85 + rand() * 0.3, cx: m.position.x, cz: m.position.z });
        shirt.setColorAt(n, col.set(VIVID[Math.floor(rand() * VIVID.length)]));
        const b = 0.7 + rand() * 0.6; fur.setColorAt(n, col.setRGB(b, b, b));
      }
    });
    fur.frustumCulled = shirt.frustumCulled = false; fur.castShadow = shirt.castShadow = false;
    group.add(fur, shirt);
    const place = (t, far) => {
      for (let i = 0; i < fans.length; i++) {
        const f = fans[i], k = far ? 0 : Math.abs(Math.sin(t * f.sp + f.ph));
        o.position.set(f.x, f.y + k * 0.45, f.z); o.rotation.set(0, f.yaw, far ? 0 : Math.sin(t * f.sp * 0.5 + f.ph) * 0.18);
        o.scale.setScalar(f.sc); o.updateMatrix(); fur.setMatrixAt(i, o.matrix); shirt.setMatrixAt(i, o.matrix);
      }
      fur.instanceMatrix.needsUpdate = shirt.instanceMatrix.needsUpdate = true;
    };
    place(0, true);
    updaters.push((dt, t, cam) => {
      // solo se anima el público cercano a la cámara
      let near = false;
      for (let i = 0; i < fans.length; i += perStand) { const f = fans[i]; if ((f.cx - cam.x) ** 2 + (f.cz - cam.z) ** 2 < 260 * 260) near = true; }
      if (near) place(t, false);
    });
  }

  // ---------- Banderas ondeando ----------
  {
    const poleG = own(merged([[new THREE.CylinderGeometry(0.09, 0.11, 6.2, 6), 0xf0f0f0, [0, 3.1, 0]], [new THREE.IcosahedronGeometry(0.2, 0), 0xffd21f, [0, 6.3, 0]]]));
    const flagG = own(new THREE.PlaneGeometry(2.6, 1.5, 7, 1)); flagG.translate(1.3, 5.35, 0);
    const flagM = own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    flagM.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float fph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;\n transformed.z += sin(position.x * 2.2 - uTime * 7.0 + fph) * 0.24 * position.x / 2.6;');
    };
    const list = [];
    for (let k = -10; k <= 0; k += 2) for (const side of [1, -1]) list.push([k * 4, side]);
    const poles = new THREE.InstancedMesh(poleG, lambert(), list.length), flags = new THREE.InstancedMesh(flagG, flagM, list.length);
    list.forEach(([i, side], n) => {
      const s = S(i), lat = (hw + 4.6) * side;
      o.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); o.rotation.set(0, s.h - Math.PI / 2, 0); o.scale.setScalar(1); o.updateMatrix();
      poles.setMatrixAt(n, o.matrix); flags.setMatrixAt(n, o.matrix); flags.setColorAt(n, col.set(VIVID[n % VIVID.length]));
    });
    poles.frustumCulled = flags.frustumCulled = false; group.add(poles, flags);
  }

  // ---------- Banderines y arcos hinchables ----------
  {
    const parts = [], W = hw + 2.7;
    for (const sx of [-W, W]) parts.push([new THREE.CylinderGeometry(0.16, 0.2, 9.2, 6), 0xf0f0f0, [sx, 4.6, 0]]);
    for (let k = 0; k < 17; k++) {
      const u = k / 16, x = -W + u * 2 * W, y = 9 - Math.sin(u * Math.PI) * 1.5;
      parts.push([new THREE.ConeGeometry(0.5, 1.0, 3), VIVID[k % VIVID.length], [x, y - 0.5, 0], [1, 1, 0.15], [0, 0, Math.PI]]);
    }
    const g = own(merged(parts)), m = lambert();
    for (const i of [N - 32, fIdx(0.05), fIdx(0.28), fIdx(0.58)]) {
      if (!free(i)) continue;
      const s = S(i), mesh = addMesh(g, m, false); mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.h;
    }
    const ap = [], R = hw + 2.9;
    for (let k = 0; k < 14; k++) {
      const a = Math.PI * (k + 0.5) / 14;
      ap.push([new THREE.CylinderGeometry(1.05, 1.05, Math.PI * R / 14 * 1.12, 8), k % 2 ? th.curbA : 0xffffff, [Math.cos(a) * R, Math.sin(a) * R - 0.8, 0], null, [0, 0, a]]);
    }
    const ag = own(merged(ap)), am = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
    for (const f of [0.22, 0.5, 0.76]) {
      const i = fIdx(f); if (!free(i)) continue;
      const s = S(i), mesh = addMesh(ag, am); mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.h;
    }
  }

  // ---------- Globos ----------
  {
    const g = own(merged([
      [new THREE.IcosahedronGeometry(0.6, 1), 0xffffff, [0, 5.4, 0], [1, 1.2, 1]],
      [new THREE.IcosahedronGeometry(0.55, 1), 0xfff2a8, [0.7, 4.7, 0.3], [1, 1.2, 1]],
      [new THREE.IcosahedronGeometry(0.55, 1), 0xffc8e8, [-0.6, 4.5, -0.25], [1, 1.2, 1]],
      [new THREE.CylinderGeometry(0.02, 0.02, 4.6, 4), 0xffffff, [0, 2.4, 0]],
      [new THREE.BoxGeometry(0.5, 0.5, 0.5), 0x4a3a44, [0, 0.25, 0]],
    ]));
    const m = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float bph = instanceMatrix[3].x * 0.5 + instanceMatrix[3].z * 0.3; float bk = smoothstep(0.3, 5.0, position.y);\n transformed.x += sin(uTime * 1.4 + bph) * 0.4 * bk; transformed.z += cos(uTime * 1.1 + bph) * 0.3 * bk;');
    };
    const count = quality > 0.7 ? 22 : 12, im = new THREE.InstancedMesh(g, m, count);
    let n = 0, tries = 0;
    while (n < count && tries++ < 300) {
      const i = n < 6 ? N - 26 + n * 8 : Math.floor(rand() * N); if (!free(i)) continue;
      const s = S(i), lat = (hw + 5.5 + rand() * 2.5) * (rand() > 0.5 ? 1 : -1);
      o.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); o.rotation.set(0, rand() * 6.28, 0); o.scale.setScalar(0.9 + rand() * 0.4); o.updateMatrix();
      im.setMatrixAt(n, o.matrix); im.setColorAt(n, col.set(VIVID[Math.floor(rand() * VIVID.length)])); n++;
    }
    im.count = n; im.frustumCulled = false; group.add(im);
  }

  // ---------- Vallas publicitarias ----------
  {
    const frameG = own(merged([
      [new THREE.BoxGeometry(13.8, 6.3, 0.3), 0x2a2238, [0, 7, -0.2]],
      [new THREE.BoxGeometry(0.5, 13, 0.5), 0x3a3248, [-4.6, 0.5, -0.4]], [new THREE.BoxGeometry(0.5, 13, 0.5), 0x3a3248, [4.6, 0.5, -0.4]],
    ]));
    const frameM = lambert(), panelG = own(new THREE.PlaneGeometry(13, 5.5));
    const mats = ADS.map(([t1, t2, c1, c2, fg]) => own(new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 1, 1).multiplyScalar(th.neon ? B(1.5) : 1),
      map: own(canvasTex(256, 108, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(i * 44, h); c.lineTo(i * 44 + 22, h); c.lineTo(i * 44 + 70, 0); c.lineTo(i * 44 + 48, 0); c.fill(); }
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
        c.font = 'italic 900 50px "Trebuchet MS", sans-serif'; c.lineWidth = 9; c.strokeStyle = '#1a0b3a';
        c.strokeText(t1, w / 2, 36); c.fillStyle = fg; c.fillText(t1, w / 2, 36);
        c.font = 'italic 900 34px "Trebuchet MS", sans-serif'; c.lineWidth = 7;
        c.strokeText(t2, w / 2, 80); c.fillStyle = '#ffffff'; c.fillText(t2, w / 2, 80);
        c.lineWidth = 8; c.strokeStyle = '#ffffff'; c.strokeRect(4, 4, w - 8, h - 8);
      })),
    })));
    let n = 0;
    for (const f of [0.04, 0.19, 0.33, 0.48, 0.58, 0.66, 0.78, 0.95]) {
      const i = fIdx(f); if (!free(i)) continue;
      const s = S(i), side = s.curv > 0 ? -1 : 1, lat = (hw + 16.5) * side, beta = 0.75;
      const nxT = -s.tx * Math.cos(beta) - s.nx * side * Math.sin(beta), nzT = -s.tz * Math.cos(beta) - s.nz * side * Math.sin(beta);
      const gr = new THREE.Group(); gr.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); gr.rotation.y = Math.atan2(nxT, nzT);
      const fr = new THREE.Mesh(frameG, frameM); fr.castShadow = shadows;
      const pn = new THREE.Mesh(panelG, mats[n++ % mats.length]); pn.position.y = 7;
      gr.add(fr, pn); group.add(gr);
    }
  }

  // ---------- Farolas / antorchas ----------
  {
    const postG = own(merged([[new THREE.CylinderGeometry(0.11, 0.17, 4.4, 6), 0x3a3248, [0, 2.2, 0]], [new THREE.CylinderGeometry(0.3, 0.14, 0.4, 6), 0x3a3248, [0, 4.5, 0]]]));
    const headG = own(new THREE.IcosahedronGeometry(0.42, 1));
    const headM = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(ex.lamp).multiplyScalar(B(2.6)) }));
    const list = [];
    for (let i = 8, k = 0; i < N - 6; i += 16, k++) { const s = samples[i]; if (!s.tun && !s.noRoad && !nearRamp(i)) list.push([s, k % 2 ? 1 : -1]); }
    const posts = new THREE.InstancedMesh(postG, lambert(), list.length), heads = new THREE.InstancedMesh(headG, headM, list.length);
    list.forEach(([s, side], n) => {
      const lat = Math.min(hw + 3.3, s.lim + 1.0) * side;
      o.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); posts.setMatrixAt(n, o.matrix);
      o.position.y = s.y + 4.95; o.updateMatrix(); heads.setMatrixAt(n, o.matrix);
    });
    posts.frustumCulled = heads.frustumCulled = false; group.add(posts, heads);
  }

  // ---------- Fauna y luces del cielo ----------
  if (ex.life === 'birds' || ex.life === 'planes') {
    // pájaros que aletean o (en la fábrica) aviones de papel que planean
    const paper = ex.life === 'planes', g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(paper
      ? [0, 0, 1.3, 0, 0, -0.9, -1.1, 0.22, -0.9, 0, 0, 1.3, 0, 0, -0.9, 1.1, 0.22, -0.9, 0, 0, 1.3, 0, 0, -0.9, 0, -0.42, -0.9]
      : [0, 0, 0.6, 0, 0, -0.5, -1.7, 0.7, 0, 0, 0, 0.6, 0, 0, -0.5, 1.7, 0.7, 0], 3));
    const m = own(new THREE.MeshBasicMaterial({ color: paper || ex.hazard === 'crab' ? 0xffffff : 0x2a2a3a, side: THREE.DoubleSide }));
    const count = 12, im = new THREE.InstancedMesh(g, m, count), birds = [];
    for (let i = 0; i < count; i++) { const s = samples[Math.floor(rand() * N)]; birds.push({ cx: s.x, cz: s.z, y: s.y + 32 + rand() * 40, r: 25 + rand() * 45, sp: (0.25 + rand() * 0.3) * (rand() > 0.5 ? 1 : -1), ph: rand() * 6.28 }); }
    im.frustumCulled = false; group.add(im);
    updaters.push((dt, t) => {
      for (let i = 0; i < count; i++) {
        const b = birds[i], a = t * b.sp + b.ph;
        o.position.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.7 + b.ph) * 3, b.cz + Math.sin(a) * b.r);
        o.rotation.set(0, -a + (b.sp > 0 ? 0 : Math.PI), paper ? (b.sp > 0 ? -0.35 : 0.35) : 0);
        if (paper) o.scale.setScalar(1.7); else o.scale.set(1.3, Math.sin(t * 9 + b.ph) * 0.9 + 0.2, 1.3);
        o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
  } else if (ex.life === 'beams') {
    const g = own(new THREE.ConeGeometry(22, 260, 14, 1, true)); g.translate(0, -130, 0); g.rotateX(Math.PI);
    const beams = [];
    for (let i = 0; i < 6; i++) {
      const m = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? 0xff2fd0 : 0x00f0ff).multiplyScalar(B(1.4)), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      const s = samples[Math.floor((i + 0.5) / 6 * N)], lat = (hw + 70) * (i % 2 ? 1 : -1);
      const mesh = new THREE.Mesh(g, m); mesh.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); mesh.userData.ph = rand() * 6.28;
      group.add(mesh); beams.push(mesh);
    }
    updaters.push((dt, t) => { for (const b of beams) b.rotation.set(Math.sin(t * 0.31 + b.userData.ph) * 0.5, 0, Math.cos(t * 0.23 + b.userData.ph) * 0.5); });
  }

  // ---------- Tramo de barco: boyas a ambos lados ----------
  if (boatRs.length) {
    const g = own(merged([[new THREE.IcosahedronGeometry(0.75, 1), 0xffffff, [0, 0.25, 0]], [new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), 0xf0f0f0, [0, 1.3, 0]], [new THREE.IcosahedronGeometry(0.17, 0), 0xfff2a0, [0, 2.1, 0]]]));
    const m = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += sin(uTime * 2.2 + instanceMatrix[3].x * 0.4 + instanceMatrix[3].z * 0.3) * 0.14;');
    };
    const list = []; for (const r of boatRs) { const st = r[1] - r[0] > 250 ? 6 : 3; for (let i = r[0] - 4; i <= r[1] + 4; i += st) for (const side of [1, -1]) list.push([S(i), side]); }
    const im = new THREE.InstancedMesh(g, m, list.length);
    list.forEach(([s, side], n) => {
      const lat = (hw + 2.4) * side; o.position.set(s.x + s.nx * lat, th.liquidLevel, s.z + s.nz * lat); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix();
      im.setMatrixAt(n, o.matrix); im.setColorAt(n, col.set((n >> 1) % 2 ? 0xff3b4a : 0xffd21f));
    });
    im.frustumCulled = false; group.add(im);
  }

  // ---------- Tramo submarino: corales, algas, peces y rayos de luz ----------
  if (subIdx.length > 10) {
    const len = subIdx.length, pick = () => S(subIdx[Math.floor(rand() * len)]);
    const coralG = toy ? own(merged([[new THREE.IcosahedronGeometry(0.9, 1), 0xffffff, [0, 0.9, 0]], [new THREE.IcosahedronGeometry(0.6, 1), 0xfff6c0, [1.3, 0.6, 0.4]],
      [new THREE.IcosahedronGeometry(0.45, 1), 0xffffff, [-0.9, 0.45, -0.7]], [new THREE.BoxGeometry(1.2, 1.2, 1.2), 0xfff6c0, [-0.4, 0.6, 1.3], null, [0, 0.5, 0]]])) : own(merged([
      [new THREE.CylinderGeometry(0.14, 0.24, 2.0, 6), 0xffffff, [0, 1.0, 0]], [new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6), 0xffffff, [0.5, 1.4, 0], null, [0, 0, -0.7]],
      [new THREE.CylinderGeometry(0.1, 0.16, 1.2, 6), 0xffffff, [-0.45, 1.2, 0.2], null, [0.3, 0, 0.8]], [new THREE.IcosahedronGeometry(0.9, 1), 0xfff0e0, [0.9, 0.4, -0.6], [1.2, 0.7, 1]],
      [new THREE.IcosahedronGeometry(0.28, 0), 0xffffff, [0, 2.1, 0]], [new THREE.IcosahedronGeometry(0.22, 0), 0xffffff, [0.95, 1.95, 0]],
    ]));
    const weedG = toy ? own(PROPS.spintop.make()) : own(merged([[new THREE.ConeGeometry(0.16, 4.2, 5), 0x2ab56a, [0, 2.1, 0]], [new THREE.ConeGeometry(0.14, 3.2, 5), 0x35d47a, [0.5, 1.6, 0.2], null, [0, 0, -0.18]], [new THREE.ConeGeometry(0.14, 3.6, 5), 0x1f9a5a, [-0.4, 1.8, -0.3], null, [0.15, 0, 0.2]]]));
    const weedM = lambert();
    if (!toy) weedM.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uTime * 1.6 + instanceMatrix[3].x * 0.5 + position.y * 0.7) * 0.12 * position.y;');
    };
    const count = quality > 0.7 ? 70 : 36;
    const coral = new THREE.InstancedMesh(coralG, lambert(), count), weed = new THREE.InstancedMesh(weedG, weedM, count);
    for (let n = 0; n < count * 2; n++) {
      const s = pick(), lat = (hw + 3.5 + Math.pow(rand(), 1.6) * 34) * (rand() > 0.5 ? 1 : -1);
      const x = s.x + s.nx * lat, z = s.z + s.nz * lat, y = Math.abs(lat) < s.lim + 2.6 ? s.y : terrainAt(x, z);
      o.position.set(x, y - 0.1, z); o.rotation.set(0, rand() * 6.28, 0); o.scale.setScalar(0.8 + rand() * 1.3); o.updateMatrix();
      if (n < count) { coral.setMatrixAt(n, o.matrix); coral.setColorAt(n, col.set(VIVID[Math.floor(rand() * VIVID.length)])); }
      else { weed.setMatrixAt(n - count, o.matrix); if (toy) weed.setColorAt(n - count, col.set(VIVID[Math.floor(rand() * VIVID.length)])); }
    }
    coral.frustumCulled = weed.frustumCulled = false; group.add(coral, weed);
    if (outline) group.add(outlineInstanced(coral));
    // peces en bancos que nadan en círculos (en la fábrica, patos de goma que flotan en la pintura)
    const fishG = toy ? own(merged([[new THREE.IcosahedronGeometry(0.7, 1), 0xffd21f, [0, 0.35, 0], [0.85, 0.7, 1.2]], [new THREE.IcosahedronGeometry(0.42, 1), 0xffd21f, [0, 1.0, 0.5]],
      [new THREE.ConeGeometry(0.2, 0.45, 5), 0xff7a1a, [0, 0.95, 1.0], [1.3, 1, 0.6], [Math.PI / 2, 0, 0]], [new THREE.ConeGeometry(0.3, 0.6, 4), 0xffd21f, [0, 0.6, -0.9], [1, 1, 0.5], [-0.9, 0, 0]],
      [new THREE.IcosahedronGeometry(0.08, 0), 0x16161c, [0.22, 1.12, 0.82]], [new THREE.IcosahedronGeometry(0.08, 0), 0x16161c, [-0.22, 1.12, 0.82]]])) : own(merged([[new THREE.IcosahedronGeometry(0.5, 1), 0xffffff, null, [0.45, 0.75, 1.3]], [new THREE.ConeGeometry(0.4, 0.6, 4), 0xffffff, [0, 0, -0.85], [0.2, 1, 1], [-Math.PI / 2, 0, 0]], [new THREE.IcosahedronGeometry(0.08, 0), 0x16161c, [0.2, 0.12, 0.5]], [new THREE.IcosahedronGeometry(0.08, 0), 0x16161c, [-0.2, 0.12, 0.5]]]));
    const fc = quality > 0.7 ? 32 : 16, fish = new THREE.InstancedMesh(fishG, lambert(), fc), fl = [];
    for (let i = 0; i < fc; i++) {
      const s = pick(), lat = (rand() - 0.5) * 40;
      fl.push({ cx: s.x + s.nx * lat, cz: s.z + s.nz * lat, y: toy ? th.liquidLevel - 0.1 : s.y + 2.5 + rand() * 5, r: 3 + rand() * 7, sp: (0.4 + rand() * 0.5) * (rand() > 0.5 ? 1 : -1) * (toy ? 0.5 : 1), ph: rand() * 6.28, sc: (0.6 + rand() * 0.8) * (toy ? 1.5 : 1) });
      fish.setColorAt(i, col.set(toy ? 0xffffff : [0xff7a1a, 0xffd21f, 0x22e6ff, 0xff4fd8][i % 4]));
    }
    fish.frustumCulled = false; group.add(fish);
    const c0 = S(subIdx[len >> 1]);
    updaters.push((dt, t, cam) => {
      if ((c0.x - cam.x) ** 2 + (c0.z - cam.z) ** 2 > 260 * 260) return;
      for (let i = 0; i < fc; i++) {
        const f = fl[i], a = t * f.sp + f.ph;
        o.position.set(f.cx + Math.cos(a) * f.r, f.y + Math.sin(t * 1.3 + f.ph) * (toy ? 0.12 : 0.5), f.cz + Math.sin(a) * f.r);
        o.rotation.set(0, -a + (f.sp > 0 ? 0 : Math.PI), 0); o.scale.setScalar(f.sc); o.updateMatrix(); fish.setMatrixAt(i, o.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
    });
    const rayG = own(new THREE.ConeGeometry(3, 46, 16, 1, true)); rayG.translate(0, -23, 0);
    const rayM = own(new THREE.MeshBasicMaterial({ color: toy ? 0xffe0f4 : 0xcff6ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    for (let i = 0; i < 9; i++) { const s = S(subIdx[Math.floor((i + 0.5) / 9 * len)]), lat = (i % 2 ? 1 : -1) * (4 + rand() * 12); const r = new THREE.Mesh(rayG, rayM); r.position.set(s.x + s.nx * lat, th.liquidLevel + 22, s.z + s.nz * lat); r.rotation.z = 0.22; group.add(r); }
  }

  // ---------- Globos aerostáticos ----------
  if (!th.neon && !th.space && ex.weather !== 'ash' && ex.liquidMode !== 1) {
    const parts = [[new THREE.SphereGeometry(7, 14, 10), 0xffffff, [0, 10, 0], [1, 1.15, 1]], [new THREE.CylinderGeometry(1.2, 1.0, 1.6, 8), 0x8a5a2a, [0, 0.8, 0]]];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push([new THREE.SphereGeometry(7.08, 6, 10, a, Math.PI / 6), VIVID[i], [0, 10, 0], [1, 1.15, 1]], [new THREE.CylinderGeometry(0.06, 0.06, 4.2, 4), 0xffffff, [Math.cos(a) * 1.6, 3.4, Math.sin(a) * 1.6], null, [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]]); }
    const g = own(merged(parts)), m = own(new THREE.MeshLambertMaterial({ vertexColors: true })), bl = [];
    for (let i = 0; i < 3; i++) { const s = S(Math.floor((i + 0.3) / 3 * N)), mesh = addMesh(g, m, false); bl.push({ mesh, cx: s.x, cz: s.z, y: s.y + 70 + i * 22, r: 60 + i * 30, ph: i * 2.1 }); if (outline) addOutline(mesh); }
    updaters.push((dt, t) => { for (const b of bl) { const a = t * 0.03 + b.ph; b.mesh.position.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.4 + b.ph) * 3, b.cz + Math.sin(a) * b.r); b.mesh.rotation.y = a; } });
  }

  // ---------- Monumentos de cada mapa ----------
  {
    const spot = (u, dist, side0) => {
      const i = fIdx(u), s = S(i), side = side0 || (s.curv > 0 ? -1 : 1), lat = (hw + dist) * side, x = s.x + s.nx * lat, z = s.z + s.nz * lat;
      return { s, x, z, y: Math.max(terrainAt(x, z), th.liquidLevel + 0.4), yaw: Math.atan2(-s.nx * side, -s.nz * side) };
    };
    const outSide = u => { const s = S(fIdx(u)); return s.x * s.nx + s.z * s.nz > 0 ? 1 : -1; }; // lado que mira hacia fuera del circuito
    const put = (g, m, sp, cast = true) => { const mesh = addMesh(g, m, cast); mesh.position.set(sp.x, sp.y, sp.z); mesh.rotation.y = sp.yaw; if (outline) addOutline(mesh); return mesh; };
    const glowM = c => own(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(B(2)) }));
    const Bx = (x, y, z) => new THREE.BoxGeometry(x, y, z), Cy = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n), Co = (r, h, n = 10) => new THREE.ConeGeometry(r, h, n), Ic = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
    const id = ctx.def.id;
    if (id === 'selva') {
      // pirámide con cabeza de gorila y cascada
      const p = [], st = [0x9a9a7a, 0x8a8a6a];
      for (let i = 0; i < 5; i++) p.push([Bx(46 - i * 8, 5, 46 - i * 8), st[i % 2], [0, 2.5 + i * 5, 0]]);
      p.push([Bx(7, 26, 3), 0xb8b89a, [0, 12.5, 21], null, [-0.72, 0, 0]], [Bx(12, 6, 12), 0x7a7a5a, [0, 28, 0]], [Ic(6.5), 0x8a7a5a, [0, 36, 0], [1, 1.05, 1]], [Bx(9, 1.6, 3), 0x6a5a3a, [0, 37.5, 5]], [Ic(3.4), 0xa89a7a, [0, 33.5, 5], [1.2, 0.8, 0.9]]);
      for (let i = 0; i < 9; i++) p.push([Bx(1.2, 6 + rand() * 9, 0.6), 0x2a9a3a, [-20 + rand() * 40, 14 - rand() * 6, 23.2 - Math.floor(rand() * 3) * 4]]);
      const sp = spot(0.72, 95); put(own(merged(p)), lambert(), sp);
      const eyes = new THREE.Mesh(own(merged([[Ic(0.9, 0), 0xffffff, [-2.2, 36.6, 5.6]], [Ic(0.9, 0), 0xffffff, [2.2, 36.6, 5.6]]])), glowM(0xffe600)); eyes.position.set(sp.x, sp.y, sp.z); eyes.rotation.y = sp.yaw; group.add(eyes);
      const wt = own(canvasTex(64, 128, (c) => { c.fillStyle = '#3ad0ff'; c.fillRect(0, 0, 64, 128); c.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 26; i++) c.fillRect(Math.random() * 64, Math.random() * 128, 3 + Math.random() * 4, 14 + Math.random() * 26); }, true));
      const fall = new THREE.Mesh(own(new THREE.PlaneGeometry(9, 22)), own(new THREE.MeshBasicMaterial({ map: wt }))); fall.position.set(sp.x + Math.sin(sp.yaw) * 23.6 + Math.cos(sp.yaw) * 13, sp.y + 11, sp.z + Math.cos(sp.yaw) * 23.6 - Math.sin(sp.yaw) * 13); fall.rotation.y = sp.yaw; group.add(fall);
      updaters.push((dt, t) => { wt.offset.y = t * 0.9 % 1; });
      // cabezas de piedra junto a la pista
      const hg = own(merged([[Ic(2.6), 0x9a9a8a, [0, 3.2, 0], [1, 1.35, 1]], [Bx(4.4, 0.9, 1.6), 0x7a7a6a, [0, 4.4, 2]], [Ic(1.5), 0xaaa99a, [0, 2.4, 2.1], [1.2, 0.8, 0.8]], [Bx(3.4, 1.4, 3.4), 0x7a7a6a, [0, 0.7, 0]]]));
      for (const u of [0.035, 0.29, 0.57, 0.945]) put(hg, lambert(), spot(u, 15));
    } else if (id === 'playa') {
      // faro con haz giratorio y barco pirata
      const p = [[Cy(3.2, 4.6, 28, 12), 0xffffff, [0, 14, 0]], [Cy(3.95, 4.3, 5, 12), 0xff3b4a, [0, 6, 0]], [Cy(3.45, 3.75, 5, 12), 0xff3b4a, [0, 17, 0]], [Cy(4.2, 4.2, 0.8, 12), 0x3a3a48, [0, 28.4, 0]], [Co(3.6, 4.5, 10), 0xff3b4a, [0, 34.5, 0]], [Ic(9), 0xc9b08a, [0, -5, 0], [1.3, 0.8, 1.3]]];
      const sp = spot(0.72, 80); put(own(merged(p)), lambert(), sp);
      const lamp = new THREE.Mesh(own(Cy(2.5, 2.5, 3.4, 10)), glowM(0xfff2a0)); lamp.position.set(sp.x, sp.y + 30.5, sp.z); group.add(lamp);
      const bg = own(new THREE.ConeGeometry(9, 150, 10, 1, true)); bg.translate(0, -75, 0); bg.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(bg, own(new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }))); beam.position.copy(lamp.position); group.add(beam);
      updaters.push((dt, t) => { beam.rotation.y = t * 0.6; });
      const sh = [[new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x7a4a2a, [0, 3.2, 0], [5, 4.5, 15]], [Bx(9.4, 0.5, 28), 0xa8744a, [0, 3.3, 0]], [Bx(8, 4, 7), 0x6a3a1a, [0, 5.3, -10.5]], [Co(0.7, 8, 6), 0x7a4a2a, [0, 5.5, 16.5], null, [1.2, 0, 0]]];
      for (const [z, hgt] of [[5, 24], [-4, 20]]) sh.push([Cy(0.4, 0.5, hgt, 6), 0x5a3a1a, [0, 3.3 + hgt / 2, z]], [Bx(11, hgt * 0.4, 0.3), 0xfff6e0, [0, 3.3 + hgt * 0.72, z + 0.6]], [Bx(8.5, hgt * 0.26, 0.3), 0xfff6e0, [0, 3.3 + hgt * 0.34, z + 0.6]]);
      sh.push([Bx(3.4, 2.2, 0.2), 0x16161c, [1.9, 28.4, 5]], [Ic(0.6, 0), 0xffffff, [1.9, 28.5, 5.2]]);
      const bi = boatR ? Math.round((boatR[0] + boatR[1]) / 2) : fIdx(0.5), bs = S(bi), side = bs.curv > 0 ? -1 : 1, lat = (hw + 34) * side;
      const ship = put(own(merged(sh)), lambert(), { x: bs.x + bs.nx * lat, y: th.liquidLevel - 0.6, z: bs.z + bs.nz * lat, yaw: bs.h + 0.5 });
      updaters.push((dt, t) => { ship.position.y = th.liquidLevel - 0.6 + Math.sin(t * 0.9) * 0.35; ship.rotation.z = Math.sin(t * 0.7) * 0.04; });
      // cabañas y tablas de surf
      const hut = own(merged([[Bx(5, 3.4, 5), 0xd9b98a, [0, 1.7, 0]], [Co(4.6, 3.2, 4), 0xc98a3a, [0, 5, 0], null, [0, Math.PI / 4, 0]], [Bx(1.3, 2.2, 0.2), 0x6a4020, [0, 1.1, 2.55]]]));
      for (const u of [0.035, 0.52, 0.945]) put(hut, lambert(), spot(u, 17));
      const sb = own(merged([[new THREE.CapsuleGeometry(0.55, 3.2, 4, 8), 0xffffff, [0, 2.1, 0], [1, 1, 0.16], [0.12, 0, 0]], [Bx(0.16, 4.2, 0.05), 0x1a0b3a, [0, 2.1, 0.11], null, [0.12, 0, 0]]]));
      [0.045, 0.3, 0.47, 0.55, 0.73, 0.95].forEach((u, n) => { const q = spot(u, 12 + (n % 3) * 1.5, n % 2 ? 1 : -1); const m = put(sb, own(new THREE.MeshLambertMaterial({ vertexColors: true, color: VIVID[n % VIVID.length] })), q); m.rotation.y = q.yaw + n; });
    } else if (id === 'volcan') {
      // gran volcán con cráter encendido, ríos de lava y humo
      const sp = spot(0.72, 210), p = [[Cy(26, 120, 130, 12, 1), 0x4a2a38, [0, 60, 0]], [Cy(30, 34, 8, 12), 0x3a1f2c, [0, 128, 0]]];
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; p.push([new THREE.DodecahedronGeometry(14 + rand() * 12, 0), 0x3a2230, [Math.cos(a) * 105, 6, Math.sin(a) * 105]]); }
      put(own(merged(p)), lambert(), sp, false);
      const lg = [[Cy(25, 25, 2, 12), 0xff6a00, [0, 131, 0]]];
      for (let i = 0; i < 5; i++) lg.push([new THREE.CylinderGeometry(26.7, 121, 130, 3, 1, true, i * 1.26 + 0.4, 0.09 + rand() * 0.08), i % 2 ? 0xff5a00 : 0xffa21f, [0, 60, 0]]);
      const lava = new THREE.Mesh(own(merged(lg)), own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.7)) })));
      lava.position.set(sp.x, sp.y, sp.z); group.add(lava);
      const smG = own(Ic(1, 1)), smM = own(new THREE.MeshLambertMaterial({ color: 0x4a3a44, flatShading: true })), puffs = [];
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(smG, smM); group.add(m); puffs.push({ m, ph: i / 9 }); }
      updaters.push((dt, t) => { for (const q of puffs) { const k = (t * 0.035 + q.ph) % 1; q.m.position.set(sp.x + Math.sin(k * 5 + q.ph * 9) * 14 + k * 50, sp.y + 135 + k * 190, sp.z + Math.cos(k * 4) * 12); q.m.scale.setScalar(16 + k * 46); } });
      // castillo de lava
      const cs = [[Bx(26, 12, 20), 0x3a2630, [0, 6, 0]], [Bx(10, 20, 10), 0x2e1e28, [0, 10, 0]], [Co(8, 9, 4), 0x5a2030, [0, 24.5, 0], null, [0, Math.PI / 4, 0]]];
      for (const [x, z] of [[-13, -10], [13, -10], [-13, 10], [13, 10]]) cs.push([Cy(3.6, 4.2, 20, 8), 0x2e1e28, [x, 10, z]], [Co(4.6, 7, 8), 0x5a2030, [x, 23.5, z]]);
      const c2 = spot(0.03, 62); put(own(merged(cs)), lambert(), c2);
      const wg = []; for (const [x, z] of [[-13, -10], [13, -10], [-13, 10], [13, 10], [0, 0]]) for (const yy of [8, 14]) wg.push([Bx(1.3, 2.2, 0.3), 0xffffff, [x, yy, z + (x ? 4.3 : 5.2)]]);
      wg.push([Bx(5, 7, 0.3), 0xffffff, [0, 3.5, 10.1]]);
      const win = new THREE.Mesh(own(merged(wg)), glowM(0xff7a1a)); win.position.set(c2.x, c2.y, c2.z); win.rotation.y = c2.yaw; group.add(win);
    } else if (id === 'hielo') {
      // castillo de hielo, iglús y aurora
      const cs = [[Bx(30, 14, 22), 0xbfe6ff, [0, 7, 0]], [Bx(12, 26, 12), 0xd6f2ff, [0, 13, 0]], [Co(9.5, 14, 6), 0x6fc6ff, [0, 33, 0]]];
      for (const [x, z] of [[-15, -11], [15, -11], [-15, 11], [15, 11]]) cs.push([Cy(4, 4.6, 24, 8), 0xd6f2ff, [x, 12, z]], [Co(5.2, 11, 8), 0x6fc6ff, [x, 29.5, z]]);
      for (let i = 0; i < 7; i++) cs.push([new THREE.OctahedronGeometry(3 + rand() * 3, 0), 0x9fe6ff, [-24 + rand() * 48, 3, 14 + rand() * 8], [0.6, 2.2, 0.6]]);
      const sp = spot(0.72, 85); put(own(merged(cs)), lambert(), sp);
      const wg = []; for (const [x, z] of [[-15, 11], [15, 11], [0, 0]]) for (const yy of [8, 15, 21]) wg.push([Bx(1.4, 2.6, 0.3), 0xffffff, [x, yy, z + (x ? 4.7 : 6.2)]]);
      const win = new THREE.Mesh(own(merged(wg)), glowM(0x7fe8ff)); win.position.set(sp.x, sp.y, sp.z); win.rotation.y = sp.yaw; group.add(win);
      const ig = own(merged([[new THREE.SphereGeometry(3.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4fbff, null], [Cy(1.3, 1.3, 2.6, 8), 0xdcefff, [0, 0.9, 3.2], null, [Math.PI / 2, 0, 0]], [Cy(1.0, 1.0, 0.3, 8), 0x26304a, [0, 0.9, 4.5], null, [Math.PI / 2, 0, 0]]]));
      for (const u of [0.035, 0.29, 0.56, 0.945]) put(ig, lambert(), spot(u, 16));
      // aurora boreal: cintas de luz en el cielo
      const at = own(canvasTex(64, 64, (c) => { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(0.45, 'rgba(120,255,200,.9)'); g.addColorStop(0.75, 'rgba(160,120,255,.6)'); g.addColorStop(1, 'rgba(160,120,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }));
      const ribbons = [];
      for (let i = 0; i < 3; i++) {
        const g = own(new THREE.PlaneGeometry(900, 150, 30, 1)), P = g.attributes.position;
        for (let k = 0; k < P.count; k++) P.setZ(k, Math.sin(P.getX(k) * 0.012 + i * 2) * 90);
        const m = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ map: at, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })));
        m.position.set(-200 + i * 220, 330 + i * 40, -500 + i * 420); m.rotation.y = i * 1.1; group.add(m); ribbons.push(m);
      }
      updaters.push((dt, t) => ribbons.forEach((r, i) => { r.material.opacity = 0.35 + Math.sin(t * 0.5 + i * 2) * 0.2; }));
    } else if (id === 'neon') {
      // noria de neón y hologramas
      const sp = spot(0.72, 75), R = 26, wheel = new THREE.Group(), neon = c => own(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(B(1.9)) }));
      wheel.add(new THREE.Mesh(own(new THREE.TorusGeometry(R, 0.7, 6, 40)), neon(0xff2fd0)), new THREE.Mesh(own(new THREE.TorusGeometry(R * 0.55, 0.4, 6, 30)), neon(0x00f0ff)));
      const spk = [], cab = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; spk.push([Bx(0.4, R, 0.4), 0xffffff, [Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0], null, [0, 0, a - Math.PI / 2]]); cab.push([Bx(3.4, 3, 3.4), VIVID[i % VIVID.length], [Math.cos(a) * R, Math.sin(a) * R - 2, 0]]); }
      wheel.add(new THREE.Mesh(own(merged(spk)), neon(0x7a5cff)), new THREE.Mesh(own(merged(cab)), own(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.4)) }))));
      wheel.position.set(sp.x, sp.y + R + 5, sp.z); wheel.rotation.y = sp.yaw; group.add(wheel);
      put(own(merged([[Bx(1.6, R + 8, 1.6), 0x2a2250, [-9, (R + 8) / 2, -2.5], null, [0, 0, -0.3]], [Bx(1.6, R + 8, 1.6), 0x2a2250, [9, (R + 8) / 2, -2.5], null, [0, 0, 0.3]], [Bx(26, 2, 8), 0x1a1240, [0, 1, -2.5]]])), lambert(), sp);
      const holos = [];
      [0.035, 0.31, 0.56, 0.945].forEach((u, n) => {
        const q = spot(u, 26), hm = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(n % 2 ? 0x00f0ff : 0xff2fd0).multiplyScalar(B(1.3)), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true, fog: false }));
        const h = new THREE.Mesh(own(n % 2 ? new THREE.IcosahedronGeometry(7, 1) : new THREE.OctahedronGeometry(8, 0)), hm); h.position.set(q.x, q.y + 15, q.z); group.add(h); holos.push(h);
        put(own(merged([[Cy(2.6, 3.2, 1.2, 10), 0x2a2250, [0, 0.6, 0]]])), lambert(), q);
      });
      updaters.push((dt, t) => { wheel.rotation.z = t * 0.12; holos.forEach((h, i) => { h.rotation.set(t * 0.4 + i, t * 0.6, 0); h.position.y += Math.sin(t * 1.2 + i) * 0.01; }); });
    } else if (id === 'arcoiris') {
      // arcoíris gigante sobre el circuito, islas flotantes y piruletas
      const rc = [0xff3b4a, 0xff9a1a, 0xffe600, 0x35e08a, 0x22b6ff, 0x9a5cff];
      rc.forEach((c, i) => { const m = new THREE.Mesh(own(new THREE.TorusGeometry(ctx.def.R * 1.55 - i * 9, 4.6, 6, 60, Math.PI)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(B(1.15)), transparent: true, opacity: 0.8, fog: false, depthWrite: false }))); m.position.set(0, -30, 0); m.rotation.y = 0.6; group.add(m); });
      const isl = own(merged([[Co(11, 16, 7), 0x9a6aff, [0, -8, 0], null, [Math.PI, 0, 0]], [Cy(11.5, 11, 2.4, 7), 0x7ae89a, [0, 1.2, 0]], [Cy(0.7, 0.9, 6, 6), 0xffffff, [-3, 5.4, 1]], [Ic(3.6), 0xff8ad8, [-3, 10.5, 1]], [new THREE.OctahedronGeometry(2, 0), 0x9fe6ff, [4.5, 5, -2], [0.7, 2.2, 0.7]]])), il = [];
      for (let i = 0; i < 5; i++) { const q = spot(0.1 + i * 0.19, 45 + (i % 2) * 30, i % 2 ? 1 : -1); const m = put(isl, lambert(), q); il.push({ m, y: q.y + 26 + i * 6, ph: i * 1.7 }); }
      updaters.push((dt, t) => { for (const q of il) { q.m.position.y = q.y + Math.sin(t * 0.6 + q.ph) * 2.2; q.m.rotation.y += dt * 0.05; } });
      const lol = own(merged([[Cy(0.3, 0.3, 9, 6), 0xffffff, [0, 4.5, 0]], [Cy(3, 3, 0.7, 16), 0xffffff, [0, 11, 0], null, [Math.PI / 2, 0, 0]], [new THREE.TorusGeometry(2.1, 0.36, 6, 18), 0xffe600, [0, 11, 0.2]], [new THREE.TorusGeometry(1.1, 0.34, 6, 14), 0x22e6ff, [0, 11, 0.25]]]));
      [0.035, 0.29, 0.47, 0.56, 0.73, 0.945].forEach((u, n) => { put(lol, own(new THREE.MeshLambertMaterial({ vertexColors: true, color: [0xff8ad8, 0xffffff, 0xc9a0ff][n % 3] })), spot(u, 14, n % 2 ? 1 : -1)); });
    } else if (id === 'nubes') {
      // palacio dorado sobre una nube y puertas con columnas junto a la pista
      const sp = spot(0.72, 105), p = [[Ic(26), 0xffffff, [0, -8, 0], [1.5, 0.5, 1.3]], [Ic(16), 0xeef3ff, [26, -9, 8], [1.3, 0.5, 1]], [Ic(15), 0xeef3ff, [-25, -9, -6], [1.3, 0.5, 1]],
        [Bx(30, 12, 22), 0xfff6ff, [0, 8, 0]], [Bx(12, 22, 12), 0xffffff, [0, 13, 0]], [new THREE.SphereGeometry(7.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xffd21f, [0, 24, 0]], [Co(1.2, 6, 6), 0xffd21f, [0, 34, 0]]];
      for (const [x, z] of [[-15, -11], [15, -11], [-15, 11], [15, 11]]) p.push([Cy(3.4, 3.8, 22, 10), 0xffffff, [x, 11, z]], [new THREE.SphereGeometry(4.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xffd21f, [x, 22, z]], [Co(0.8, 4, 6), 0xffd21f, [x, 27.5, z]]);
      for (let i = 0; i < 6; i++) p.push([Cy(1, 1.1, 9, 8), 0xfff0d0, [-12.5 + i * 5, 4.5, 12.5]]);
      sp.y = Math.max(sp.y, 14); put(own(merged(p)), lambert(), sp);
      const gate = own(merged([[Cy(1, 1.15, 11, 10), 0xffffff, [-9.6, 5.5, 0]], [Cy(1, 1.15, 11, 10), 0xffffff, [9.6, 5.5, 0]], [Bx(22.5, 1.6, 2.6), 0xfff6ff, [0, 11.8, 0]], [Bx(8, 3.2, 1.4), 0xffd21f, [0, 14, 0], null, [0, 0, 0]], [Ic(2.2), 0xffffff, [-9.6, -0.3, 0], [1.4, 0.6, 1.4]], [Ic(2.2), 0xffffff, [9.6, -0.3, 0], [1.4, 0.6, 1.4]]]));
      for (const u of [0.035, 0.235, 0.6, 0.945]) { const i = fIdx(u), s = S(i); if (free(i)) { const m = addMesh(gate, lambert()); m.position.set(s.x, s.y, s.z); m.rotation.y = s.h; if (outline) addOutline(m); } }
      const rc = [0xff3b4a, 0xff9a1a, 0xffe600, 0x35e08a, 0x22b6ff, 0x9a5cff];
      rc.forEach((c, i) => { const m = new THREE.Mesh(own(new THREE.TorusGeometry(260 - i * 7, 3.6, 6, 50, Math.PI)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(B(1.1)), transparent: true, opacity: 0.75, fog: false, depthWrite: false }))); m.position.set(sp.x, sp.y - 40, sp.z); m.rotation.y = sp.yaw + 0.4; group.add(m); });
    } else if (id === 'oceano') {
      // islas con palmeras, arcos de roca sobre la ruta, faro y barcos
      const palm = own(PROPS.palm.make()), palmM = lambert();
      const islG = own(merged([[Ic(11), 0xffe08a, [0, -3.5, 0], [1.4, 0.5, 1.2]], [Ic(5), 0xf2c868, [6, -1.6, 3], [1.3, 0.5, 1]], [new THREE.DodecahedronGeometry(2.4, 0), 0x9aa0b0, [-7, 0.6, -3]], [new THREE.DodecahedronGeometry(1.5, 0), 0x7f8597, [8, 0.3, -5]]]));
      for (let k = 0; k < 9; k++) {
        const i = Math.floor((k + 0.5) / 9 * N), s = S(i), side = k % 2 ? 1 : -1, lat = (hw + 24 + rand() * 20) * side, x = s.x + s.nx * lat, z = s.z + s.nz * lat, yaw = rand() * 6.28;
        put(islG, lambert(), { x, y: th.liquidLevel + 0.6, z, yaw });
        for (let j = 0; j < 3; j++) { const a = yaw + j * 2.1, pm = addMesh(palm, palmM); pm.position.set(x + Math.cos(a) * 4, th.liquidLevel + 1.6, z + Math.sin(a) * 4); pm.rotation.y = a; pm.scale.setScalar(1.1 + rand() * 0.5); if (outline) addOutline(pm); }
      }
      const ap = [], R2 = hw + 9;
      for (let k = 0; k < 11; k++) { const a = Math.PI * (k + 0.5) / 11; ap.push([new THREE.DodecahedronGeometry(3.4 + rand() * 1.4, 0), k % 2 ? 0x9aa0b0 : 0x8a90a0, [Math.cos(a) * R2, Math.sin(a) * R2 * 0.8 - 1, (rand() - 0.5) * 2]]); }
      const arch = own(merged(ap));
      for (const u of [0.16, 0.42, 0.66, 0.9]) { const s = S(fIdx(u)), m = addMesh(arch, lambert()); m.position.set(s.x, th.liquidLevel, s.z); m.rotation.y = s.h; if (outline) addOutline(m); }
      const lh = [[Cy(3.2, 4.6, 28, 12), 0xffffff, [0, 14, 0]], [Cy(3.95, 4.3, 5, 12), 0xff3b4a, [0, 6, 0]], [Cy(3.45, 3.75, 5, 12), 0xff3b4a, [0, 17, 0]], [Cy(2.5, 2.5, 3.4, 10), 0xfff2a0, [0, 30.5, 0]], [Co(3.6, 4.5, 10), 0xff3b4a, [0, 34.5, 0]], [Ic(10), 0x8a90a0, [0, -4, 0], [1.3, 0.8, 1.3]]];
      const ls = S(fIdx(0.5)), ll = (hw + 46) * (ls.curv > 0 ? 1 : -1); put(own(merged(lh)), lambert(), { x: ls.x + ls.nx * ll, y: th.liquidLevel + 1, z: ls.z + ls.nz * ll, yaw: 0 });
      const sh = [[new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x7a4a2a, [0, 3.2, 0], [5, 4.5, 15]], [Bx(9.4, 0.5, 28), 0xa8744a, [0, 3.3, 0]], [Bx(8, 4, 7), 0x6a3a1a, [0, 5.3, -10.5]]];
      for (const [z, hgt] of [[5, 24], [-4, 20]]) sh.push([Cy(0.4, 0.5, hgt, 6), 0x5a3a1a, [0, 3.3 + hgt / 2, z]], [Bx(11, hgt * 0.4, 0.3), 0xfff6e0, [0, 3.3 + hgt * 0.72, z + 0.6]], [Bx(8.5, hgt * 0.26, 0.3), 0xfff6e0, [0, 3.3 + hgt * 0.34, z + 0.6]]);
      const shipG = own(merged(sh)), ships = [];
      for (const u of [0.08, 0.34, 0.78]) { const s = S(fIdx(u)), lat = (hw + 38) * (s.curv > 0 ? -1 : 1); ships.push(put(shipG, lambert(), { x: s.x + s.nx * lat, y: th.liquidLevel - 0.6, z: s.z + s.nz * lat, yaw: s.h + 0.6 })); }
      updaters.push((dt, t) => ships.forEach((m, i) => { m.position.y = th.liquidLevel - 0.6 + Math.sin(t * 0.9 + i * 2) * 0.35; m.rotation.z = Math.sin(t * 0.7 + i) * 0.04; }));
    } else if (id === 'abismo') {
      // galeón hundido, ruinas con cúpula, almeja gigante y medusas luminosas
      const sh = [[new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x5a4a3a, [0, 3.2, 0], [5, 4.5, 15]], [Bx(9.4, 0.5, 28), 0x6a5a48, [0, 3.3, 0]], [Bx(8, 4, 7), 0x4a3a2a, [0, 5.3, -10.5]], [Cy(0.4, 0.5, 20, 6), 0x4a3a2a, [0, 12, 5], null, [0, 0, 0.5]], [Cy(0.4, 0.5, 14, 6), 0x4a3a2a, [0, 9, -4], null, [0.3, 0, -0.2]]];
      const w1 = spot(0.3, 26), wm = put(own(merged(sh)), lambert(), w1); wm.rotation.z = 0.35; wm.position.y += 1.5;
      const ru = [[Cy(11, 12, 1.2, 14), 0xcfd8e0, [0, 0.6, 0]], [new THREE.SphereGeometry(8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x9fb4c8, [0, 10.5, 0]], [Cy(8.6, 8.6, 1, 14), 0xcfd8e0, [0, 10.2, 0]]];
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, broken = k % 3 === 1; ru.push([Cy(0.9, 1, broken ? 4.5 : 9, 8), 0xdfe8f0, [Math.cos(a) * 8, 1.2 + (broken ? 2.25 : 4.5), Math.sin(a) * 8]]); }
      const r1 = spot(0.72, 30); put(own(merged(ru)), lambert(), r1);
      const orb = new THREE.Mesh(own(Ic(1.6)), glowM(0x7ff0ff)); orb.position.set(r1.x, r1.y + 4.5, r1.z); group.add(orb);
      const cl = [[new THREE.SphereGeometry(3.4, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffb8d8, [0, 2.2, 0], [1.2, 0.6, 1]], [new THREE.SphereGeometry(3.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xff9ac8, [0, 2.6, -1.2], [1.2, 0.6, 1], [-0.7, 0, 0]]];
      for (const u of [0.05, 0.47, 0.9]) { const q = spot(u, 13, u > 0.4 ? 1 : -1); put(own(merged(cl)), lambert(), q); const pearl = new THREE.Mesh(own(Ic(0.9)), glowM(0xffffff)); pearl.position.set(q.x, q.y + 2.6, q.z); group.add(pearl); }
      const jg = own(merged([[new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, null, [1, 0.8, 1]], [Cy(0.06, 0.02, 2.2, 4), 0xffffff, [0.4, -1.1, 0]], [Cy(0.06, 0.02, 2.6, 4), 0xffffff, [-0.3, -1.3, 0.3]], [Cy(0.06, 0.02, 2, 4), 0xffffff, [0, -1, -0.4]]]));
      const jc = 18, jm = own(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.6)) })), jel = new THREE.InstancedMesh(jg, jm, jc), jl = [];
      for (let i = 0; i < jc; i++) { const s = S(Math.floor(rand() * N)), lat = (hw + 5 + rand() * 22) * (rand() > 0.5 ? 1 : -1); jl.push({ x: s.x + s.nx * lat, y: s.y + 5 + rand() * 6, z: s.z + s.nz * lat, ph: rand() * 6.28, sc: 0.8 + rand() * 0.9 }); jel.setColorAt(i, col.set([0xff7ae0, 0x7ff0ff, 0xc9a0ff][i % 3])); }
      jel.frustumCulled = false; group.add(jel);
      updaters.push((dt, t) => { for (let i = 0; i < jc; i++) { const j = jl[i], k = Math.sin(t * 1.5 + j.ph); o.position.set(j.x, j.y + Math.sin(t * 0.5 + j.ph) * 1.6, j.z); o.rotation.set(0, j.ph, 0); o.scale.set(j.sc * (1 + k * 0.12), j.sc * (1 - k * 0.15), j.sc * (1 + k * 0.12)); o.updateMatrix(); jel.setMatrixAt(i, o.matrix); } jel.instanceMatrix.needsUpdate = true; });
    } else if (id === 'desierto') {
      // pirámides doradas (la mayor con la punta encendida), la pirámide que cubre el túnel, el oasis y el cañón de roca roja
      const Q = Math.PI / 4, capG = (r, h) => own(merged([[Co(r * 0.15, h * 0.15, 4), 0xffffff, [0, h * 0.93, 0], null, [0, Q, 0]]]));
      const pyramid = (r, h, ox = 0, oz = 0) => {
        const p = [[Co(r, h, 4), 0xe8b860, [ox, h / 2, oz], null, [0, Q, 0]], [Bx(r * 1.5, 3, r * 1.5), 0xc89648, [ox, 0.6, oz]]];
        for (const f of [0.24, 0.5, 0.74]) p.push([Cy(r * (1 - f - 0.035) + 0.3, r * (1 - f) + 0.3, h * 0.035, 4), 0xc8823a, [ox, h * (f + 0.0175), oz], null, [0, Q, 0]]);
        return p;
      };
      const g1 = spot(0.7, 150, outSide(0.7)); g1.y -= 5;
      put(own(merged(pyramid(52, 62).concat(pyramid(34, 40, -76, 24), pyramid(24, 28, 64, 40)))), lambert(), g1, false);
      const caps = [[capG(52, 62), g1]];
      if (tunR) {
        // el túnel atraviesa una pirámide: las bocas asoman por dos de sus caras
        const a = S(tunR[0]), b = S(tunR[1]), m = S((tunR[0] + tunR[1]) >> 1), r = (Math.hypot(b.x - a.x, b.z - a.z) / 2 - 16) * 1.414;
        const tp = { x: (a.x + b.x + 2 * m.x) / 4, z: (a.z + b.z + 2 * m.z) / 4, y: Math.min(a.y, b.y) - 4, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
        put(own(merged(pyramid(r, r * 0.9))), lambert(), tp, false); caps.push([capG(r, r * 0.9), tp]);
      }
      for (const [g, sp] of caps) { const c = new THREE.Mesh(g, glowM(0xffd21f)); c.position.set(sp.x, sp.y, sp.z); c.rotation.y = sp.yaw; group.add(c); }
      const inst = (g, m, list, cast) => { // [x, y, z, escala, giro]
        const im = new THREE.InstancedMesh(g, m, list.length);
        list.forEach(([x, y, z, sc, ry], n) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(sc); o.updateMatrix(); im.setMatrixAt(n, o.matrix); });
        im.frustumCulled = false; im.castShadow = shadows && cast; group.add(im); if (outline) group.add(outlineInstanced(im)); return im;
      };
      if (boatR) {
        // oasis: islotes con palmeras, matorral y una tienda junto a la ruta del barco
        const il = [], pl = [];
        for (let k = 0; k < 5; k++) {
          const s = S(Math.round(boatR[0] + (boatR[1] - boatR[0]) * (k + 0.5) / 5)), lat = (hw + 22 + rand() * 14) * (k % 2 ? 1 : -1), x = s.x + s.nx * lat, z = s.z + s.nz * lat, yaw = rand() * 6.28, cy = Math.cos(yaw), sy = Math.sin(yaw);
          il.push([x, th.liquidLevel + 0.6, z, 1, yaw]);
          for (const [lx, lz] of [[-4.5, 3.5], [0.5, 5.5], [-1.5, -5.5]]) pl.push([x + lx * cy + lz * sy, th.liquidLevel + 1.5, z - lx * sy + lz * cy, 1.1 + rand() * 0.5, rand() * 6.28]);
        }
        inst(own(merged([[Ic(11), 0xf2c46a, [0, -3.5, 0], [1.4, 0.5, 1.2]], [Ic(5), 0xe0a850, [6, -1.6, 3], [1.3, 0.5, 1]], [Ic(3), 0x4cc468, [-6.5, 1.3, -1], [1.3, 0.5, 1.2]],
          [Cy(2.4, 2.4, 1.6, 6), 0xfff3d0, [4.5, 2.5, -2.5]], [Co(3, 2.8, 6), 0xe8502a, [4.5, 4.7, -2.5]]])), lambert(), il, true);
        inst(own(PROPS.palm.make()), lambert(), pl, true);
      }
      // paredes del cañón: torres de roca a los lados del vuelo y del puente
      const brI = []; samples.forEach((q, i) => { if (q.kb > 0.99) brI.push(i); });
      const ml = [], wall = (r, st) => { for (let i = r[0] - 4; i <= r[1] + 4; i += st) for (const side of [1, -1]) { const s = S(i), sc = 4.5 + rand() * 4, lat = (hw + 9 + 4 * sc + rand() * 12) * side, x = s.x + s.nx * lat, z = s.z + s.nz * lat; ml.push([x, Math.min(terrainAt(x, z), th.liquidLevel) - 2, z, sc, rand() * 6.28]); } };
      for (const r of ctx.glRs) wall(r, 6);
      if (brI.length) wall([brI[0], brI[brI.length - 1]], 9);
      if (ml.length) inst(own(PROPS.mesa.make()), lambert(), ml, false);
      // arcos de roca sobre la pista y obeliscos en la recta de meta
      const ap = [], R2 = hw + 7.5, rockM = lambert();
      for (let k = 0; k < 11; k++) { const a = Math.PI * (k + 0.5) / 11; ap.push([new THREE.DodecahedronGeometry(3.2 + rand() * 1.4, 0), [0xc8703a, 0xe08a4a, 0xd07a42][k % 3], [Math.cos(a) * R2, Math.sin(a) * R2 * 0.85 - 1, (rand() - 0.5) * 2]]); }
      const arch = own(merged(ap));
      for (const u of [0.062, 0.185, 0.375]) { const i = fIdx(u); if (!free(i)) continue; const s = S(i), m = addMesh(arch, rockM); m.position.set(s.x, s.y, s.z); m.rotation.y = s.h; if (outline) addOutline(m); }
      const ob = own(merged([[Cy(0.8, 1.2, 12, 4), 0xe8b860, [0, 6, 0], null, [0, Q, 0]], [Co(1.15, 2.2, 4), 0xffd21f, [0, 13.1, 0], null, [0, Q, 0]], [Bx(3, 1.2, 3), 0xc89648, [0, 0.6, 0]]]));
      for (const [i, side] of [[26, 1], [26, -1], [N - 50, 1], [N - 50, -1]]) { const s = S(i), lat = (hw + 9) * side, m = addMesh(ob, rockM); m.position.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat); m.rotation.y = s.h; if (outline) addOutline(m); }
    } else if (id === 'fabrica') {
      // nave de la fábrica sobre el túnel (chimeneas con humo de colores y engranajes), tren de juguete, grúa, robot de cuerda y puertas de bloques
      const cols = [0xff3b4a, 0xffd21f, 0x2b9dff, 0x35e08a, 0xff7a1a, 0x7a5cff], spin = []; // spin: [malla, velocidad de giro]
      if (tunR) {
        const a = S(tunR[0]), b = S(tunR[1]), m = S((tunR[0] + tunR[1]) >> 1), L2 = Math.hypot(b.x - a.x, b.z - a.z) / 2 - 13, W2 = 34, H = 26;
        const hall = new THREE.Group(); hall.position.set((a.x + b.x + 2 * m.x) / 4, Math.min(a.y, b.y) - 4, (a.z + b.z + 2 * m.z) / 4); hall.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        const p = [[Bx(W2 * 2, H, L2 * 2), 0xfff3d0, [0, H / 2, 0]], [Bx(W2 * 2 + 0.8, 3, L2 * 2 + 0.8), 0xff3b4a, [0, H * 0.34, 0]], [Bx(W2 * 2 + 0.8, 3, L2 * 2 + 0.8), 0x2b9dff, [0, H * 0.66, 0]]];
        const nT = 4, tr = L2 / nT * 1.12, chim = [[-W2 + 7, -L2 + 8], [W2 - 7, L2 - 8]];
        for (let k = 0; k < nT; k++) p.push([Cy(tr, tr, W2 * 2, 3), cols[k], [0, H + tr * 0.2, -L2 + (k + 0.5) * 2 * L2 / nT], null, [0, 0, Math.PI / 2]]); // tejado en dientes de sierra
        for (const [x, z] of chim) p.push([Cy(3, 3.6, 22, 10), 0xffffff, [x, H + 11, z]], [Cy(3.3, 3.45, 3, 10), 0xff3b4a, [x, H + 14, z]], [Cy(3.1, 3.2, 3, 10), 0xff3b4a, [x, H + 19.5, z]]);
        const hm = new THREE.Mesh(own(merged(p)), lambert()); hm.castShadow = shadows; hall.add(hm); if (outline) addOutline(hm);
        const gp = [[Cy(6, 6, 1.6, 18), 0xffffff, null, null, [Math.PI / 2, 0, 0]], [Cy(1.8, 1.8, 2.4, 10), 0x5a5a6a, null, null, [Math.PI / 2, 0, 0]]];
        for (let i = 0; i < 10; i++) { const an = i / 10 * 6.283; gp.push([Bx(2.2, 2.2, 1.6), 0xffffff, [Math.cos(an) * 6.6, Math.sin(an) * 6.6, 0], null, [0, 0, an]]); }
        const gearG = own(merged(gp));
        [[-19, 1, 1], [19, 1, -1], [-19, -1, -1], [19, -1, 1]].forEach(([x, f, dir], n) => {
          const g = new THREE.Mesh(gearG, own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: cols[n + 1] }))); g.position.set(x, H * 0.76, f * (L2 + 1)); hall.add(g); spin.push([g, dir * 0.5]);
        });
        group.add(hall); hall.updateMatrixWorld();
        const ch = chim.map(([x, z]) => hall.localToWorld(new THREE.Vector3(x, H + 23, z)));
        const puffs = new THREE.InstancedMesh(own(Ic(1, 1)), own(new THREE.MeshLambertMaterial({ flatShading: true })), 10);
        for (let i = 0; i < 10; i++) puffs.setColorAt(i, col.set(cols[i % 6]));
        puffs.frustumCulled = false; group.add(puffs);
        updaters.push((dt, t) => {
          for (let i = 0; i < 10; i++) { const c = ch[i % 2], k = (t * 0.07 + i / 10) % 1; o.position.set(c.x + Math.sin(k * 5 + i) * 3 + k * 14, c.y + k * 46, c.z + Math.cos(k * 4 + i) * 3); o.rotation.set(0, 0, 0); o.scale.setScalar((2 + k * 7) * Math.min(1, (1 - k) * 4)); o.updateMatrix(); puffs.setMatrixAt(i, o.matrix); }
          puffs.instanceMatrix.needsUpdate = true;
        });
      }
      // tren de juguete que da vueltas sobre una mesa redonda
      const tp = spot(0.64, 66, outSide(0.64)), TR = 30; tp.y += 3; tp.yaw = 0;
      const at = (a, r, y, d = 0) => [Math.cos(a) * r - Math.sin(a) * d, y, Math.sin(a) * r + Math.cos(a) * d]; // punto de la vía (d: avance a lo largo)
      const tb = [[Cy(TR + 8, TR + 11, 18, 24), 0x7a5cff, [0, -9.2, 0]], [Cy(TR + 8.3, TR + 8.3, 0.7, 24), 0xfff3d0, null],
        [new THREE.TorusGeometry(TR - 1.3, 0.22, 5, 48), 0x8a8a9a, [0, 0.95, 0], null, [Math.PI / 2, 0, 0]], [new THREE.TorusGeometry(TR + 1.3, 0.22, 5, 48), 0x8a8a9a, [0, 0.95, 0], null, [Math.PI / 2, 0, 0]],
        [Cy(9, 9, 8, 6), 0x35e08a, [0, 4.3, 0]], [Co(11.5, 7, 6), 0xff3b4a, [0, 11.8, 0]], [Bx(3, 5, 0.6), 0xffd21f, [0, 2.8, 7.9]]];
      for (let k = 0; k < 30; k++) { const a = k / 30 * 6.283; tb.push([Bx(4.4, 0.3, 0.9), 0xa8744a, at(a, TR, 0.55), null, [0, -a, 0]]); }
      put(own(merged(tb)), lambert(), tp);
      const cars = [], da = 7 / TR;
      for (let c = 0; c < 5; c++) {
        const a = -c * da;
        if (!c) cars.push([Bx(3, 3.2, 2.4), 0xff3b4a, at(a, TR, 3.2, -1.7), null, [0, -a, 0]], [Cy(1.3, 1.3, 3.8, 10), 0x35e08a, at(a, TR, 2.7, 1.2), null, [0, -a - Math.PI / 2, Math.PI / 2]],
          [Cy(0.45, 0.65, 1.8, 8), 0xffd21f, at(a, TR, 4.6, 2.2)], [Bx(3.4, 0.4, 2.8), 0xffd21f, at(a, TR, 5, -1.7), null, [0, -a, 0]], [Bx(3, 0.9, 6.2), 0x2a2238, at(a, TR, 1.55), null, [0, -a, 0]]);
        else cars.push([Bx(2.8, 1.9, 4.6), cols[c % 6], at(a, TR, 2.4), null, [0, -a, 0]], [Ic(1.1), cols[(c + 2) % 6], at(a, TR, 3.9, 0.8)], [Bx(1.4, 1.4, 1.4), cols[(c + 4) % 6], at(a, TR, 4, -1), null, [0, 0.5 - a, 0]]);
        for (const d of [-1.6, 1.6]) for (const sd of [-1.5, 1.5]) cars.push([Cy(0.75, 0.75, 0.4, 10), 0x2a2238, at(a, TR + sd, 1.6, d), null, [0, -a, Math.PI / 2]]);
      }
      const train = put(own(merged(cars)), lambert(), tp);
      // grúa que moja un cubo en el tanque de pintura
      const cp = spot(0.28, 28, outSide(0.28)), TH = 30;
      const cr = [[Bx(8, 3, 8), 0x5a5a6a, [0, 1.5, 0]], [Bx(3, TH, 3), 0xffd21f, [0, TH / 2 + 3, 0]], [Bx(4.6, 3.6, 4.6), 0xff3b4a, [0, TH + 4.5, 0]]];
      for (let k = 0; k < 6; k++) cr.push([Bx(3.3, 0.5, 3.3), 0x2a2238, [0, 5 + k * 5, 0]]);
      put(own(merged(cr)), lambert(), cp);
      const jib = new THREE.Group(); jib.position.set(cp.x, cp.y + TH + 7.4, cp.z);
      const jm = new THREE.Mesh(own(merged([[Bx(1.8, 1.8, 44), 0xffd21f, [0, 0, 12]], [Bx(4, 4, 5), 0x5a5a6a, [0, -0.6, -8]], [Bx(0.4, 5, 0.4), 0x2a2238, [0, 2.5, 0]]])), lambert());
      const hook = new THREE.Mesh(own(merged([[Cy(0.14, 0.14, 22, 5), 0x2a2238, [0, -11, 0]], [Bx(3, 0.8, 3), 0x5a5a6a, [0, -22.2, 0]], [Bx(5.4, 5.4, 5.4), 0x35e08a, [0, -25.3, 0]],
        [Cy(0.8, 0.8, 0.5, 8), 0x35e08a, [-1.3, -22.5, -1.3]], [Cy(0.8, 0.8, 0.5, 8), 0x35e08a, [1.3, -22.5, 1.3]]])), lambert());
      hook.position.z = 30; jm.castShadow = hook.castShadow = shadows; jib.add(jm, hook); group.add(jib);
      if (outline) { addOutline(jm); addOutline(hook); }
      // robot de cuerda gigante junto a la meta
      const rp = spot(0.945, 21, outSide(0.945));
      const rb = [[Bx(2.2, 4, 2.6), 0x2b6cff, [-1.7, 2, 0]], [Bx(2.2, 4, 2.6), 0x2b6cff, [1.7, 2, 0]], [Bx(2.8, 1, 3.6), 0x2a2238, [-1.7, 0.5, 0.4]], [Bx(2.8, 1, 3.6), 0x2a2238, [1.7, 0.5, 0.4]],
        [Bx(7, 6, 4.4), 0xff3b4a, [0, 7, 0]], [Bx(4.4, 2.6, 0.4), 0xffd21f, [0, 7.4, 2.3]], [Bx(5, 4.4, 4.2), 0xfff3d0, [0, 12.4, 0]], [Cy(0.2, 0.2, 2, 6), 0x8a8a9a, [0, 15.6, 0]], [Ic(0.6), 0xff7a1a, [0, 16.8, 0]],
        [Bx(3, 0.5, 0.3), 0x2a2238, [0, 11.2, 2.15]], [Cy(0.9, 0.9, 5, 8), 0x8a8a9a, [-4.6, 7.6, 0], null, [0, 0, 0.25]], [Cy(0.9, 0.9, 5, 8), 0x8a8a9a, [4.9, 10.4, 0], null, [0, 0, -2.5]], [Ic(1.2), 0xffd21f, [-5.3, 5, 0]], [Ic(1.2), 0xffd21f, [6.5, 12.6, 0]]];
      for (let k = 0; k < 3; k++) rb.push([Cy(0.4, 0.4, 0.3, 8), cols[k + 2], [-1.2 + k * 1.2, 7.4, 2.55], null, [Math.PI / 2, 0, 0]]);
      put(own(merged(rb)), lambert(), rp);
      const eyes = new THREE.Mesh(own(merged([[Ic(0.75), 0xffffff, [-1.2, 12.9, 2.2]], [Ic(0.75), 0xffffff, [1.2, 12.9, 2.2]]])), glowM(0x22e6ff)); eyes.position.set(rp.x, rp.y, rp.z); eyes.rotation.y = rp.yaw; group.add(eyes);
      const key = new THREE.Mesh(own(merged([[Cy(0.3, 0.3, 2.4, 6), 0x8a8a9a, [0, 0, -1.2], null, [Math.PI / 2, 0, 0]], [new THREE.TorusGeometry(1.1, 0.3, 6, 12), 0xffd21f, [-1.1, 0, -2.6]], [new THREE.TorusGeometry(1.1, 0.3, 6, 12), 0xffd21f, [1.1, 0, -2.6]]])), lambert());
      key.position.set(rp.x - Math.sin(rp.yaw) * 2.2, rp.y + 7.5, rp.z - Math.cos(rp.yaw) * 2.2); key.rotation.order = 'YXZ'; key.rotation.y = rp.yaw; group.add(key); spin.push([key, 2]);
      updaters.push((dt, t) => {
        train.rotation.y = -t * 0.3; jib.rotation.y = cp.yaw + Math.sin(t * 0.22); hook.position.y = Math.sin(t * 0.7) * 5 - 6;
        for (const [m, v] of spin) m.rotation.z = t * v;
      });
      // puertas de bloques de construcción sobre la pista
      const gx = hw + 4.4, gt = [[Bx(gx * 2 + 5.4, 2.4, 3.2), 0xfff3d0, [0, 12, 0]], [Cy(3.6, 3.6, 3, 3), 0xff3b4a, [0, 15, 0], null, [-Math.PI / 2, 0, 0]],
        [Cy(1.7, 1.7, 3.2, 12), 0x2b9dff, [-gx * 0.55, 14.9, 0], null, [Math.PI / 2, 0, 0]], [Cy(1.7, 1.7, 3.2, 12), 0x35e08a, [gx * 0.55, 14.9, 0], null, [Math.PI / 2, 0, 0]]];
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) gt.push([Bx(3.6, 3.6, 3.6), cols[(k + (sx > 0 ? 3 : 0)) % 6], [sx * gx, 1.8 + k * 3.6, 0], null, [0, (k - 1) * 0.2 * sx, 0]]);
      const gate = own(merged(gt)), gateM = lambert();
      for (const u of [0.03, 0.203, 0.89]) { const i = fIdx(u); if (!free(i)) continue; const s = S(i), m = addMesh(gate, gateM); m.position.set(s.x, s.y, s.z); m.rotation.y = s.h; if (outline) addOutline(m); }
    } else if (id === 'estacion') {
      // planeta con anillos y luna en el cielo, estrellas y nebulosas; torre con anillo giratorio, cohete, satélites, aros sobre la pista y balizas en los paseos espaciales
      const sunD = new THREE.Vector3(0.7, 0.62, 0.5).normalize(), v = new THREE.Vector3(), s0 = S(0);
      const bake = (g, light, paint) => { // color por vértice con la luz del sol ya aplicada (estas mallas no usan luces ni niebla)
        const P = g.attributes.position, c = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).normalize(); const k = Math.max(0.2, Math.min(1, v.dot(light) * 0.95 + 0.6)); paint(v, col); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
      };
      const far = c => own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, ...c }));
      const sky = new THREE.Group(), az = s0.h + 0.45, el = 0.25;
      // el planeta se aplasta en la dirección de la vista para que quepa antes del plano lejano sin cambiar cómo se ve
      const pg = new THREE.Group(); pg.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(1950); pg.lookAt(0, 0, 0); pg.scale.set(1, 1, 0.3);
      const tilt = new THREE.Group(); tilt.rotation.z = -0.32; pg.add(tilt);
      const bands = [0x2ac8b8, 0x2a6ad8, 0x8a4ae0, 0xff7ac8, 0xffe8c0, 0x8a4ae0, 0x2a6ad8, 0x2ac8b8, 0xff9ad8];
      const lightL = sunD.clone().applyQuaternion(pg.quaternion.clone().multiply(tilt.quaternion).invert());
      const planet = new THREE.Mesh(bake(own(new THREE.SphereGeometry(300, 36, 22)), lightL, (p, c) => {
        const f = (p.y * 0.5 + 0.5) * 8.99 + Math.sin(Math.atan2(p.z, p.x) * 3 + p.y * 5) * 0.3, i = Math.max(0, Math.min(8, Math.floor(f)));
        c.set(bands[i]).lerp(col2.set(bands[Math.min(8, i + 1)]), Math.max(0, f - i - 0.6) * 2.5);
      }), far());
      const rg = [];
      for (const [r0, r1, c] of [[390, 470, 0xffe8c0], [486, 540, 0xff9ad8], [552, 572, 0x2ac8b8]]) rg.push([new THREE.RingGeometry(r0, r1, 56, 1), c, null]);
      const ring = new THREE.Mesh(own(merged(rg)), far({ side: THREE.DoubleSide })); ring.rotation.x = 1.27;
      tilt.add(planet, ring); sky.add(pg);
      const moon = new THREE.Mesh(bake(own(new THREE.IcosahedronGeometry(70, 3)), sunD, (p, c) => { const n = Math.sin(p.x * 7 + 1) * Math.sin(p.y * 9) * Math.sin(p.z * 8 + 2); c.set(n > 0.35 ? 0x8a8fb8 : 0xc8cce8); }), far());
      moon.position.set(Math.sin(az + 2.5) * Math.cos(0.4), Math.sin(0.4), Math.cos(az + 2.5) * Math.cos(0.4)).multiplyScalar(1900); sky.add(moon);
      const sp = [], sc = [], tints = [[1, 1, 1], [0.7, 0.85, 1], [1, 0.92, 0.7], [1, 0.7, 0.9]], gk = B(1.5);
      for (let i = 0; i < 1100; i++) {
        const a = rand() * 6.283, e = Math.asin(rand() * 1.02 - 0.04), tc = tints[Math.floor(rand() * 4)], k = (0.35 + rand() * 0.65) * gk;
        sp.push(Math.cos(a) * Math.cos(e) * 2300, Math.sin(e) * 2300, Math.sin(a) * Math.cos(e) * 2300); sc.push(tc[0] * k, tc[1] * k, tc[2] * k);
      }
      const sg = own(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
      const stars = new THREE.Points(sg, own(new THREE.PointsMaterial({ vertexColors: true, size: 3, sizeAttenuation: false, fog: false, map: glowTex(), transparent: true, depthWrite: false })));
      sky.add(stars);
      [[az - 1.3, 0.5, 0x7a3ae0, 1500], [az + 1.2, 0.3, 0x2ab8c8, 1200], [az + 3.4, 0.6, 0xe04a9a, 1300]].forEach(([a, e, c, size]) => {
        const nb = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex(), color: c, opacity: 0.28, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })));
        nb.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(2250); nb.scale.set(size, size * 0.7, 1); sky.add(nb);
      });
      sky.traverse(q => { q.frustumCulled = false; }); group.add(sky);
      // torre de la estación con anillo habitable giratorio y paneles solares
      const cp = spot(0.035, 66, outSide(0.035));
      const core = [[Cy(9, 11, 6, 12), 0x5a6088, [0, 3, 0]], [Cy(6, 7, 40, 12), 0xe8ecf8, [0, 26, 0]], [Cy(7.2, 7.4, 2.4, 12), 0xff7a1a, [0, 14, 0]], [Cy(6.5, 6.6, 2.4, 12), 0xff7a1a, [0, 40, 0]],
        [new THREE.SphereGeometry(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xf6f8ff, [0, 46, 0]], [Cy(0.3, 0.5, 12, 6), 0x8a90b0, [0, 57, 0]], [Bx(64, 0.8, 0.8), 0xc8cce0, [0, 21, 0]],
        [Bx(22, 0.5, 9), 0x2a4ad8, [-24, 21, 0], null, [0.4, 0, 0]], [Bx(22, 0.5, 9), 0x2a4ad8, [24, 21, 0], null, [0.4, 0, 0]], [Cy(2.4, 0.5, 1.2, 10), 0xeef2ff, [0, 50.5, 4.5], null, [0.9, 0, 0]]];
      put(own(merged(core)), lambert(), cp);
      const hp = [[new THREE.TorusGeometry(24, 2.6, 8, 28), 0xe8ecf8, null, null, [Math.PI / 2, 0, 0]]], hw2 = [];
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; hp.push([Bx(18, 1.2, 1.2), 0xc8cce0, [Math.cos(a) * 15, 0, Math.sin(a) * 15], null, [0, -a, 0]], [Bx(5.6, 3.6, 5.6), 0xff7a1a, [Math.cos(a) * 24, 0, Math.sin(a) * 24], null, [0, -a, 0]]); }
      for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * 6.283; hw2.push([Bx(0.4, 0.9, 1.8), 0xffffff, [Math.cos(a) * 26.7, 0, Math.sin(a) * 26.7], null, [0, -a, 0]]); }
      const hab = new THREE.Mesh(own(merged(hp)), lambert()); hab.position.set(cp.x, cp.y + 33, cp.z); hab.castShadow = shadows; group.add(hab); if (outline) addOutline(hab);
      const win = new THREE.Mesh(own(merged(hw2)), glowM(0x7ff0ff)); win.position.copy(hab.position); group.add(win);
      const beacon = new THREE.Mesh(own(Ic(1, 1)), glowM(0xff3b4a)); beacon.position.set(cp.x, cp.y + 63.6, cp.z); group.add(beacon);
      // cohete en su plataforma de lanzamiento
      const kp = spot(0.94, 46, outSide(0.94)), rk = [[Cy(11, 12, 2, 12), 0x5a6088, [0, 1, 0]], [Cy(3.6, 3.6, 20, 12), 0xf6f8ff, [0, 15, 0]], [Co(3.6, 8, 12), 0xff3b4a, [0, 29, 0]], [Cy(3.72, 3.72, 2, 12), 0xff7a1a, [0, 9, 0]],
        [Cy(2.4, 3.4, 3, 12), 0x5a6088, [0, 3.6, 0]], [Bx(2, 27, 2), 0xff7a1a, [-8, 15.5, 0]], [Bx(5, 0.8, 1.2), 0xc8cce0, [-5.4, 21, 0]], [Bx(5, 0.8, 1.2), 0xc8cce0, [-5.4, 12, 0]]];
      for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.52; rk.push([Bx(0.5, 7, 4.6), 0xff3b4a, [Math.cos(a) * 4.7, 6.5, Math.sin(a) * 4.7], null, [0, Math.PI / 2 - a, 0]]); }
      put(own(merged(rk)), lambert(), kp);
      const port = new THREE.Mesh(own(merged([[Cy(1.2, 1.2, 0.4, 12), 0xffffff, [0, 20, 3.5], null, [Math.PI / 2, 0, 0]], [Cy(0.9, 0.9, 0.4, 12), 0xffffff, [0, 15.5, 3.5], null, [Math.PI / 2, 0, 0]]])), glowM(0x7ff0ff));
      port.position.set(kp.x, kp.y, kp.z); port.rotation.y = kp.yaw; group.add(port);
      // aros de la estación sobre la pista
      const gR = hw + 5.5, gt = [[Bx(3.4, 2.4, 4.4), 0x5a6088, [-gR, 1.2, 0]], [Bx(3.4, 2.4, 4.4), 0x5a6088, [gR, 1.2, 0]]], gl = [], arc = Math.PI + 0.5;
      for (let k = 0; k < 16; k++) {
        const a = -0.25 + arc * (k + 0.5) / 16; gt.push([Cy(1, 1, arc * gR / 16 * 1.08, 8), k % 2 ? 0xff7a1a : 0xe8ecf8, [Math.cos(a) * gR, Math.sin(a) * gR + 1.5, 0], null, [0, 0, a]]);
        if (k % 2 === 0) gl.push([Ic(0.5, 0), 0xffffff, [Math.cos(a) * (gR - 1.25), Math.sin(a) * (gR - 1.25) + 1.5, 0]]);
      }
      const gate = own(merged(gt)), gateL = own(merged(gl)), gateM = lambert(), gateLM = glowM(0x7ff0ff);
      for (const u of [0.06, 0.383, 0.955]) {
        const i = fIdx(u); if (!free(i)) continue;
        const s = S(i), m = addMesh(gate, gateM), l = new THREE.Mesh(gateL, gateLM); m.position.set(s.x, s.y, s.z); m.rotation.y = s.h; m.add(l); if (outline) addOutline(m);
      }
      // satélites que cruzan despacio por encima
      const sat = own(merged([[Cy(1.6, 1.6, 4, 8), 0xe8ecf8, null, null, [0, 0, Math.PI / 2]], [Bx(0.3, 0.3, 14), 0x8a90b0, null], [Bx(3.4, 0.2, 5), 0x2a4ad8, [0, 0, 5.2]], [Bx(3.4, 0.2, 5), 0x2a4ad8, [0, 0, -5.2]],
        [Cy(1.8, 0.4, 0.9, 10), 0xeef2ff, [2.8, 0, 0], null, [0, 0, -Math.PI / 2]], [Ic(0.4, 0), 0xff7a1a, [-2.3, 0, 0]]])), satM = lambert(), sl = [];
      for (let i = 0; i < 3; i++) { const s = S(Math.floor((i + 0.3) / 3 * N)), mesh = addMesh(sat, satM, false); mesh.scale.setScalar(2.2); sl.push({ mesh, cx: s.x, cz: s.z, y: s.y + 55 + i * 18, r: 60 + i * 30, ph: i * 2.1 }); if (outline) addOutline(mesh); }
      // paseos espaciales: balizas de luz a los lados del pasillo y rocas flotando alrededor
      const bl = [], rocks = [];
      for (const r of ctx.glRs) {
        for (let i = r[0]; i <= r[1]; i += 3) { const s = S(i); for (const side of [1, -1]) bl.push([s.x + s.nx * (hw + 4) * side, s.y + s.air - 0.6, s.z + s.nz * (hw + 4) * side, (i / 3 | 0) % 2]); }
        for (let i = r[0] + 3; i < r[1]; i += 4) { const s = S(i), lat = (hw + 13 + rand() * 30) * (rand() > 0.5 ? 1 : -1); rocks.push([s.x + s.nx * lat, s.y + s.air - 12 + rand() * 18, s.z + s.nz * lat, 1.5 + rand() * 3.5]); }
      }
      if (bl.length) {
        const im = new THREE.InstancedMesh(own(Ic(0.42, 1)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(B(2.2)) })), bl.length);
        bl.forEach(([x, y, z, k], n) => { o.position.set(x, y, z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(n, o.matrix); im.setColorAt(n, col.set(k ? 0xff9a3a : 0x7ff0ff)); });
        im.frustumCulled = false; group.add(im);
        const rm = new THREE.InstancedMesh(own(new THREE.DodecahedronGeometry(1, 0)), own(new THREE.MeshLambertMaterial({ color: 0x9a9fc4, flatShading: true })), rocks.length);
        rocks.forEach(([x, y, z, sc], n) => { o.position.set(x, y, z); o.rotation.set(rand() * 6, rand() * 6, 0); o.scale.set(sc, sc * (0.6 + rand() * 0.5), sc); o.updateMatrix(); rm.setMatrixAt(n, o.matrix); const b = 0.6 + rand() * 0.5; rm.setColorAt(n, col.setRGB(b, b, b)); });
        rm.frustumCulled = false; group.add(rm); if (outline) group.add(outlineInstanced(rm));
      }
      updaters.push((dt, t, cam) => {
        sky.position.set(cam.x, 0, cam.z); hab.rotation.y = win.rotation.y = t * 0.15; beacon.scale.setScalar(Math.sin(t * 4) > 0.3 ? 1.5 : 0.5);
        for (const b of sl) { const a = t * 0.05 + b.ph; b.mesh.position.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.4 + b.ph) * 2, b.cz + Math.sin(a) * b.r); b.mesh.rotation.set(t * 0.1 + b.ph, a, 0.3); }
      });
    } else if (id === 'arena2' || id === 'arena3') {
      // arenas de batalla: un gran monumento en el centro del anillo y dos arcos sobre la pista
      const ice = id === 'arena2', ctr = { x: 0, y: terrainAt(0, 0) - 1.5, z: 0, yaw: 0 };
      if (ice) {
        // corona de agujas de hielo con el corazón encendido y aurora en el cielo
        const sp = [[Cy(34, 40, 5, 12), 0xeef6ff, null]], cs = [0x9fe6ff, 0xd6f6ff, 0x7fc8ff], tips = [];
        for (let k = 0; k < 10; k++) {
          const a = k / 9 * 6.283, r = k ? 15 + rand() * 12 : 0, h = k ? 14 + rand() * 14 : 42, x = Math.cos(a) * r, z = Math.sin(a) * r;
          sp.push([new THREE.OctahedronGeometry(1, 0), cs[k % 3], [x, h * 0.3 + 2, z], [h * 0.2, h * 0.7, h * 0.2], [k ? (rand() - 0.5) * 0.3 : 0, rand() * 3, k ? (rand() - 0.5) * 0.3 : 0]]);
          if (k % 3 === 0) tips.push([new THREE.OctahedronGeometry(1, 0), 0xffffff, [x, h * 0.3 + 2, z], [h * 0.07, h * 0.5, h * 0.07]]);
        }
        put(own(merged(sp)), lambert(), ctr);
        const core = new THREE.Mesh(own(merged(tips)), glowM(0x9fe6ff)); core.position.set(0, ctr.y, 0); group.add(core);
        const at = own(canvasTex(64, 64, (c) => { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(0.45, 'rgba(120,255,200,.9)'); g.addColorStop(0.75, 'rgba(200,120,255,.6)'); g.addColorStop(1, 'rgba(200,120,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }));
        const ribbons = [];
        for (let i = 0; i < 2; i++) {
          const g = own(new THREE.PlaneGeometry(800, 130, 26, 1)), P = g.attributes.position;
          for (let k = 0; k < P.count; k++) P.setZ(k, Math.sin(P.getX(k) * 0.013 + i * 2) * 80);
          const m = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ map: at, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })));
          m.position.set(-120 + i * 260, 250 + i * 50, -380 + i * 700); m.rotation.y = 0.4 + i * 1.3; group.add(m); ribbons.push(m);
        }
        updaters.push((dt, t) => { ribbons.forEach((r, i) => { r.material.opacity = 0.35 + Math.sin(t * 0.5 + i * 2) * 0.2; }); core.scale.y = 1 + Math.sin(t * 1.5) * 0.06; });
      } else {
        // cráter encendido con ríos de lava y humo
        const p = [[Cy(13, 50, 38, 12), 0x4a2a38, [0, 19, 0]], [Cy(15.5, 17, 4, 12), 0x3a1f2c, [0, 38, 0]]];
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; p.push([new THREE.DodecahedronGeometry(7 + rand() * 5, 0), 0x3a2230, [Math.cos(a) * 46, 3, Math.sin(a) * 46]]); }
        put(own(merged(p)), lambert(), ctr, false);
        const lg = [[Cy(12.5, 12.5, 1.5, 12), 0xff6a00, [0, 39.8, 0]]];
        for (let i = 0; i < 5; i++) lg.push([new THREE.CylinderGeometry(13.5, 50.6, 38, 3, 1, true, i * 1.26 + 0.4, 0.1 + rand() * 0.1), i % 2 ? 0xff5a00 : 0xffa21f, [0, 19, 0]]);
        const lava = new THREE.Mesh(own(merged(lg)), own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(1, 1, 1).multiplyScalar(B(1.7)) })));
        lava.position.set(0, ctr.y, 0); group.add(lava);
        const puffs = new THREE.InstancedMesh(own(Ic(1, 1)), own(new THREE.MeshLambertMaterial({ color: 0x4a3a44, flatShading: true })), 7);
        puffs.frustumCulled = false; group.add(puffs);
        updaters.push((dt, t) => {
          for (let i = 0; i < 7; i++) { const k = (t * 0.05 + i / 7) % 1; o.position.set(Math.sin(k * 5 + i * 1.3) * 6 + k * 22, ctr.y + 42 + k * 80, Math.cos(k * 4 + i) * 6); o.rotation.set(0, 0, 0); o.scale.setScalar(6 + k * 20); o.updateMatrix(); puffs.setMatrixAt(i, o.matrix); }
          puffs.instanceMatrix.needsUpdate = true;
        });
      }
      const ap = [], gp = [], R2 = hw + 7, cs2 = ice ? [0xbfe6ff, 0x9fd6ff, 0xe6f6ff] : [0x3a2630, 0x4a3440, 0x2a1a24];
      for (let k = 0; k < 13; k++) {
        const a = Math.PI * (k + 0.5) / 13, x = Math.cos(a) * R2, y = Math.sin(a) * R2 * 0.8 - 1;
        ap.push([ice ? new THREE.OctahedronGeometry(3.6 + rand() * 1.2, 0) : new THREE.DodecahedronGeometry(3.3 + rand() * 1.3, 0), cs2[k % 3], [x, y, (rand() - 0.5) * 2], ice ? [1, 1.25, 1] : null, [0, rand() * 3, 0]]);
        if (k % 3 === 1) gp.push([new THREE.OctahedronGeometry(0.9, 0), 0xffffff, [x * 0.84, y * 0.84 - 0.4, 0], [0.7, 1.9, 0.7], [0, 0, a - Math.PI / 2]]);
      }
      const arch = own(merged(ap)), archG = own(merged(gp)), archM = lambert(), archGM = glowM(ice ? 0x9fe6ff : 0xff7a1a);
      for (const u of ice ? [0.42, 0.8] : [0.12, 0.6]) {
        const i = fIdx(u); if (!free(i)) continue;
        const s = S(i), m = addMesh(arch, archM); m.position.set(s.x, s.y, s.z); m.rotation.y = s.h; m.add(new THREE.Mesh(archG, archGM)); if (outline) addOutline(m);
      }
    }
  }

  return { update(dt, t, cam) { for (const u of updaters) u(dt, t, cam); } };
}
