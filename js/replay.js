// Repetición de la carrera: graba la posición de todos los coches y la reproduce con cámaras de cine.
// También graba los objetos lanzados (cáscaras, cocos y barriles), las ondas del golpe de pecho, los rayos y los obstáculos
// derribados, y en los modos especiales los eliminados y los globos: así en la repetición se ve por qué pasa cada cosa.
import * as THREE from './vendor/three.module.min.js';
import { makeHazard } from './models.js';
import { addOutline } from './outline.js';

const STEP = 0.1, F = 8; // datos por coche: x, z, rumbo, salto, banderas, volante, velocidad, altura
// banderas: 1 derrape · 2 turbo · 4 trompo · 8 furia · 16 eliminado · 32 escudo · 64 encogido · 128 lanzando · 256-512 modo
//  1024 golpe de pecho · 2048-8192 globos que le quedan · 16384 protección (parpadea tras perder un globo)
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const MODES = [null, 'boat', 'glide', 'sub'];
const PEEL = 0, COCO = 1, BARREL = 2, W = [3, 3, 4]; // objetos lanzados y números por muestra (x, y, z y, en el barril, hacia dónde rueda)
const ITEM_MAX = 24000, EVENT_MAX = 300;             // topes de memoria: números guardados de objetos, y ondas y rayos
const WAVE_T = 0.55, BOLT_T = 0.35;                  // lo que duran la onda y el rayo (como en la carrera)
// lo que la repetición cambia en cada coche y hay que devolver a su sitio al terminar
const KEEP = ['finished', 'prog', 'idx', 'x', 'z', 'h', 'y', 'hopY', 'hopV', 'speed', 'vx', 'vz', 'steer', 'slopeF', 'off', 'drifting', 'driftDir', 'charge',
  'spinT', 'boostT', 'furyT', 'shieldT', 'shrinkT', 'poundT', 'tauntT', 'lookT', 'trickT', 'throwT', 'modeT', 'alt'];
const BOLT_OFF = [[0, 0], [0.25, 0], [-0.25, 0.1], [0, 0.25], [0.1, -0.25]]; // trazos del rayo, para que se vea grueso

export class Replay {
  constructor(race) {
    this.race = race; this.n = race.racers.length; this.frames = []; this.acc = STEP; this.playing = false; this.t = 0;
    this.cut = -1; this.camFix = { x: 0, y: 0, z: 0 }; this.fov = 50;
    // objetos: una pista por objeto { k: tipo, f0: primera muestra, last: última, n: muestras guardadas, d: posiciones }
    this.items = []; this.alive = new Map(); this.itemN = 0;
    this.events = []; this.seen = new WeakSet(); // sucesos: instante, tipo (0 onda, 1 rayo, 2 obstáculo derribado), x, y, z (o nº de obstáculo)
    this.t0 = 0; this.hzDown = []; this.noRacers = { player: race.player, racers: [] }; // reloj de la carrera en la primera muestra y obstáculos caídos
    this.pool = [[], [], []]; this.used = [0, 0, 0]; this.wavePool = []; this.boltPool = []; // copias que se ven en la repetición
  }

  // Guarda una muestra cada décima de segundo (máximo ~4 minutos)
  record(dt) {
    this.acc += dt; if (this.acc < STEP || this.frames.length > 2400) return;
    this.acc -= STEP;
    const f = new Float32Array(this.n * F);
    this.race.racers.forEach((r, i) => {
      const o = i * F;
      f[o] = r.x; f[o + 1] = r.z; f[o + 2] = r.h; f[o + 3] = r.hopY;
      f[o + 4] = (r.drifting ? 1 : 0) | (r.boostT > 0 ? 2 : 0) | (r.spinT > 0 ? 4 : 0) | (r.furyT > 0 ? 8 : 0) | (r.out ? 16 : 0) | (r.shieldT > 0 ? 32 : 0) | (r.shrinkT > 0 ? 64 : 0)
        | (r.throwT > 0 ? 128 : 0) | (Math.max(0, MODES.indexOf(r.mode)) << 8) | (r.poundT > 0 ? 1024 : 0) | (Math.max(0, Math.min(7, r.balloons | 0)) << 11) | (r.graceT > 0 ? 16384 : 0);
      f[o + 5] = r.steer; f[o + 6] = r.speed; f[o + 7] = r.y;
    });
    this.frames.push(f);
    if (this.frames.length === 1) this.t0 = this.race.t;
    this.recordItems(this.frames.length - 1);
  }

  // Objetos de la pista en esta muestra. Los datos son pocos: 3 números por cáscara y 3 o 4 por muestra de coco o barril.
  recordItems(fi) {
    const race = this.race;
    this.scan(race.peels, PEEL, fi); this.scan(race.cocos, COCO, fi); this.scan(race.barrels, BARREL, fi);
    // los que ya no están (chocaron o caducaron) cierran su pista y sueltan la memoria que les sobra
    for (const [o, tk] of this.alive) {
      if (tk.last === fi) continue;
      this.alive.delete(o);
      const len = tk.n * W[tk.k]; if (len < tk.d.length) { this.itemN -= tk.d.length - len; tk.d = tk.d.slice(0, len); }
    }
    const t = fi * STEP, E = this.events;
    for (const w of race.waves) {
      if (this.seen.has(w) || E.length >= EVENT_MAX * 5) continue;
      this.seen.add(w); const p = w.mesh.position; E.push(t - w.t, 0, p.x, p.y, p.z);
    }
    for (const b of race.bolts) {
      if (this.seen.has(b) || E.length >= EVENT_MAX * 5) continue;
      this.seen.add(b);
      // el rayo cae del cielo: su punto más bajo es donde golpea
      const a = b.line.geometry.attributes.position; let m = 0;
      for (let i = 1; i < a.count; i++) if (a.getY(i) < a.getY(m)) m = i;
      E.push(t - b.t, 1, a.getX(m), a.getY(m), a.getZ(m));
    }
    // obstáculos del mapa: se mueven según el reloj de la carrera, así que basta apuntar cuándo derriban uno
    const hz = race.hazards.list;
    for (let i = 0; i < hz.length; i++) {
      const down = hz[i].down > 0;
      if (down && !this.hzDown[i] && E.length < EVENT_MAX * 5) E.push(t - STEP / 2, 2, i, 0, 0);
      this.hzDown[i] = down;
    }
  }

  scan(list, kind, fi) {
    const w = W[kind];
    for (const o of list) {
      let tk = this.alive.get(o);
      if (!tk) {
        if (this.itemN + 8 * w > ITEM_MAX) continue; // memoria llena: el resto de objetos no se graba
        tk = { k: kind, f0: fi, last: fi, n: 0, d: new Float32Array(kind === PEEL ? w : 8 * w) };
        this.itemN += tk.d.length; this.alive.set(o, tk); this.items.push(tk);
      }
      tk.last = fi;
      if (kind === PEEL && tk.n) continue; // la cáscara no se mueve
      let i = tk.n * w;
      if (i + w > tk.d.length) { // la pista crece según haga falta
        if (this.itemN + tk.d.length > ITEM_MAX) continue;
        const d = new Float32Array(tk.d.length * 2); d.set(tk.d); this.itemN += tk.d.length; tk.d = d;
      }
      const m = kind === BARREL ? o.holder : o.mesh, p = m.position;
      tk.d[i] = p.x; tk.d[i + 1] = p.y; tk.d[i + 2] = p.z; if (kind === BARREL) tk.d[i + 3] = m.rotation.y;
      tk.n++;
    }
  }

  get duration() { return (this.frames.length - 1) * STEP; }
  // memoria que ocupa lo grabado, en bytes (coches + objetos + ondas y rayos)
  get bytes() { return this.frames.length * this.n * F * 4 + this.itemN * 4 + this.events.length * 8; }

  start() {
    const race = this.race, tr = race.track, f0 = this.frames[0];
    this.playing = true; this.t = 0; this.cut = -1; this.pfi = 0; this.ev0 = 0; race.replaying = true; race.state = 'replay';
    // estado real de la carrera, para dejarlo todo exactamente igual al terminar
    this.keep = race.racers.map(r => {
      const k = { mode: r.mode, root: r.root.visible, tilt: r.tilt.visible, pos: r.root.position.clone(), rot: r.root.rotation.y, balloons: r.balloons, bal: r.balMeshes ? r.balMeshes.map(g => g.visible) : null, v: {} };
      for (const key of KEEP) k.v[key] = r[key];
      return k;
    });
    // lo que quedó en la pista (objetos, ondas, rayos y anillos) se esconde: la repetición enseña sus propias copias
    this.hid = [];
    const hide = o => { this.hid.push(o, o.visible); o.visible = false; };
    for (const p of race.peels) hide(p.mesh);
    for (const c of race.cocos) hide(c.mesh);
    for (const b of race.barrels) hide(b.holder);
    for (const w of race.waves) hide(w.mesh);
    for (const b of race.bolts) hide(b.line);
    for (const s of race.shocks) hide(s.mesh);
    const gh = race.ghost;
    if (gh) { this.ghostKeep = { v: gh.visible, x: gh.position.x, y: gh.position.y, z: gh.position.z, h: gh.rotation.y }; gh.visible = false; this.gIdx = race.ghostData ? tr.locate(race.ghostData[0], race.ghostData[1], 0, tr.N) : 0; }
    // los obstáculos vuelven a estar todos en pie
    this.hzKeep = race.hazards.list.map(h => ({ down: h.down, harm: h.harm, was: h.was }));
    for (const h of race.hazards.list) h.down = 0;
    this.wasOut = new Uint8Array(this.n);
    race.racers.forEach((r, i) => {
      const o = i * F, fl = f0[o + 4] | 0, mode = MODES[(fl >> 8) & 3];
      r.finished = false; r.spinT = 0; r.boostT = 0; r.poundT = 0; r.tauntT = 0; r.lookT = 0; r.trickT = 0; r.throwT = 0;
      // todos vuelven a la parrilla, con el vehículo y los globos que tenían al empezar
      r.x = f0[o]; r.z = f0[o + 1]; r.y = f0[o + 7]; r.idx = tr.locate(r.x, r.z, r.idx, tr.N);
      if (mode !== r.mode) race.setMode(r, mode, true);
      if (r.balMeshes) r.balloons = Math.min(r.balMeshes.length, (fl >> 11) & 7);
      r.root.visible = true; r.tilt.visible = true; r.trail.reset(r.x, r.y, r.z);
    });
  }

  stop() {
    if (!this.playing) return;
    const race = this.race; this.playing = false; race.replaying = false; race.state = 'finished';
    race.racers.forEach((r, i) => {
      const k = this.keep[i];
      if (k.mode !== r.mode) race.setMode(r, k.mode, true);
      Object.assign(r, k.v);
      if (r.balMeshes) { r.balloons = k.balloons; k.bal.forEach((v, j) => { r.balMeshes[j].visible = v; }); }
      r.root.visible = k.root; r.tilt.visible = k.tilt; r.root.position.copy(k.pos); r.root.rotation.y = k.rot;
      r.trail.reset(r.x, r.y, r.z); r.trail.mesh.visible = false; // la estela vuelve sola en cuanto el coche la necesite
    });
    for (let i = 0; i < this.hid.length; i += 2) this.hid[i].visible = this.hid[i + 1];
    race.hazards.list.forEach((h, i) => Object.assign(h, this.hzKeep[i])); // se recolocan solos en cuanto sigue la carrera
    const gh = race.ghost, gk = this.ghostKeep;
    if (gh && gk) { gh.visible = gk.v; gh.position.set(gk.x, gk.y, gk.z); gh.rotation.y = gk.h; }
    // fuera las copias de la repetición
    for (const pool of this.pool) { for (const m of pool) race.scene.remove(m); pool.length = 0; }
    for (const m of this.wavePool) { race.scene.remove(m); m.material.dispose(); }
    for (const l of this.boltPool) { race.scene.remove(l); l.geometry.dispose(); l.material.dispose(); }
    this.wavePool.length = 0; this.boltPool.length = 0;
    this.keep = this.hid = this.ghostKeep = this.hzKeep = null;
  }

  // Copia de un objeto para la repetición (se reutilizan mientras dura)
  mesh(kind) {
    const race = this.race, pool = this.pool[kind], i = this.used[kind]++;
    let m = pool[i];
    if (!m) {
      if (kind === BARREL) { m = new THREE.Group(); const b = makeHazard('barrel'); b.castShadow = !!race.shadows; b.scale.setScalar(0.85); m.add(b); }
      else { m = new THREE.Mesh(kind === PEEL ? race.peelGeo : race.cocoGeo, kind === PEEL ? race.peelMat : race.cocoMat); m.castShadow = !!race.shadows; addOutline(m); }
      race.scene.add(m); pool.push(m);
    }
    m.visible = true;
    return m;
  }

  // Objetos lanzados tal como estaban en el instante fi (en muestras)
  playItems(fi) {
    const race = this.race, fx = race.fx, used = this.used, lastF = this.frames.length - 1;
    used[0] = used[1] = used[2] = 0;
    for (const tk of this.items) {
      if (fi < tk.f0) break; // las pistas van por orden de aparición
      const end = tk.last + 1, w = W[tk.k], d = tk.d, n = tk.n, gone = fi >= end;
      // al desaparecer (por un choque o por caducar), el coco y el barril estallan donde estaban
      if (gone && (tk.k === PEEL || this.pfi >= end || tk.last >= lastF)) continue;
      if (tk.k === PEEL) { const m = this.mesh(PEEL); m.position.set(d[0], d[1], d[2]); m.rotation.y = this.t * 2 + tk.f0; continue; }
      // entre dos muestras se interpola; tras la última, sigue su trayectoria hasta la siguiente
      const j = (gone ? end : fi) - tk.f0, j0 = Math.min(Math.floor(j), n - 1), o = j0 * w, k = Math.min(1, j - j0);
      const b1 = j0 + 1 < n ? o + w : o, b0 = j0 + 1 < n ? o : Math.max(0, o - w);
      const x = d[o] + (d[b1] - d[b0]) * k, y = d[o + 1] + (d[b1 + 1] - d[b0 + 1]) * k, z = d[o + 2] + (d[b1 + 2] - d[b0 + 2]) * k;
      if (gone) {
        if (tk.k === COCO) fx.add.burst(x, y, z, 18, [0x7a4a22, 0xffffff, 0xffb060], 9, 8, 0.5, 10);
        else fx.norm.burst(x, y, z, 16, [0xa8643a, 0x6a3a1a, 0xffd21f], 10, 10, 0.7, 14);
        continue;
      }
      const m = this.mesh(tk.k); m.position.set(x, y, z);
      if (tk.k === COCO) { m.rotation.x = this.t * 12; fx.add.emit(x, y, z, 0, 1, 0, 0xffb060, 7, 0.3); }
      else { m.rotation.y = d[o + 3]; m.children[0].rotation.x = this.t * 9; }
    }
    for (let k = 0; k < 3; k++) for (let i = used[k]; i < this.pool[k].length; i++) this.pool[k][i].visible = false;
    this.pfi = fi;
  }

  // Ondas del golpe de pecho y rayos activos en este instante, y obstáculos que caen justo ahora
  playEvents(dt) {
    const race = this.race, E = this.events, t = this.t; let nw = 0, nb = 0;
    while (this.ev0 < E.length && E[this.ev0] + 0.8 < t) this.ev0 += 5;
    for (let i = this.ev0; i < E.length && E[i] <= t + 0.2; i += 5) {
      const age = t - E[i], bolt = E[i + 1] === 1;
      if (E[i + 1] === 2) { const h = race.hazards.list[E[i + 2]]; if (h && age >= 0 && age < dt) race.hazards.knock(h); continue; }
      if (age < 0 || age >= (bolt ? BOLT_T : WAVE_T)) continue;
      if (!bolt) {
        let m = this.wavePool[nw++];
        if (!m) {
          m = new THREE.Mesh(race.waveGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a3c).multiplyScalar(race.glowK), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
          m.rotation.x = -Math.PI / 2; race.scene.add(m); this.wavePool.push(m);
        }
        const k = age / WAVE_T; m.visible = true; m.position.set(E[i + 2], E[i + 3], E[i + 4]); m.scale.setScalar(1 + k * 30); m.material.opacity = 0.85 * (1 - k);
      } else {
        let l = this.boltPool[nb++];
        if (!l) {
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_OFF.length * 14 * 3), 3));
          l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0xfff6a0).multiplyScalar(race.bloom ? 3 : 1), transparent: true, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));
          l.frustumCulled = false; l.userData.ev = -1; race.scene.add(l); this.boltPool.push(l);
        }
        if (l.userData.ev !== i) { // rayo nuevo: zigzag desde el cielo hasta el coche
          l.userData.ev = i;
          const a = l.geometry.attributes.position, zx = [0], zz = [0]; let v = 0;
          for (let s = 1; s <= 7; s++) { zx.push(s < 7 ? (Math.random() - 0.5) * 7 : 0); zz.push(s < 7 ? (Math.random() - 0.5) * 7 : 0); }
          for (const [ox, oz] of BOLT_OFF) for (let s = 0; s < 7; s++) for (let j = s; j <= s + 1; j++) { const q = 1 - j / 7; a.setXYZ(v++, E[i + 2] + zx[j] + q * 6 + ox, E[i + 3] + q * 70, E[i + 4] + zz[j] + oz); }
          a.needsUpdate = true;
          race.fx.add.burst(E[i + 2], E[i + 3] + 0.2, E[i + 4], 16, [0xfff6a0, 0xffffff], 9, 9, 0.4);
        }
        l.visible = true; l.material.opacity = (1 - age / BOLT_T) * (Math.random() < 0.3 ? 0.3 : 1);
      }
    }
    for (let i = nw; i < this.wavePool.length; i++) this.wavePool[i].visible = false;
    for (let i = nb; i < this.boltPool.length; i++) this.boltPool[i].visible = false;
  }

  // Devuelve false cuando la repetición termina
  update(dt, cam) {
    const race = this.race, tr = race.track, fx = race.fx;
    if (!this.playing) return false;
    this.t += dt; race.t += dt;
    const fi = this.t / STEP, i0 = Math.floor(fi), k = fi - i0;
    if (i0 + 1 >= this.frames.length) { this.stop(); return false; }
    const a = this.frames[i0], b = this.frames[i0 + 1];
    race.racers.forEach((r, i) => {
      const o = i * F, fl = a[o + 4] | 0;
      r.x = a[o] + (b[o] - a[o]) * k; r.z = a[o + 1] + (b[o + 1] - a[o + 1]) * k; r.h = a[o + 2] + wrapA(b[o + 2] - a[o + 2]) * k;
      r.hopY = a[o + 3] + (b[o + 3] - a[o + 3]) * k; r.steer = a[o + 5] + (b[o + 5] - a[o + 5]) * k; r.speed = a[o + 6] + (b[o + 6] - a[o + 6]) * k; r.y = a[o + 7] + (b[o + 7] - a[o + 7]) * k;
      r.vx = Math.sin(r.h) * r.speed; r.vz = Math.cos(r.h) * r.speed; r.hopV = 0; r.t += dt;
      r.idx = tr.locate(r.x, r.z, r.idx, 20); r.slopeF = tr.samples[r.idx].slope;
      r.drifting = !!(fl & 1); if (r.drifting) { r.driftDir = Math.sign(r.steer) || 1; r.charge = 1; } else r.charge = 0;
      r.boostT = fl & 2 ? 0.2 : 0; r.furyT = fl & 8 ? 0.2 : 0; r.shieldT = fl & 32 ? 0.2 : 0; r.shrinkT = fl & 64 ? 0.2 : 0;
      // eliminado: humo y fuera (el jugador sigue a la vista, como en la carrera)
      const out = !!(fl & 16), vis = !out || r.isPlayer;
      if (out && !this.wasOut[i]) {
        fx.norm.burst(r.x, r.y + 1.2, r.z, 30, [0xffffff, 0xdddddd, 0x9aa0b0], 12, 16, 0.9, 4);
        fx.add.burst(r.x, r.y + 1.5, r.z, 20, [0xffd21f, 0xff5a3c], 10, 9, 0.6, 10);
      }
      this.wasOut[i] = out ? 1 : 0;
      // golpe: chispas y anillo al empezar el trompo
      if (fl & 4 && r.spinT <= 0 && vis) {
        fx.add.burst(r.x, r.y + 1.5, r.z, 26, [0xffe21f, 0xffffff, 0xff5a3c], 11, 8, 0.7, 12);
        if ((race.camPos.x - r.x) ** 2 + (race.camPos.z - r.z) ** 2 < 3600) race.shock(r.x, r.y + 1.2, r.z, 0xff5a3c, 6);
      }
      r.spinT = fl & 4 ? (r.spinT > 0.05 ? r.spinT - dt : 1.25) : 0;
      r.throwT = fl & 128 ? (r.throwT > 0 ? Math.max(0.001, r.throwT - dt) : 0.4) : 0; r.poundT = fl & 1024 ? 0.2 : 0;
      r.off = Math.abs((r.x - tr.samples[r.idx].x) * tr.samples[r.idx].nx + (r.z - tr.samples[r.idx].z) * tr.samples[r.idx].nz) > tr.hw + 1.6 && !tr.samples[r.idx].zone;
      const mode = MODES[(fl >> 8) & 3]; if (mode !== r.mode) race.setMode(r, mode);
      // batalla: los globos que le quedaban en ese momento (revientan al perderlos) y el parpadeo de la protección
      const bm = r.balMeshes;
      if (bm) {
        const nb = Math.min(bm.length, (fl >> 11) & 7);
        for (let j = nb; j < r.balloons && vis; j++) fx.add.burst(r.x, r.y + 3.6, r.z, 16, [bm[j].children[0].material.color.getHex(), 0xffffff], 9, 8, 0.5, 8);
        r.balloons = nb;
        for (let j = 0; j < bm.length; j++) { const g = bm[j]; g.visible = j < nb; if (g.visible) g.rotation.x = Math.sin(race.t * 3 + g.userData.ph) * 0.12 - Math.min(0.5, r.speed * 0.006); }
        r.tilt.visible = !(fl & 16384) || Math.sin(race.t * 28) > -0.2;
      }
      r.root.visible = vis; if (!vis) r.trail.mesh.visible = false;
      if (vis) r.visuals(dt, race.t);
    });
    this.playItems(fi); this.playEvents(dt);
    race.hazards.update(dt, this.t0 + this.t, this.noRacers); // los obstáculos se mueven como en la carrera, sin chocar con nadie
    // fantasma de la contrarreloj: también repite su vuelta
    const gh = race.ghost, g = race.ghostData;
    if (gh && g) {
      gh.visible = (i0 + 1) * 3 < g.length;
      if (gh.visible) {
        const p = i0 * 3, q = p + 3, gx = g[p] + (g[q] - g[p]) * k, gz = g[p + 1] + (g[q + 1] - g[p + 1]) * k;
        this.gIdx = tr.locate(gx, gz, this.gIdx, 20);
        gh.position.set(gx, tr.yAt(gx, gz, this.gIdx), gz); gh.rotation.y = g[p + 2] + wrapA(g[q + 2] - g[p + 2]) * k;
      }
    }
    // cámaras: cambia de plano cada 5 segundos
    const p = race.player, cut = Math.floor(this.t / 5), kind = cut % 4, py = p.y + p.hopY;
    const fx0 = Math.sin(p.h), fz = Math.cos(p.h);
    if (cut !== this.cut) {
      this.cut = cut;
      if (kind === 0) { const s = tr.samples[(p.idx + 24) % tr.N], side = cut % 8 < 4 ? 1 : -1, lat = Math.min(tr.hw + 7, s.lim) * side; this.camFix.x = s.x + s.nx * lat; this.camFix.z = s.z + s.nz * lat; this.camFix.y = s.y + s.air + 3.2; }
    }
    let fov = 50;
    if (kind === 0) { cam.position.set(this.camFix.x, this.camFix.y, this.camFix.z); fov = 38; }
    else if (kind === 1) cam.position.set(p.x + fx0 * 10 + fz * 2.5, py + 2.6, p.z + fz * 10 - fx0 * 2.5);
    else if (kind === 2) { cam.position.set(p.x - fx0 * 17, py + 11, p.z - fz * 17); fov = 56; }
    else cam.position.set(p.x + fz * 11 - fx0 * 2, py + 2.4, p.z - fx0 * 11 - fz * 2);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.lookAt(p.x, py + 1.3, p.z);
    race.camPos.copy(cam.position);
    return true;
  }
}
