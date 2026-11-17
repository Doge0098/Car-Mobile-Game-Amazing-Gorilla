// Lógica de carrera: física arcade con desnivel y saltos, rivales IA, power-ups, cámara y fantasma.
import * as THREE from './vendor/three.module.min.js';
import * as A from './audio.js';
import { CHARACTERS, KARTS, LAPS, RACERS, charById, kartById, KART_COLORS, rng } from './data.js';
import { makeGorilla, makeKart, mountGorilla, makeModeRigs, animateGorilla, animateKart, blobShadow, toon, makeHazard, canvasTex } from './models.js';
import { addOutline } from './outline.js';
import { SkidMarks, Trail, Weather, Hazards, Underwater } from './world.js';
import { tryShortcut, stepFlight, applyCurrents, gliderAlt } from './extras.js';
import { Rules } from './rules.js';
import { Replay } from './replay.js';
import { Emotes } from './emotes.js';

const sfx = A.sfx;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const DRIFT_COLORS = [0xffffff, 0x38b6ff, 0xff9a1a, 0xe04dff];
const TRICK_T = 0.55, THROW_T = 0.4;
// estela por defecto: { color de la cinta, sparks: chispas del escape, rainbow: recorre el arcoíris }
const FIRE_TRAIL = { color: 0xffa030, sparks: [0xff7a1a, 0xffe45a] };
const _hue = new THREE.Color();
const hueHex = h => _hue.setHSL(h - Math.floor(h), 1, 0.56).getHex();
// cartel flotante que señala al rival personal
let rivalTex = null;
function rivalTag() {
  if (!rivalTex) rivalTex = canvasTex(160, 56, c => {
    c.fillStyle = '#1a0b3a'; c.fillRect(0, 0, 160, 56); c.fillStyle = '#ff2f4a'; c.fillRect(5, 5, 150, 46);
    c.fillStyle = '#fff'; c.font = 'italic 900 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RIVAL', 80, 30);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: rivalTex, depthWrite: false, fog: false }));
  s.scale.set(3.4, 1.2, 1); s.position.y = 4.5;
  return s;
}

class Racer {
  constructor(race, slot, char, kart, color, isPlayer) {
    this.race = race; this.char = char; this.kartDef = kart; this.isPlayer = isPlayer; this.slot = slot;
    const sp = isPlayer ? char.stats.speed + kart.stats.speed : 7;
    const ac = isPlayer ? char.stats.accel + kart.stats.accel : 7;
    const hd = isPlayer ? char.stats.handling + kart.stats.handling : 7;
    this.maxSpeed = 50 + sp * 1.7; this.accel = 20 + ac * 2.2; this.turnRate = 1.75 + hd * 0.07; this.grip = 6 + hd * 0.4;
    this.boostK = 1; // multiplicador de la duración de los impulsos
    // solo el jugador: mejoras del garaje y personalización
    const tune = isPlayer && race.playerTune;
    if (tune) for (const k of ['maxSpeed', 'accel', 'turnRate', 'grip', 'boostK']) this[k] += tune[k] || 0;
    this.hat = (isPlayer && race.playerHat) || null; this.wheels = (isPlayer && race.playerWheel) || null;
    this.sticker = (isPlayer && race.playerSticker) || null; this.dance = (isPlayer && race.playerDance) || null;
    this.trailDef = (isPlayer && race.playerTrail) || FIRE_TRAIL;

    const tr = race.track, g = tr.grid(slot);
    this.x = g.x; this.z = g.z; this.h = g.h; this.idx = g.idx; this.y = tr.yAt(g.x, g.z, g.idx);
    this.prog = g.idx - tr.N;
    this.vx = 0; this.vz = 0; this.speed = 0; this.steer = 0; this.slopeF = 0; this.pitch = 0;
    this.drifting = false; this.driftDir = 0; this.charge = 0;
    this.boostT = 0; this.spinT = 0; this.shieldT = 0; this.furyT = 0; this.poundT = 0;
    this.shrinkT = 0; this.magnetT = 0; this.stallT = 0;
    this.hopY = 0; this.hopV = 0; this.air = false; this.trickT = 0; this.trickDone = false; this.trickDir = 1; this.rampCd = 0; this.aiTrick = -1;
    this.lat = 0; this.off = false; this.inPuddle = false; this.mode = null; this.modeT = 0; this.bob = 0;
    this.item = null; this.itemCount = 0; this.rolling = 0; this.useDelay = 0;
    this.bananas = 0; this.finished = false; this.finishTime = 0; this.pos = slot + 1; this.prevPos = 0;
    this.wrongT = 0; this.t = Math.random() * 10; this.bumpCd = 0; this.sizeK = 1;
    this.throwT = 0; this.tauntT = 0; this.angryT = 0; this.lookT = 0; this.lookDir = 0; this.lookCd = 2 + Math.random() * 4; this.lookNow = 0;
    this.mk = [{ on: false, x: 0, y: 0, z: 0 }, { on: false, x: 0, y: 0, z: 0 }];
    this.out = false; this.flight = null; this.alt = 0; this.inCurrent = 0; this.isRival = false;
    // estadísticas de la carrera (misiones, logros, tutorial)
    this.st = { tricks: 0, rings: 0, miniturbos: 0, items: 0, hitsDealt: 0, hitsTaken: 0, bananas: 0, startBoost: false, pads: 0,
      offT: 0, offMax: 0, offCur: 0, bestPos: slot + 1, overtakes: 0, topSpeed: 0 };
    // IA
    this.lane = (Math.random() - 0.5) * tr.hw * 1.1; this.ph = Math.random() * 6.28;
    this.skill = (Math.random() - 0.5) * 0.05;

    this.root = new THREE.Group();
    this.pitchG = new THREE.Group(); this.root.add(this.pitchG);
    this.tilt = new THREE.Group(); this.pitchG.add(this.tilt);
    this.kart = makeKart(kart, color, null, this.wheels, this.sticker); this.tilt.add(this.kart);
    this.gorilla = mountGorilla(this.kart, makeGorilla(char, null, false, this.hat));
    this.tilt.add(this.gorilla);
    this.rigs = makeModeRigs(); this.tilt.add(this.rigs.glider, this.rigs.boat, this.rigs.sub);
    this.outlines = []; this.olOn = true; this.tilt.traverse(o => { if (o.userData.isOutline) this.outlines.push(o); });
    if (race.shadows) this.tilt.traverse(o => { if (o.isMesh && !o.userData.isOutline && !o.material.transparent) o.castShadow = true; });
    this.shadow = blobShadow(); this.pitchG.add(this.shadow);
    this.shadow.visible = !race.shadows || tr.unlitRoad;
    this.shield = new THREE.Mesh(race.shieldGeo, race.shieldMat); this.shield.position.y = 1.3; this.shield.visible = false;
    this.tilt.add(this.shield);
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.y = this.h;
    race.scene.add(this.root);
    this.trail = new Trail(); race.scene.add(this.trail.mesh); this.trail.reset(this.x, this.y, this.z);
  }

  boost(t) { this.boostT = Math.max(this.boostT, t * this.boostK); }

  // by: corredor que provoca el golpe (para contar los golpes dados); sin él es un obstáculo del mapa
  hit(by) {
    if (this.furyT > 0 || this.spinT > 0 || this.flight || this.out || this.graceT > 0) return false;
    const race = this.race, fx = race.fx;
    if (this.shieldT > 0) {
      this.shieldT = 0;
      fx.add.burst(this.x, this.y + 1.4, this.z, 24, [0x35e08a, 0xffffff], 9, 7, 0.5);
      if (this.isPlayer || this.near()) sfx.shieldBreak();
      return false;
    }
    this.spinT = 1.25; this.drifting = false; this.charge = 0; this.hopV = Math.max(this.hopV, 7.5); this.boostT = 0; this.air = false;
    this.bananas = Math.max(0, this.bananas - 3);
    this.st.hitsTaken++; if (by && by !== this) by.st.hitsDealt++;
    fx.add.burst(this.x, this.y + 1.5, this.z, 26, [0xffe21f, 0xffffff, 0xff5a3c], 11, 8, 0.7, 12);
    if (this.isPlayer) { sfx.hit(); race.shake = 0.5; A.haptic?.('hit'); } else if (this.near()) sfx.bump();
    if (this.isPlayer || this.near()) race.shock(this.x, this.y + 1.2, this.z, 0xff5a3c, 6);
    race.voice(this, this.shrinkT > 0 ? 'tiny' : 'hit');
    race.emotes.hit(this);
    if (race.rules) race.rules.onHit(this, by);
    return true;
  }

  near() { const p = this.race.player; return (p.x - this.x) ** 2 + (p.z - this.z) ** 2 < 2500; }

  step(dt, ctl) {
    const race = this.race, tr = race.track, N = tr.N, fx = race.fx;
    this.t += dt;
    for (const k of ['boostT', 'shieldT', 'furyT', 'poundT', 'bumpCd', 'shrinkT', 'magnetT', 'stallT', 'rampCd', 'throwT', 'tauntT', 'angryT', 'lookT', 'trickT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    this.lookCd -= dt;
    // vuelo del atajo: el coche va guiado hasta el punto de aterrizaje
    if (this.flight) {
      if (stepFlight(this, dt, tr)) { this.slopeF = 0; return; }
      this.boost(0.9);
      fx.norm.burst(this.x, this.y + 0.3, this.z, 12, race.dustColor, 7, 12, 0.5, 3);
      if (this.isPlayer) { sfx.land?.(); A.haptic?.('land'); }
    }
    const spinning = this.spinT > 0;
    if (spinning) this.spinT -= dt;
    const s0 = tr.samples[this.idx], mode = this.mode, gliding = mode === 'glide';
    const air = this.hopY > 0.05 && !gliding;

    let fxd = Math.sin(this.h), fzd = Math.cos(this.h);
    this.slopeF = s0.slope * (fxd * s0.tx + fzd * s0.tz);
    let max = this.maxSpeed * (ctl.maxK || 1) * (1 + Math.min(this.bananas, 10) * 0.006) * clamp(1 - this.slopeF * 0.9, 0.86, 1.14);
    if (this.off && !air && this.furyT <= 0 && this.boostT <= 0) max *= 0.5;
    if (gliding) max *= 1.08; else if (mode === 'sub') max *= 0.97;
    if (this.furyT > 0) max *= 1.16;
    if (this.boostT > 0) max *= 1.36;
    if (this.shrinkT > 0) max *= 0.72;
    // corrientes de agua: empujan hacia delante o hacia un lado
    if (tr.currents.length && (mode === 'boat' || mode === 'sub')) {
      const was = this.inCurrent; max *= applyCurrents(this, tr, dt);
      if (this.inCurrent && !was && this.isPlayer) { sfx.whoosh?.(0, 0.7); race.emit('current', this.inCurrent); }
    } else this.inCurrent = 0;

    // aceleración
    if (spinning) this.speed -= this.speed * 2.4 * dt;
    else if (this.stallT > 0) this.speed -= this.speed * 1.5 * dt;
    else if (air) { /* en el aire conserva la velocidad */ }
    else if (ctl.brake && !gliding) this.speed = Math.max(-13, this.speed - 55 * dt); // en el ala delta, FRENO baja
    else if (ctl.accel || gliding) {
      if (this.speed < max) this.speed += this.accel * dt * (this.boostT > 0 ? 2.4 : 1) * (1.2 - 0.75 * Math.max(0, this.speed) / max);
    } else this.speed -= this.speed * 0.9 * dt;
    if (this.speed > max) this.speed -= (this.speed - max) * Math.min(1, 2.6 * dt);

    // derrape
    const steer = spinning ? 0 : clamp(ctl.steer, -1, 1);
    this.steer += (steer - this.steer) * Math.min(1, dt * 12);
    if (!this.drifting) {
      if (ctl.drift && !spinning && !air && !gliding && Math.abs(steer) > 0.25 && this.speed > 24) {
        this.drifting = true; this.driftDir = Math.sign(steer); this.charge = 0; this.hopV = 4.2;
      }
    } else {
      this.charge += dt * (0.75 + 0.5 * Math.max(0, steer * this.driftDir));
      if (!ctl.drift || this.speed < 16 || spinning) {
        const lvl = this.driftLevel();
        if (lvl > 0 && !spinning && this.speed >= 16) {
          this.boost([0, 0.7, 1.25, 1.9][lvl]); this.st.miniturbos++;
          if (this.isPlayer) { sfx.miniturbo(); A.haptic?.('boost'); }
          fx.add.burst(this.x, this.y + 0.6, this.z, 16, DRIFT_COLORS[lvl], 8, 7, 0.4);
        }
        this.drifting = false; this.charge = 0;
      }
    }
    // truco en el aire
    if (this.air && !this.trickDone && this.hopY > 0.5 && ctl.trick && !spinning) {
      this.trickDone = true; this.trickT = TRICK_T; this.trickDir = steer < -0.2 ? 1 : steer > 0.2 ? -1 : (Math.random() < 0.5 ? 1 : -1);
      fx.add.burst(this.x, this.y + this.hopY + 1, this.z, 14, [0x22e6ff, 0xffffff, 0xff4fd8], 7, 7, 0.5);
      race.voice(this, 'ooh');
    }
    // giro
    let yaw;
    if (air) yaw = steer * this.turnRate * 0.3;
    else if (gliding) yaw = steer * this.turnRate * 0.75;
    else if (this.drifting) yaw = (this.driftDir * 0.72 + steer * 0.58) * this.turnRate * 1.05;
    else yaw = steer * this.turnRate * clamp(this.speed / 16, -1, 1) * (1 - 0.18 * clamp(this.speed / max, 0, 1));
    this.h -= yaw * dt;

    // velocidad con agarre (permite deslizar)
    fxd = Math.sin(this.h); fzd = Math.cos(this.h);
    let g = air ? 1.0 : gliding ? 2.4 : this.drifting ? 2.7 : mode === 'boat' ? 3.2 : mode === 'sub' ? 4.6 : this.grip; if (this.off && !air) g *= 0.7;
    const k = Math.min(1, g * dt);
    this.vx += (fxd * this.speed - this.vx) * k; this.vz += (fzd * this.speed - this.vz) * k;
    this.x += this.vx * dt; this.z += this.vz * dt;

    // salto (en el ala delta la altura la marca el tramo)
    if (gliding) { this.hopV = 0; this.air = false; }
    else if (this.hopY > 0 || this.hopV > 0) {
      this.hopV -= 30 * dt; this.hopY += this.hopV * dt;
      if (this.hopY <= 0) {
        this.hopY = 0; this.hopV = 0;
        if (this.air) {
          this.air = false;
          fx.norm.burst(this.x, this.y + 0.3, this.z, 10, race.dustColor, 6, 12, 0.5, 3);
          if (this.isPlayer) { sfx.land?.(); A.haptic?.('land'); }
          if (this.trickDone && !spinning) {
            this.boost(1.15); this.st.tricks++;
            fx.add.burst(this.x, this.y + 0.8, this.z, 20, [0x22e6ff, 0xffe45a, 0xffffff], 10, 8, 0.5);
            if (this.isPlayer) { sfx.trick?.(); race.emit('trick'); }
          }
        }
      }
    }

    // posición en el circuito
    const ni = tr.locate(this.x, this.z, this.idx);
    let d = ni - this.idx; if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    this.prog += d; this.idx = ni;
    const s = tr.samples[ni];
    let lat = (this.x - s.x) * s.nx + (this.z - s.z) * s.nz;
    if (Math.abs(lat) > s.lim) {
      const sg = Math.sign(lat), over = lat - sg * s.lim;
      this.x -= s.nx * over; this.z -= s.nz * over; lat = sg * s.lim;
      const vn = this.vx * s.nx + this.vz * s.nz;
      if (vn * sg > 0) { this.vx -= s.nx * vn; this.vz -= s.nz * vn; }
      this.speed -= this.speed * 1.2 * dt;
    }
    this.lat = lat; this.off = Math.abs(lat) > tr.hw + 1.6 && !s.zone;
    this.y = tr.yAt(this.x, this.z, ni);
    if (race.state === 'racing' && !this.finished) {
      const st = this.st;
      if (!this.off) st.offCur = 0;
      else if (!air) { st.offT += dt; st.offCur += dt; if (st.offCur > st.offMax) st.offMax = st.offCur; }
      if (this.speed > st.topSpeed) st.topSpeed = this.speed;
    }
    // transformación automática según el tramo
    if (s.zone !== this.mode) race.setMode(this, s.zone);
    if (s.zone === 'glide') {
      const nx = tr.samples[(ni + 1) % N], fr = clamp(((this.x - s.x) * s.tx + (this.z - s.z) * s.tz) / tr.spacing, 0, 1);
      // altura del tramo más lo que suba o baje el piloto (DERRAPE sube, FRENO baja)
      const base = s.air + (nx.air - s.air) * fr;
      this.hopY += (Math.max(0.3, base + gliderAlt(this, ctl, tr, dt) * clamp(base / 4.5, 0, 1)) - this.hopY) * Math.min(1, dt * 12);
    } else this.alt = 0;
    // aros de impulso
    for (const rg of tr.rings) {
      if (rg.cd[this.slot] > 0) { rg.cd[this.slot] -= dt; continue; }
      let di = ni - rg.idx; if (di < -N / 2) di += N;
      if (di >= 0 && di <= 1 && Math.abs(lat - rg.lat) < 3.4 && (!rg.air || Math.abs(this.y + this.hopY + 1 - rg.y) < 2.2)) {
        rg.cd[this.slot] = 4; this.boost(0.9); this.bananas++; this.st.rings++; this.st.bananas++;
        fx.add.burst(rg.x, rg.y, rg.z, 22, [0xffd21f, 0xffffff, 0x22e6ff], 12, 9, 0.5);
        race.shock(rg.x, rg.y, rg.z, 0xffffff, 9, 0.4);
        if (this.isPlayer) { sfx.trick?.(); A.haptic?.('boost'); race.emit('ring'); }
      }
    }

    // atajo: el trampolín del arcén lanza el coche por encima de la curva
    if (tr.shortcut && !spinning && tryShortcut(this, tr)) {
      this.st.shortcuts = (this.st.shortcuts || 0) + 1; this.air = false; this.trickT = TRICK_T; this.trickDir = -tr.shortcut.side;
      fx.add.burst(this.x, this.y + 0.8, this.z, 18, [0x35e08a, 0xffffff], 10, 9, 0.5);
      if (this.isPlayer) { sfx.ramp?.(); A.haptic?.('boost'); race.emit('shortcut'); }
    }

    // rampas (también en el agua: los barcos saltan)
    if (this.rampCd <= 0 && this.hopY <= 0.01 && this.speed > 18 && !spinning && !this.flight && (!s.zone || s.zone === 'boat')) {
      for (const rp of tr.ramps) {
        let di = ni - rp.idx; if (di < -N / 2) di += N;
        if (di >= 0 && di <= 2 && Math.abs(lat) < tr.hw - 0.4) {
          this.hopV = 11.5 + this.speed * 0.075; this.air = true; this.trickDone = false; this.rampCd = 1.2; this.drifting = false; this.charge = 0;
          this.aiTrick = Math.random() < 0.6 ? 0.15 + Math.random() * 0.3 : -1;
          if (this.isPlayer) { sfx.ramp?.(); race.emit('ramp'); }
          break;
        }
      }
    }

    // sentido contrario
    const fwdDot = fxd * s.tx + fzd * s.tz;
    this.wrongT = fwdDot < -0.25 && this.speed > 5 ? this.wrongT + dt : 0;

    if (race.state === 'racing' || race.state === 'finished') this.pickups(dt);
    if (this.rolling > 0) {
      this.rolling -= dt;
      if (this.rolling <= 0) { this.item = race.rollItem(this); this.itemCount = 1; this.useDelay = race.mode === 'battle' ? 3 + Math.random() * 6 : 1 + Math.random() * 3.5; if (this.isPlayer) sfx.item(); }
    }
    if (!this.finished && this.prog >= race.laps * N && (race.state === 'racing' || race.state === 'finished')) race.finishRacer(this);
  }

  driftLevel() { return this.charge > 2.6 ? 3 : this.charge > 1.6 ? 2 : this.charge > 0.75 ? 1 : 0; }

  pickups() {
    const race = this.race, tr = race.track, N = tr.N, fx = race.fx, ground = this.hopY < 1.2;
    if (ground) for (const p of tr.pads) {
      const dx = this.x - p.x, dz = this.z - p.z;
      if (dx * dx + dz * dz < 14 && this.boostT < 0.6) {
        this.boost(1.15); this.st.pads++;
        if (this.isPlayer) { sfx.boost(); A.haptic?.('boost'); }
      }
    }
    for (const b of tr.bananas) {
      if (!b.active) continue;
      let di = b.idx - this.idx; if (di > N / 2) di -= N; if (di < -N / 2) di += N;
      if ((di > 7 || di < -7) && this.magnetT <= 0) continue;
      const dx = this.x - b.px, dz = this.z - b.pz;
      if (dx * dx + dz * dz < 5.3 * this.sizeK) {
        b.active = false; b.timer = 14; this.bananas++; this.st.bananas++;
        if (this.isPlayer) { sfx.coin(); fx.add.burst(b.px, this.y + 1.2, b.pz, 8, 0xffe21f, 5, 5, 0.35); }
      }
    }
    if (race.mode !== 'time') for (const b of tr.itemBoxes) {
      if (!b.active) continue;
      const dx = this.x - b.x, dz = this.z - b.z;
      if (dx * dx + dz * dz < 6.5 && this.hopY < 2.4) {
        b.active = false; b.timer = race.boxRespawn || 3.5; b.mesh.visible = false;
        fx.add.burst(b.x, b.y + 1.5, b.z, 22, [0xff4fd8, 0xffd21f, 0x22e6ff, 0xffffff], 10, 8, 0.5, 8);
        if (!this.item && this.rolling <= 0 && !this.finished && (this.isPlayer || race.aiItems !== false)) { this.rolling = 1.3; }
        if (this.isPlayer || this.near()) race.shock(b.x, b.y + 1.5, b.z, 0xffe45a, 4.5);
        if (this.isPlayer) sfx.tick();
      }
    }
    // charcos
    let inP = false;
    if (ground && this.speed > 10) for (const p of tr.puddles) {
      const dx = this.x - p.x, dz = this.z - p.z;
      if (dx * dx + dz * dz < p.r * p.r) {
        inP = true;
        for (let i = 0; i < 3; i++) fx.norm.emit(this.x + (Math.random() - 0.5) * 2, this.y + 0.2, this.z + (Math.random() - 0.5) * 2, -this.vx * 0.1 + (Math.random() - 0.5) * 9, 5 + Math.random() * 6, -this.vz * 0.1 + (Math.random() - 0.5) * 9, 0xeaf8ff, 6, 0.5, 22);
      }
    }
    if (inP && !this.inPuddle && (this.isPlayer || this.near())) sfx.splash?.(0, this.isPlayer ? 1 : 0.5);
    this.inPuddle = inP;
  }

  visuals(dt, t) {
    const race = this.race, fx = race.fx, y = this.y;
    this.root.position.set(this.x, y, this.z); this.root.rotation.y = this.h;
    const pt = this.hopY > 0.3 ? this.pitch * 0.9 : -Math.atan(this.slopeF);
    this.pitch += (pt - this.pitch) * Math.min(1, dt * 8);
    this.pitchG.rotation.x = this.pitch;
    let yawOff = this.drifting ? -this.driftDir * 0.42 : 0, fast = false;
    if (this.spinT > 0) { yawOff += (1.25 - this.spinT) / 1.25 * Math.PI * 4; fast = true; }
    if (this.trickT > 0) { yawOff += (1 - this.trickT / TRICK_T) * Math.PI * 2 * this.trickDir; fast = true; }
    const ty = this.tilt.rotation;
    ty.y += wrapA(yawOff - ty.y) * Math.min(1, dt * (fast ? 30 : 9));
    ty.z += ((this.drifting ? -this.driftDir * 0.1 : -this.steer * 0.05) - ty.z) * Math.min(1, dt * 8);
    ty.x = -this.hopV * 0.012 - (this.boostT > 0 ? 0.06 : 0);
    // modo de vehículo: aparición de accesorios, flotación y hélice
    const md = this.mode; this.modeT = Math.min(1, this.modeT + dt * 5);
    const pop = 0.6 + 0.4 * Math.sin(this.modeT * Math.PI / 2) + (this.modeT < 1 ? Math.sin(this.modeT * Math.PI) * 0.25 : 0);
    if (md) this.rigs[md === 'glide' ? 'glider' : md].scale.setScalar(pop);
    this.bob += ((md === 'boat' ? -0.32 + Math.sin(t * 3.2 + this.ph) * 0.1 : md === 'sub' ? 0.75 + Math.sin(t * 2 + this.ph) * 0.18 : 0) - this.bob) * Math.min(1, dt * 6);
    if (md === 'sub') this.rigs.prop.rotation.z += dt * (6 + this.speed * 0.5);
    if (md === 'glide') ty.z += (-this.steer * 0.38 - ty.z) * Math.min(1, dt * 6);
    else if (md === 'boat') { ty.z += Math.sin(t * 2.6 + this.ph) * 0.0015; ty.x += Math.sin(t * 3.2 + this.ph) * 0.03; }
    this.tilt.position.y = this.hopY + this.bob;
    const targetSize = this.furyT > 0 ? 1.38 : this.shrinkT > 0 ? 0.55 : 1;
    this.sizeK += (targetSize - this.sizeK) * Math.min(1, dt * 6);
    this.tilt.scale.setScalar(this.sizeK);
    this.shadow.scale.setScalar(this.sizeK * (1 - Math.min(0.5, this.hopY * 0.12)));
    this.shield.visible = this.shieldT > 0;
    if (this.shield.visible) { this.shield.rotation.y = t * 2; this.shield.scale.setScalar(1 + Math.sin(t * 8) * 0.04); }

    // la cara solo se anima de cerca o en las presentaciones
    const camD = (race.camPos.x - this.x) ** 2 + (race.camPos.z - this.z) ** 2;
    this.gorilla.userData.face.visible = camD < 55 * 55;
    // el contorno de los coches lejanos no se dibuja
    const ol = camD < 85 * 85; if (ol !== this.olOn) { this.olOn = ol; for (const o of this.outlines) o.visible = ol; }
    // expresión y animación del gorila
    let mode = 'drive', face = 'neutral';
    if (this.spinT > 0) { mode = 'dizzy'; face = 'dizzy'; }
    else if (this.poundT > 0) { mode = 'pound'; face = 'angry'; }
    else if (this.finished) { mode = this.pos <= 3 ? this.dance || 'cheer' : 'sad'; face = this.pos <= 3 ? 'happy' : 'sad'; }
    else if (this.trickT > 0 || (this.air && this.trickDone)) { mode = 'trick'; face = 'happy'; }
    else if (this.shrinkT > 0 || this.stallT > 0) face = 'scared';
    else if (this.tauntT > 0 || this.air) face = 'happy';
    else if (this.furyT > 0 || this.angryT > 0) face = 'angry';
    else if (this.lookT > 0) face = 'scared';
    else if (this.boostT > 0) face = 'happy';
    else if (this.drifting) face = 'focus';
    const lookTarget = this.lookT > 0 && mode === 'drive' ? this.lookDir * 2.2 : 0;
    this.lookNow += (lookTarget - this.lookNow) * Math.min(1, dt * 10);
    animateGorilla(this.gorilla, this.t, {
      steer: this.steer, mode, face, dt, speedK: clamp(this.speed / this.maxSpeed, 0, 1), look: this.lookNow,
      taunt: this.tauntT > 0, throwK: this.throwT > 0 ? 1 - this.throwT / THROW_T : 0,
    });
    animateKart(this.kart, dt, this.speed, this.steer);

    // estela luminosa
    const f = [Math.sin(this.h), Math.cos(this.h)], l = [Math.cos(this.h), -Math.sin(this.h)];
    const glow = this.boostT > 0 || this.furyT > 0, td = this.trailDef;
    this.trail.push(this.x - f[0] * 1.9, y + this.hopY + 0.75, this.z - f[1] * 1.9, l[0], l[1], this.furyT > 0 ? 0xc04dff : td.rainbow ? hueHex(t * 0.8) : td.color, glow, race.glowK * 0.7);

    // lo demás solo si está cerca de la cámara
    const cam = race.camPos, dd = (cam.x - this.x) ** 2 + (cam.z - this.z) ** 2;
    if (dd > 120 * 120) { this.mk[0].on = this.mk[1].on = false; return; }
    const ground = this.hopY < 0.1;
    const rear = (side, back = 1.4) => [this.x - f[0] * back + l[0] * side * 1.15, this.z - f[1] * back + l[1] * side * 1.15];
    // marcas de derrape y rodadas fuera de pista
    if (md === 'boat' && this.speed > 8) {
      // estela de espuma y salpicaduras
      for (const sd of [-1, 1]) if (Math.random() < 0.8) { const [px, pz] = rear(sd * 1.2, 1.6); fx.norm.emit(px, y + 0.15, pz, l[0] * sd * 3 + (Math.random() - 0.5) * 2, 2.5 + Math.random() * 3, l[1] * sd * 3 + (Math.random() - 0.5) * 2, 0xffffff, 9, 0.55, 12, 0.8); }
    } else if (md === 'sub' && Math.random() < 0.7) {
      const [px, pz] = rear((Math.random() - 0.5) * 0.8, 3.2);
      fx.norm.emit(px, y + this.bob + 0.9, pz, (Math.random() - 0.5) * 1.5, 2.2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 0xdff8ff, 5 + Math.random() * 5, 1.1, -1.5);
    }
    const marking = ground && (md === 'boat' ? this.speed > 8 : !md && ((this.drifting && !this.off) || (this.off && this.speed > 14) || (this.spinT > 0 && this.speed > 10)));
    for (let i = 0; i < 2; i++) {
      const m = this.mk[i], [px, pz] = rear(i ? 1 : -1, 1.2);
      if (!marking) { m.on = false; continue; }
      if (!m.on) { m.on = true; m.x = px; m.y = y; m.z = pz; continue; }
      if ((px - m.x) ** 2 + (pz - m.z) ** 2 > 1.4) {
        race.marks.add(m.x, m.y, m.z, px, y, pz, md === 'boat' ? 0.5 : 0.3, md === 'boat' ? 0xffffff : this.off ? race.rutColor : race.markColor, t);
        m.x = px; m.y = y; m.z = pz;
      }
    }
    if (this.drifting && ground && !md) {
      const lvl = this.driftLevel(), c = DRIFT_COLORS[lvl];
      for (const sd of [-1, 1]) {
        const [px, pz] = rear(sd);
        if (lvl > 0 || Math.random() < 0.5) fx.add.emit(px, y + 0.2, pz, -this.vx * 0.15 + (Math.random() - 0.5) * 6, 2 + Math.random() * 5, -this.vz * 0.15 + (Math.random() - 0.5) * 6, c, lvl > 0 ? 6 + lvl : 4, 0.28, 16);
        if (Math.random() < 0.4) fx.norm.emit(px, y + 0.3, pz, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 0xffffff, 9, 0.5, 0, 1.5);
      }
    }
    if (this.inCurrent && Math.random() < 0.7) {
      const [px, pz] = rear((Math.random() - 0.5) * 2, 2.4);
      fx.norm.emit(px, y + this.bob + 0.6, pz, -f[0] * 6, 1.5 + Math.random() * 2, -f[1] * 6, 0xdff8ff, 6 + Math.random() * 5, 0.6, -1);
    }
    if (this.boostT > 0) {
      for (const sd of [-0.4, 0.4]) {
        const [px, pz] = rear(sd, 2.3);
        fx.add.emit(px, y + 1.0 + this.hopY, pz, -f[0] * 14 + (Math.random() - 0.5) * 3, (Math.random() - 0.3) * 3, -f[1] * 14 + (Math.random() - 0.5) * 3,
          td.rainbow ? hueHex(Math.random()) : td.sparks[Math.random() < 0.5 ? 0 : 1], 12, 0.3, 0, -0.5);
      }
    }
    if (this.off && this.speed > 12 && ground && Math.random() < 0.7) {
      const [px, pz] = rear(Math.random() < 0.5 ? -1 : 1);
      fx.norm.emit(px, y + 0.3, pz, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, race.dustColor, 11, 0.6, 3, 1.2);
    }
    if (this.furyT > 0 && Math.random() < 0.8) {
      const a = Math.random() * 6.28;
      fx.add.emit(this.x + Math.cos(a) * 2, y + 0.4 + Math.random() * 2.5, this.z + Math.sin(a) * 2, this.vx * 0.5, 4, this.vz * 0.5, Math.random() < 0.5 ? 0xc04dff : 0xff4fd8, 9, 0.45);
    }
    if (this.magnetT > 0 && Math.random() < 0.6) {
      const a = Math.random() * 6.28;
      fx.add.emit(this.x + Math.cos(a) * 3.5, y + 0.6 + Math.random() * 1.5, this.z + Math.sin(a) * 3.5, -Math.cos(a) * 9 + this.vx, 0, -Math.sin(a) * 9 + this.vz, Math.random() < 0.5 ? 0xff3b4a : 0x38b6ff, 7, 0.35);
    }
    if (this.poundT > 0 && Math.random() < 0.5) fx.add.emit(this.x, y + 2.2, this.z, (Math.random() - 0.5) * 12, 6, (Math.random() - 0.5) * 12, 0xff5a3c, 8, 0.4, 10);
  }
}

export class Race {
  constructor(opts) {
    // opts: scene, track, fx:{add,norm}, mode, difficulty, quality, bloom, shadows, onEvent, playerChar/Kart/Color...
    //  opcionales: laps · rivals [{ char, kart, color }] · playerTune { maxSpeed, accel, turnRate, grip, boostK } (se suman al jugador)
    //  playerHat · playerWheel · playerTrail { color, sparks, rainbow } · playerHorn · aiItems: false (los rivales no cogen objetos) · noHazards
    //  playerSticker (id de pegatina) · playerDance (modo de animateGorilla al acabar en el podio) · playerEmote (emoji del gesto)
    Object.assign(this, opts);
    this.laps = this.laps > 0 ? Math.round(this.laps) : LAPS;
    const tr = this.track, def = tr.def, ex = def.extras;
    this.state = 'intro'; this.stateT = 0; this.time = 0; this.t = 0; this.shake = 0;
    this.finishOrder = []; this.peels = []; this.cocos = []; this.waves = []; this.barrels = []; this.bolts = []; this.shocks = [];
    this.windColor = def.theme.fxColor;
    this.camPos = new THREE.Vector3(); this.camH = 0; this.fov = 70; this.countShown = 4; this.camY = 0;
    this.pressT = -99; this.goWindow = 0; this.prevDrift = false; this.voiceCd = 0;
    this.glowK = this.bloom ? 1.5 : 1;
    this.dustColor = def.theme.ground2; this.markColor = ex.mark; this.rutColor = new THREE.Color(def.theme.ground2).multiplyScalar(0.55).getHex();
    this.shieldGeo = new THREE.SphereGeometry(2.05, 14, 10);
    this.shieldMat = new THREE.MeshBasicMaterial({ color: 0x35e08a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
    this.peelGeo = new THREE.ConeGeometry(0.8, 0.55, 5);
    this.peelMat = toon(0xffd21f);
    this.cocoGeo = new THREE.IcosahedronGeometry(0.75, 1);
    this.cocoMat = toon(0x7a4a22);
    this.waveGeo = new THREE.RingGeometry(0.82, 1, 40);
    this.marks = new SkidMarks(this.quality < 0.7 ? 300 : 700); this.scene.add(this.marks.mesh);
    this.emotes = new Emotes(() => this.t); // bocadillos con gestos (opts.playerEmote: el emoji del jugador)

    const pc = charById(this.playerChar), pk = kartById(this.playerKart);
    this.racers = []; this.hornCd = 0;
    const solo = this.mode === 'time';
    // rivales: opts.rivals = [{ char, kart, color }] (ids e índice de color); si no se dan, los de siempre
    const others = CHARACTERS.filter(c => c.id !== pc.id);
    const lineup = solo ? [] : this.rivals || others.slice(0, RACERS - 1).map((c, i) => ({ char: c.id, kart: KARTS[(i * 2 + 1) % KARTS.length].id, color: 1 + (i * 3) % (KART_COLORS.length - 1) }));
    const total = lineup.length + 1;
    for (let i = 0; i < total; i++) {
      const isP = i === total - 1;
      const slot = solo ? 0 : i;
      if (isP) { this.racers.push(new Racer(this, slot, pc, pk, KART_COLORS[this.playerColor] || null, true)); this.racers[i].colorIdx = this.playerColor; }
      else {
        const rv = lineup[i];
        this.racers.push(new Racer(this, slot, charById(rv.char), kartById(rv.kart), KART_COLORS[rv.color] || null, false)); this.racers[i].colorIdx = rv.color;
      }
    }
    this.player = this.racers[total - 1];
    this.live = this.racers; // corredores que siguen en juego (los modos con eliminación van quitando)
    // rival personal: opts.rivalDef = { char, level }; se adapta al nivel del jugador
    this.rival = null; this.rivalAhead = null;
    if (this.rivalDef && !solo) {
      const rv = this.racers.find(r => !r.isPlayer && r.char.id === this.rivalDef.char);
      if (rv) { rv.isRival = true; rv.skill = clamp(0.006 + this.rivalDef.level * 0.011, -0.03, 0.075); this.rival = rv; this.rivalTag = rivalTag(); rv.root.add(this.rivalTag); }
      this.rivalTagY = this.mode === 'battle' ? 5.9 : 4.5; // por encima de los globos
    }
    const wOpts = { scene: this.scene, track: tr, fx: this.fx, quality: this.quality, B: k => (this.bloom ? k : 1), shadows: this.shadows, rand: rng(def.seed * 7 + 5), onEvent: (e, d) => this.emit(e, d) };
    // en contrarreloj no hay obstáculos ni meteoritos: la vuelta debe depender solo del piloto
    this.hazards = new Hazards(solo || this.noHazards ? null : ex.hazard, wOpts);
    this.weather = new Weather(solo && ex.weather === 'ash' ? 'none' : ex.weather, wOpts);
    this.underwater = new Underwater(wOpts);
    if (solo) {
      this.player.item = 'turbo'; this.player.itemCount = 3;
      for (const b of tr.itemBoxes) { b.active = false; b.timer = 1e9; b.mesh.visible = false; }
      this.rec = []; this.recT = 0;
      if (this.ghostData && this.ghostData.length > 6) {
        const gm = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.32, depthWrite: false });
        this.ghost = new THREE.Group(); this.ghostIdx = this.player.idx;
        const gk = makeKart(pk, null, gm, this.playerWheel), gg = mountGorilla(gk, makeGorilla(pc, gm, false, this.playerHat));
        animateGorilla(gg, 0, {}); this.ghost.add(gk, gg);
        this.scene.add(this.ghost);
      }
    }
    this.camH = this.player.h; this.camY = this.player.y;
    // en los mapas que empiezan en el agua los coches salen ya transformados
    for (const r of this.racers) { const z = tr.samples[r.idx].zone; if (z && z !== 'glide') this.setMode(r, z, true); }
    this.rules = this.mode === 'elim' || this.mode === 'battle' ? new Rules(this) : null;
    this.replay = new Replay(this); this.replaying = false;
    this.ranking();
    for (const r of this.racers) r.prevPos = r.pos;
  }

  emit(ev, data) { if (this.onEvent) this.onEvent(ev, data); }

  // voz del gorila: fuerte si es el jugador, con posición estéreo si es un rival cercano
  voice(r, kind, vol = 1) {
    if (!A.voice) return;
    const pitch = r.char.voice * (r.shrinkT > 0 ? 1.5 : 1);
    if (r.isPlayer) { A.voice(kind, pitch, 0, vol); return; }
    if (this.voiceCd > 0 || !r.near()) return;
    this.voiceCd = 0.45;
    A.voice(kind, pitch, this.panOf(r.x, r.z), vol * 0.55);
  }

  // Transformación del coche al entrar o salir de un tramo especial
  // silent: sin efectos (al colocar la parrilla). En la repetición se ven los efectos pero no suenan.
  setMode(r, mode, silent) {
    const prev = r.mode, mute = this.replaying; r.mode = mode || null; r.modeT = 0; r.alt = 0;
    r.rigs.glider.visible = mode === 'glide'; r.rigs.boat.visible = mode === 'boat'; r.rigs.sub.visible = mode === 'sub';
    for (const w of r.kart.userData.wheels) {
      const sg = Math.sign(w.x);
      w.pivot.visible = mode !== 'sub';
      w.pivot.rotation.z = mode === 'boat' ? -sg * Math.PI / 2 : 0;
      w.pivot.position.set(mode === 'boat' ? w.x - sg * 0.1 : w.x, mode === 'boat' ? w.y + 0.75 : w.y, w.pivot.position.z);
    }
    r.drifting = false; r.charge = 0;
    if (silent) { r.modeT = 1; return; }
    if (prev === 'glide' && !mode) { r.hopY = 0; this.fx.norm.burst(r.x, r.y + 0.3, r.z, 12, this.dustColor, 7, 12, 0.5, 3); if (r.isPlayer && !mute) { sfx.land?.(); A.haptic?.('land'); } }
    const near = !mute && (r.isPlayer || r.near());
    this.fx.add.burst(r.x, r.y + r.hopY + 1.2, r.z, 20, [0xffffff, 0x22e6ff, 0xffd21f], 10, 9, 0.45);
    if (mode === 'boat' || mode === 'sub' || prev === 'boat' || prev === 'sub') {
      this.fx.norm.burst(r.x, r.y + 0.4, r.z, 18, 0xffffff, 9, 10, 0.7, 14);
      if (near) sfx.splash?.(r.isPlayer ? 0 : this.panOf(r.x, r.z), r.isPlayer ? 1 : 0.5);
    } else if (mode === 'glide' && near) sfx.whoosh?.(r.isPlayer ? 0 : this.panOf(r.x, r.z), r.isPlayer ? 1 : 0.5);
    if (r.isPlayer && !mute) this.emit('mode', mode || null);
  }

  panOf(x, z) { return clamp(((x - this.camPos.x) * -Math.cos(this.camH) + (z - this.camPos.z) * Math.sin(this.camH)) / 18, -1, 1); }

  ranking() {
    if (this.rules) return this.rules.rank();
    const arr = this.racers.slice().sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.finishTime - b.finishTime;
      return b.prog - a.prog;
    });
    arr.forEach((r, i) => { r.pos = i + 1; });
    return arr;
  }

  rollItem(r) {
    if (this.rules) { const key = this.rules.rollItem(r); if (key) return key; }
    const n = this.racers.length, k = n > 1 ? (r.pos - 1) / (n - 1) : 0, first = r.pos === 1;
    const w = {
      turbo: 2 + 3 * k, coco: first ? 0.3 : 2 + 2 * k, peel: 4 - 3.2 * k, shield: 3 - 1.8 * k, drum: first ? 0.4 : 1 + 1.5 * k,
      fury: k >= 0.4 ? 2.4 * k : 0, bolt: k >= 0.5 ? 1.9 * k : 0, magnet: 1.7 - 0.9 * k, barrel: first ? 0.5 : 1.3 + 1.2 * k,
    };
    let tot = 0; for (const key in w) tot += w[key];
    let x = Math.random() * tot;
    for (const key in w) { x -= w[key]; if (x <= 0) return key; }
    return 'turbo';
  }

  useItem(r) {
    if (!r.item || r.spinT > 0) return;
    const it = r.item, fx = this.fx, tr = this.track, loud = r.isPlayer || r.near(), pan = r.isPlayer ? 0 : this.panOf(r.x, r.z), vol = r.isPlayer ? 1 : 0.6;
    r.itemCount--; if (r.itemCount <= 0) { r.item = null; r.itemCount = 0; }
    r.st.items++;
    const f = [Math.sin(r.h), Math.cos(r.h)];
    if (it === 'turbo') { r.boost(1.9); if (loud) sfx.boost(pan, vol); if (r.isPlayer) A.haptic?.('boost'); }
    else if (it === 'shield') { r.shieldT = 12; if (loud) sfx.shield(pan, vol); }
    else if (it === 'fury') {
      r.furyT = 7; r.poundT = 0.8; r.shrinkT = 0;
      if (loud) sfx.fury(pan, vol); this.voice(r, 'roar');
      fx.add.burst(r.x, r.y + 1.5, r.z, 30, [0xc04dff, 0xff4fd8], 12, 10, 0.6);
    } else if (it === 'magnet') { r.magnetT = 8; if (loud) sfx.magnet?.(pan, vol); }
    else if (it === 'peel') {
      const m = new THREE.Mesh(this.peelGeo, this.peelMat); m.castShadow = !!this.shadows; addOutline(m);
      const x = r.x - f[0] * 3.4, z = r.z - f[1] * 3.4; m.position.set(x, r.y + 0.3, z); this.scene.add(m);
      this.peels.push({ x, z, mesh: m, owner: r, age: 0 });
      if (this.peels.length > 14) { const o = this.peels.shift(); this.scene.remove(o.mesh); }
      r.throwT = THROW_T; if (loud) sfx.drop(pan, vol);
    } else if (it === 'coco') {
      const m = new THREE.Mesh(this.cocoGeo, this.cocoMat); m.castShadow = !!this.shadows; addOutline(m); this.scene.add(m);
      // objetivo: el coche más cercano por delante (en los modos sin vueltas, por posición en el circuito)
      const N = tr.N, gap = o => (this.rules ? ((o.idx - r.idx) % N + N) % N : o.prog - r.prog);
      const ahead = this.live.filter(o => o !== r && !o.finished && gap(o) > 0).sort((a, b) => gap(a) - gap(b))[0] || null;
      this.cocos.push({ prog: r.prog + 2, lat: r.lat, owner: r, target: ahead, life: 5.5, mesh: m });
      r.throwT = THROW_T; if (loud) sfx.throw(pan, vol); this.voice(r, 'grunt');
    } else if (it === 'barrel') {
      const holder = new THREE.Group(), m = makeHazard('barrel'); m.castShadow = !!this.shadows; m.scale.setScalar(0.85); holder.add(m); this.scene.add(holder);
      this.barrels.push({ prog: r.prog + 2.5, lat: r.lat, vlat: (Math.random() < 0.5 ? 1 : -1) * (9 + Math.random() * 7), owner: r, age: 0, holder, mesh: m });
      r.throwT = THROW_T; if (loud) sfx.throw(pan, vol); this.voice(r, 'grunt');
    } else if (it === 'drum') {
      r.poundT = 0.9; r.boost(0.8);
      if (loud) sfx.drum(pan, vol);
      const m = new THREE.Mesh(this.waveGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a3c).multiplyScalar(this.glowK), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(r.x, r.y + 0.4, r.z); this.scene.add(m);
      this.waves.push({ mesh: m, t: 0 });
      for (const o of this.live) if (o !== r && (o.x - r.x) ** 2 + (o.z - r.z) ** 2 < 30 * 30) o.hit(r);
      if (loud) this.shake = Math.max(this.shake, 0.35);
    } else if (it === 'bolt') {
      sfx.zap?.(0, loud ? 1 : 0.7); this.emit('flash');
      for (const o of this.live) {
        if (o === r || o.finished || o.furyT > 0) continue;
        // rayo en zigzag desde el cielo (varios trazos para que se vea grueso)
        const pts = [], zig = [];
        for (let i = 0; i <= 7; i++) zig.push(i && i < 7 ? [(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7] : [0, 0]);
        for (const [ox, oz] of [[0, 0], [0.25, 0], [-0.25, 0.1], [0, 0.25], [0.1, -0.25]]) for (let i = 0; i < 7; i++) for (const j of [i, i + 1]) {
          const q = j / 7; pts.push(new THREE.Vector3(o.x + zig[j][0] + (1 - q) * 6 + ox, o.y + 1 + (1 - q) * 70, o.z + zig[j][1] + oz));
        }
        const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(0xfff6a0).multiplyScalar(this.bloom ? 3 : 1), transparent: true, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.scene.add(line); this.bolts.push({ line, t: 0 });
        fx.add.burst(o.x, o.y + 1.2, o.z, 16, [0xfff6a0, 0xffffff], 9, 9, 0.4);
        if (o.shieldT > 0) { o.shieldT = 0; if (o.isPlayer) sfx.shieldBreak(); continue; }
        o.shrinkT = 4.5; o.speed *= 0.75; o.drifting = false; o.charge = 0;
        o.st.hitsTaken++; r.st.hitsDealt++;
        if (o.isPlayer) { sfx.shrink?.(); A.haptic?.('hit'); this.shake = 0.3; this.voice(o, 'tiny'); }
      }
    }
    if (r.isPlayer) this.emit('used', it);
  }

  // Bocina del jugador: suena, saluda y los rivales de delante miran atrás
  honk(r) {
    if (this.hornCd > 0 || r.spinT > 0) return;
    this.hornCd = 0.5; sfx.horn?.(this.playerHorn);
    this.emotes.show(r, this.playerEmote);
    r.tauntT = Math.max(r.tauntT, 0.45);
    for (const o of this.live) {
      const dp = o.prog - r.prog;
      if (o !== r && dp > 0 && dp < 9 && o.spinT <= 0) { o.lookT = 0.85; o.lookDir = r.lat >= o.lat ? 1 : -1; o.lookCd = 3; }
    }
    this.emit('horn');
  }

  aiControl(r, dt) {
    const tr = this.track, N = tr.N, S = tr.samples;
    const look = Math.round(5 + Math.max(0, r.speed) * 0.2);
    let lane = r.lane + Math.sin(this.t * 0.25 + r.ph) * 1.6;
    const s0 = S[r.idx], fwx = Math.sin(r.h), fwz = Math.cos(r.h);
    // esquivar al coche de delante
    for (const o of this.live) {
      if (o === r) continue;
      const dp = o.prog - r.prog;
      if (dp > 0 && dp < 5 && Math.abs(o.lat - r.lat) < 2.6) lane += (r.lat >= o.lat ? 3.2 : -3.2);
    }
    // esquivar cáscaras y obstáculos
    const dodge = (px, pz, w) => {
      const dx = px - r.x, dz = pz - r.z, d2 = dx * dx + dz * dz;
      if (d2 < 520 && d2 > 4 && dx * fwx + dz * fwz > 0) {
        const pl = (px - s0.x) * s0.nx + (pz - s0.z) * s0.nz;
        if (Math.abs(pl - r.lat) < w) lane += pl > r.lat ? -3.2 : 3.2;
      }
    };
    for (const p of this.peels) dodge(p.x, p.z, 2.4);
    for (const h of this.hazards.list) if (h.harm) dodge(h.x, h.z, 3);
    const sA = S[(r.idx + look) % N], room = Math.min(tr.hw, sA.lim) - 1.6;
    lane = clamp(lane, -room, room);
    let tx = sA.x + sA.nx * lane, tz = sA.z + sA.nz * lane;
    // algunos rivales se desvían hacia el trampolín del atajo (más a menudo en difícil)
    const sc = tr.shortcut;
    if (sc && !r.isPlayer && !r.mode && !r.flight) {
      let di = sc.i0 - r.idx; if (di < -N / 2) di += N;
      if (di > 0 && di < 18 && (((Math.floor(r.prog / N) * 7 + r.slot * 3) % 5) + 5) % 5 < (this.difficulty.ai > 0.95 ? 2 : 1)) { tx = sc.ex; tz = sc.ez; }
    }
    const diff = wrapA(Math.atan2(tx - r.x, tz - r.z) - r.h);
    let cm = 0;
    for (let k = 2; k < 16; k += 3) cm = Math.max(cm, Math.abs(S[(r.idx + k) % N].curv));
    const vlim = cm > 0.001 ? 0.92 * r.turnRate / cm : 999;
    // goma elástica respecto al jugador
    const p = this.player;
    let band = 0;
    if (!r.isPlayer) band = clamp((p.prog - r.prog) * tr.spacing / 420, r.isRival ? -0.065 : -0.08, r.isRival ? 0.075 : 0.05); // el rival personal no se queda atrás
    const maxK = r.isPlayer ? 0.9 : this.difficulty.ai + r.skill + band;
    // truco en los saltos
    let trick = false;
    if (r.air && r.aiTrick > 0) { r.aiTrick -= dt; if (r.aiTrick <= 0) trick = true; }
    // uso de objetos
    if (r.item && !r.isPlayer) {
      r.useDelay -= dt;
      if (r.useDelay <= 0) {
        let ok = true;
        const L = this.live;
        if (r.item === 'drum') ok = L.some(o => o !== r && (o.x - r.x) ** 2 + (o.z - r.z) ** 2 < 24 * 24);
        else if (!this.rules) { // en la batalla y la eliminación se usa todo en cuanto se puede
          if (r.item === 'coco' || r.item === 'bolt') ok = r.pos > 1;
          if (r.item === 'peel') ok = L.some(o => o !== r && o.prog < r.prog && r.prog - o.prog < 14);
          if (r.item === 'barrel') ok = L.some(o => o !== r && o.prog > r.prog && o.prog - r.prog < 45);
        }
        if (ok || r.useDelay < -6) this.useItem(r);
      }
    }
    return { steer: clamp(-diff * 3.2, -1, 1), accel: r.speed < vlim, brake: false, drift: false, maxK, trick };
  }

  finishRacer(r) {
    r.finished = true; r.finishTime = this.time + (this.state === 'finished' ? this.stateT : 0); this.finishOrder.push(r);
    r.drifting = false;
    this.ranking();
    if (r.isPlayer) {
      this.state = 'finished'; this.stateT = 0;
      this.emit('finish', r.pos);
      this.voice(r, this.mode === 'time' || r.pos <= 3 ? 'cheer' : 'sad');
      for (let i = 0; i < 5; i++) this.fx.add.burst(r.x + (Math.random() - 0.5) * 8, r.y + 3 + Math.random() * 3, r.z + (Math.random() - 0.5) * 8, 30, [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xffffff], 14, 9, 1.2, 14);
    }
  }

  results() {
    const order = this.ranking(), extra = this.state === 'finished' ? this.stateT : 0;
    return order.map((r, i) => ({
      name: r.char.name, isPlayer: r.isPlayer, pos: i + 1, char: r.char, kart: r.kartDef, color: r.colorIdx,
      time: this.rules ? 0 : r.finished ? r.finishTime : this.time + extra + Math.max(0.3, (this.laps * this.track.N - r.prog) * this.track.spacing / (r.maxSpeed * 0.9)), bananas: r.bananas, st: r.st, hat: r.hat, wheels: r.wheels,
      out: !!r.out, balloons: r.balloons || 0, pops: r.pops || 0, isRival: r.isRival,
      sticker: r.sticker, dance: r.dance,
    }));
  }

  update(dt, input) {
    const tr = this.track, N = tr.N, S = tr.samples;
    this.t += dt; this.stateT += dt; this.voiceCd -= dt; this.hornCd -= dt;
    const p = this.player, driftEdge = input.drift && !this.prevDrift;

    if (this.state === 'intro') {
      if (this.stateT > 2.6) { this.state = 'countdown'; this.stateT = 0; }
    } else if (this.state === 'countdown') {
      if (driftEdge) this.pressT = this.stateT;
      const n = 3 - Math.floor(this.stateT);
      if (n !== this.countShown) {
        this.countShown = n;
        if (n > 0) this.emit('count', n);
        else {
          this.state = 'racing'; this.stateT = 0; this.emit('go');
          for (const r of this.racers) if (!r.isPlayer) r.boostT = Math.random() * 0.8;
          // salida turbo: pulsar DERRAPE justo en el «¡YA!»
          const early = 3 - this.pressT;
          if (early <= 0.35) { p.boost(1.6); p.st.startBoost = true; this.emit('startBoost'); }
          else if (early < 1.3) { p.stallT = 0.85; this.emit('stall'); }
          else this.goWindow = 0.22;
        }
      }
    } else if (this.state === 'racing') {
      this.time += dt;
      if (this.goWindow > 0) { this.goWindow -= dt; if (driftEdge) { this.goWindow = 0; p.boost(1.1); p.st.startBoost = true; this.emit('startBoost'); } }
    }

    const moving = this.state === 'racing' || this.state === 'finished';
    const lapBefore = Math.floor(p.prog / N);
    for (const r of this.live) {
      let ctl;
      if (!moving) ctl = null;
      else if (r.isPlayer && !r.finished) {
        ctl = { steer: input.steer, accel: !input.brake, brake: input.brake, drift: input.drift, trick: driftEdge };
        if (input.itemPressed && r.item) this.useItem(r);
        else if ((input.itemPressed && r.rolling <= 0) || input.hornPressed) this.honk(r); // sin objeto, el botón toca la bocina
      } else ctl = this.aiControl(r, dt);
      if (!ctl) { r.speed = 0; r.vx = r.vz = 0; r.t += dt; } else r.step(dt, ctl);
    }
    this.prevDrift = input.drift;
    if (this.state === 'racing' && !this.rules) {
      const lapNow = Math.floor(p.prog / N);
      if (lapNow > lapBefore && lapNow > (p.maxLap || 0) && lapNow < this.laps) {
        p.maxLap = lapNow; this.emit(lapNow === this.laps - 1 ? 'finalLap' : 'lap', lapNow + 1);
      }
    }

    // choques entre coches
    const L = this.live;
    if (moving) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.flight || b.flight) continue;
      let dx = b.x - a.x, dz = b.z - a.z; const d2 = dx * dx + dz * dz, min = 2.5 * (a.sizeK + b.sizeK) / 2;
      if (d2 < min * min && d2 > 0.0001 && Math.abs(a.hopY - b.hopY) < 1.8) {
        const d = Math.sqrt(d2), push = (min - d) / 2; dx /= d; dz /= d;
        a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
        const rel = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
        if (rel < 0) { a.vx += dx * rel * 0.5; a.vz += dz * rel * 0.5; b.vx -= dx * rel * 0.5; b.vz -= dz * rel * 0.5; }
        if (a.furyT > 0 && b.furyT <= 0) b.hit(a); else if (b.furyT > 0 && a.furyT <= 0) a.hit(b);
        else if (a.shrinkT > 0 && b.shrinkT <= 0 && b.speed > 30) a.hit(b); else if (b.shrinkT > 0 && a.shrinkT <= 0 && a.speed > 30) b.hit(a);
        else if ((a.isPlayer || b.isPlayer) && a.bumpCd <= 0 && b.bumpCd <= 0) { sfx.bump(); A.haptic?.('bump'); a.bumpCd = b.bumpCd = 0.4; this.shock((a.x + b.x) / 2, a.y + 1, (a.z + b.z) / 2, 0xffffff, 3.2, 0.25); }
      }
    }

    // cáscaras
    for (let i = this.peels.length - 1; i >= 0; i--) {
      const pe = this.peels[i]; pe.age += dt; pe.mesh.rotation.y += dt * 2;
      for (const r of L) {
        if (r === pe.owner && pe.age < 0.8) continue;
        if ((r.x - pe.x) ** 2 + (r.z - pe.z) ** 2 < 4.4 && r.hopY < 1) {
          r.hit(pe.owner); this.scene.remove(pe.mesh); this.peels.splice(i, 1); break;
        }
      }
    }
    // cocos teledirigidos
    const posOn = (prog, lat, out) => {
      const fi = ((prog % N) + N) % N, i0 = Math.floor(fi), fr = fi - i0, a = S[i0], b = S[(i0 + 1) % N];
      out.x = a.x + (b.x - a.x) * fr + a.nx * lat; out.z = a.z + (b.z - a.z) * fr + a.nz * lat; out.y = a.y + (b.y - a.y) * fr + a.air; out.s = a;
    };
    const q = this._q || (this._q = {});
    for (let i = this.cocos.length - 1; i >= 0; i--) {
      const c = this.cocos[i]; c.life -= dt;
      c.prog += 105 / tr.spacing * dt;
      if (c.target && !c.target.finished && (this.rules ? !c.target.out : c.target.prog > c.prog - 2)) c.lat += (c.target.lat - c.lat) * Math.min(1, dt * 4);
      c.lat = clamp(c.lat, -tr.hw, tr.hw);
      posOn(c.prog, c.lat, q);
      c.mesh.position.set(q.x, q.y + 1.1 + Math.abs(Math.sin(this.t * 9)) * 0.5, q.z); c.mesh.rotation.x += dt * 12;
      this.fx.add.emit(q.x, q.y + 1.1, q.z, 0, 1, 0, 0xffb060, 7, 0.3);
      let dead = c.life <= 0;
      for (const r of L) {
        if (r === c.owner) continue;
        if ((r.x - q.x) ** 2 + (r.z - q.z) ** 2 < 7.5 && r.hopY < 2.5) { r.hit(c.owner); dead = true; break; }
      }
      if (dead) { this.fx.add.burst(q.x, q.y + 1.2, q.z, 18, [0x7a4a22, 0xffffff, 0xffb060], 9, 8, 0.5, 10); this.scene.remove(c.mesh); this.cocos.splice(i, 1); }
    }
    // barriles rodantes: rebotan de lado a lado
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i]; b.age += dt;
      b.prog += 80 / tr.spacing * dt; b.lat += b.vlat * dt;
      posOn(b.prog, b.lat, q);
      const room = Math.min(tr.hw, q.s.lim) - 1;
      if (Math.abs(b.lat) > room) {
        b.lat = Math.sign(b.lat) * room; b.vlat = -b.vlat; posOn(b.prog, b.lat, q);
        if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 3600) sfx.thud?.(this.panOf(q.x, q.z), 0.7);
      }
      b.holder.position.set(q.x, q.y + 0.92, q.z); b.holder.rotation.y = q.s.h; b.mesh.rotation.x += dt * 9;
      let dead = b.age > 7;
      for (const r of L) {
        if (r === b.owner && b.age < 1) continue;
        if ((r.x - q.x) ** 2 + (r.z - q.z) ** 2 < 6.5 && r.hopY < 2) { r.hit(b.owner); dead = true; break; }
      }
      if (dead) {
        this.fx.norm.burst(q.x, q.y + 1, q.z, 16, [0xa8643a, 0x6a3a1a, 0xffd21f], 10, 10, 0.7, 14);
        if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 3600) sfx.crash?.(this.panOf(q.x, q.z), 0.8);
        this.scene.remove(b.holder); this.barrels.splice(i, 1);
      }
    }
    // ondas del golpe de pecho y rayos
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.t += dt;
      const k = w.t / 0.55; w.mesh.scale.setScalar(1 + k * 30); w.mesh.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(w.mesh); w.mesh.material.dispose(); this.waves.splice(i, 1); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt; b.line.material.opacity = (1 - b.t / 0.35) * (Math.random() < 0.3 ? 0.3 : 1);
      if (b.t >= 0.35) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); this.bolts.splice(i, 1); }
    }
    // imán: los plátanos vuelan hacia el coche
    for (const r of L) {
      if (r.magnetT <= 0) continue;
      for (const b of tr.bananas) {
        if (!b.active) continue;
        const dx = r.x - b.px, dz = r.z - b.pz, d2 = dx * dx + dz * dz;
        if (d2 < 19 * 19 && d2 > 0.01) { const d = Math.sqrt(d2), st = Math.min(d, (45 + r.speed) * dt); b.px += dx / d * st; b.pz += dz / d * st; b.y += (r.y - b.y) * Math.min(1, dt * 6); }
      }
    }

    if (moving) this.hazards.update(dt, this.t, this);
    if (this.rules) this.rules.update(dt);

    // adelantamientos: burla del que pasa y enfado del adelantado
    this.ranking();
    for (const r of this.live) {
      if (this.state === 'racing' && this.time > 4 && r.pos !== r.prevPos) {
        if (r.pos < r.prevPos) this.emotes.overtake(r);
        if (r.pos < r.prevPos) { r.tauntT = 1.1; r.st.overtakes++; this.voice(r, 'laugh'); if (r.isPlayer) sfx.whoosh?.(); }
        else { r.angryT = 1.3; if (r.isPlayer) sfx.whoosh?.(0, 0.6); }
      }
      r.prevPos = r.pos;
      if (this.state === 'racing' && r.pos < r.st.bestPos) r.st.bestPos = r.pos;
      // mira hacia atrás si le pisan los talones
      if (moving && r.lookCd <= 0 && r.spinT <= 0) {
        for (const o of this.live) {
          const dp = r.prog - o.prog;
          if (o !== r && dp > 1.2 && dp < 6) { r.lookT = 0.85; r.lookDir = o.lat >= r.lat ? 1 : -1; r.lookCd = 3.5 + Math.random() * 4; break; }
        }
        if (r.lookCd <= 0) r.lookCd = 0.5;
      }
    }

    // fantasma (contrarreloj)
    if (this.mode === 'time' && this.state === 'racing') {
      this.recT -= dt;
      if (this.recT <= 0) { this.recT += 0.1; this.rec.push(Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(p.h * 100) / 100); }
    }
    if (this.ghost) {
      const g = this.ghostData, fi = this.time / 0.1, i0 = Math.floor(fi), n = g.length / 3;
      if (i0 + 1 < n) {
        const fr = fi - i0, a = i0 * 3, b = a + 3;
        const gx = g[a] + (g[b] - g[a]) * fr, gz = g[a + 1] + (g[b + 1] - g[a + 1]) * fr;
        this.ghostIdx = tr.locate(gx, gz, this.ghostIdx, 20);
        this.ghost.visible = true;
        this.ghost.position.set(gx, tr.yAt(gx, gz, this.ghostIdx), gz);
        this.ghost.rotation.y = g[a + 2] + wrapA(g[b + 2] - g[a + 2]) * fr;
      } else if (this.state === 'racing') this.ghost.visible = false;
    }

    // rival personal: avisa cuando adelanta al jugador o cuando el jugador le pasa
    if (this.rival && this.state === 'racing' && !this.rival.out) {
      const ahead = this.rival.pos < p.pos;
      if (this.rivalAhead !== null && ahead !== this.rivalAhead && this.time > 6) { this.emit('rival', ahead); if (ahead) this.voice(this.rival, 'laugh'); }
      this.rivalAhead = ahead;
      if (this.rivalTag) this.rivalTag.position.y = this.rivalTagY + Math.sin(this.t * 4) * 0.15 + this.rival.hopY;
    }
    if (this.state === 'racing' || (this.state === 'finished' && this.stateT < 2.5)) this.replay.record(dt);
    for (const r of this.live) r.visuals(dt, this.t);
  }

  // tras mover la cámara: clima y marcas
  lateUpdate(dt, cam) {
    this.weather.update(dt, this.t, cam.position, this);
    this.underwater.update(dt, cam.position);
    this.marks.update(this.t);
    // anillos de impacto
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const w = this.shocks[i]; w.t += dt; const k = w.t / w.d;
      w.mesh.scale.setScalar(0.4 + k * w.r); w.mesh.material.opacity = 0.9 * (1 - k); if (cam.quaternion) w.mesh.quaternion.copy(cam.quaternion);
      if (k >= 1) { this.scene.remove(w.mesh); w.mesh.material.dispose(); this.shocks.splice(i, 1); }
    }
    // ráfagas que pasan junto a la cámara a gran velocidad
    const p = this.player;
    if (p.speed > p.maxSpeed * 0.9 && !this.underwater.on && Math.random() < 0.7) {
      const f0 = Math.sin(p.h), f1 = Math.cos(p.h), d = 30 + Math.random() * 25, o = (Math.random() - 0.5) * 26;
      this.fx.add.emit(p.x + f0 * d + f1 * o, p.y + p.hopY + 0.6 + Math.random() * 6, p.z + f1 * d - f0 * o, -f0 * 22, 0, -f1 * 22, this.windColor, 4 + Math.random() * 3, 0.7);
    }
  }

  // anillo que se expande mirando a la cámara (recoger objeto, choque, aro)
  shock(x, y, z, color, r = 5, d = 0.32) {
    if (this.shocks.length > 10) return;
    const m = new THREE.Mesh(this.waveGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(this.glowK), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(x, y, z); this.scene.add(m); this.shocks.push({ mesh: m, t: 0, r, d });
  }

  // hasta 3 motores rivales para el sonido posicional (sin crear objetos por fotograma)
  rivalAudio(out) {
    const p = this.player;
    let n = 0;
    for (const r of this.live) {
      if (r === p || n >= 3) continue;
      const d = Math.hypot(r.x - p.x, r.z - p.z); if (d > 48) continue;
      const o = out[n++]; o.pan = this.panOf(r.x, r.z); o.gain = (1 - d / 48) ** 2; o.pitch = clamp(r.speed / r.maxSpeed, 0, 1.3);
    }
    return n;
  }

  updateCamera(cam, dt, aspect) {
    const p = this.player;
    this.shake = Math.max(0, this.shake - dt);
    this.camY += (p.y - this.camY) * Math.min(1, dt * 7);
    let tx, ty, tz, lx, ly, lz, fov = 68;
    const portrait = aspect < 1, by = this.camY;
    if (this.state === 'intro') {
      const a = p.h + Math.PI * 0.85 - this.stateT * 0.55, d = 16 - this.stateT * 2;
      tx = p.x + Math.sin(a) * d; tz = p.z + Math.cos(a) * d; ty = by + 3 + (2.6 - this.stateT) * 2.2;
      lx = p.x; ly = by + 1.4; lz = p.z; this.camH = p.h;
    } else if (this.state === 'finished') {
      // la cámara gira desde atrás hasta ponerse delante del ganador
      const e = Math.min(1, this.stateT / 1.6), ease = e * e * (3 - 2 * e);
      const a = this.camH + Math.PI + Math.PI * ease + Math.sin(Math.max(0, this.stateT - 1.6) * 0.6) * 0.9, d = 9.5;
      this.camH += wrapA(p.h - this.camH) * Math.min(1, dt * 4);
      tx = p.x + Math.sin(a) * d; tz = p.z + Math.cos(a) * d; ty = by + 4.3 - ease * 1.3;
      lx = p.x; ly = by + 1.6; lz = p.z;
    } else {
      const vh = p.speed > 8 ? Math.atan2(p.vx, p.vz) : p.h;
      const target = p.h + wrapA(vh - p.h) * 0.55;
      this.camH += wrapA(target - this.camH) * Math.min(1, dt * 5.5);
      const sk = clamp(p.speed / p.maxSpeed, 0, 1.4), d = (portrait ? 11.5 : 9) + sk * 1.2 - (p.boostT > 0 ? 0.8 : 0), high = p.mode === 'glide' || !!p.flight; // en el aire la cámara sube con el coche
      tx = p.x - Math.sin(this.camH) * d; tz = p.z - Math.cos(this.camH) * d; ty = by + (portrait ? 5.4 : 4.3) + p.hopY * (high ? 0.9 : 0.35) + p.bob * 0.6 - p.slopeF * 4;
      lx = p.x + Math.sin(this.camH) * 6; lz = p.z + Math.cos(this.camH) * 6; ly = by + 1.7 + p.slopeF * 6 + p.hopY * (high ? 0.8 : 0.25) + p.bob * 0.6;
      fov = 66 + sk * 8 + (p.boostT > 0 ? 13 : 0);
    }
    cam.position.set(tx, ty, tz);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 1.4; cam.position.y += (Math.random() - 0.5) * this.shake * 1.4;
    }
    if (portrait) fov += 16;
    this.fov += (fov - this.fov) * Math.min(1, dt * 5);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.lookAt(lx, ly, lz);
    this.camPos.copy(cam.position);
  }

  dispose() {
    this.hazards.dispose(); this.weather.dispose(); this.marks.dispose();
    this.emotes.dispose();
    for (const r of this.racers) r.trail.dispose();
    if (this.rivalTag) this.rivalTag.material.dispose();
    for (const b of this.bolts) { b.line.geometry.dispose(); b.line.material.dispose(); }
    this.shieldGeo.dispose(); this.shieldMat.dispose(); this.peelGeo.dispose(); this.cocoGeo.dispose(); this.waveGeo.dispose();
  }
}
