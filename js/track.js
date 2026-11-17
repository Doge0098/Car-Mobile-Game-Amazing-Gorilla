// Generación del circuito: trazado con desnivel, puentes, túneles, rampas, terreno y decorado.
import * as THREE from './vendor/three.module.min.js';
import { rng } from './data.js';
import { PROPS, canvasTex, glowTex, merged } from './models.js';
import { buildScenery } from './scenery.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

const LIQUID_VS = `varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const LIQUID_FS = `uniform float uTime; uniform vec3 uColor; uniform vec3 uColor2; uniform float uMode; uniform float uGlow;
varying vec3 vW;
#include <fog_pars_fragment>
vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
vec2 voro(vec2 x, float t){ vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 o = hash2(n + g);
    o = 0.5 + 0.4 * sin(t + 6.2831 * o); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; } }
  return vec2(d1, d2 - d1); }
void main(){
  vec2 p = vW.xz; vec3 col;
  if (uMode < 0.5) {
    vec2 v = voro(p * 0.07 + vec2(uTime * 0.05, uTime * 0.03), uTime * 0.8);
    float foam = smoothstep(0.09, 0.0, v.y);
    float wave = sin(p.x * 0.05 + uTime * 0.7 + sin(p.y * 0.04 + uTime * 0.3) * 2.0) * 0.5 + 0.5;
    col = mix(uColor, uColor2, wave * 0.5 + v.x * 0.35) + foam * 0.5;
  } else if (uMode < 1.5) {
    vec2 v = voro(p * 0.045 + vec2(uTime * 0.02, -uTime * 0.015), uTime * 0.35);
    float crack = smoothstep(0.17, 0.0, v.y);
    float pulse = 0.75 + 0.25 * sin(uTime * 1.7 + v.x * 6.0);
    vec3 crust = mix(uColor2, uColor * 0.5, v.x);
    col = mix(crust, uColor * uGlow * pulse + vec3(0.9, 0.55, 0.08) * crack * uGlow * 0.6, crack * 0.85 + 0.12);
  } else if (uMode < 2.5) {
    vec2 g = abs(fract(p * 0.05 + vec2(0.0, uTime * 0.12)) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + p.x * 0.02 + p.y * 0.02);
    col = uColor2 + uColor * line * uGlow * pulse;
  } else {
    vec2 v = voro(p * 0.06 + uTime * 0.04, uTime * 0.6);
    float foam = smoothstep(0.07, 0.0, v.y);
    float spark = pow(max(0.0, 1.0 - voro(p * 0.5, uTime * 2.0).x * 3.0), 4.0);
    col = mix(uColor, uColor2, v.x) + foam * 0.4 * uGlow + spark * uGlow;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

export function buildTrack(def, opts = {}) {
  const quality = opts.quality ?? 1, bloom = !!opts.bloom, shadows = !!opts.shadows;
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
    for (const [k, amp, ph] of def.waves) r += amp * Math.sin(k * a + ph);
    ctrl.push(new THREE.Vector3(Math.cos(a) * def.R * r, 0, Math.sin(a) * def.R * r));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const length = curve.getLength();
  const N = Math.round(length / 3);
  const pts = curve.getSpacedPoints(N); pts.pop();
  const hw = def.width / 2, spacing = length / N;
  const fIdx = u => ((Math.floor(u * N) % N) + N) % N;
  const tunR = def.tunnel ? [fIdx(def.tunnel[0]), fIdx(def.tunnel[1])] : null;
  const brR = def.bridge ? [fIdx(def.bridge[0]), fIdx(def.bridge[1])] : null;
  // factor de zona: 1 dentro del tramo y transición suave de E muestras fuera
  const zoneK = (i, r, E) => {
    if (!r) return 0;
    if (i >= r[0] && i <= r[1]) return 1;
    let d = i < r[0] ? r[0] - i : i - r[1]; d = Math.min(d, N - d);
    return 1 - smooth(0, E, d);
  };

  const samples = [];
  for (let i = 0; i < N; i++) {
    const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    const u = i / N;
    let y = 0;
    for (const [f, amp] of def.elev || []) y += amp * (1 - Math.cos(TAU * f * u)) / 2;
    if (brR && i >= brR[0] && i <= brR[1]) y += 4.5 * Math.sin(Math.PI * (i - brR[0]) / (brR[1] - brR[0])) ** 2;
    const kt = zoneK(i, tunR, 8), kb = zoneK(i, brR, 8);
    samples.push({
      x: pts[i].x, z: pts[i].z, y, tx, tz, nx: tz, nz: -tx, h: Math.atan2(tx, tz), curv: 0, slope: 0,
      kt, kb, kbT: zoneK(i, brR, 16), tun: !!(tunR && i >= tunR[0] && i <= tunR[1]),
      lim: hw + 8 - 5.6 * kt - 7.5 * kb,
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
  const special = s => s.kt > 0.02 || s.kb > 0.02; // túnel, puente o sus embudos
  const rampIdx = (def.ramps || []).map(fIdx);
  const nearRamp = i => rampIdx.some(r => { let d = Math.abs(i - r); d = Math.min(d, N - d); return d < 22; });

  let nearI = 0;
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
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
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
  }
  // ---- Pianos, arcenes y barreras ----
  const deckC = new THREE.Color(ex.deck), gC1 = new THREE.Color(th.ground), gC2 = new THREE.Color(th.ground2), tunC = new THREE.Color(ex.tunnelCol).multiplyScalar(0.55);
  {
    const pos = [], col = [], ca = new THREE.Color(th.curbA), cb = new THREE.Color(th.curbB), cw = 1.4;
    const bpos = [], bcol = [];
    const kC = th.neon ? B(1.6) : 1;
    for (let i = 0; i < N; i++) {
      const s = samples[i], e = samples[(i + 1) % N], c = (i >> 1) % 2 ? ca : cb;
      for (const side of [1, -1]) {
        const i0 = hw * side, i1 = (hw + cw) * side;
        const p = [s.x + s.nx * i0, s.z + s.nz * i0, s.x + s.nx * i1, s.z + s.nz * i1, e.x + e.nx * i0, e.z + e.nz * i0, e.x + e.nx * i1, e.z + e.nz * i1];
        for (const k of [0, 2, 1, 1, 2, 3]) { pos.push(p[k * 2], (k < 2 ? s.y : e.y) + (k % 2 ? 0.1 : 0.03), p[k * 2 + 1]); col.push(c.r * kC, c.g * kC, c.b * kC); }
        // barrera / barandilla donde el borde se estrecha
        if (s.lim < hw + 7.6 && !s.tun && !e.tun) {
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
      if (i < N) for (const o of [0, 3]) for (const j of [0, 1]) {
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
    const d = lastD = distToTrack(x, z, stride), s = samples[nearI], kbt = s.kbT;
    let near = s.y - 0.9; near += (th.liquidLevel - 3.5 - near) * kbt;
    let far = s.y * 0.55 + nz(x, z) * th.hills + th.hills * 0.22;
    if (kbt > 0) far += (Math.min(far, th.liquidLevel - 2.5) - far) * kbt * (1 - smooth(70, 170, d));
    return near + (far - near) * smooth(hw + 17, hw + 85, d);
  };
  {
    const size = 1900, seg = quality > 0.7 ? 150 : 100;
    const g = own(new THREE.PlaneGeometry(size, size, seg, seg));
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), y = terrainH(x, z);
      P.setY(i, y);
      const n = nz(x * 2.3 + 40, z * 2.3 - 17) * 0.5 + 0.5;
      c.copy(gC1).lerp(gC2, Math.max(0, Math.min(1, n * 0.9 + (y < th.liquidLevel + 1.2 ? 0.5 : 0) + (rand() - 0.5) * 0.25)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
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
  const lc = new THREE.Color(th.liquid), lc2 = lc.clone();
  if (ex.liquidMode === 1) lc2.set(0x2a0c10); else if (ex.liquidMode === 2) lc2.set(0x0a0624); else lc2.offsetHSL(0.03, 0, -0.16);
  const liquidMat = own(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uColor: { value: lc }, uColor2: { value: lc2 }, uMode: { value: ex.liquidMode || 0 },
      uGlow: { value: th.liquidGlow ? B(1.9) : 1 },
    }]),
    vertexShader: LIQUID_VS, fragmentShader: LIQUID_FS, fog: true,
  }));
  const liquid = new THREE.Mesh(own(new THREE.CircleGeometry(1150, 40)), liquidMat);
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = th.liquidLevel;
  group.add(liquid);

  // ---- Cielo ----
  const skyMat = own(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(th.skyTop) }, bottom: { value: new THREE.Color(th.skyBottom) }, dim: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform float dim; varying vec3 vP;
      void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.08, 0.0, 1.0); h = pow(h, 0.7);
      gl_FragColor = vec4(mix(bottom, top, h) * dim, 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(1500, 24, 14)), skyMat);
  sky.renderOrder = -10; group.add(sky);
  const sunDir = new THREE.Vector3(0.7, 0.62, 0.5).normalize();
  const sunMat = own(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(th.sun).multiplyScalar(B(1.5)), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const sun = new THREE.Sprite(sunMat); sun.scale.set(400, 400, 1); sun.position.copy(sunDir).multiplyScalar(1100); sky.add(sun);
  const sun2 = new THREE.Sprite(sunMat); sun2.scale.set(140, 140, 1); sun2.position.copy(sun.position); sky.add(sun2);

  // nubes
  {
    const g = own(new THREE.IcosahedronGeometry(1, 1));
    const mat = own(new THREE.MeshBasicMaterial({ color: th.clouds, fog: false, transparent: true, opacity: 0.9 }));
    const count = 46, im = new THREE.InstancedMesh(g, mat, count), o = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < count / 2; i++) {
      const a = rand() * TAU, r = 420 + rand() * 600, y = 200 + rand() * 160;
      for (let j = 0; j < 2; j++) {
        o.position.set(Math.cos(a) * r + j * 38, y - j * 6, Math.sin(a) * r + j * 12);
        const s = 34 + rand() * 40; o.scale.set(s * 1.7, s * 0.5, s); o.updateMatrix(); im.setMatrixAt(n++, o.matrix);
      }
    }
    im.frustumCulled = false; group.add(im);
  }
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
    const parts = [];
    const base = new THREE.Color(th.mountains), fogC = new THREE.Color(th.fog), c = new THREE.Color();
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU + rand() * 0.2, r = 900 + rand() * 160, h = 170 + rand() * 240, w = 170 + rand() * 150;
      c.copy(base).lerp(fogC, 0.3 + rand() * 0.25);
      parts.push([new THREE.ConeGeometry(w, h, 5), c.getHex(), [Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r], null, [0, rand() * 3, 0]]);
    }
    group.add(new THREE.Mesh(own(merged(parts)), own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))));
  }

  // ---- Luces, sombras y niebla ----
  const hemi = new THREE.HemisphereLight(th.ambientSky, th.ambientGround, 1.25 * th.light);
  const dir = new THREE.DirectionalLight(th.sun, 1.7 * th.light); dir.position.copy(sunDir);
  group.add(hemi, dir, dir.target);
  if (shadows) {
    dir.castShadow = true;
    const sz = quality > 0.7 ? 2048 : 1024;
    dir.shadow.mapSize.set(sz, sz);
    const sc = dir.shadow.camera; sc.left = sc.bottom = -62; sc.right = sc.top = 62; sc.near = 20; sc.far = 420; sc.updateProjectionMatrix();
    dir.shadow.bias = -0.0008; dir.shadow.normalBias = 0.35;
  }
  const fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);

  // ---- Decorado instanciado ----
  {
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (const [type, count0] of th.props) {
      const P = PROPS[type]; if (!P) continue;
      const count = Math.round(count0 * (quality > 0.7 ? 1 : 0.55));
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
        if (s.kbT > 0.02 && d < 60) continue;
        if (s.kt > 0.02 && d < hw + 14) continue;
        if (small && d < s.lim + 2.4) { if (d < hw + 3) continue; y = s.y + 0.08; } else if (d < s.lim + 10) continue;
        if (y < th.liquidLevel + 0.4) continue;
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
        bananas.push({ x, z, px: x, pz: z, y: s.y, idx, active: true, timer: 0 });
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
  const scenery = buildScenery({ def, th, ex, samples, N, hw, rand, own, group, B, quality, shadows, uTime, special, nearRamp, tunR, fIdx });

  // ---- Minimapa ----
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const s of samples) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); }

  const tmp = new THREE.Object3D(), baseHemi = hemi.intensity, baseDir = dir.intensity;
  const track = {
    def, group, fog, samples, N, length, spacing, hw, maxCurv, unlitRoad,
    pads, ramps, itemBoxes, bananas, puddles, mini: { minX, maxX, minZ, maxZ },
    sunDir, hemi, dir, skyMat, baseFog: [th.fogNear, th.fogFar], fIdx,
    isFree: i => !special(samples[i]) && !nearRamp(i),
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
      padTex.offset.y = -(t * 2.2) % 1;
      liquidMat.uniforms.uTime.value = t;
      liquid.position.set(camPos.x, th.liquidLevel + Math.sin(t * 0.8) * 0.12, camPos.z);
      if (shadows && focus) {
        // se ajusta a una rejilla para que las sombras no tiemblen
        const fx = Math.round(focus.x / 2) * 2, fz = Math.round(focus.z / 2) * 2;
        dir.target.position.set(fx, focus.y || 0, fz);
        dir.position.set(fx + sunDir.x * 200, (focus.y || 0) + sunDir.y * 200, fz + sunDir.z * 200);
      }
      for (const b of itemBoxes) {
        if (!b.active) { b.timer -= dt; if (b.timer <= 0) { b.active = true; b.mesh.visible = true; } continue; }
        b.mesh.rotation.set(t * 1.3 + b.ph, t * 1.9 + b.ph, 0);
        b.mesh.position.y = b.y + 1.5 + Math.sin(t * 3 + b.ph) * 0.2;
      }
      for (let i = 0; i < bananas.length; i++) {
        const b = bananas[i];
        if (!b.active) { b.timer -= dt; if (b.timer <= 0) { b.active = true; b.px = b.x; b.pz = b.z; } }
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
