// Partículas y efectos ambientales.
import * as THREE from './vendor/three.module.min.js';
import { glowTex } from './models.js';

const VS = `attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uScale;
void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform sampler2D map; varying vec4 vC;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a);
#include <colorspace_fragment>
}`;

export class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.size0 = new Float32Array(max); this.grow = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex() }, uScale: { value: 600 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 5;
    this._c = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0, grow = 0) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this._c.set(color);
    this.base[i * 3] = this._c.r; this.base[i * 3 + 1] = this._c.g; this.base[i * 3 + 2] = this._c.b;
    this.life[i] = this.maxLife[i] = life; this.grav[i] = grav; this.size0[i] = size; this.grow[i] = grow;
  }

  burst(x, y, z, count, color, speed, size, life, grav = 0, up = 0.5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.5 + up) * 1.6, s = speed * (0.4 + Math.random() * 0.6);
      const col = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color;
      this.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, col,
        size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav);
    }
  }

  update(dt, pixelScale) {
    this.mat.uniforms.uScale.value = pixelScale;
    const { pos, vel, life, maxLife, col, size, base } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; } continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / maxLife[i]);
      vel[i * 3 + 1] -= this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.05 && this.grav[i] > 0) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.4; }
      col[i * 4] = base[i * 3]; col[i * 4 + 1] = base[i * 3 + 1]; col[i * 4 + 2] = base[i * 3 + 2];
      col[i * 4 + 3] = Math.min(1, k * 2.2);
      size[i] = this.size0[i] * (1 + this.grow[i] * (1 - k)) * (0.35 + 0.65 * k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }

  clear() { this.life.fill(0); }
}

// Partículas ambientales que siguen a la cámara (luciérnagas, nieve, ascuas...)
export class Ambient {
  constructor(kind, color, count = 130) {
    this.kind = kind; this.count = count; this.box = 90;
    this.off = new Float32Array(count * 3); this.ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.off[i * 3] = Math.random() * this.box; this.off[i * 3 + 1] = Math.random() * 26; this.off[i * 3 + 2] = Math.random() * this.box;
      this.ph[i] = Math.random() * 6.283;
    }
    this.pos = new Float32Array(count * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const big = kind === 'bubbles' || kind === 'stars';
    this.mat = new THREE.PointsMaterial({
      color, size: kind === 'snow' ? 0.5 : big ? 0.8 : 0.6, map: glowTex(), transparent: true, depthWrite: false,
      blending: kind === 'snow' || kind === 'bubbles' ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, opacity: 0.9,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 4;
  }

  update(t, cam) {
    const b = this.box, vy = this.kind === 'snow' ? -5 : this.kind === 'embers' ? 4 : this.kind === 'bubbles' ? 1.5 : 0.4;
    const drift = this.kind === 'snow' ? 1.5 : 2.5;
    for (let i = 0; i < this.count; i++) {
      const ph = this.ph[i];
      const x = this.off[i * 3] + Math.sin(t * 0.7 + ph) * drift, y = this.off[i * 3 + 1] + vy * t, z = this.off[i * 3 + 2] + Math.cos(t * 0.6 + ph) * drift;
      this.pos[i * 3] = cam.x + ((((x - cam.x) % b) + b) % b) - b / 2;
      this.pos[i * 3 + 1] = (((y % 26) + 26) % 26) + 0.3;
      this.pos[i * 3 + 2] = cam.z + ((((z - cam.z) % b) + b) % b) - b / 2;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    if (this.kind === 'fireflies' || this.kind === 'stars') this.mat.opacity = 0.65 + Math.sin(t * 3) * 0.25;
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}
