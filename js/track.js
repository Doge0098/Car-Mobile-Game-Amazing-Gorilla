// Generación del circuito y su decorado a partir de la definición del mapa.
import * as THREE from './vendor/three.module.min.js';
import { rng } from './data.js';
import { PROPS, canvasTex, glowTex, merged } from './models.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildTrack(def, quality = 1) {
  const th = def.theme, rand = rng(def.seed);
  const group = new THREE.Group();
  const disposables = [];
  const own = o => { disposables.push(o); return o; };

  // ---- Línea central ----
  const ctrl = [];
  const M = 140;
  for (let i = 0; i < M; i++) {
    const a = i / M * Math.PI * 2;
    let r = 1;
    for (const [k, amp, ph] of def.waves) r += amp * Math.sin(k * a + ph);
    ctrl.push(new THREE.Vector3(Math.cos(a) * def.R * r, 0, Math.sin(a) * def.R * r));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const length = curve.getLength();
  const N = Math.round(length / 3);
  const pts = curve.getSpacedPoints(N); pts.pop();
  const hw = def.width / 2;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    samples.push({ x: pts[i].x, z: pts[i].z, tx, tz, nx: tz, nz: -tx, h: Math.atan2(tx, tz), curv: 0 });
  }
  const spacing = length / N;
  let maxCurv = 0;
  for (let i = 0; i < N; i++) {
    const a = samples[(i + N - 2) % N], b = samples[(i + 2) % N];
    let d = b.h - a.h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    samples[i].curv = d / (4 * spacing); // >0 gira a la izquierda
    maxCurv = Math.max(maxCurv, Math.abs(samples[i].curv));
  }

  const distToTrack = (x, z, stride = 3) => {
    let best = 1e12;
    for (let i = 0; i < N; i += stride) { const s = samples[i], dx = x - s.x, dz = z - s.z, d = dx * dx + dz * dz; if (d < best) best = d; }
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
  {
    const pos = [], uv = [], col = [], idx = [];
    const vRep = Math.round(length / 22), c = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const s = samples[i % N];
      pos.push(s.x + s.nx * hw, 0, s.z + s.nz * hw, s.x - s.nx * hw, 0, s.z - s.nz * hw);
      const v = i / N * vRep; uv.push(0, v, 1, v);
      if (th.rainbow) c.setHSL((i / N * 5) % 1, 0.95, 0.66); else c.setRGB(1, 1, 1);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mat = own(th.neon || th.rainbow
      ? new THREE.MeshBasicMaterial({ map: roadTex, vertexColors: true })
      : new THREE.MeshLambertMaterial({ map: roadTex, vertexColors: true }));
    group.add(new THREE.Mesh(g, mat));
  }
  // ---- Pianos (bordillos) ----
  {
    const pos = [], col = [], ca = new THREE.Color(th.curbA), cb = new THREE.Color(th.curbB), cw = 1.4;
    for (let i = 0; i < N; i++) {
      const s = samples[i], e = samples[(i + 1) % N], c = (i >> 1) % 2 ? ca : cb;
      for (const side of [1, -1]) {
        const i0 = hw * side, i1 = (hw + cw) * side;
        const p = [
          s.x + s.nx * i0, s.z + s.nz * i0, s.x + s.nx * i1, s.z + s.nz * i1,
          e.x + e.nx * i0, e.z + e.nz * i0, e.x + e.nx * i1, e.z + e.nz * i1];
        for (const k of [0, 2, 1, 1, 2, 3]) { pos.push(p[k * 2], k % 2 ? 0.1 : 0.03, p[k * 2 + 1]); col.push(c.r, c.g, c.b); }
      }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mat = own(th.neon ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    group.add(new THREE.Mesh(g, mat));
  }

  // ---- Terreno ----
  const ph = [rand() * 6, rand() * 6, rand() * 6, rand() * 6];
  const nz = (x, z) => Math.sin(x * 0.011 + ph[0]) * Math.cos(z * 0.013 + ph[1]) * 0.6
    + Math.sin(x * 0.027 + z * 0.021 + ph[2]) * 0.28 + Math.cos(z * 0.05 - x * 0.04 + ph[3]) * 0.12;
  const heightAt = (x, z, d) => {
    if (d === undefined) d = distToTrack(x, z);
    const k = smooth(hw + 15, hw + 75, d);
    return -0.12 + k * (nz(x, z) * th.hills + th.hills * 0.22);
  };
  {
    const size = 1900, seg = quality > 0.7 ? 120 : 84;
    const g = own(new THREE.PlaneGeometry(size, size, seg, seg));
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3);
    const c1 = new THREE.Color(th.ground), c2 = new THREE.Color(th.ground2), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      const d = distToTrack(x, z, 2), y = heightAt(x, z, d);
      P.setY(i, y);
      const n = nz(x * 2.3 + 40, z * 2.3 - 17) * 0.5 + 0.5;
      c.copy(c1).lerp(c2, Math.max(0, Math.min(1, n * 0.9 + (y < th.liquidLevel + 1.2 ? 0.5 : 0) + (rand() - 0.5) * 0.25)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mat = own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const m = new THREE.Mesh(g, mat);
    group.add(m);
  }
  // ---- Agua / lava / líquido ----
  const liquidMat = own(th.liquidGlow
    ? new THREE.MeshBasicMaterial({ color: th.liquid })
    : new THREE.MeshLambertMaterial({ color: th.liquid, transparent: true, opacity: 0.82 }));
  const liquid = new THREE.Mesh(own(new THREE.CircleGeometry(1100, 40)), liquidMat);
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = th.liquidLevel;
  group.add(liquid);

  // ---- Cielo ----
  const skyMat = own(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(th.skyTop) }, bottom: { value: new THREE.Color(th.skyBottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.08, 0.0, 1.0); h = pow(h, 0.7);
      gl_FragColor = vec4(mix(bottom, top, h), 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(1500, 24, 14)), skyMat);
  sky.renderOrder = -10; group.add(sky);
  const sunMat = own(new THREE.SpriteMaterial({ map: glowTex(), color: th.sun, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const sun = new THREE.Sprite(sunMat); sun.scale.set(400, 400, 1); sun.position.set(700, 420, 500); group.add(sun);
  const sun2 = new THREE.Sprite(sunMat); sun2.scale.set(140, 140, 1); sun2.position.copy(sun.position); group.add(sun2);

  // nubes
  {
    const g = own(new THREE.IcosahedronGeometry(1, 1));
    const mat = own(new THREE.MeshBasicMaterial({ color: th.clouds, fog: false, transparent: true, opacity: 0.9 }));
    const count = 46, im = new THREE.InstancedMesh(g, mat, count), o = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < count / 2; i++) {
      const a = rand() * 6.283, r = 420 + rand() * 600, y = 190 + rand() * 160;
      for (let j = 0; j < 2; j++) {
        o.position.set(Math.cos(a) * r + j * 38, y - j * 6, Math.sin(a) * r + j * 12);
        const s = 34 + rand() * 40; o.scale.set(s * 1.7, s * 0.5, s); o.updateMatrix(); im.setMatrixAt(n++, o.matrix);
      }
    }
    im.frustumCulled = false; group.add(im);
  }
  // estrellas
  if (th.stars) {
    const pos = [];
    for (let i = 0; i < 500; i++) {
      const a = rand() * 6.283, e = 0.1 + rand() * 1.4;
      pos.push(Math.cos(a) * Math.cos(e) * 1400, Math.sin(e) * 1400, Math.sin(a) * Math.cos(e) * 1400);
    }
    const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = own(new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, sizeAttenuation: false, fog: false, map: glowTex(), transparent: true, depthWrite: false }));
    group.add(new THREE.Points(g, mat));
  }
  // montañas lejanas
  {
    const parts = [];
    const base = new THREE.Color(th.mountains), fogC = new THREE.Color(th.fog), c = new THREE.Color();
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * 6.283 + rand() * 0.2, r = 880 + rand() * 160, h = 150 + rand() * 230, w = 170 + rand() * 150;
      c.copy(base).lerp(fogC, 0.3 + rand() * 0.25);
      parts.push([new THREE.ConeGeometry(w, h, 5), c.getHex(), [Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r], null, [0, rand() * 3, 0]]);
    }
    const g = own(merged(parts));
    group.add(new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))));
  }

  // ---- Luces y niebla ----
  const hemi = new THREE.HemisphereLight(th.ambientSky, th.ambientGround, 1.25 * th.light);
  const dir = new THREE.DirectionalLight(th.sun, 1.7 * th.light); dir.position.set(0.7, 1, 0.5);
  group.add(hemi, dir);
  const fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);

  // ---- Decorado instanciado ----
  {
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (const [type, count0] of th.props) {
      const P = PROPS[type]; if (!P) continue;
      const count = Math.round(count0 * (quality > 0.7 ? 1 : 0.55));
      const g = own(P.make());
      const mat = own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true,
        emissive: P.glow ? (th.propGlow || 0x66ccff) : 0x000000, emissiveIntensity: P.glow ? 0.45 : 0 }));
      const im = new THREE.InstancedMesh(g, mat, count);
      let n = 0, tries = 0;
      const small = type === 'flower' || type === 'shell';
      while (n < count && tries++ < count * 12) {
        const s = samples[Math.floor(rand() * N)], side = rand() > 0.5 ? 1 : -1;
        const off = hw + (small ? 4 : 11) + Math.pow(rand(), 1.8) * (small ? 30 : 150);
        const x = s.x + s.nx * off * side, z = s.z + s.nz * off * side;
        const d = distToTrack(x, z, 2);
        if (d < hw + (small ? 3 : 9)) continue;
        const y = heightAt(x, z, d);
        if (y < th.liquidLevel + 0.4) continue;
        const sc = P.scale[0] + rand() * (P.scale[1] - P.scale[0]);
        o.position.set(x, y - 0.1, z); o.rotation.set(0, rand() * 6.283, 0);
        o.scale.set(sc, sc * (0.85 + rand() * 0.3), sc); o.updateMatrix();
        im.setMatrixAt(n, o.matrix);
        if (P.tint) c.setHSL(th.neon ? (rand() > 0.5 ? 0.86 : 0.52) + rand() * 0.06 : rand(), 0.95, 0.62);
        else { const b = 0.85 + rand() * 0.3; c.setRGB(b, b, b); }
        im.setColorAt(n, c); n++;
      }
      im.count = n; im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      group.add(im);
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
    for (let i = 0; i < N; i += 7) { const s = samples[i]; if (Math.abs(s.curv) > 0.0115) list.push(s); }
    const im = new THREE.InstancedMesh(g, mat, Math.max(1, list.length)), o = new THREE.Object3D();
    list.forEach((s, i) => {
      const side = s.curv > 0 ? -1 : 1; // exterior de la curva
      o.position.set(s.x + s.nx * (hw + 4.2) * side, 2.1, s.z + s.nz * (hw + 4.2) * side);
      o.rotation.set(0, s.h + Math.PI, s.curv > 0 ? 0 : Math.PI); o.rotation.order = 'YXZ';
      o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
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
    line.position.set(s.x, 0.04, s.z); group.add(line);
    const banner = own(canvasTex(512, 96, (c) => {
      for (let y = 0; y < 6; y++) for (let x = 0; x < 32; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 16, y * 16, 16, 16); }
      c.fillStyle = '#ff2f4a'; c.fillRect(130, 12, 252, 72);
      c.fillStyle = '#fff'; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('META', 256, 50);
    }));
    const gantry = new THREE.Group();
    const postM = own(new THREE.MeshLambertMaterial({ color: th.curbA }));
    const postG = own(new THREE.CylinderGeometry(0.4, 0.5, 9, 8));
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(postG, postM); p.position.set((hw + 2.4) * sd, 4.5, 0); gantry.add(p); }
    const bn = new THREE.Mesh(own(new THREE.BoxGeometry(def.width + 5.6, 2.6, 0.5)), own(new THREE.MeshBasicMaterial({ map: banner })));
    bn.position.y = 8.2; gantry.add(bn);
    gantry.position.set(s.x, 0, s.z); gantry.rotation.y = s.h; group.add(gantry);
  }

  // ---- Aceleradores ----
  const pads = [];
  const padTex = own(canvasTex(64, 64, (c) => {
    c.fillStyle = '#ff7a00'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#fff36a';
    for (let i = 0; i < 2; i++) { const y = 62 - i * 32; c.beginPath(); c.moveTo(6, y); c.lineTo(32, y - 22); c.lineTo(58, y); c.lineTo(58, y - 12); c.lineTo(32, y - 34); c.lineTo(6, y - 12); c.fill(); }
  }, true));
  {
    const g = own(new THREE.PlaneGeometry(4.6, 8));
    const mat = own(new THREE.MeshBasicMaterial({ map: padTex }));
    for (const f of [0.2, 0.46, 0.72, 0.93]) {
      const idx = Math.floor((f + (rand() - 0.5) * 0.06) * N), s = samples[idx];
      const lat = (rand() - 0.5) * hw * 0.9;
      const m = new THREE.Mesh(g, mat);
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, s.h + Math.PI, 0);
      const x = s.x + s.nx * lat, z = s.z + s.nz * lat;
      m.position.set(x, 0.05, z); group.add(m);
      pads.push({ idx, x, z });
    }
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
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 }));
    for (const f of [0.08, 0.3, 0.55, 0.8]) {
      const idx = Math.floor(f * N), s = samples[idx];
      for (const l of [-0.66, -0.22, 0.22, 0.66]) {
        const x = s.x + s.nx * l * hw, z = s.z + s.nz * l * hw;
        const m = new THREE.Mesh(g, mat); m.position.set(x, 1.5, z); group.add(m);
        itemBoxes.push({ x, z, idx, mesh: m, active: true, timer: 0, ph: rand() * 6 });
      }
    }
  }

  // ---- Plátanos ----
  const bananas = [];
  let bananaMesh;
  {
    const g = own(new THREE.TorusGeometry(0.55, 0.17, 6, 10, Math.PI * 1.1));
    const mat = own(new THREE.MeshBasicMaterial({ color: 0xffe21f }));
    const groups = 13;
    for (let k = 0; k < groups; k++) {
      const base = Math.floor((k + 0.55) / groups * N), lat0 = (rand() - 0.5) * hw * 1.2;
      for (let j = 0; j < 4; j++) {
        const idx = (base + j * 3) % N, s = samples[idx], lat = lat0 + Math.sin(j * 0.9) * 1.5;
        bananas.push({ x: s.x + s.nx * lat, z: s.z + s.nz * lat, idx, active: true, timer: 0 });
      }
    }
    bananaMesh = new THREE.InstancedMesh(g, mat, bananas.length);
    bananaMesh.frustumCulled = false; group.add(bananaMesh);
  }

  // ---- Minimapa ----
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const s of samples) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); }

  const tmp = new THREE.Object3D();
  const track = {
    def, group, fog, samples, N, length, spacing, hw, limit: hw + 8, maxCurv,
    pads, itemBoxes, bananas, mini: { minX, maxX, minZ, maxZ },
    grid(i) {
      const row = Math.floor(i / 2), col = i % 2;
      const s = samples[(N - 5 - row * 4 - col * 2 + N) % N], lat = col ? -3.2 : 3.2;
      return { x: s.x + s.nx * lat, z: s.z + s.nz * lat, h: s.h, idx: (N - 5 - row * 4 - col * 2 + N) % N };
    },
    // Busca la muestra más cercana alrededor de un índice conocido
    locate(x, z, hint, range = 14) {
      let best = hint, bd = 1e12;
      for (let k = -range; k <= range; k++) {
        const i = ((hint + k) % N + N) % N, s = samples[i], dx = x - s.x, dz = z - s.z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    },
    update(dt, t, camPos) {
      sky.position.set(camPos.x, 0, camPos.z);
      padTex.offset.y = -(t * 2.2) % 1;
      liquid.position.y = th.liquidLevel + Math.sin(t * 0.8) * 0.12;
      for (const b of itemBoxes) {
        if (!b.active) { b.timer -= dt; if (b.timer <= 0) { b.active = true; b.mesh.visible = true; } continue; }
        b.mesh.rotation.set(t * 1.3 + b.ph, t * 1.9 + b.ph, 0);
        b.mesh.position.y = 1.5 + Math.sin(t * 3 + b.ph) * 0.2;
      }
      for (let i = 0; i < bananas.length; i++) {
        const b = bananas[i];
        if (!b.active) { b.timer -= dt; if (b.timer <= 0) b.active = true; }
        tmp.position.set(b.x, b.active ? 1.1 + Math.sin(t * 4 + i) * 0.15 : -50, b.z);
        tmp.rotation.set(0, t * 3 + i, 0.6); tmp.updateMatrix();
        bananaMesh.setMatrixAt(i, tmp.matrix);
      }
      bananaMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    },
  };
  return track;
}
