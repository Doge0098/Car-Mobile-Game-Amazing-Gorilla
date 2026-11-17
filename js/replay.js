// Repetición de la carrera: graba la posición de todos los coches y la reproduce con cámaras de cine.
const STEP = 0.1, F = 8; // datos por coche: x, z, rumbo, salto, banderas, volante, velocidad, altura
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const MODES = [null, 'boat', 'glide', 'sub'];

export class Replay {
  constructor(race) {
    this.race = race; this.n = race.racers.length; this.frames = []; this.acc = STEP; this.playing = false; this.t = 0;
    this.cut = -1; this.camFix = { x: 0, y: 0, z: 0 }; this.fov = 50;
  }

  // Guarda una muestra cada décima de segundo (máximo ~4 minutos)
  record(dt) {
    this.acc += dt; if (this.acc < STEP || this.frames.length > 2400) return;
    this.acc -= STEP;
    const f = new Float32Array(this.n * F);
    this.race.racers.forEach((r, i) => {
      const o = i * F;
      f[o] = r.x; f[o + 1] = r.z; f[o + 2] = r.h; f[o + 3] = r.hopY;
      f[o + 4] = (r.drifting ? 1 : 0) | (r.boostT > 0 ? 2 : 0) | (r.spinT > 0 ? 4 : 0) | (r.furyT > 0 ? 8 : 0) | (r.out ? 16 : 0) | (r.shieldT > 0 ? 32 : 0) | (r.shrinkT > 0 ? 64 : 0) | (MODES.indexOf(r.mode) << 8);
      f[o + 5] = r.steer; f[o + 6] = r.speed; f[o + 7] = r.y;
    });
    this.frames.push(f);
  }

  get duration() { return (this.frames.length - 1) * STEP; }

  start() {
    const race = this.race;
    this.playing = true; this.t = 0; this.cut = -1; race.replaying = true; race.state = 'replay';
    this.keep = race.racers.map(r => ({ finished: r.finished, prog: r.prog, idx: r.idx, x: r.x, z: r.z, h: r.h, y: r.y }));
    if (race.ghost) race.ghost.visible = false;
    for (const r of race.racers) { r.finished = false; r.spinT = 0; r.boostT = 0; r.poundT = 0; r.tauntT = 0; r.lookT = 0; r.trickT = 0; r.root.visible = true; r.trail.reset(r.x, r.y, r.z); }
  }

  stop() {
    const race = this.race; this.playing = false; race.replaying = false; race.state = 'finished';
    race.racers.forEach((r, i) => {
      const k = this.keep[i]; Object.assign(r, k); r.hopY = 0; r.speed = 0; r.vx = r.vz = 0; r.spinT = 0; r.boostT = 0; r.drifting = false; r.charge = 0;
      const z = race.track.samples[r.idx].zone; if (z !== r.mode) race.setMode(r, z === 'glide' ? null : z, true);
      r.root.visible = !r.out || r.isPlayer; r.trail.reset(r.x, r.y, r.z);
    });
  }

  // Devuelve false cuando la repetición termina
  update(dt, cam) {
    const race = this.race, tr = race.track;
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
      r.spinT = fl & 4 ? (r.spinT > 0.05 ? r.spinT - dt : 1.25) : 0;
      r.off = Math.abs((r.x - tr.samples[r.idx].x) * tr.samples[r.idx].nx + (r.z - tr.samples[r.idx].z) * tr.samples[r.idx].nz) > tr.hw + 1.6 && !tr.samples[r.idx].zone;
      const mode = MODES[(fl >> 8) & 3]; if (mode !== r.mode) race.setMode(r, mode);
      r.root.visible = !(fl & 16);
      if (r.root.visible) r.visuals(dt, race.t);
    });
    // cámaras: cambia de plano cada 5 segundos
    const p = race.player, cut = Math.floor(this.t / 5), kind = cut % 4, py = p.y + p.hopY;
    const fx = Math.sin(p.h), fz = Math.cos(p.h);
    if (cut !== this.cut) {
      this.cut = cut;
      if (kind === 0) { const s = tr.samples[(p.idx + 24) % tr.N], side = cut % 8 < 4 ? 1 : -1, lat = Math.min(tr.hw + 7, s.lim) * side; this.camFix.x = s.x + s.nx * lat; this.camFix.z = s.z + s.nz * lat; this.camFix.y = s.y + s.air + 3.2; }
    }
    let fov = 50;
    if (kind === 0) { cam.position.set(this.camFix.x, this.camFix.y, this.camFix.z); fov = 38; }
    else if (kind === 1) cam.position.set(p.x + fx * 10 + fz * 2.5, py + 2.6, p.z + fz * 10 - fx * 2.5);
    else if (kind === 2) { cam.position.set(p.x - fx * 17, py + 11, p.z - fz * 17); fov = 56; }
    else cam.position.set(p.x + fz * 11 - fx * 2, py + 2.4, p.z - fx * 11 - fz * 2);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.lookAt(p.x, py + 1.3, p.z);
    race.camPos.copy(cam.position);
    return true;
  }
}
