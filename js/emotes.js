// Gestos: bocadillos con un emoji que flotan un momento sobre un coche.
// El del jugador sale al tocar la bocina (el gesto elegido en el garaje); los rivales sueltan alguno al adelantar o al recibir un golpe.
import * as THREE from './vendor/three.module.min.js';
import { canvasTex } from './models.js';

const FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const TAUNTS = ['😜', '😎', '😂', '👋'], DIZZY = '😵';
const SIZE = 1.7, POP = 0.16, FADE = 0.25; // tamaño en la pista y duración de la entrada y la salida (s)
const TAUNT_GAP = 4, TAUNT_P = 0.35;       // burlas de los rivales: segundos mínimos entre dos y probabilidad de cada adelantamiento

// Una textura por emoji: son pocos y sirven para todas las carreras
const texCache = new Map();
function bubbleTex(icon) {
  let tex = texCache.get(icon);
  if (!tex) texCache.set(icon, tex = canvasTex(128, 128, c => {
    // bocadillo blanco con contorno de tinta y el pico hacia abajo
    const box = () => { c.beginPath(); c.moveTo(38, 8); c.arcTo(120, 8, 120, 100, 30); c.arcTo(120, 100, 8, 100, 30); c.arcTo(8, 100, 8, 8, 30); c.arcTo(8, 8, 120, 8, 30); c.closePath(); };
    const tip = () => { c.beginPath(); c.moveTo(48, 92); c.lineTo(64, 123); c.lineTo(80, 92); c.closePath(); };
    c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = '#1a0b3a'; c.fillStyle = '#fff';
    tip(); c.stroke(); box(); c.stroke(); c.fill(); tip(); c.fill();
    c.font = '62px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1a0b3a'; c.fillText(icon, 64, 58);
  }));
  return tex;
}

export class Emotes {
  // clock(): reloj en segundos (en carrera, el de la propia carrera: la pausa también congela los bocadillos)
  // n: cuántos bocadillos puede haber a la vez (se reutilizan)
  constructor(clock, n = 4) {
    this.clock = clock; this.lastTaunt = -99;
    this.pool = Array.from({ length: n }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
      s.center.set(0.5, 0); s.renderOrder = 9; s.visible = false; s.userData.t0 = -99; s.userData.dur = 0;
      // cada bocadillo se anima solo justo antes de dibujarse: entra con un salto, flota y se desvanece
      s.onBeforeRender = () => {
        const u = s.userData, k = clock() - u.t0;
        if (k > u.dur || k < 0) { s.visible = false; s.material.opacity = 0; return; }
        const e = Math.min(1, k / POP), sc = SIZE * u.k * (e + Math.sin(e * Math.PI) * 0.28);
        s.scale.set(sc, sc, 1); s.material.opacity = Math.min(1, (u.dur - k) / FADE);
        s.position.y = u.y + (u.target.hopY || 0) + Math.sin(k * 5) * 0.07;
      };
      return s;
    });
  }

  // Muestra un emoji sobre target durante dur segundos. target: un corredor o { root: Object3D del que cuelga, emoteY: altura, emoteK: tamaño }
  show(target, icon, dur = 1.3) {
    if (!icon || !target || !target.root) return;
    const now = this.clock(), free = s => !s.visible || now - s.userData.t0 > s.userData.dur;
    const s = this.pool.find(x => x.userData.target === target) || this.pool.find(free) || this.pool.reduce((a, b) => (a.userData.t0 < b.userData.t0 ? a : b));
    if (!s.material.map) s.material.needsUpdate = true;
    s.material.map = bubbleTex(icon); s.material.opacity = 1;
    // por encima de los globos de la batalla y del cartel de «RIVAL»
    const y = target.emoteY || 4.1 + (target.balMeshes ? 1.3 : 0) + (target.isRival ? 1.5 : 0);
    Object.assign(s.userData, { target, t0: now, dur, y, k: target.emoteK || 1 });
    target.root.add(s); s.position.set(0, y, 0); s.scale.set(0.01, 0.01, 1); s.visible = true;
  }

  // Un rival que adelanta cerca del jugador se burla, pero solo de vez en cuando
  overtake(r) {
    const now = this.clock();
    if (r.isPlayer || now - this.lastTaunt < TAUNT_GAP || !r.near() || Math.random() > TAUNT_P) return;
    this.lastTaunt = now; this.show(r, TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
  }
  // Un rival golpeado ve las estrellas
  hit(r) { if (!r.isPlayer && r.near()) this.show(r, DIZZY); }

  clear() { for (const s of this.pool) { s.visible = false; s.userData.dur = 0; s.userData.target = null; s.removeFromParent(); } }

  dispose() { this.clear(); for (const s of this.pool) s.material.dispose(); }
}
