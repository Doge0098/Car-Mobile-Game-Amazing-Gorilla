// Reglas de los modos especiales: eliminación y batalla de globos.
import * as THREE from './vendor/three.module.min.js';
import * as A from './audio.js';

const BAL_COL = [0xff3b4a, 0xffd21f, 0x22e6ff];
let balGeo = null, strGeo = null;
const balMats = BAL_COL.map(c => new THREE.MeshBasicMaterial({ color: c }));
const strMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

export class Rules {
  constructor(race) {
    this.race = race; this.kind = race.mode; // 'elim' | 'battle'
    this.outOrder = []; this.timer = this.kind === 'elim' ? 22 : 150; this.period = 16; this.danger = false; this.over = false;
    race.laps = 999;
    if (this.kind === 'battle') {
      race.boxRespawn = 1.6;
      if (!balGeo) { balGeo = new THREE.SphereGeometry(0.42, 10, 8); strGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.5, 4); }
      for (const r of race.racers) {
        r.balloons = 3; r.balMeshes = [];
        for (let i = 0; i < 3; i++) {
          const g = new THREE.Group(), b = new THREE.Mesh(balGeo, balMats[i]), s = new THREE.Mesh(strGeo, strMat);
          b.position.y = 1.5; b.scale.y = 1.2; s.position.y = 0.75; g.add(b, s);
          g.position.set((i - 1) * 0.55, 2.2, -1.5); g.rotation.z = (1 - i) * 0.28; g.userData.ph = i * 2.1 + r.slot;
          r.tilt.add(g); r.balMeshes.push(g);
        }
      }
    }
  }

  active() { return this.race.racers.filter(r => !r.out); }

  // Elimina a un corredor (humo, desaparece y deja de contar)
  knockOut(r) {
    if (r.out) return;
    const race = this.race;
    r.out = true; r.speed = 0; r.vx = r.vz = 0; r.root.visible = r.isPlayer; r.trail.mesh.visible = r.isPlayer;
    this.outOrder.push(r);
    race.live = race.racers.filter(x => !x.out || x.isPlayer); // el jugador eliminado sigue rodando, ya sin contar
    race.fx.norm.burst(r.x, r.y + 1.2, r.z, 30, [0xffffff, 0xdddddd, 0x9aa0b0], 12, 16, 0.9, 4);
    race.fx.add.burst(r.x, r.y + 1.5, r.z, 20, [0xffd21f, 0xff5a3c], 10, 9, 0.6, 10);
    if (r.isPlayer || r.near()) A.sfx.pop?.(r.isPlayer ? 0 : race.panOf(r.x, r.z), 1);
    race.emit('out', { name: r.char.name, isPlayer: r.isPlayer, left: this.active().length });
    this.check();
  }

  // ¿Ha terminado la partida?
  check() {
    const race = this.race, p = race.player, act = this.active();
    if (this.over || race.state !== 'racing') return;
    if (p.out || act.length <= 1 || (this.kind === 'battle' && this.timer <= 0)) {
      this.over = true; race.ranking();
      p.finished = true; p.finishTime = race.time; race.state = 'finished'; race.stateT = 0;
      race.emit('finish', p.pos);
      race.voice(p, p.pos <= 3 ? 'cheer' : 'sad');
    }
  }

  // Batalla: cada golpe revienta un globo
  onHit(r, by) {
    if (this.kind !== 'battle' || r.out || r.balloons <= 0) return;
    r.balloons--;
    const g = r.balMeshes[r.balloons]; g.visible = false;
    this.race.fx.add.burst(r.x, r.y + 3.6, r.z, 16, [BAL_COL[r.balloons], 0xffffff], 9, 8, 0.5, 8);
    if (r.isPlayer || r.near()) A.sfx.pop?.(r.isPlayer ? 0 : this.race.panOf(r.x, r.z), 1);
    if (by && by !== r) by.pops = (by.pops || 0) + 1;
    if (r.balloons <= 0) this.knockOut(r);
  }

  // Objetos más agresivos en la batalla
  rollItem(r) {
    if (this.kind !== 'battle') return null;
    const w = { coco: 3, peel: 2.5, barrel: 2.5, drum: 1.6, shield: 1.6, turbo: 1.2, bolt: 0.8, fury: 0.6 };
    let tot = 0; for (const k in w) tot += w[k];
    let x = Math.random() * tot;
    for (const k in w) { x -= w[k]; if (x <= 0) return k; }
    return 'coco';
  }

  // Clasificación propia del modo
  rank() {
    const act = this.active();
    if (this.kind === 'battle') act.sort((a, b) => b.balloons - a.balloons || (b.pops || 0) - (a.pops || 0));
    else act.sort((a, b) => b.prog - a.prog);
    const arr = act.concat(this.outOrder.slice().reverse());
    arr.forEach((r, i) => { r.pos = i + 1; });
    return arr;
  }

  update(dt) {
    const race = this.race;
    if (this.kind === 'battle') for (const r of race.racers) if (!r.out) for (const g of r.balMeshes) if (g.visible) g.rotation.x = Math.sin(race.t * 3 + g.userData.ph) * 0.12 - Math.min(0.5, r.speed * 0.006);
    if (race.state !== 'racing' || this.over) return;
    this.timer -= dt;
    if (this.kind === 'elim') {
      const act = this.active(); let last = act[0];
      for (const r of act) if (r.prog < last.prog) last = r;
      this.danger = last === race.player;
      if (this.timer <= 0) { this.timer = this.period; this.knockOut(last); }
    } else if (this.timer <= 0) this.check();
  }
}
