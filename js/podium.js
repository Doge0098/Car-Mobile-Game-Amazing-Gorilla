// Escena de podio: los tres primeros celebran con confeti, focos y trofeo.
import * as THREE from './vendor/three.module.min.js';
import { makeGorilla, makeKart, animateGorilla, makeTrophy, blobShadow, canvasTex } from './models.js';
import { Particles } from './fx.js';
import { KART_COLORS } from './data.js';

const CONFETTI = [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xff7a1a, 0x7a5cff, 0xffffff];
const SLOTS = [{ x: 0, h: 2.6, mode: 'dance' }, { x: -3.5, h: 1.8, mode: 'clap' }, { x: 3.5, h: 1.2, mode: 'wave' }];

export class Podium {
  constructor() {
    this.active = false; this.t = 0;
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.3, 400);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 14), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ vec3 n = normalize(vP); float h = n.y * 0.5 + 0.5;
        vec3 c = mix(vec3(0.75, 0.16, 0.72), vec3(0.06, 0.03, 0.25), smoothstep(0.38, 0.95, h));
        c = mix(vec3(1.0, 0.55, 0.15), c, smoothstep(0.3, 0.52, h));
        float rays = step(0.5, fract(atan(n.x, n.z) * 2.5465)); c += rays * 0.06 * (1.0 - h);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        }`,
    }));
    sc.add(dome);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xb070ff, 1.5));
    const d = new THREE.DirectionalLight(0xffffff, 1.9); d.position.set(3, 6, 5); sc.add(d);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshLambertMaterial({ color: 0x5a2ea8 }));
    floor.rotation.x = -Math.PI / 2; sc.add(floor);
    const carpet = new THREE.Mesh(new THREE.CircleGeometry(8.5, 40), new THREE.MeshLambertMaterial({ color: 0xff3b6a }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.02; sc.add(carpet);
    // cajones del podio con su número
    const cols = [0xffd21f, 0xcfd6e6, 0xe08a4a];
    SLOTS.forEach((s, i) => {
      const tex = canvasTex(128, 128, (c) => {
        c.fillStyle = '#' + cols[i].toString(16).padStart(6, '0'); c.fillRect(0, 0, 128, 128);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, 128, 14);
        c.font = 'italic 900 96px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 12; c.strokeStyle = '#1a0b3a'; c.strokeText(String(i + 1), 64, 70); c.fillStyle = '#fff'; c.fillText(String(i + 1), 64, 70);
      });
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.3, s.h, 3), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(s.x, s.h / 2, 0); sc.add(m);
    });
    // focos
    this.beams = [];
    const bg = new THREE.ConeGeometry(4.5, 40, 14, 1, true); bg.translate(0, -20, 0);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: [0xffd21f, 0x22e6ff, 0xff4fd8, 0x35e08a][i], transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(-12 + i * 8, 24, -6); sc.add(m); this.beams.push(m);
    }
    this.fx = new Particles(500, false); sc.add(this.fx.points);
    this.group = new THREE.Group(); sc.add(this.group);
    this.gorillas = []; this.trophy = null;
  }

  // top: [{ char, kart, color, hat, wheels }] (hasta 3; hat y wheels solo los lleva el jugador)
  setup(top) {
    this.group.clear(); this.gorillas = []; this.t = 0; this.fx.clear();
    top.slice(0, 3).forEach((r, i) => {
      const s = SLOTS[i], g = makeGorilla(r.char, null, true, r.hat);
      g.position.set(s.x, s.h, 0.2); g.scale.setScalar(1.15);
      const sh = blobShadow(2.2); sh.position.set(s.x, s.h + 0.03, 0.2);
      this.group.add(g, sh); this.gorillas.push({ g, mode: s.mode });
      if (r.kart) {
        const k = makeKart(r.kart, r.color != null ? KART_COLORS[r.color] || null : null, null, r.wheels);
        k.position.set(s.x * 1.9, 0, -5.2 - (i === 0 ? 1.2 : 0)); k.rotation.y = i === 0 ? 0 : (i === 1 ? 0.5 : -0.5);
        this.group.add(k);
      }
    });
    this.trophy = makeTrophy(); this.trophy.position.set(0, 0.9, 3.4); this.trophy.scale.setScalar(1.25);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.9, 16), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    ped.position.set(0, 0.45, 3.4);
    this.group.add(this.trophy, ped);
    this.active = true;
  }

  update(dt, aspect) {
    this.t += dt; const t = this.t;
    const portrait = aspect < 1, a = Math.sin(t * 0.35) * 0.55, d = (portrait ? 19 : 12.5) - Math.min(2.5, t * 0.5);
    this.camera.aspect = aspect; this.camera.fov = portrait ? 60 : 44; this.camera.updateProjectionMatrix();
    this.camera.position.set(Math.sin(a) * d, 4.4 + Math.sin(t * 0.5) * 0.4, Math.cos(a) * d + 1);
    this.camera.lookAt(0, 2.7, 0);
    for (const o of this.gorillas) animateGorilla(o.g, t + o.g.id * 0.37, { mode: o.mode, face: 'happy', dt });
    if (this.trophy) { this.trophy.rotation.y = t * 1.6; this.trophy.position.y = 0.9 + Math.sin(t * 2.2) * 0.12; }
    this.beams.forEach((b, i) => b.rotation.set(Math.sin(t * 0.9 + i * 1.7) * 0.35 + 0.15, 0, Math.cos(t * 0.7 + i * 2.1) * 0.4));
    for (let i = 0; i < 3; i++) {
      this.fx.emit((Math.random() - 0.5) * 18, 10 + Math.random() * 2, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2,
        CONFETTI[Math.floor(Math.random() * CONFETTI.length)], 7 + Math.random() * 5, 3.2, 3.5);
    }
    if (t < 0.3) for (const s of SLOTS) this.fx.burst(s.x, s.h + 3, 0, 8, CONFETTI, 9, 9, 1.6, 9);
  }
}
