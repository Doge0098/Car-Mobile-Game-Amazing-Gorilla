// Decoración del circuito: túnel, gradas con público, banderas, globos, vallas, arcos, farolas y fauna.
import * as THREE from './vendor/three.module.min.js';
import { merged, canvasTex } from './models.js';

const VIVID = [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xff7a1a, 0x7a5cff, 0xff3b4a];
const ADS = [
  ['BANANA', 'COLA', '#ffd21f', '#ff7a1a', '#c0182c'],
  ['COCO', 'FUEL', '#22e6ff', '#1a6aff', '#ffffff'],
  ['GORILA', 'GYM', '#7a5cff', '#c04dff', '#ffe600'],
  ['TURBO', 'PLÁTANO', '#35e08a', '#0f9a5a', '#fff36a'],
  ['SELVA', 'TIRES', '#ff4fd8', '#b01a8a', '#ffffff'],
];

export function buildScenery(ctx) {
  const { th, ex, samples, N, hw, rand, own, group, B, quality, shadows, uTime, special, nearRamp, tunR, fIdx } = ctx;
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
    for (let i = 8, k = 0; i < N - 6; i += 16, k++) { const s = samples[i]; if (!s.tun && !nearRamp(i)) list.push([s, k % 2 ? 1 : -1]); }
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

  return { update(dt, t, cam) { for (const u of updaters) u(dt, t, cam); } };
}
