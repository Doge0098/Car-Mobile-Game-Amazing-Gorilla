// Tutorial: una primera carrera guiada. Las lecciones son datos; el motor solo decide cuál toca mostrar.
// Ninguna lección bloquea la carrera: todas caducan solas (max) si el jugador las ignora.

// Reglas de la carrera del tutorial (main.js las aplica al crear la carrera)
export const TUTORIAL = {
  track: 'selva', laps: 1, rivals: 2, reward: 50,
  difficulty: { id: 'tutorial', name: 'Tutorial', ai: 0.7, reward: 0 },
  tune: { maxSpeed: -9 }, // el jugador va algo más despacio para que dé tiempo a leer
};

// Lección: { id, text, hl, start(c), done(c), max, ok, label, learned(c), urgent, tries, stage(c) }
//  text: frase o lista de frases (la elige stage) · hl: ids de los botones que se resaltan (o una lista por fase)
//  start: cuándo puede empezar · done: cuándo se da por aprendida (sin done, dura hasta max) · max: segundos en pantalla
//  ok: felicitación al completarla · label + learned: línea del resumen final y si se consiguió · urgent: interrumpe a las demás (va ligada a un sitio)
//  tries: veces que puede volver a salir si no se completa
// c es el propio tutorial: { state, racing, p (jugador), st (sus estadísticas), steerT, rampAhead, tilt }
export const LESSONS = [
  { id: 'hello', max: 5, text: '¡Bienvenido! Tu coche acelera solo: tú solo tienes que girar.',
    start: c => c.state === 'intro', done: c => c.state !== 'intro' },
  { id: 'start', max: 6, label: 'Salida turbo', hl: ['btn-drift'], text: 'Truco: pulsa DERRAPE justo cuando salga «¡YA!» para una salida turbo.',
    start: c => c.state === 'countdown', done: c => c.racing, learned: c => c.st.startBoost },
  { id: 'steer', max: 9, label: 'Girar', hl: [['btn-left', 'btn-right'], []],
    text: ['Gira con ◀ y ▶ para seguir la carretera.', 'Inclina el móvil a los lados para girar.'], stage: c => (c.tilt ? 1 : 0),
    start: c => c.racing, done: c => c.steerT > 1, learned: c => c.steerT > 1, ok: '¡Muy bien!' },
  { id: 'drift', max: 30, label: 'Mini-turbo derrapando', hl: ['btn-drift'],
    text: ['En las curvas, gira y mantén pulsado DERRAPE.', '¡Eso es! Aguanta el derrape hasta que salgan chispas azules…', '¡Chispas! Suelta DERRAPE ahora para un mini-turbo.'],
    stage: c => (!c.p.drifting ? 0 : c.p.charge > 0.75 ? 2 : 1),
    start: c => c.racing && !c.p.mode, done: c => c.st.miniturbos > 0, learned: c => c.st.miniturbos > 0, ok: '¡Mini-turbo! Cuanto más aguantes, más fuerte será.' },
  { id: 'item', max: 40, label: 'Usar un objeto', hl: [[], [], ['btn-item', 'hud-item']],
    text: ['Atraviesa una caja ? para conseguir un objeto.', '¡Caja abierta! A ver qué te toca…', 'Pulsa OBJETO para usar lo que te ha tocado.'],
    stage: c => (c.p.item ? 2 : c.p.rolling > 0 ? 1 : 0),
    start: c => c.racing, done: c => c.st.items > 0, learned: c => c.st.items > 0, ok: '¡Bien usado! Hay objetos para atacar, defenderte y correr más.' },
  { id: 'bananas', max: 6, text: 'Recoge plátanos 🍌: corres más y sirven para comprar en el garaje.', start: c => c.racing },
  { id: 'horn', max: 5, hl: ['btn-item'], text: 'Cuando no lleves objeto, el botón OBJETO toca la bocina.', start: c => c.racing && !c.p.item },
  // ligadas a un punto del circuito
  { id: 'ramp', urgent: true, tries: 2, max: 7, label: 'Truco en una rampa', hl: ['btn-drift'],
    text: ['¡Rampa azul! Cuando estés en el aire, pulsa DERRAPE para hacer un truco.', '¡Ahora! Pulsa DERRAPE.'], stage: c => (c.p.air ? 1 : 0),
    start: c => c.rampAhead, done: c => c.st.tricks > 0 || c.p.trickDone, learned: c => c.st.tricks > 0, ok: '¡Truco! Al aterrizar ganas un impulso.' },
  { id: 'boat', urgent: true, max: 4, text: 'En el agua tu coche se transforma en barco. ¡Se conduce igual!', start: c => c.p.mode === 'boat' },
  { id: 'glide', urgent: true, max: 4, text: '¡Ala delta! Gira para planear y pasa por los aros para ganar impulso.', start: c => c.p.mode === 'glide' },
  { id: 'sub', urgent: true, max: 4, text: 'Bajo el agua eres un submarino. Sigue los aros.', start: c => c.p.mode === 'sub' },
];

const NONE = [];
const RAMP_WARN = 130; // distancia a la que se avisa de una rampa

export class Tutorial {
  constructor(race, { tilt = false } = {}) {
    this.race = race; this.tilt = tilt;
    this.list = LESSONS.map(def => ({ def, t: 0, left: def.tries || 1, fin: false }));
    this.cur = null; this.stage = -1; this.praiseT = 0;
    this.text = ''; this.hl = NONE; this.good = false; this.rev = 0; // lo que hay que pintar; rev cambia cuando cambia
    this.state = race.state; this.racing = false; this.p = race.player; this.st = race.player.st; this.steerT = 0; this.rampAhead = false;
  }

  set(text, hl, good) {
    if (text === this.text && hl === this.hl && good === this.good) return;
    this.text = text; this.hl = hl; this.good = good; this.rev++;
  }

  update(dt, input) {
    const r = this.race, p = this.p, tr = r.track;
    this.state = r.state; this.racing = r.state === 'racing';
    if (r.state === 'finished') { this.cur = null; this.set('', NONE, false); return; }
    if (this.racing && Math.abs(input.steer) > 0.3) this.steerT += dt;
    this.rampAhead = false;
    if (this.racing && !p.mode) for (const rp of tr.ramps) {
      let di = rp.idx - p.idx; if (di < 0) di += tr.N;
      if (di * tr.spacing < RAMP_WARN) this.rampAhead = true;
    }
    if (this.praiseT > 0) { this.praiseT -= dt; if (this.praiseT > 0) return; this.set('', NONE, false); }
    // qué lección toca: una urgente interrumpe a las normales; si no, la primera pendiente que pueda empezar
    let cur = this.cur;
    if (!cur || !cur.def.urgent) for (const l of this.list) if (l.def.urgent && !l.fin && l.def.start(this)) { cur = l; break; }
    if (!cur) for (const l of this.list) if (!l.def.urgent && !l.fin && l.def.start(this)) { cur = l; break; }
    if (cur !== this.cur) { this.cur = cur; this.stage = -1; }
    if (!cur) { this.set('', NONE, false); return; }
    const d = cur.def;
    cur.t += dt;
    if (d.done && d.done(this)) {
      cur.fin = true; this.cur = null;
      if (d.ok) { this.praiseT = 2; this.set(d.ok, NONE, true); } else this.set('', NONE, false);
      return;
    }
    if (cur.t > d.max) { // caducada: se retira (o se deja para otro intento)
      cur.t = 0; if (--cur.left <= 0) cur.fin = true;
      this.cur = null; this.set('', NONE, false);
      return;
    }
    const s = d.stage ? d.stage(this) : 0;
    if (s !== this.stage) {
      this.stage = s;
      this.set(Array.isArray(d.text) ? d.text[s] : d.text, !d.hl ? NONE : Array.isArray(d.hl[0]) ? d.hl[s] : d.hl, false);
    }
  }

  // Resumen para la pantalla final: [{ text, done }] de las lecciones con nombre
  summary() { return LESSONS.filter(d => d.label).map(d => ({ text: d.label, done: !!d.learned(this) })); }
}
