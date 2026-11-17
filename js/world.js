// Sistemas dinámicos del mundo: marcas de derrape, estelas, clima y obstáculos vivos.
import * as THREE from './vendor/three.module.min.js';
import * as A from './audio.js';
import { makeHazard, glowTex, merged } from './models.js';
import { addOutline } from './outline.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (v, b) => ((v % b) + b) % b;

// ---------------- Marcas en el suelo ----------------
const MARK_VS = `attribute float aBirth; attribute vec3 aCol; varying float vB; varying vec3 vC;
#include <fog_pars_vertex>
void main(){ vB = aBirth; vC = aCol; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const MARK_FS = `uniform float uTime; uniform float uLife; varying float vB; varying vec3 vC;
#include <fog_pars_fragment>
void main(){ float a = clamp(1.0 - (uTime - vB) / uLife, 0.0, 1.0); if (a <= 0.0) discard; gl_FragColor = vec4(vC, min(1.0, a * 2.5) * 0.78);
#include <fog_fragment>
#include <colorspace_fragment>
}`;

export class SkidMarks {
  constructor(max = 700, life = 9) {
    this.max = max; this.cursor = 0;
    this.pos = new Float32Array(max * 12); this.birth = new Float32Array(max * 4).fill(-1e4); this.col = new Float32Array(max * 12);
    const idx = new Uint16Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLife: { value: life } }]),
      vertexShader: MARK_VS, fragmentShader: MARK_FS, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this._c = new THREE.Color(); this.dirty = false;
  }

  // tramo de p0 a p1 (xz) con media anchura w
  add(x0, y0, z0, x1, y1, z1, w, color, t) {
    let dx = x1 - x0, dz = z1 - z0; const l = Math.hypot(dx, dz); if (l < 0.01) return;
    dx /= l; dz /= l; const px = -dz * w, pz = dx * w, i = this.cursor * 12, b = this.cursor * 4;
    this.cursor = (this.cursor + 1) % this.max;
    const P = this.pos;
    P[i] = x0 + px; P[i + 1] = y0 + 0.05; P[i + 2] = z0 + pz; P[i + 3] = x0 - px; P[i + 4] = y0 + 0.05; P[i + 5] = z0 - pz;
    P[i + 6] = x1 + px; P[i + 7] = y1 + 0.05; P[i + 8] = z1 + pz; P[i + 9] = x1 - px; P[i + 10] = y1 + 0.05; P[i + 11] = z1 - pz;
    this._c.set(color);
    for (let k = 0; k < 4; k++) { this.birth[b + k] = t; this.col[i + k * 3] = this._c.r; this.col[i + k * 3 + 1] = this._c.g; this.col[i + k * 3 + 2] = this._c.b; }
    this.dirty = true;
  }

  update(t) {
    this.mat.uniforms.uTime.value = t;
    if (this.dirty) { const a = this.mesh.geometry.attributes; a.position.needsUpdate = a.aBirth.needsUpdate = a.aCol.needsUpdate = true; this.dirty = false; }
  }

  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ---------------- Estela luminosa (turbo / furia) ----------------
export class Trail {
  constructor(K = 16) {
    this.K = K; this.h = new Float32Array(K * 6); this.live = 0;
    this.pos = new Float32Array(K * 6); this.col = new Float32Array(K * 6);
    const idx = [];
    for (let i = 0; i < K - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.visible = false;
    this._c = new THREE.Color();
  }

  // (x,y,z) centro trasero, (rx,rz) vector lateral, on: si emite ahora
  push(x, y, z, rx, rz, color, on, gain = 1) {
    if (!on && this.live <= 0) { this.mesh.visible = false; return; }
    const K = this.K, h = this.h;
    h.copyWithin(6, 0, (K - 1) * 6);
    h[0] = x; h[1] = y; h[2] = z; h[3] = rx; h[4] = rz; h[5] = on ? 1 : 0;
    this.live = on ? K : this.live - 1;
    this._c.set(color);
    for (let i = 0; i < K; i++) {
      const o = i * 6, f = 1 - i / (K - 1), a = h[o + 5] * f * f * gain, w = 0.95 * (0.4 + 0.6 * f);
      this.pos[o] = h[o] + h[o + 3] * w; this.pos[o + 1] = h[o + 1]; this.pos[o + 2] = h[o + 2] + h[o + 4] * w;
      this.pos[o + 3] = h[o] - h[o + 3] * w; this.pos[o + 4] = h[o + 1]; this.pos[o + 5] = h[o + 2] - h[o + 4] * w;
      for (let k = 0; k < 2; k++) { this.col[o + k * 3] = this._c.r * a; this.col[o + k * 3 + 1] = this._c.g * a; this.col[o + k * 3 + 2] = this._c.b * a; }
    }
    const at = this.mesh.geometry.attributes; at.position.needsUpdate = at.color.needsUpdate = true;
    this.mesh.visible = true;
  }

  reset(x, y, z) { for (let i = 0; i < this.K; i++) { const o = i * 6; this.h[o] = x; this.h[o + 1] = y; this.h[o + 2] = z; this.h[o + 5] = 0; } this.live = 0; }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ---------------- Clima ----------------
export class Weather {
  constructor(kind, { scene, track, fx, quality = 1, B = k => k, onEvent }) {
    this.kind = kind; this.scene = scene; this.track = track; this.fx = fx; this.onEvent = onEvent; this.level = 0; this.objs = [];
    const lowQ = quality < 0.7;
    if (kind === 'rain') {
      const n = this.n = lowQ ? 260 : 560;
      this.off = new Float32Array(n * 3); this.spd = new Float32Array(n);
      for (let i = 0; i < n; i++) { this.off[i * 3] = Math.random() * 80; this.off[i * 3 + 1] = Math.random() * 44; this.off[i * 3 + 2] = Math.random() * 80; this.spd[i] = 55 + Math.random() * 25; }
      this.pos = new Float32Array(n * 6);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.mat = new THREE.LineBasicMaterial({ color: 0xd8eeff, transparent: true, opacity: 0, depthWrite: false, fog: false });
      this.obj = new THREE.LineSegments(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = 6; this.obj.visible = false;
      scene.add(this.obj); this.objs.push(this.obj); this.lt = 5;
    } else if (kind === 'blizzard') {
      const n = this.n = lowQ ? 300 : 700;
      this.off = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { this.off[i * 3] = Math.random() * 70; this.off[i * 3 + 1] = Math.random() * 30; this.off[i * 3 + 2] = Math.random() * 70; }
      this.pos = new Float32Array(n * 3);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, map: glowTex(), transparent: true, opacity: 0, depthWrite: false, fog: false });
      this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = 6; this.obj.visible = false;
      scene.add(this.obj); this.objs.push(this.obj);
    } else if (kind === 'ash') {
      this.meteors = []; this.spawnT = 5;
      const ringG = new THREE.CircleGeometry(1, 22);
      for (let i = 0; i < 3; i++) {
        const rock = makeHazard('meteor'); rock.visible = false; scene.add(rock);
        const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
        ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
        this.meteors.push({ state: 0, t: 0, rock, ring, x: 0, y: 0, z: 0 }); this.objs.push(rock, ring);
      }
      this.ringG = ringG; this.glow = B(1.8);
    } else if (kind === 'stars') {
      const n = this.n = 5;
      this.pos = new Float32Array(n * 6); const col = new Float32Array(n * 6), k = B(3);
      for (let i = 0; i < n; i++) { col[i * 6] = k; col[i * 6 + 1] = k; col[i * 6 + 2] = k * 0.85; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.mat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
      this.obj = new THREE.LineSegments(g, this.mat); this.obj.frustumCulled = false; scene.add(this.obj); this.objs.push(this.obj);
      this.stars = []; for (let i = 0; i < n; i++) this.stars.push({ t: 9, life: 1, d: new THREE.Vector3(), v: new THREE.Vector3() });
      this.spawnT = 1;
    } else if (kind === 'sandstorm' || kind === 'confetti') {
      // arena que cruza con el viento / papelillos de colores que caen (puntos alrededor de la cámara)
      const sand = kind === 'sandstorm', n = this.n = sand ? (lowQ ? 320 : 760) : (lowQ ? 110 : 240);
      this.off = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { this.off[i * 3] = Math.random() * 70; this.off[i * 3 + 1] = Math.random() * 30; this.off[i * 3 + 2] = Math.random() * 70; }
      this.pos = new Float32Array(n * 3);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      if (sand) this.mat = new THREE.PointsMaterial({ color: 0xf6d9a0, size: 1.1, map: glowTex(), transparent: true, opacity: 0, depthWrite: false, fog: false });
      else {
        const col = new Float32Array(n * 3), c = new THREE.Color(), pal = [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xff7a1a, 0x7a5cff, 0xff3b4a];
        for (let i = 0; i < n; i++) { c.set(pal[i % pal.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.mat = new THREE.PointsMaterial({ vertexColors: true, size: 0.34, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
      }
      this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = 6; this.obj.visible = false;
      scene.add(this.obj); this.objs.push(this.obj);
    }
  }

  update(dt, t, cam, race) {
    const tr = this.track, p = race.player, inTunnel = tr.samples[p.idx].tun || cam.y < tr.liquidLevel, racing = race.state === 'racing';
    const k = this.kind;
    if (k === 'rain') {
      const lv = this.level = clamp(Math.sin(t * 0.07 - 0.6) * 1.7 - 0.1, 0, 1);
      this.obj.visible = lv > 0.02 && !inTunnel;
      this.mat.opacity = lv * 0.5;
      if (this.obj.visible) {
        const P = this.pos, O = this.off;
        for (let i = 0; i < this.n; i++) {
          const x = cam.x + wrap(O[i * 3] + t * 6 - cam.x, 80) - 40, y = cam.y - 14 + wrap(O[i * 3 + 1] - this.spd[i] * t, 44), z = cam.z + wrap(O[i * 3 + 2] - cam.z, 80) - 40;
          P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z; P[i * 6 + 3] = x - 0.25; P[i * 6 + 4] = y + 2.3; P[i * 6 + 5] = z;
        }
        this.obj.geometry.attributes.position.needsUpdate = true;
        if (lv > 0.25) for (let i = 0; i < 2; i++) this.fx.norm.emit(cam.x + (Math.random() - 0.5) * 50, p.y + 0.15, cam.z + (Math.random() - 0.5) * 50, 0, 2.5, 0, 0xe6f6ff, 3.5, 0.25, 9);
      }
      tr.setLight(lv * 0.85); tr.fog.near = tr.baseFog[0] * (1 - 0.3 * lv); tr.fog.far = tr.baseFog[1] * (1 - 0.25 * lv);
      if (lv > 0.55 && racing) { this.lt -= dt; if (this.lt <= 0) { this.lt = 5 + Math.random() * 8; if (this.onEvent) this.onEvent('lightning'); } }
    } else if (k === 'blizzard') {
      const lv = this.level = clamp(Math.sin(t * 0.09 - 0.9) * 1.6 + 0.05, 0, 1);
      this.obj.visible = lv > 0.02 && !inTunnel; this.mat.opacity = lv * 0.9;
      if (this.obj.visible) {
        const P = this.pos, O = this.off;
        for (let i = 0; i < this.n; i++) {
          P[i * 3] = cam.x + wrap(O[i * 3] + t * 26 - cam.x, 70) - 35; P[i * 3 + 1] = cam.y - 9 + wrap(O[i * 3 + 1] - t * 5 + Math.sin(t * 2 + i) * 0.6, 30);
          P[i * 3 + 2] = cam.z + wrap(O[i * 3 + 2] + t * 9 - cam.z, 70) - 35;
        }
        this.obj.geometry.attributes.position.needsUpdate = true;
      }
      tr.setLight(lv * 0.4); tr.fog.near = tr.baseFog[0] * (1 - 0.55 * lv); tr.fog.far = tr.baseFog[1] * (1 - 0.42 * lv);
    } else if (k === 'ash') {
      let busy = 0;
      if (racing) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = 3.5 + Math.random() * 3.5;
          const m = this.meteors.find(q => q.state === 0);
          const r = Math.random() < 0.55 ? p : race.racers[Math.floor(Math.random() * race.racers.length)];
          const idx = (r.idx + 16 + Math.floor(Math.random() * 22)) % tr.N, s = tr.samples[idx];
          if (m && !s.tun && !s.zone && s.kz < 0.02) {
            const lat = (Math.random() - 0.5) * 2 * (tr.hw - 1);
            m.x = s.x + s.nx * lat; m.z = s.z + s.nz * lat; m.y = s.y; m.state = 1; m.t = 0;
            m.rock.visible = m.ring.visible = true; m.ring.position.set(m.x, m.y + 0.09, m.z); m.ring.material.color.setRGB(1, 0.2, 0.08);
            if ((m.x - p.x) ** 2 + (m.z - p.z) ** 2 < 150 * 150) A.sfx.meteorFall?.();
          }
        }
      }
      for (const m of this.meteors) {
        if (m.state === 1) {
          busy = 1; m.t += dt; const q = Math.min(1, m.t / 1.7), e = 1 - q;
          m.rock.position.set(m.x - 35 * e, m.y + 1 + 95 * e, m.z + 25 * e); m.rock.rotation.set(t * 3, t * 2, 0);
          m.ring.scale.setScalar(4.6 * (0.35 + 0.65 * q)); m.ring.material.opacity = 0.35 + 0.3 * Math.sin(t * 22);
          for (let i = 0; i < 2; i++) this.fx.add.emit(m.rock.position.x, m.rock.position.y, m.rock.position.z, (Math.random() - 0.5) * 5, 3, (Math.random() - 0.5) * 5, Math.random() < 0.5 ? 0xff7a1a : 0xffd21f, 16, 0.5, 0, 0.8);
          if (q >= 1) {
            m.state = 2; m.t = 0; m.rock.visible = false;
            this.fx.add.burst(m.x, m.y + 1, m.z, 46, [0xff7a1a, 0xffd21f, 0xff3a1a, 0xffffff], 20, 12, 0.9, 16);
            this.fx.norm.burst(m.x, m.y + 0.6, m.z, 14, 0x3a2630, 9, 16, 1.1, 4);
            const d2 = (m.x - p.x) ** 2 + (m.z - p.z) ** 2, near = clamp(1 - Math.sqrt(d2) / 110, 0, 1);
            if (near > 0) { A.sfx.meteorHit?.(0, 0.3 + near * 0.7); if (near > 0.55) { race.shake = Math.max(race.shake, near * 0.6); A.haptic?.('meteor'); } }
            for (const r of race.racers) if ((r.x - m.x) ** 2 + (r.z - m.z) ** 2 < 21 && r.hopY < 3) r.hit();
            m.ring.material.color.setRGB(0.12, 0.05, 0.05);
          }
        } else if (m.state === 2) {
          m.t += dt; m.ring.material.opacity = 0.7 * (1 - m.t / 4);
          if (m.t >= 4) { m.state = 0; m.ring.visible = false; }
        }
      }
      this.level += ((busy ? 1 : 0) - this.level) * Math.min(1, dt * 2);
    } else if (k === 'stars') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 1 + Math.random() * 2.5;
        const s = this.stars.find(q => q.t >= q.life);
        if (s) {
          const a = Math.random() * 6.283, e = 0.35 + Math.random() * 0.7;
          s.d.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
          s.v.set(-Math.sin(a), -0.35 - Math.random() * 0.3, Math.cos(a)).multiplyScalar((Math.random() < 0.5 ? 1 : -1) * 0.75);
          s.t = 0; s.life = 0.8 + Math.random() * 0.7;
        }
      }
      const P = this.pos, R = 900;
      for (let i = 0; i < this.n; i++) {
        const s = this.stars[i]; s.t += dt;
        if (s.t >= s.life) { for (let j = 0; j < 6; j++) P[i * 6 + j] = 0; continue; }
        const hx = s.d.x + s.v.x * s.t, hy = s.d.y + s.v.y * s.t, hz = s.d.z + s.v.z * s.t, tl = Math.min(s.t, 0.22);
        P[i * 6] = cam.x + hx * R; P[i * 6 + 1] = cam.y + hy * R; P[i * 6 + 2] = cam.z + hz * R;
        P[i * 6 + 3] = cam.x + (hx - s.v.x * tl) * R; P[i * 6 + 4] = cam.y + (hy - s.v.y * tl) * R; P[i * 6 + 5] = cam.z + (hz - s.v.z * tl) * R;
      }
      this.obj.geometry.attributes.position.needsUpdate = true;
    } else if (k === 'sandstorm') {
      // ráfagas: la arena cruza la pista, la niebla se cierra y la luz se vuelve ocre
      const lv = this.level = clamp(Math.sin(t * 0.085 - 1.1) * 1.6 - 0.1, 0, 1);
      this.obj.visible = lv > 0.02 && !inTunnel; this.mat.opacity = lv * 0.75;
      if (this.obj.visible) {
        const P = this.pos, O = this.off;
        for (let i = 0; i < this.n; i++) {
          P[i * 3] = cam.x + wrap(O[i * 3] + t * 38 - cam.x, 70) - 35; P[i * 3 + 1] = cam.y - 8 + wrap(O[i * 3 + 1] + Math.sin(t * 1.7 + i) * 1.2 - t * 1.5, 30);
          P[i * 3 + 2] = cam.z + wrap(O[i * 3 + 2] + t * 15 - cam.z, 70) - 35;
        }
        this.obj.geometry.attributes.position.needsUpdate = true;
        if (lv > 0.3 && Math.random() < 0.6) this.fx.norm.emit(cam.x + (Math.random() - 0.5) * 60, p.y + 0.4, cam.z + (Math.random() - 0.5) * 60, 16, 1 + Math.random() * 2, 6, 0xf2c46a, 16, 0.9, 0, 1.6);
      }
      tr.setLight(lv * 0.3); tr.fog.near = tr.baseFog[0] * (1 - 0.65 * lv); tr.fog.far = tr.baseFog[1] * (1 - 0.52 * lv);
    } else if (k === 'confetti') {
      this.obj.visible = !inTunnel;
      if (this.obj.visible) {
        const P = this.pos, O = this.off;
        for (let i = 0; i < this.n; i++) {
          P[i * 3] = cam.x + wrap(O[i * 3] + Math.sin(t * 1.3 + i) * 1.6 - cam.x, 70) - 35; P[i * 3 + 1] = cam.y - 8 + wrap(O[i * 3 + 1] - t * (2.2 + (i % 5) * 0.4), 30);
          P[i * 3 + 2] = cam.z + wrap(O[i * 3 + 2] + Math.cos(t * 1.1 + i * 2) * 1.6 - cam.z, 70) - 35;
        }
        this.obj.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const o of this.objs) this.scene.remove(o);
    if (this.obj) { this.obj.geometry.dispose(); this.mat.dispose(); }
    if (this.meteors) { for (const m of this.meteors) m.ring.material.dispose(); this.ringG.dispose(); }
  }
}

// ---------------- Obstáculos vivos ----------------
// Obstáculos de la Copa Galaxia: matojo rodante, robot de cuerda y asteroide flotante
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d), box = (x, y, z) => new THREE.BoxGeometry(x, y, z), cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
const XHAZ = {
  tumbleweed: () => {
    const p = [[ico(0.5, 0), 0x8a6a34, [0, 0, 0]]];
    for (let i = 0; i < 5; i++) p.push([new THREE.TorusGeometry(1, 0.075, 4, 10), i % 2 ? 0xc8a45a : 0xa8843a, null, null, [i * 1.3, i * 0.9, i * 0.5]]);
    for (let i = 0; i < 8; i++) { const a = i * 0.8, b = i * 1.7; p.push([cyl(0.04, 0.04, 1.3, 4), 0xb8944a, [Math.cos(a) * 0.6, Math.sin(b) * 0.6, Math.sin(a) * 0.6], null, [b, a, a + b]]); }
    return merged(p);
  },
  windup: () => merged([
    [box(1.5, 1.4, 1.2), 0xff3b4a, [0, 1.25, 0]], [box(1.2, 0.95, 1.05), 0xfff3d0, [0, 2.45, 0]], [box(0.5, 0.55, 0.9), 0x2b6cff, [-0.42, 0.28, 0.08]], [box(0.5, 0.55, 0.9), 0x2b6cff, [0.42, 0.28, 0.08]],
    [ico(0.19, 1), 0x22e6ff, [-0.3, 2.55, 0.55]], [ico(0.19, 1), 0x22e6ff, [0.3, 2.55, 0.55]], [box(0.7, 0.1, 0.1), 0x2a2238, [0, 2.2, 0.55]], [box(0.9, 0.6, 0.1), 0xffd21f, [0, 1.3, 0.62]],
    [cyl(0.16, 0.16, 0.9, 6), 0x8a8a9a, [-0.95, 1.4, 0.15], null, [0.5, 0, 0]], [cyl(0.16, 0.16, 0.9, 6), 0x8a8a9a, [0.95, 1.4, 0.15], null, [0.5, 0, 0]],
    [cyl(0.05, 0.05, 0.5, 5), 0x8a8a9a, [0, 3.15, 0]], [ico(0.15, 0), 0xff7a1a, [0, 3.45, 0]],
    [cyl(0.08, 0.08, 0.6, 5), 0x8a8a9a, [0, 1.35, -0.9], null, [Math.PI / 2, 0, 0]], [new THREE.TorusGeometry(0.3, 0.09, 5, 10), 0xffd21f, [-0.3, 1.35, -1.25]], [new THREE.TorusGeometry(0.3, 0.09, 5, 10), 0xffd21f, [0.3, 1.35, -1.25]],
  ]),
  asteroid: () => merged([
    [new THREE.DodecahedronGeometry(1.25, 0), 0x8a8fb0, null, [1.15, 0.9, 1]], [new THREE.DodecahedronGeometry(0.6, 0), 0x6a6f92, [0.9, 0.5, 0.3]], [new THREE.DodecahedronGeometry(0.45, 0), 0xa8aed0, [-0.8, -0.5, 0.5]],
    [new THREE.OctahedronGeometry(0.42, 0), 0x7ff0ff, [-0.4, 0.95, -0.2], [0.7, 1.5, 0.7]], [new THREE.OctahedronGeometry(0.3, 0), 0xff7ac8, [0.5, -0.8, -0.5], [0.7, 1.4, 0.7]],
  ]),
};
const xGeo = new Map();
let xMat = null;
function makeXHazard(type) {
  if (!xGeo.has(type)) xGeo.set(type, XHAZ[type]());
  if (!xMat) xMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Mesh(xGeo.get(type), xMat); addOutline(m);
  return m;
}

const CAND = [0.045, 0.125, 0.165, 0.235, 0.275, 0.33, 0.5, 0.585, 0.76, 0.84, 0.9, 0.965];

export class Hazards {
  constructor(type, { scene, track, fx, rand, shadows, B = k => k }) {
    this.type = type; this.scene = scene; this.track = track; this.fx = fx; this.list = []; this.glow = B(1.8);
    if (!type) return;
    const N = track.N, picks = [];
    for (const f of CAND.slice().sort(() => rand() - 0.5)) {
      const i = Math.floor(f * N);
      if (!track.isFree(i) || picks.some(q => Math.abs(q - f) < 0.11)) continue;
      picks.push(f); if (picks.length >= 4) break;
    }
    for (const f of picks) {
      const idx = Math.floor(f * N), s = track.samples[idx], holder = new THREE.Group(), mesh = XHAZ[type] ? makeXHazard(type) : makeHazard(type);
      mesh.castShadow = !!shadows; holder.add(mesh);
      const h = { kind: type, idx, s, lat: (rand() - 0.5) * (track.hw - 2) * 1.6, x: s.x, y: s.y, z: s.z, ph: rand() * 6.28, down: 0, holder, mesh, harm: true, hopY: 0, was: 0 };
      if (type === 'geyser') {
        h.disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 18), new THREE.MeshBasicMaterial({ color: 0xff5a00 }));
        h.disc.rotation.x = -Math.PI / 2; h.disc.position.y = 0.09; holder.add(h.disc);
        h.x = s.x + s.nx * h.lat; h.z = s.z + s.nz * h.lat; holder.position.set(h.x, h.y, h.z); holder.rotation.y = s.h; h.harm = false;
      }
      scene.add(holder); this.list.push(h);
    }
  }

  knock(h) {
    h.down = 3.2;
    this.fx.add.burst(h.x, h.y + 1.2, h.z, 18, [0xffffff, 0xffd21f], 9, 8, 0.5, 8);
  }

  update(dt, t, race) {
    const tr = this.track, A0 = tr.hw - 1.3, p = race.player;
    for (const h of this.list) {
      const s = h.s, near = (h.x - p.x) ** 2 + (h.z - p.z) ** 2 < 130 * 130;
      if (h.kind === 'geyser') {
        const tt = (t + h.ph) % 6.5, st = tt < 3.6 ? 0 : tt < 4.9 ? 1 : 2;
        h.harm = st > 0; h.erupt = st === 2;
        const g = st === 0 ? 0.35 : st === 1 ? 0.7 + 0.5 * Math.sin(t * 24) : this.glow;
        h.disc.material.color.setRGB(g, g * 0.4, g * 0.05);
        if (near) {
          if (st === 1 && Math.random() < 0.4) this.fx.add.emit(h.x + (Math.random() - 0.5) * 2, h.y + 0.3, h.z + (Math.random() - 0.5) * 2, 0, 3 + Math.random() * 3, 0, 0xffa23a, 7, 0.4, 6);
          if (st === 2) for (let i = 0; i < 5; i++) this.fx.add.emit(h.x + (Math.random() - 0.5) * 1.6, h.y + 0.4, h.z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 5, 15 + Math.random() * 12, (Math.random() - 0.5) * 5, Math.random() < 0.5 ? 0xff5a00 : 0xffd21f, 15, 0.9, 26);
          if (st === 2 && h.was !== 2) A.sfx.geyser?.(0, 0.9);
        }
        h.was = st;
        if (st === 2) for (const r of race.racers) if ((r.x - h.x) ** 2 + (r.z - h.z) ** 2 < 7.3 && r.hopY < 2 && r.hit()) r.hopV = 13;
        continue;
      }
      let along = 0, hop = 0;
      const m = h.mesh;
      if (h.kind === 'barrel') { h.lat = A0 * Math.sin(t * 0.9 + h.ph); m.position.y = 1.05; m.rotation.z = -h.lat / 1.05; h.holder.rotation.y = s.h; }
      else if (h.kind === 'crab') { h.lat = A0 * Math.sin(t * 0.45 + h.ph); m.position.y = Math.abs(Math.sin(t * 9 + h.ph)) * 0.14; m.rotation.y = Math.sin(t * 7) * 0.12; h.holder.rotation.y = s.h + Math.PI; }
      else if (h.kind === 'penguin') {
        const v = Math.sin(t * 0.7 + h.ph), moving = Math.abs(v) < 0.66;
        h.lat = A0 * clamp(v * 1.5, -1, 1); m.rotation.z = moving ? Math.sin(t * 13) * 0.16 : 0;
        h.holder.rotation.y = moving ? Math.atan2(s.nx, s.nz) + (Math.cos(t * 0.7 + h.ph) > 0 ? 0 : Math.PI) : s.h + Math.PI;
      } else if (h.kind === 'drone') { h.lat = A0 * Math.sin(t * 0.8 + h.ph); along = Math.cos(t * 0.8 + h.ph) * 5; m.position.y = 0.3 + Math.sin(t * 3 + h.ph) * 0.25; m.rotation.y = t * 2; }
      else if (h.kind === 'star') { h.lat = A0 * Math.sin(t * 0.4 + h.ph); hop = Math.abs(Math.sin(t * 2.6 + h.ph)) * 2.8; m.position.y = hop; m.rotation.z = Math.sin(t * 2.6 + h.ph) * 0.4; h.holder.rotation.y = s.h + Math.PI; }
      else if (h.kind === 'tumbleweed') { h.lat = A0 * Math.sin(t * 0.75 + h.ph); m.position.y = 1.05 + Math.abs(Math.sin(t * 4.5 + h.ph)) * 0.7; m.rotation.z = -h.lat / 1.05; m.rotation.x = t * 1.5; h.holder.rotation.y = s.h; }
      else if (h.kind === 'windup') {
        // robot de cuerda: cruza la pista a pasitos y se para a mirar
        const v = Math.sin(t * 0.6 + h.ph), moving = Math.abs(v) < 0.7;
        h.lat = A0 * clamp(v * 1.42, -1, 1); m.rotation.z = moving ? Math.sin(t * 14) * 0.13 : 0; m.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.12 : 0;
        h.holder.rotation.y = moving ? Math.atan2(s.nx, s.nz) + (Math.cos(t * 0.6 + h.ph) > 0 ? 0 : Math.PI) : s.h + Math.PI;
      } else if (h.kind === 'asteroid') { h.lat = A0 * Math.sin(t * 0.55 + h.ph); along = Math.cos(t * 0.55 + h.ph) * 4; m.position.y = 1.5 + Math.sin(t * 1.8 + h.ph) * 0.3; m.rotation.set(t * 0.9, t * 0.6, 0); }
      h.hopY = hop;
      h.x = s.x + s.nx * h.lat + s.tx * along; h.z = s.z + s.nz * h.lat + s.tz * along;
      h.holder.position.set(h.x, h.y, h.z);
      if (h.down > 0) { h.down -= dt; h.holder.scale.setScalar(h.down > 0.5 ? 0.001 : 1 - h.down / 0.5); h.harm = false; continue; }
      h.holder.scale.setScalar(1); h.harm = hop < 1.4;
      if (!h.harm) continue;
      for (const r of race.racers) {
        if ((r.x - h.x) ** 2 + (r.z - h.z) ** 2 < 4.6 * r.sizeK && r.hopY < 1.5) {
          r.hit(); this.knock(h);
          if (r.isPlayer || near) { if (h.kind === 'barrel' || h.kind === 'asteroid') A.sfx.crash?.(); else if (h.kind === 'tumbleweed') A.sfx.thud?.(); else A.sfx.critter?.(); }
          break;
        }
      }
    }
  }

  dispose() { for (const h of this.list) { this.scene.remove(h.holder); if (h.disc) { h.disc.geometry.dispose(); h.disc.material.dispose(); } } }
}

// ---------------- Ambiente submarino ----------------
// Cuando la cámara baja de la superficie: niebla del color del líquido, luz tenue, burbujas y montañas ocultas.
export class Underwater {
  constructor({ scene, track, fx }) {
    this.scene = scene; this.track = track; this.fx = fx; this.on = false;
    this.col = new THREE.Color(track.def.theme.liquid).multiplyScalar(0.5).lerp(new THREE.Color(0x06245a), 0.35);
    this.baseCol = track.fog.color.clone(); this.baseBg = scene.background ? scene.background.clone() : null;
  }

  update(dt, cam) {
    const tr = this.track, sub = cam.y < tr.liquidLevel - 0.15;
    if (sub) {
      tr.fog.color.copy(this.col); tr.fog.near = 5; tr.fog.far = 135; if (this.baseBg) this.scene.background.copy(this.col);
      tr.setLight(0.5);
      for (let i = 0; i < 2; i++) this.fx.norm.emit(cam.x + (Math.random() - 0.5) * 44, cam.y - 5 + Math.random() * 6, cam.z + (Math.random() - 0.5) * 44, (Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6, 0xdff8ff, 3 + Math.random() * 5, 2.2, -0.8);
    } else if (this.on) {
      tr.fog.color.copy(this.baseCol); tr.fog.near = tr.baseFog[0]; tr.fog.far = tr.baseFog[1]; if (this.baseBg) this.scene.background.copy(this.baseBg);
      tr.setLight(0);
    }
    if (sub !== this.on) { this.on = sub; if (tr.farMesh) tr.farMesh.visible = !sub; }
  }
}
