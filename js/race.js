// Lógica de carrera: física arcade, rivales IA, power-ups, cámara y fantasma.
import * as THREE from './vendor/three.module.min.js';
import { CHARACTERS, KARTS, LAPS, RACERS, charById, kartById, KART_COLORS } from './data.js';
import { makeGorilla, makeKart, animateGorilla, animateKart, blobShadow, toon } from './models.js';
import { sfx } from './audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const DRIFT_COLORS = [0xffffff, 0x38b6ff, 0xff9a1a, 0xe04dff];

class Racer {
  constructor(race, slot, char, kart, color, isPlayer) {
    this.race = race; this.char = char; this.kartDef = kart; this.isPlayer = isPlayer; this.slot = slot;
    const sp = isPlayer ? char.stats.speed + kart.stats.speed : 7;
    const ac = isPlayer ? char.stats.accel + kart.stats.accel : 7;
    const hd = isPlayer ? char.stats.handling + kart.stats.handling : 7;
    this.maxSpeed = 50 + sp * 1.7; this.accel = 20 + ac * 2.2; this.turnRate = 1.75 + hd * 0.07; this.grip = 6 + hd * 0.4;

    const g = race.track.grid(slot);
    this.x = g.x; this.z = g.z; this.h = g.h; this.idx = g.idx;
    this.prog = g.idx - race.track.N;
    this.vx = 0; this.vz = 0; this.speed = 0; this.steer = 0;
    this.drifting = false; this.driftDir = 0; this.charge = 0;
    this.boostT = 0; this.spinT = 0; this.shieldT = 0; this.furyT = 0; this.poundT = 0;
    this.hopY = 0; this.hopV = 0; this.lat = 0; this.off = false;
    this.item = null; this.itemCount = 0; this.rolling = 0; this.useDelay = 0;
    this.bananas = 0; this.finished = false; this.finishTime = 0; this.pos = slot + 1;
    this.wrongT = 0; this.t = Math.random() * 10; this.bumpCd = 0; this.sizeK = 1;
    // IA
    this.lane = (Math.random() - 0.5) * race.track.hw * 1.1; this.ph = Math.random() * 6.28;
    this.skill = (Math.random() - 0.5) * 0.05;

    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.root.add(this.tilt);
    this.kart = makeKart(kart, color); this.tilt.add(this.kart);
    this.gorilla = makeGorilla(char); this.gorilla.position.set(0, 0.52, -0.5); this.gorilla.scale.setScalar(0.95);
    this.tilt.add(this.gorilla);
    this.shadow = blobShadow(); this.root.add(this.shadow);
    this.shield = new THREE.Mesh(race.shieldGeo, race.shieldMat); this.shield.position.y = 1.3; this.shield.visible = false;
    this.tilt.add(this.shield);
    this.root.position.set(this.x, 0, this.z); this.root.rotation.y = this.h;
    race.scene.add(this.root);
  }

  boost(t) { this.boostT = Math.max(this.boostT, t); }

  hit() {
    if (this.furyT > 0 || this.spinT > 0) return false;
    const fx = this.race.fx;
    if (this.shieldT > 0) {
      this.shieldT = 0;
      fx.add.burst(this.x, 1.4, this.z, 24, [0x35e08a, 0xffffff], 9, 7, 0.5);
      if (this.isPlayer || this.near()) sfx.shieldBreak();
      return false;
    }
    this.spinT = 1.25; this.drifting = false; this.charge = 0; this.hopV = 7.5; this.boostT = 0;
    this.bananas = Math.max(0, this.bananas - 3);
    fx.add.burst(this.x, 1.5, this.z, 26, [0xffe21f, 0xffffff, 0xff5a3c], 11, 8, 0.7, 12);
    if (this.isPlayer) { sfx.hit(); this.race.shake = 0.5; } else if (this.near()) sfx.bump();
    return true;
  }

  near() { const p = this.race.player; return (p.x - this.x) ** 2 + (p.z - this.z) ** 2 < 2500; }

  step(dt, ctl) {
    const race = this.race, tr = race.track, N = tr.N, fx = race.fx;
    this.t += dt;
    this.boostT = Math.max(0, this.boostT - dt); this.shieldT = Math.max(0, this.shieldT - dt);
    this.furyT = Math.max(0, this.furyT - dt); this.poundT = Math.max(0, this.poundT - dt);
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    const spinning = this.spinT > 0;
    if (spinning) this.spinT -= dt;

    let max = this.maxSpeed * (ctl.maxK || 1) * (1 + Math.min(this.bananas, 10) * 0.006);
    if (this.off && this.furyT <= 0 && this.boostT <= 0) max *= 0.5;
    if (this.furyT > 0) max *= 1.16;
    if (this.boostT > 0) max *= 1.36;

    // aceleración
    if (spinning) this.speed -= this.speed * 2.4 * dt;
    else if (ctl.brake) this.speed = Math.max(-13, this.speed - 55 * dt);
    else if (ctl.accel) {
      if (this.speed < max) this.speed += this.accel * dt * (this.boostT > 0 ? 2.4 : 1) * (1.2 - 0.75 * Math.max(0, this.speed) / max);
    } else this.speed -= this.speed * 0.9 * dt;
    if (this.speed > max) this.speed -= (this.speed - max) * Math.min(1, 2.6 * dt);

    // derrape
    const steer = spinning ? 0 : clamp(ctl.steer, -1, 1);
    this.steer += (steer - this.steer) * Math.min(1, dt * 12);
    if (!this.drifting) {
      if (ctl.drift && !spinning && Math.abs(steer) > 0.25 && this.speed > 24 && this.hopY <= 0.01) {
        this.drifting = true; this.driftDir = Math.sign(steer); this.charge = 0; this.hopV = 4.2;
      }
    } else {
      this.charge += dt * (0.75 + 0.5 * Math.max(0, steer * this.driftDir));
      if (!ctl.drift || this.speed < 16 || spinning) {
        const lvl = this.driftLevel();
        if (lvl > 0 && !spinning && this.speed >= 16) {
          this.boost([0, 0.7, 1.25, 1.9][lvl]);
          if (this.isPlayer) sfx.miniturbo();
          fx.add.burst(this.x, 0.6, this.z, 16, DRIFT_COLORS[lvl], 8, 7, 0.4);
        }
        this.drifting = false; this.charge = 0;
      }
    }
    // giro
    let yaw;
    if (this.drifting) yaw = (this.driftDir * 0.72 + steer * 0.58) * this.turnRate * 1.05;
    else yaw = steer * this.turnRate * clamp(this.speed / 16, -1, 1) * (1 - 0.18 * clamp(this.speed / max, 0, 1));
    this.h -= yaw * dt;

    // velocidad con agarre (permite deslizar)
    const fxd = Math.sin(this.h), fzd = Math.cos(this.h);
    let g = this.drifting ? 2.7 : this.grip; if (this.off) g *= 0.7;
    const k = Math.min(1, g * dt);
    this.vx += (fxd * this.speed - this.vx) * k; this.vz += (fzd * this.speed - this.vz) * k;
    this.x += this.vx * dt; this.z += this.vz * dt;

    // salto visual
    if (this.hopY > 0 || this.hopV > 0) {
      this.hopV -= 30 * dt; this.hopY += this.hopV * dt;
      if (this.hopY <= 0) { this.hopY = 0; this.hopV = 0; }
    }

    // posición en el circuito
    const ni = tr.locate(this.x, this.z, this.idx);
    let d = ni - this.idx; if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    this.prog += d; this.idx = ni;
    const s = tr.samples[ni];
    let lat = (this.x - s.x) * s.nx + (this.z - s.z) * s.nz;
    if (Math.abs(lat) > tr.limit) {
      const sg = Math.sign(lat), over = lat - sg * tr.limit;
      this.x -= s.nx * over; this.z -= s.nz * over; lat = sg * tr.limit;
      const vn = this.vx * s.nx + this.vz * s.nz;
      if (vn * sg > 0) { this.vx -= s.nx * vn; this.vz -= s.nz * vn; }
      this.speed -= this.speed * 1.2 * dt;
    }
    this.lat = lat; this.off = Math.abs(lat) > tr.hw + 1.6;

    // sentido contrario
    const fwdDot = fxd * s.tx + fzd * s.tz;
    this.wrongT = fwdDot < -0.25 && this.speed > 5 ? this.wrongT + dt : 0;

    if (race.state === 'racing' || race.state === 'finished') this.pickups(dt);
    if (this.rolling > 0) {
      this.rolling -= dt;
      if (this.rolling <= 0) { this.item = race.rollItem(this); this.itemCount = 1; this.useDelay = 1 + Math.random() * 3.5; if (this.isPlayer) sfx.item(); }
    }
    if (!this.finished && this.prog >= LAPS * N && (race.state === 'racing' || race.state === 'finished')) race.finishRacer(this);
  }

  driftLevel() { return this.charge > 2.6 ? 3 : this.charge > 1.6 ? 2 : this.charge > 0.75 ? 1 : 0; }

  pickups() {
    const race = this.race, tr = race.track, N = tr.N, fx = race.fx;
    for (const p of tr.pads) {
      const dx = this.x - p.x, dz = this.z - p.z;
      if (dx * dx + dz * dz < 12 && this.boostT < 0.6) {
        this.boost(1.15);
        if (this.isPlayer) sfx.boost();
      }
    }
    for (const b of tr.bananas) {
      if (!b.active) continue;
      let di = b.idx - this.idx; if (di > N / 2) di -= N; if (di < -N / 2) di += N;
      if (di > 5 || di < -5) continue;
      const dx = this.x - b.x, dz = this.z - b.z;
      if (dx * dx + dz * dz < 5.3) {
        b.active = false; b.timer = 14; this.bananas++;
        if (this.isPlayer) { sfx.coin(); fx.add.burst(b.x, 1.2, b.z, 8, 0xffe21f, 5, 5, 0.35); }
      }
    }
    if (race.mode !== 'time') for (const b of tr.itemBoxes) {
      if (!b.active) continue;
      const dx = this.x - b.x, dz = this.z - b.z;
      if (dx * dx + dz * dz < 6.5) {
        b.active = false; b.timer = 3.5; b.mesh.visible = false;
        fx.add.burst(b.x, 1.5, b.z, 22, [0xff4fd8, 0xffd21f, 0x22e6ff, 0xffffff], 10, 8, 0.5, 8);
        if (!this.item && this.rolling <= 0 && !this.finished) { this.rolling = 1.3; }
        if (this.isPlayer) sfx.tick();
      }
    }
  }

  visuals(dt, t) {
    const race = this.race, fx = race.fx;
    this.root.position.set(this.x, 0, this.z); this.root.rotation.y = this.h;
    let yawOff = this.drifting ? -this.driftDir * 0.42 : 0;
    if (this.spinT > 0) yawOff += (1.25 - this.spinT) / 1.25 * Math.PI * 4;
    const ty = this.tilt.rotation;
    ty.y += wrapA(yawOff - ty.y) * Math.min(1, dt * (this.spinT > 0 ? 30 : 9));
    ty.z += ((this.drifting ? -this.driftDir * 0.1 : -this.steer * 0.05) - ty.z) * Math.min(1, dt * 8);
    ty.x = -this.hopV * 0.012 - (this.boostT > 0 ? 0.06 : 0);
    this.tilt.position.y = this.hopY;
    const targetSize = this.furyT > 0 ? 1.38 : 1;
    this.sizeK += (targetSize - this.sizeK) * Math.min(1, dt * 6);
    this.tilt.scale.setScalar(this.sizeK);
    this.shadow.scale.setScalar(this.sizeK * (1 - Math.min(0.5, this.hopY * 0.15)));
    this.shield.visible = this.shieldT > 0;
    if (this.shield.visible) { this.shield.rotation.y = t * 2; this.shield.scale.setScalar(1 + Math.sin(t * 8) * 0.04); }

    let mode = 'drive';
    if (this.spinT > 0) mode = 'dizzy';
    else if (this.poundT > 0) mode = 'pound';
    else if (this.finished) mode = this.pos <= 3 ? 'cheer' : 'sad';
    animateGorilla(this.gorilla, this.t, this.steer, mode, clamp(this.speed / this.maxSpeed, 0, 1));
    animateKart(this.kart, dt, this.speed, this.steer);

    // partículas (solo si está cerca de la cámara)
    const cam = race.camPos, dd = (cam.x - this.x) ** 2 + (cam.z - this.z) ** 2;
    if (dd > 120 * 120) return;
    const f = [Math.sin(this.h), Math.cos(this.h)], l = [Math.cos(this.h), -Math.sin(this.h)];
    const rear = (side, back = 1.4) => [this.x - f[0] * back + l[0] * side * 1.15, this.z - f[1] * back + l[1] * side * 1.15];
    if (this.drifting && this.hopY < 0.1) {
      const lvl = this.driftLevel(), c = DRIFT_COLORS[lvl];
      for (const sd of [-1, 1]) {
        const [px, pz] = rear(sd);
        if (lvl > 0 || Math.random() < 0.5) fx.add.emit(px, 0.2, pz, -this.vx * 0.15 + (Math.random() - 0.5) * 6, 2 + Math.random() * 5, -this.vz * 0.15 + (Math.random() - 0.5) * 6, c, lvl > 0 ? 6 + lvl : 4, 0.28, 16);
        if (Math.random() < 0.4) fx.norm.emit(px, 0.3, pz, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 0xffffff, 9, 0.5, 0, 1.5);
      }
    }
    if (this.boostT > 0) {
      for (const sd of [-0.4, 0.4]) {
        const [px, pz] = rear(sd, 2.3);
        fx.add.emit(px, 1.0 + this.hopY, pz, -f[0] * 14 + (Math.random() - 0.5) * 3, (Math.random() - 0.3) * 3, -f[1] * 14 + (Math.random() - 0.5) * 3,
          Math.random() < 0.5 ? 0xff7a1a : 0xffe45a, 12, 0.3, 0, -0.5);
      }
    }
    if (this.off && this.speed > 12 && this.hopY < 0.1 && Math.random() < 0.7) {
      const [px, pz] = rear(Math.random() < 0.5 ? -1 : 1);
      fx.norm.emit(px, 0.3, pz, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, race.dustColor, 11, 0.6, 3, 1.2);
    }
    if (this.furyT > 0 && Math.random() < 0.8) {
      const a = Math.random() * 6.28;
      fx.add.emit(this.x + Math.cos(a) * 2, 0.4 + Math.random() * 2.5, this.z + Math.sin(a) * 2, this.vx * 0.5, 4, this.vz * 0.5, Math.random() < 0.5 ? 0xc04dff : 0xff4fd8, 9, 0.45);
    }
    if (this.poundT > 0 && Math.random() < 0.5) fx.add.emit(this.x, 2.2, this.z, (Math.random() - 0.5) * 12, 6, (Math.random() - 0.5) * 12, 0xff5a3c, 8, 0.4, 10);
  }
}

export class Race {
  constructor(opts) {
    Object.assign(this, opts); // scene, track, fx:{add,norm}, mode, difficulty, save-info, onEvent
    const tr = this.track;
    this.state = 'intro'; this.stateT = 0; this.time = 0; this.t = 0; this.shake = 0;
    this.finishOrder = []; this.peels = []; this.cocos = []; this.waves = [];
    this.camPos = new THREE.Vector3(); this.camH = 0; this.fov = 70; this.countShown = 4;
    this.dustColor = tr.def.theme.ground2;
    this.shieldGeo = new THREE.SphereGeometry(2.05, 14, 10);
    this.shieldMat = new THREE.MeshBasicMaterial({ color: 0x35e08a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
    this.peelGeo = new THREE.ConeGeometry(0.8, 0.55, 5);
    this.peelMat = toon(0xffd21f);
    this.cocoGeo = new THREE.IcosahedronGeometry(0.75, 1);
    this.cocoMat = toon(0x7a4a22);
    this.waveGeo = new THREE.RingGeometry(0.82, 1, 40);

    const pc = charById(this.playerChar), pk = kartById(this.playerKart);
    this.racers = [];
    const solo = this.mode === 'time';
    const total = solo ? 1 : RACERS;
    const others = CHARACTERS.filter(c => c.id !== pc.id);
    for (let i = 0; i < total; i++) {
      const isP = i === total - 1;
      const slot = solo ? 0 : i;
      if (isP) this.racers.push(new Racer(this, slot, pc, pk, KART_COLORS[this.playerColor] || null, true));
      else {
        const ch = others[i % others.length], kd = KARTS[(i * 2 + 1) % KARTS.length];
        this.racers.push(new Racer(this, slot, ch, kd, KART_COLORS[1 + (i * 3) % (KART_COLORS.length - 1)], false));
      }
    }
    this.player = this.racers[total - 1];
    if (solo) {
      this.player.item = 'turbo'; this.player.itemCount = 3;
      for (const b of tr.itemBoxes) { b.active = false; b.timer = 1e9; b.mesh.visible = false; }
      this.rec = []; this.recT = 0;
      if (this.ghostData && this.ghostData.length > 6) {
        const gm = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.32, depthWrite: false });
        this.ghost = new THREE.Group();
        this.ghost.add(makeKart(pk, null, gm));
        const gg = makeGorilla(pc, gm); gg.position.set(0, 0.52, -0.5); gg.scale.setScalar(0.95);
        animateGorilla(gg, 0, 0, 'drive'); this.ghost.add(gg);
        this.scene.add(this.ghost);
      }
    }
    this.camH = this.player.h;
    this.ranking();
  }

  emit(ev, data) { if (this.onEvent) this.onEvent(ev, data); }

  ranking() {
    const arr = this.racers.slice().sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.finishTime - b.finishTime;
      return b.prog - a.prog;
    });
    arr.forEach((r, i) => { r.pos = i + 1; });
    return arr;
  }

  rollItem(r) {
    const n = this.racers.length, k = n > 1 ? (r.pos - 1) / (n - 1) : 0;
    const w = { turbo: 2 + 3 * k, coco: r.pos > 1 ? 2 + 2 * k : 0.3, peel: 4 - 3.2 * k, shield: 3 - 1.8 * k, drum: r.pos > 1 ? 1 + 1.5 * k : 0.4, fury: k >= 0.4 ? 2.4 * k : 0 };
    let tot = 0; for (const key in w) tot += w[key];
    let x = Math.random() * tot;
    for (const key in w) { x -= w[key]; if (x <= 0) return key; }
    return 'turbo';
  }

  useItem(r) {
    if (!r.item || r.spinT > 0) return;
    const it = r.item, fx = this.fx, loud = r.isPlayer || r.near();
    r.itemCount--; if (r.itemCount <= 0) { r.item = null; r.itemCount = 0; }
    const f = [Math.sin(r.h), Math.cos(r.h)];
    if (it === 'turbo') { r.boost(1.9); if (loud) sfx.boost(); }
    else if (it === 'shield') { r.shieldT = 12; if (loud) sfx.shield(); }
    else if (it === 'fury') { r.furyT = 7; r.poundT = 0.8; if (loud) sfx.fury(); fx.add.burst(r.x, 1.5, r.z, 30, [0xc04dff, 0xff4fd8], 12, 10, 0.6); }
    else if (it === 'peel') {
      const m = new THREE.Mesh(this.peelGeo, this.peelMat);
      const x = r.x - f[0] * 3.4, z = r.z - f[1] * 3.4; m.position.set(x, 0.3, z); this.scene.add(m);
      this.peels.push({ x, z, mesh: m, owner: r, age: 0 });
      if (this.peels.length > 14) { const o = this.peels.shift(); this.scene.remove(o.mesh); }
      if (loud) sfx.drop();
    } else if (it === 'coco') {
      const m = new THREE.Mesh(this.cocoGeo, this.cocoMat); this.scene.add(m);
      const ahead = this.racers.filter(o => o !== r && !o.finished && o.prog > r.prog).sort((a, b) => a.prog - b.prog)[0] || null;
      this.cocos.push({ prog: r.prog + 2, lat: r.lat, owner: r, target: ahead, life: 5.5, mesh: m });
      if (loud) sfx.throw();
    } else if (it === 'drum') {
      r.poundT = 0.9; r.boost(0.8);
      if (loud) sfx.drum();
      const m = new THREE.Mesh(this.waveGeo, new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(r.x, 0.4, r.z); this.scene.add(m);
      this.waves.push({ mesh: m, t: 0, x: r.x, z: r.z });
      for (const o of this.racers) if (o !== r && (o.x - r.x) ** 2 + (o.z - r.z) ** 2 < 30 * 30) o.hit();
      if (r.isPlayer || r.near()) this.shake = Math.max(this.shake, 0.35);
    }
    if (r.isPlayer) this.emit('used', it);
  }

  aiControl(r, dt) {
    const tr = this.track, N = tr.N, S = tr.samples;
    const look = Math.round(5 + Math.max(0, r.speed) * 0.2);
    let lane = r.lane + Math.sin(this.t * 0.25 + r.ph) * 1.6;
    // esquivar al coche de delante
    for (const o of this.racers) {
      if (o === r) continue;
      const dp = o.prog - r.prog;
      if (dp > 0 && dp < 5 && Math.abs(o.lat - r.lat) < 2.6) lane += (r.lat >= o.lat ? 3.2 : -3.2);
    }
    // esquivar cáscaras
    for (const p of this.peels) {
      const dx = p.x - r.x, dz = p.z - r.z, d2 = dx * dx + dz * dz;
      if (d2 < 400 && d2 > 4 && dx * Math.sin(r.h) + dz * Math.cos(r.h) > 0) {
        const s0 = S[r.idx], pl = (p.x - s0.x) * s0.nx + (p.z - s0.z) * s0.nz;
        if (Math.abs(pl - r.lat) < 2.4) lane += pl > r.lat ? -3 : 3;
      }
    }
    lane = clamp(lane, -tr.hw + 1.6, tr.hw - 1.6);
    const s = S[(r.idx + look) % N];
    const tx = s.x + s.nx * lane, tz = s.z + s.nz * lane;
    const diff = wrapA(Math.atan2(tx - r.x, tz - r.z) - r.h);
    let cm = 0;
    for (let k = 2; k < 16; k += 3) cm = Math.max(cm, Math.abs(S[(r.idx + k) % N].curv));
    const vlim = cm > 0.001 ? 0.92 * r.turnRate / cm : 999;
    // goma elástica respecto al jugador
    const p = this.player;
    let band = 0;
    if (!r.isPlayer) band = clamp((p.prog - r.prog) * tr.spacing / 420, -0.08, 0.05);
    const maxK = r.isPlayer ? 0.9 : this.difficulty.ai + r.skill + band;
    // uso de objetos
    if (r.item && !r.isPlayer) {
      r.useDelay -= dt;
      if (r.useDelay <= 0) {
        let ok = true;
        if (r.item === 'coco') ok = r.pos > 1;
        if (r.item === 'drum') ok = this.racers.some(o => o !== r && (o.x - r.x) ** 2 + (o.z - r.z) ** 2 < 24 * 24);
        if (r.item === 'peel') ok = this.racers.some(o => o !== r && o.prog < r.prog && r.prog - o.prog < 14);
        if (ok || r.useDelay < -6) this.useItem(r); else if (r.useDelay < -6) r.useDelay = 1;
      }
    }
    return { steer: clamp(-diff * 3.2, -1, 1), accel: r.speed < vlim, brake: false, drift: false, maxK };
  }

  finishRacer(r) {
    r.finished = true; r.finishTime = this.time + (this.state === 'finished' ? this.stateT : 0); this.finishOrder.push(r);
    r.drifting = false;
    this.ranking();
    if (r.isPlayer) {
      this.state = 'finished'; this.stateT = 0;
      this.emit('finish', r.pos);
      for (let i = 0; i < 5; i++) this.fx.add.burst(r.x + (Math.random() - 0.5) * 8, 3 + Math.random() * 3, r.z + (Math.random() - 0.5) * 8, 30, [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xffffff], 14, 9, 1.2, 14);
    }
  }

  results() {
    const order = this.ranking();
    return order.map((r, i) => ({
      name: r.char.name, isPlayer: r.isPlayer, pos: i + 1, char: r.char,
      time: r.finished ? r.finishTime : this.time + (this.state === 'finished' ? this.stateT : 0) + Math.max(0.3, (LAPS * this.track.N - r.prog) * this.track.spacing / (r.maxSpeed * 0.9)), bananas: r.bananas,
    }));
  }

  update(dt, input) {
    const tr = this.track, N = tr.N;
    this.t += dt; this.stateT += dt;
    const p = this.player;

    if (this.state === 'intro') {
      if (this.stateT > 2.6) { this.state = 'countdown'; this.stateT = 0; }
    } else if (this.state === 'countdown') {
      const n = 3 - Math.floor(this.stateT);
      if (n !== this.countShown) {
        this.countShown = n;
        if (n > 0) this.emit('count', n);
        else { this.state = 'racing'; this.stateT = 0; this.emit('go'); for (const r of this.racers) if (!r.isPlayer) r.boostT = Math.random() * 0.8; }
      }
    } else if (this.state === 'racing') this.time += dt;

    const moving = this.state === 'racing' || this.state === 'finished';
    const lapBefore = Math.floor(p.prog / N);
    for (const r of this.racers) {
      let ctl;
      if (!moving) ctl = { steer: 0, accel: false, brake: false, drift: false };
      else if (r.isPlayer && !r.finished) {
        ctl = { steer: input.steer, accel: !input.brake, brake: input.brake, drift: input.drift };
        if (input.itemPressed && r.item) this.useItem(r);
      } else ctl = this.aiControl(r, dt);
      if (!moving) { r.speed = 0; r.vx = r.vz = 0; r.t += dt; } else r.step(dt, ctl);
    }
    if (this.state === 'racing') {
      const lapNow = Math.floor(p.prog / N);
      if (lapNow > lapBefore && lapNow > (p.maxLap || 0) && lapNow < LAPS) {
        p.maxLap = lapNow; this.emit(lapNow === LAPS - 1 ? 'finalLap' : 'lap', lapNow + 1);
      }
    }

    // choques entre coches
    if (moving) for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i], b = this.racers[j];
      let dx = b.x - a.x, dz = b.z - a.z; const d2 = dx * dx + dz * dz, min = 2.5 * (a.sizeK + b.sizeK) / 2;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2), push = (min - d) / 2; dx /= d; dz /= d;
        a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
        const rel = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
        if (rel < 0) { a.vx += dx * rel * 0.5; a.vz += dz * rel * 0.5; b.vx -= dx * rel * 0.5; b.vz -= dz * rel * 0.5; }
        if (a.furyT > 0 && b.furyT <= 0) b.hit(); else if (b.furyT > 0 && a.furyT <= 0) a.hit();
        else if ((a.isPlayer || b.isPlayer) && a.bumpCd <= 0 && b.bumpCd <= 0) { sfx.bump(); a.bumpCd = b.bumpCd = 0.4; }
      }
    }

    // cáscaras
    for (let i = this.peels.length - 1; i >= 0; i--) {
      const pe = this.peels[i]; pe.age += dt; pe.mesh.rotation.y += dt * 2;
      for (const r of this.racers) {
        if (r === pe.owner && pe.age < 0.8) continue;
        if ((r.x - pe.x) ** 2 + (r.z - pe.z) ** 2 < 4.4 && r.hopY < 1) {
          r.hit(); this.scene.remove(pe.mesh); this.peels.splice(i, 1); break;
        }
      }
    }
    // cocos teledirigidos
    for (let i = this.cocos.length - 1; i >= 0; i--) {
      const c = this.cocos[i]; c.life -= dt;
      c.prog += 105 / tr.spacing * dt;
      if (c.target && !c.target.finished && c.target.prog > c.prog - 2) c.lat += (c.target.lat - c.lat) * Math.min(1, dt * 4);
      c.lat = clamp(c.lat, -tr.hw, tr.hw);
      const fi = ((c.prog % N) + N) % N, i0 = Math.floor(fi), fr = fi - i0, s0 = tr.samples[i0], s1 = tr.samples[(i0 + 1) % N];
      const x = s0.x + (s1.x - s0.x) * fr + s0.nx * c.lat, z = s0.z + (s1.z - s0.z) * fr + s0.nz * c.lat;
      c.mesh.position.set(x, 1.1 + Math.abs(Math.sin(this.t * 9)) * 0.5, z); c.mesh.rotation.x += dt * 12;
      this.fx.add.emit(x, 1.1, z, 0, 1, 0, 0xffb060, 7, 0.3);
      let dead = c.life <= 0;
      for (const r of this.racers) {
        if (r === c.owner) continue;
        if ((r.x - x) ** 2 + (r.z - z) ** 2 < 7.5) { r.hit(); dead = true; break; }
      }
      if (dead) { this.fx.add.burst(x, 1.2, z, 18, [0x7a4a22, 0xffffff, 0xffb060], 9, 8, 0.5, 10); this.scene.remove(c.mesh); this.cocos.splice(i, 1); }
    }
    // ondas del golpe de pecho
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.t += dt;
      const k = w.t / 0.55; w.mesh.scale.setScalar(1 + k * 30); w.mesh.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(w.mesh); w.mesh.material.dispose(); this.waves.splice(i, 1); }
    }

    this.ranking();

    // fantasma (contrarreloj)
    if (this.mode === 'time' && this.state === 'racing') {
      this.recT -= dt;
      if (this.recT <= 0) { this.recT += 0.1; this.rec.push(Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(p.h * 100) / 100); }
    }
    if (this.ghost) {
      const g = this.ghostData, fi = this.time / 0.1, i0 = Math.floor(fi), n = g.length / 3;
      if (i0 + 1 < n) {
        const fr = fi - i0, a = i0 * 3, b = a + 3;
        this.ghost.visible = true;
        this.ghost.position.set(g[a] + (g[b] - g[a]) * fr, 0, g[a + 1] + (g[b + 1] - g[a + 1]) * fr);
        this.ghost.rotation.y = g[a + 2] + wrapA(g[b + 2] - g[a + 2]) * fr;
      } else this.ghost.visible = this.state !== 'racing' ? this.ghost.visible : false;
    }

    for (const r of this.racers) r.visuals(dt, this.t);
  }

  updateCamera(cam, dt, aspect) {
    const p = this.player;
    this.shake = Math.max(0, this.shake - dt);
    let tx, ty, tz, lx, ly, lz, fov = 68;
    const portrait = aspect < 1;
    if (this.state === 'intro') {
      const a = p.h + Math.PI * 0.85 - this.stateT * 0.55, d = 16 - this.stateT * 2;
      tx = p.x + Math.sin(a) * d; tz = p.z + Math.cos(a) * d; ty = 3 + (2.6 - this.stateT) * 2.2;
      lx = p.x; ly = 1.4; lz = p.z; this.camH = p.h;
      cam.position.set(tx, ty, tz);
    } else if (this.state === 'finished') {
      // la cámara gira desde atrás hasta ponerse delante del ganador
      const e = Math.min(1, this.stateT / 1.6), ease = e * e * (3 - 2 * e);
      const a = this.camH + Math.PI + Math.PI * ease + Math.sin(Math.max(0, this.stateT - 1.6) * 0.6) * 0.9, d = 9.5;
      this.camH += wrapA(p.h - this.camH) * Math.min(1, dt * 4);
      tx = p.x + Math.sin(a) * d; tz = p.z + Math.cos(a) * d; ty = 4.3 - ease * 1.3;
      lx = p.x; ly = 1.6; lz = p.z;
      cam.position.set(tx, ty, tz);
    } else {
      const vh = p.speed > 8 ? Math.atan2(p.vx, p.vz) : p.h;
      const target = p.h + wrapA(vh - p.h) * 0.55;
      this.camH += wrapA(target - this.camH) * Math.min(1, dt * 5.5);
      const sk = clamp(p.speed / p.maxSpeed, 0, 1.4), d = (portrait ? 11.5 : 9) + sk * 1.2 - (p.boostT > 0 ? 0.8 : 0);
      tx = p.x - Math.sin(this.camH) * d; tz = p.z - Math.cos(this.camH) * d; ty = (portrait ? 5.4 : 4.3) + p.hopY * 0.3;
      lx = p.x + Math.sin(this.camH) * 6; lz = p.z + Math.cos(this.camH) * 6; ly = 1.7;
      cam.position.set(tx, ty, tz);
      fov = 66 + sk * 8 + (p.boostT > 0 ? 13 : 0);
    }
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 1.4; cam.position.y += (Math.random() - 0.5) * this.shake * 1.4;
    }
    if (portrait) fov += 16;
    this.fov += (fov - this.fov) * Math.min(1, dt * 5);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.lookAt(lx, ly, lz);
    this.camPos.copy(cam.position);
  }
}
