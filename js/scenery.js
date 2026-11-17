// Decoración del circuito: túnel, gradas con público, banderas, globos, vallas, arcos, farolas y fauna.
import * as THREE from './vendor/three.module.min.js';
import { merged, canvasTex } from './models.js';
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
  const { th, ex, samples, N, hw, rand, own, group, B, quality, shadows, uTime, special, nearRamp, tunR, fIdx, boatR, glR, subR, outline, terrainAt } = ctx;
  const updaters = [];
  const S = i => samples[((i % N) + N) % N];
  const free = i => !special(S(i)) && !nearRamp(((i % N) + N) % N);
  const o = new THREE.Object3D(), col = new THREE.Color();
  const lambert = (extra = {}) => own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra }));
  const addMesh = (g, m, cast = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadows && cast; group.add(mesh); return mesh; };

  // ---------- Túnel ----------
  if (tunR) {
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
  if (ex.life === 'birds') {
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.6, 0, 0, -0.5, -1.7, 0.7, 0, 0, 0, 0.6, 0, 0, -0.5, 1.7, 0.7, 0], 3));
    const m = own(new THREE.MeshBasicMaterial({ color: ex.hazard === 'crab' ? 0xffffff : 0x2a2a3a, side: THREE.DoubleSide }));
    const count = 12, im = new THREE.InstancedMesh(g, m, count), birds = [];
    for (let i = 0; i < count; i++) { const s = samples[Math.floor(rand() * N)]; birds.push({ cx: s.x, cz: s.z, y: s.y + 32 + rand() * 40, r: 25 + rand() * 45, sp: (0.25 + rand() * 0.3) * (rand() > 0.5 ? 1 : -1), ph: rand() * 6.28 }); }
    im.frustumCulled = false; group.add(im);
    updaters.push((dt, t) => {
      for (let i = 0; i < count; i++) {
        const b = birds[i], a = t * b.sp + b.ph;
        o.position.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.7 + b.ph) * 3, b.cz + Math.sin(a) * b.r);
        o.rotation.set(0, -a + (b.sp > 0 ? 0 : Math.PI), 0); o.scale.set(1.3, Math.sin(t * 9 + b.ph) * 0.9 + 0.2, 1.3); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
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
  if (boatR) {
    const g = own(merged([[new THREE.IcosahedronGeometry(0.75, 1), 0xffffff, [0, 0.25, 0]], [new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), 0xf0f0f0, [0, 1.3, 0]], [new THREE.IcosahedronGeometry(0.17, 0), 0xfff2a0, [0, 2.1, 0]]]));
    const m = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += sin(uTime * 2.2 + instanceMatrix[3].x * 0.4 + instanceMatrix[3].z * 0.3) * 0.14;');
    };
    const list = []; for (let i = boatR[0] - 4; i <= boatR[1] + 4; i += 3) for (const side of [1, -1]) list.push([S(i), side]);
    const im = new THREE.InstancedMesh(g, m, list.length);
    list.forEach(([s, side], n) => {
      const lat = (hw + 2.4) * side; o.position.set(s.x + s.nx * lat, th.liquidLevel, s.z + s.nz * lat); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix();
      im.setMatrixAt(n, o.matrix); im.setColorAt(n, col.set((n >> 1) % 2 ? 0xff3b4a : 0xffd21f));
    });
    im.frustumCulled = false; group.add(im);
  }

  // ---------- Tramo submarino: corales, algas, peces y rayos de luz ----------
  if (subR) {
    const mid = Math.round((subR[0] + subR[1]) / 2), len = subR[1] - subR[0];
    const coralG = own(merged([
      [new THREE.CylinderGeometry(0.14, 0.24, 2.0, 6), 0xffffff, [0, 1.0, 0]], [new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6), 0xffffff, [0.5, 1.4, 0], null, [0, 0, -0.7]],
      [new THREE.CylinderGeometry(0.1, 0.16, 1.2, 6), 0xffffff, [-0.45, 1.2, 0.2], null, [0.3, 0, 0.8]], [new THREE.IcosahedronGeometry(0.9, 1), 0xfff0e0, [0.9, 0.4, -0.6], [1.2, 0.7, 1]],
      [new THREE.IcosahedronGeometry(0.28, 0), 0xffffff, [0, 2.1, 0]], [new THREE.IcosahedronGeometry(0.22, 0), 0xffffff, [0.95, 1.95, 0]],
    ]));
    const weedG = own(merged([[new THREE.ConeGeometry(0.16, 4.2, 5), 0x2ab56a, [0, 2.1, 0]], [new THREE.ConeGeometry(0.14, 3.2, 5), 0x35d47a, [0.5, 1.6, 0.2], null, [0, 0, -0.18]], [new THREE.ConeGeometry(0.14, 3.6, 5), 0x1f9a5a, [-0.4, 1.8, -0.3], null, [0.15, 0, 0.2]]]));
    const weedM = lambert();
    weedM.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uTime * 1.6 + instanceMatrix[3].x * 0.5 + position.y * 0.7) * 0.12 * position.y;');
    };
    const count = quality > 0.7 ? 70 : 36;
    const coral = new THREE.InstancedMesh(coralG, lambert(), count), weed = new THREE.InstancedMesh(weedG, weedM, count);
    for (let n = 0; n < count * 2; n++) {
      const s = S(subR[0] + Math.floor(rand() * len)), lat = (hw + 3.5 + Math.pow(rand(), 1.6) * 34) * (rand() > 0.5 ? 1 : -1);
      const x = s.x + s.nx * lat, z = s.z + s.nz * lat, y = Math.abs(lat) < s.lim + 2.6 ? s.y : terrainAt(x, z);
      o.position.set(x, y - 0.1, z); o.rotation.set(0, rand() * 6.28, 0); o.scale.setScalar(0.8 + rand() * 1.3); o.updateMatrix();
      if (n < count) { coral.setMatrixAt(n, o.matrix); coral.setColorAt(n, col.set(VIVID[Math.floor(rand() * VIVID.length)])); } else weed.setMatrixAt(n - count, o.matrix);
    }
    coral.frustumCulled = weed.frustumCulled = false; group.add(coral, weed);
    if (outline) group.add(outlineInstanced(coral));
    // peces en bancos que nadan en círculos
    const fishG = own(merged([[new THREE.IcosahedronGeometry(0.5, 1), 0xffffff, null, [0.45, 0.75, 1.3]], [new THREE.ConeGeometry(0.4, 0.6, 4), 0xffffff, [0, 0, -0.85], [0.2, 1, 1], [-Math.PI / 2, 0, 0]], [new THREE.IcosahedronGeometry(0.08, 0), 0x16161c, [0.2, 0.12, 0.5]], [new THREE.IcosahedronGeometry(0.08, 0), 0x16161c, [-0.2, 0.12, 0.5]]]));
    const fc = quality > 0.7 ? 32 : 16, fish = new THREE.InstancedMesh(fishG, lambert(), fc), fl = [];
    for (let i = 0; i < fc; i++) {
      const s = S(subR[0] + Math.floor(rand() * len)), lat = (rand() - 0.5) * 40;
      fl.push({ cx: s.x + s.nx * lat, cz: s.z + s.nz * lat, y: s.y + 2.5 + rand() * 5, r: 3 + rand() * 7, sp: (0.4 + rand() * 0.5) * (rand() > 0.5 ? 1 : -1), ph: rand() * 6.28, sc: 0.6 + rand() * 0.8 });
      fish.setColorAt(i, col.set([0xff7a1a, 0xffd21f, 0x22e6ff, 0xff4fd8][i % 4]));
    }
    fish.frustumCulled = false; group.add(fish);
    const c0 = S(mid);
    updaters.push((dt, t, cam) => {
      if ((c0.x - cam.x) ** 2 + (c0.z - cam.z) ** 2 > 260 * 260) return;
      for (let i = 0; i < fc; i++) {
        const f = fl[i], a = t * f.sp + f.ph;
        o.position.set(f.cx + Math.cos(a) * f.r, f.y + Math.sin(t * 1.3 + f.ph) * 0.5, f.cz + Math.sin(a) * f.r);
        o.rotation.set(0, -a + (f.sp > 0 ? 0 : Math.PI), 0); o.scale.setScalar(f.sc); o.updateMatrix(); fish.setMatrixAt(i, o.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
    });
    const rayG = own(new THREE.ConeGeometry(3, 46, 16, 1, true)); rayG.translate(0, -23, 0);
    const rayM = own(new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    for (let i = 0; i < 9; i++) { const s = S(subR[0] + Math.floor((i + 0.5) / 9 * len)), lat = (i % 2 ? 1 : -1) * (4 + rand() * 12); const r = new THREE.Mesh(rayG, rayM); r.position.set(s.x + s.nx * lat, th.liquidLevel + 22, s.z + s.nz * lat); r.rotation.z = 0.22; group.add(r); }
  }

  // ---------- Globos aerostáticos ----------
  if (!th.neon && ex.weather !== 'ash') {
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
    }
  }

  return { update(dt, t, cam) { for (const u of updaters) u(dt, t, cam); } };
}
