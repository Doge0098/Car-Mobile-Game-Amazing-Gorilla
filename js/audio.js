// Música, efectos, voces de gorila, ambiente y motores generados con WebAudio (sin archivos externos).
import { rng } from './data.js';

let ctx = null, master, limiter, musicGain, sfxGain, noiseBuf, bassWave, paused = false, graceT = 0;
let duck, wetBus, jBus, dly, dlySend, revSend, engBus, tunSend, ambGain; // buses fijos
let mDry = null, mWet = null;                                            // buses de la canción actual
let engine = null, rivals = [], tunnelOn = false;
let musicTimer = null, song = null, nextStepTime = 0, stepIdx = 0, intensity = 0, tempoMul = 1;
let amb = null, ambWant = null, hapticsOn = true;
const vol = { music: 0.6, sfx: 0.8 }, MUSIC_LEVEL = 0.7;

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const gainNode = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
// ¿Se puede sonar ya? (en pausa explícita los avisos quedan en cola hasta reanudar)
const live = () => ctx && (paused || ctx.state === 'running' || performance.now() < graceT);

function wake() {
  paused = false; graceT = performance.now() + 800;
  const p = ctx.resume(); if (p && p.catch) p.catch(() => {});
}

export function initAudio() {
  if (ctx) { if (ctx.state !== 'running') wake(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch (e) { ctx = null; return; }
  // Salida: compresor + recorte suave (lineal hasta 0.6, techo ≈ 0.9), así nada satura aunque suene todo a la vez
  master = ctx.createDynamicsCompressor();
  master.threshold.value = -15; master.knee.value = 12; master.ratio.value = 14;
  master.attack.value = 0.003; master.release.value = 0.2;
  limiter = ctx.createWaveShaper();
  const curve = new Float32Array(2049);
  for (let i = 0; i < 2049; i++) { const x = i / 1024 - 1, a = Math.abs(x); curve[i] = a <= 0.6 ? x : Math.sign(x) * (0.6 + 0.38 * Math.tanh((a - 0.6) / 0.38)); }
  limiter.curve = curve; master.connect(limiter); limiter.connect(ctx.destination);
  musicGain = gainNode(vol.music * MUSIC_LEVEL, master); sfxGain = gainNode(vol.sfx, master);
  bassWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.4, 0.22, 0.1, 0.06])); // bajo con armónicos (se oye en altavoces pequeños)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Música: `duck` la baja durante los jingles; `wetBus` añade envíos a eco realimentado y reverb de impulso generado
  duck = gainNode(1, musicGain); wetBus = gainNode(1, duck); jBus = gainNode(1, musicGain);
  dly = ctx.createDelay(1); dlySend = gainNode(0, dly); wetBus.connect(dlySend);
  const lp = ctx.createBiquadFilter(), rev = ctx.createConvolver(), n = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, n, ctx.sampleRate);
  lp.frequency.value = 2600; dly.connect(lp); lp.connect(gainNode(0.36, dly)); lp.connect(musicGain);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
  rev.buffer = ir; rev.connect(musicGain); revSend = gainNode(0, rev); wetBus.connect(revSend); jBus.connect(gainNode(0.35, rev));
  // Motores: bus propio + eco corto de túnel (dos retardos en anillo)
  engBus = gainNode(1, sfxGain); tunSend = gainNode(0);
  const d1 = ctx.createDelay(0.5), d2 = ctx.createDelay(0.5), tl = ctx.createBiquadFilter(), to = gainNode(0.8, sfxGain);
  d1.delayTime.value = 0.067; d2.delayTime.value = 0.109; tl.frequency.value = 1700;
  engBus.connect(tunSend); tunSend.connect(d1); d1.connect(d2); d2.connect(tl); tl.connect(gainNode(0.5, d1)); d1.connect(to); d2.connect(to);
  ambGain = gainNode(0.6, sfxGain);
  wake();
  if (song) { const i = intensity; startMusic(song.def); intensity = i; }
  if (ambWant) startAmbience(ambWant);
}

export function setVolumes(music, sfxVol) {
  vol.music = clamp(+music || 0, 0, 1); vol.sfx = clamp(+sfxVol || 0, 0, 1);
  if (!ctx) return;
  musicGain.gain.value = vol.music * MUSIC_LEVEL;
  sfxGain.gain.value = vol.sfx;
}

export function suspendAudio(on) {
  if (!ctx) return;
  if (on) { paused = true; const p = ctx.suspend(); if (p && p.catch) p.catch(() => {}); } else wake();
}

// Nodo final de salida (o bus 'music' / 'sfx') para pruebas con un AnalyserNode
export const __debugNode = (name = 'master') => ({ master: limiter, music: musicGain, sfx: sfxGain })[name];

// ---------- Utilidades de síntesis ----------
// Oscilador con envolvente (ataque + caída exponencial), deslizamiento y vibrato opcionales
function tone(freq, dur, type = 'square', gain = 0.2, dest = sfxGain, t0 = 0, slideTo = 0, att = 0.008, vibHz = 0, vibAmt = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  if (vibHz) { const l = ctx.createOscillator(); l.frequency.value = vibHz; l.connect(gainNode(vibAmt, o.frequency)); l.start(t); l.stop(t + dur + 0.02); }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

// Ruido filtrado con barrido de frecuencia y ataque opcionales
function noise(dur, gain = 0.2, filterType = 'highpass', f0 = 4000, f1 = 0, dest = sfxGain, t0 = 0, att = 0, q = 1) {
  if (!ctx) return;
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  if (att) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + att); } else g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.9); s.stop(t + dur + 0.02);
}

// Voz FM de 2 operadores: marimba, campanas, steel drum, piano eléctrico
function fm(freq, dur, gain, dest, t0 = 0, ratio = 2, index = 2, mdec = 0.15) {
  if (!ctx) return;
  const t = ctx.currentTime + t0;
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = freq; m.frequency.value = freq * ratio;
  mg.gain.setValueAtTime(freq * index, t); mg.gain.exponentialRampToValueAtTime(freq * index * 0.04 + 0.01, t + mdec);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest);
  c.start(t); m.start(t); c.stop(t + dur + 0.02); m.stop(t + dur + 0.02);
}

// Voz sustractiva: 1-2 osciladores desafinados -> paso bajo con barrido -> envolvente con sostenido (vibrato en notas largas)
function syn(freq, dur, gain, dest, t0 = 0, type = 'sawtooth', cut = 2200, att = 0.012, det = 6, vib = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + t0, end = t + dur + 0.12, f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.frequency.setValueAtTime(cut * 2.2, t); f.frequency.exponentialRampToValueAtTime(cut, t + att + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + att);
  g.gain.setTargetAtTime(gain * 0.65, t + att, 0.12); g.gain.setTargetAtTime(0, t + dur, 0.025);
  f.connect(g); g.connect(dest);
  let lg = null;
  if (vib && dur > 0.3) {
    const l = ctx.createOscillator(); lg = ctx.createGain(); l.frequency.value = 5.5;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(freq * 0.011, t + 0.3);
    l.connect(lg); l.start(t); l.stop(end);
  }
  for (let i = det ? -1 : 1; i <= 1; i += 2) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = i * det;
    if (lg) lg.connect(o.frequency);
    o.connect(f); o.start(t); o.stop(end);
  }
}

// Acorde: varias notas -> un filtro -> una envolvente (colchón, golpes a contratiempo o pad con puerta rítmica)
function chord(freqs, dur, gain, dest, t0, type, cut, att, gate, stepDur) {
  if (!ctx) return;
  const t = ctx.currentTime + t0, f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.frequency.value = cut; f.connect(g); g.connect(dest);
  g.gain.setValueAtTime(0, t);
  if (gate) for (let k = 0; k < 16; k++) g.gain.setTargetAtTime(gate[k] === 'x' ? gain : gain * 0.1, t + k * stepDur, 0.012);
  else g.gain.linearRampToValueAtTime(gain, t + att);
  g.gain.setTargetAtTime(0, t + dur, 0.03);
  for (const fr of freqs) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = rnd(-7, 7);
    o.connect(f); o.start(t); o.stop(t + dur + 0.14);
  }
}

// Destino con paneo y volumen para sonidos puntuales (se libera solo al acabar sus fuentes)
function bus(pan = 0, v = 1, dest = sfxGain) {
  pan = clamp(+pan || 0, -1, 1); v = isFinite(v) ? Math.max(0, +v) : 1;
  const sp = pan && ctx.createStereoPanner;
  if (!sp && v === 1) return dest;
  const g = gainNode(v);
  if (sp) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(dest); } else g.connect(dest);
  return g;
}

// Cambio suave de un parámetro; omite valores casi idénticos para no programar eventos en cada fotograma
function glide(p, v, tc) {
  if (Math.abs(v - p._v) <= Math.abs(v) * 0.004) return;
  p._v = v; p.setTargetAtTime(v, ctx.currentTime, tc);
}

// ---------- Efectos puntuales: sfx.nombre(pan = 0, vol = 1) ----------
const S = {
  ui(d) { tone(660, 0.07, 'square', 0.12, d); tone(990, 0.08, 'square', 0.1, d, 0.05); },
  back(d) { tone(500, 0.07, 'square', 0.1, d); tone(330, 0.09, 'square', 0.1, d, 0.05); },
  buy(d) { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.22, d, i * 0.07)); tone(2093, 0.35, 'sine', 0.07, d, 0.28); },
  deny(d) { tone(160, 0.2, 'sawtooth', 0.15, d); tone(113, 0.22, 'sawtooth', 0.13, d, 0.1); },
  count(d) { tone(440, 0.18, 'square', 0.2, d); tone(220, 0.12, 'triangle', 0.15, d); },
  go(d) { tone(880, 0.5, 'square', 0.22, d); tone(1320, 0.5, 'triangle', 0.15, d); tone(1760, 0.35, 'sine', 0.08, d, 0.04); },
  coin(d) { tone(1320, 0.06, 'square', 0.1, d); tone(1760, 0.14, 'square', 0.1, d, 0.05); },
  tick(d) { tone(1200, 0.03, 'square', 0.07, d); },
  item(d) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.14, d, i * 0.05)); },
  boost(d) { noise(0.7, 0.3, 'bandpass', 500, 5000, d); tone(180, 0.6, 'sawtooth', 0.14, d, 0, 900); },
  miniturbo(d) { noise(0.35, 0.2, 'bandpass', 900, 5000, d); tone(300, 0.3, 'sawtooth', 0.1, d, 0, 1000); },
  hit(d) { tone(500, 0.5, 'sawtooth', 0.22, d, 0, 70); noise(0.3, 0.3, 'lowpass', 1800, 200, d); tone(140, 0.15, 'sine', 0.3, d, 0, 60); },
  bump(d) { noise(0.12, 0.25, 'lowpass', 900, 200, d); tone(120, 0.1, 'sine', 0.25, d); },
  throw(d) { tone(300, 0.25, 'triangle', 0.18, d, 0, 900); noise(0.2, 0.08, 'bandpass', 1200, 3500, d); },
  drop(d) { tone(500, 0.15, 'triangle', 0.15, d, 0, 200); },
  shield(d) { tone(520, 0.3, 'sine', 0.2, d, 0, 1040); tone(780, 0.3, 'sine', 0.12, d, 0.1, 1560); },
  shieldBreak(d) { noise(0.25, 0.25, 'highpass', 3000, 800, d); tone(900, 0.2, 'triangle', 0.15, d, 0, 300); },
  drum(d) { for (let i = 0; i < 6; i++) { tone(110, 0.16, 'sine', 0.5, d, i * 0.1, 50); noise(0.06, 0.2, 'lowpass', 500, 0, d, i * 0.1); } },
  fury(d) { tone(90, 0.9, 'sawtooth', 0.25, d, 0, 240); tone(135, 0.9, 'sawtooth', 0.15, d, 0.05, 360); noise(0.8, 0.15, 'lowpass', 700, 1500, d); },
  lap(d) { [659, 880, 1319].forEach((f, i) => tone(f, 0.14, 'square', 0.16, d, i * 0.09)); },
  finalLap(d) { [659, 659, 659, 1047].forEach((f, i) => tone(f, i === 3 ? 0.4 : 0.09, 'square', 0.18, d, i * 0.11)); },
  finish(d) { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.18, d, i * 0.13)); },
  lose(d) { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, d, i * 0.18)); },
  jump(d) { tone(300, 0.18, 'sine', 0.15, d, 0, 700); },
  // --- clima, objetos y pista ---
  thunder(d) { noise(0.12, 0.4, 'highpass', 2500, 700, d); noise(2, 0.55, 'lowpass', 600, 50, d, 0.03); noise(1.1, 0.3, 'lowpass', 300, 70, d, 0.5, 0.25); tone(60, 1.7, 'sine', 0.3, d, 0.03, 32); },
  zap(d) { for (let i = 0; i < 7; i++) tone(rnd(900, 3200), 0.045, 'sawtooth', 0.14, d, i * 0.035, rnd(200, 700)); noise(0.3, 0.2, 'highpass', 5000, 1500, d); tone(110, 0.25, 'square', 0.12, d, 0, 55); },
  shrink(d) { tone(1300, 0.5, 'triangle', 0.2, d, 0, 190, 0.008, 22, 60); [988, 784, 587, 440].forEach((f, i) => tone(f, 0.08, 'square', 0.07, d, i * 0.1)); },
  grow(d) { tone(190, 0.5, 'triangle', 0.2, d, 0, 1300, 0.008, 22, 60); [440, 587, 784, 988].forEach((f, i) => tone(f, 0.08, 'square', 0.07, d, i * 0.1)); },
  magnet(d) { tone(140, 0.6, 'sawtooth', 0.12, d, 0, 420, 0.05, 14, 40); tone(700, 0.6, 'sine', 0.1, d, 0, 1400, 0.05, 9, 120); },
  thud(d) { tone(190, 0.13, 'sine', 0.4, d, 0, 70); tone(430, 0.05, 'triangle', 0.18, d); noise(0.05, 0.18, 'bandpass', 800, 0, d); },
  crash(d) { noise(0.35, 0.35, 'bandpass', 1400, 300, d); for (let i = 0; i < 5; i++) noise(0.045, 0.28, 'bandpass', rnd(600, 2400), 0, d, i * 0.05 + rnd(0, 0.02), 0, 4); tone(150, 0.2, 'triangle', 0.3, d, 0, 60); },
  splash(d) { noise(0.5, 0.3, 'bandpass', 1600, 500, d); noise(0.35, 0.14, 'highpass', 5000, 0, d, 0.03); tone(320, 0.15, 'sine', 0.18, d, 0, 90); },
  geyser(d) { noise(1.2, 0.3, 'bandpass', 700, 4500, d, 0, 0.25); noise(1.2, 0.4, 'lowpass', 300, 120, d, 0, 0.15); tone(60, 1.1, 'sawtooth', 0.14, d, 0, 120, 0.2); },
  meteorFall(d) { tone(2600, 1.4, 'sine', 0.16, d, 0, 320, 1.15); noise(1.4, 0.12, 'bandpass', 3000, 500, d, 0, 1.2); },
  meteorHit(d) { noise(0.1, 0.4, 'highpass', 2000, 500, d); noise(0.9, 0.6, 'lowpass', 1400, 70, d); tone(120, 0.7, 'sine', 0.6, d, 0, 30); },
  land(d) { tone(150, 0.14, 'sine', 0.45, d, 0, 50); noise(0.1, 0.25, 'lowpass', 700, 150, d); },
  ramp(d) { noise(0.4, 0.22, 'bandpass', 400, 3200, d, 0, 0.1); tone(250, 0.35, 'sine', 0.13, d, 0, 950); },
  trick(d) { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, d, i * 0.05)); tone(3136, 0.35, 'sine', 0.07, d, 0.25); },
  startBoost(d) { tone(85, 0.55, 'sawtooth', 0.22, d, 0, 430, 0.03); tone(170, 0.55, 'square', 0.07, d, 0, 860, 0.03); noise(0.7, 0.3, 'bandpass', 600, 6000, d, 0.18, 0.08); },
  stall(d) { [0, 0.11, 0.2, 0.36].forEach((t, i) => { tone(125 - i * 18, 0.09, 'sawtooth', 0.2, d, t, 60); noise(0.06, 0.12, 'lowpass', 600, 200, d, t); }); tone(70, 0.4, 'sawtooth', 0.15, d, 0.47, 32); },
  crowd(d) { noise(1.5, 0.22, 'bandpass', 950, 1300, d, 0, 0.3, 0.8); noise(1.5, 0.12, 'bandpass', 2400, 3000, d, 0, 0.4, 1.2); for (let i = 0; i < 4; i++) { const f = rnd(1500, 2300); tone(f, 0.25, 'sine', 0.035, d, rnd(0.1, 1), f * 1.4, 0.05); } },
  critter(d) { tone(1800, 0.07, 'sine', 0.16, d, 0, 2700); tone(2300, 0.1, 'sine', 0.16, d, 0.09, 3100); },
  whoosh(d) { noise(0.5, 0.25, 'bandpass', 500, 1600, d, 0, 0.18, 0.7); tone(210, 0.5, 'sawtooth', 0.05, d, 0, 140, 0.18); },
  pop(d) { tone(900, 0.05, 'sine', 0.3, d, 0, 200); noise(0.04, 0.3, 'highpass', 2000, 0, d); },
};
export const sfx = {};
for (const k in S) sfx[k] = (pan = 0, v = 1) => { if (live()) S[k](bus(pan, v)); };

// ---------- Bocinas del jugador (id de HORNS en shop.js): sfx.horn(tipo, pan = 0, vol = 1) ----------
const HORN = {
  clasica(d) { for (const t of [0, 0.17]) { tone(440, 0.13, 'square', 0.15, d, t); tone(554, 0.13, 'square', 0.11, d, t); } },                        // ¡mec, mec!
  camion(d) { tone(147, 0.62, 'sawtooth', 0.2, d, 0, 0, 0.03); tone(185, 0.62, 'sawtooth', 0.16, d, 0, 0, 0.03); tone(73.5, 0.62, 'square', 0.1, d, 0, 0, 0.03); }, // dos trompetas graves
  payaso(d) { for (const t of [0, 0.21]) { tone(540, 0.16, 'sawtooth', 0.15, d, t, 300); tone(270, 0.16, 'square', 0.1, d, t, 150); noise(0.05, 0.08, 'bandpass', 900, 0, d, t); } }, // ¡moc-moc!
  melodia(d) { [[392, 0, 0.09], [392, 0.11, 0.09], [392, 0.22, 0.09], [523, 0.33, 0.2], [659, 0.56, 0.3]].forEach(([f, t, l]) => { tone(f, l, 'square', 0.12, d, t); tone(f * 1.26, l, 'square', 0.07, d, t); }); }, // la cu-ca-ra-cha
  espacial(d) { tone(280, 0.5, 'sine', 0.2, d, 0, 1900, 0.01, 19, 90); tone(1900, 0.32, 'triangle', 0.07, d, 0.12, 480); noise(0.3, 0.05, 'bandpass', 3200, 700, d, 0.05); },
};
sfx.horn = (kind = 'clasica', pan = 0, v = 1) => { if (live()) (HORN[kind] || HORN.clasica)(bus(pan, v)); };

// ---------- Voces de gorila: sierra + soplo -> 2 formantes vocales, con contorno de tono por sílaba ----------
const VOW = { u: [340, 800], o: [480, 950], a: [800, 1300], e: [520, 1850], i: [330, 2400] };
// s: sílabas [inicio, duración, tono inicial, tono pico, tono final, vocal inicial, vocal final, amplitud]
// lf/ld: temblor (Hz, profundidad): lento = vibrato, rápido = gruñido · br: soplo · lp: paso bajo · fs: escala de formantes · g: nivel
const VOX = {
  hit: { s: [[0, 0.32, 430, 660, 230, 'a', 'o', 1]] },                                                             // ¡AU!
  laugh: { s: [[0, 0.08, 300, 330, 300, 'u', 'u', 0.7], [0.12, 0.08, 330, 360, 330, 'u', 'u', 0.8], [0.25, 0.1, 400, 450, 400, 'a', 'a', 1],
    [0.38, 0.1, 430, 480, 420, 'a', 'a', 1], [0.51, 0.16, 400, 430, 300, 'a', 'o', 0.9]] },                        // hu hu ha ha haa
  cheer: { s: [[0, 0.14, 280, 380, 400, 'u', 'u', 0.7], [0.19, 0.14, 330, 450, 470, 'u', 'o', 0.8], [0.38, 0.14, 400, 540, 560, 'u', 'a', 0.9],
    [0.57, 0.62, 480, 700, 520, 'a', 'a', 1]] },                                                                   // uh uh uh ¡UAAAH!
  grunt: { s: [[0, 0.16, 170, 215, 120, 'o', 'u', 1]], lf: 46, ld: 0.12, br: 0.3, lp: 2200, g: 1.5 },                               // ¡hmpf!
  roar: { s: [[0, 1, 120, 195, 85, 'o', 'a', 1]], lf: 38, ld: 0.22, br: 0.35, lp: 2000, g: 1.5 },                            // ¡GROOAAR!
  sad: { s: [[0, 0.25, 420, 430, 340, 'u', 'u', 0.8], [0.32, 0.25, 360, 365, 290, 'u', 'u', 0.8], [0.64, 0.5, 310, 300, 190, 'o', 'u', 0.9]], lf: 7.5, ld: 0.035 }, // uu… uu… uuuh
  ooh: { s: [[0, 0.34, 290, 520, 560, 'u', 'o', 1]] },                                                             // ¡uuUH!
  scared: { s: [[0, 0.09, 520, 700, 680, 'e', 'i', 0.9], [0.13, 0.2, 600, 860, 620, 'i', 'a', 1]] },               // ¡ih-IAH!
  tiny: { s: [[0, 0.08, 900, 1300, 1250, 'i', 'i', 0.8], [0.1, 0.16, 1200, 1500, 800, 'i', 'e', 1]], fs: 1.5, g: 2.4 },   // ¡ii-íi! (encogido)
};

export function voice(kind, pitch = 1, pan = 0, v = 1) {
  const def = VOX[kind];
  if (!def || !live()) return;
  pitch = clamp(+pitch || 1, 0.4, 2.5);
  const t0 = ctx.currentTime + 0.01, fs = Math.pow(pitch, 0.45) * (def.fs || 1);
  const o = ctx.createOscillator(), l = ctx.createOscillator(), n = ctx.createBufferSource();
  const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), pre = gainNode(1), lg = gainNode(0, o.frequency);
  const out = ctx.createBiquadFilter(), env = gainNode(0, out); // paso bajo final: voz redonda, sin zumbido agudo
  out.frequency.value = (def.lp || 3400) * fs; out.connect(bus(pan, (isFinite(v) ? +v : 1) * 0.5 * (def.g || 1)));
  o.type = 'sawtooth'; n.buffer = noiseBuf; n.loop = true; l.frequency.value = def.lf || 6.5;
  o.connect(pre); n.connect(gainNode(def.br || 0.12, pre)); l.connect(lg);
  f1.type = f2.type = 'bandpass'; f1.Q.value = 4.5; f2.Q.value = 7;
  pre.connect(f1); pre.connect(f2); f1.connect(env); f2.connect(gainNode(0.7, env));
  let end = t0;
  for (const [at, dur, a, pk, b, v0, v1, amp] of def.s) {
    const t = t0 + at, A = VOW[v0], B = VOW[v1];
    end = t + dur;
    o.frequency.setValueAtTime(a * pitch, t); o.frequency.linearRampToValueAtTime(pk * pitch, t + dur * 0.35); o.frequency.linearRampToValueAtTime(b * pitch, end);
    lg.gain.setValueAtTime(pk * pitch * (def.ld || 0.015), t);
    f1.frequency.setValueAtTime(A[0] * fs, t); f1.frequency.linearRampToValueAtTime(B[0] * fs, t + dur * 0.6);
    f2.frequency.setValueAtTime(A[1] * fs, t); f2.frequency.linearRampToValueAtTime(B[1] * fs, t + dur * 0.6);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(amp, t + Math.min(0.025, dur * 0.3));
    env.gain.linearRampToValueAtTime(amp * 0.8, t + dur * 0.7); env.gain.linearRampToValueAtTime(0, end);
  }
  o.start(t0); l.start(t0); n.start(t0, Math.random());
  o.stop(end + 0.05); l.stop(end + 0.05); n.stop(end + 0.05);
}

// ---------- Motor del jugador, derrape, viento y motores rivales (sonidos continuos) ----------
const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, Math.random() * 1.9); return s; };

export function startEngine() {
  if (!ctx || engine) return;
  const f = ctx.createBiquadFilter(), g = gainNode(0, engBus);
  f.frequency.value = 700; f.Q.value = 1.2; f.connect(g);
  const mk = type => { const o = ctx.createOscillator(); o.type = type; o.connect(f); o.start(); return o; };
  const n = loopNoise(), bf = ctx.createBiquadFilter(), dg = gainNode(0, sfxGain), wf = ctx.createBiquadFilter(), wg = gainNode(0, engBus);
  bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 3; n.connect(bf); bf.connect(dg);   // chirrido de derrape
  wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.5; n.connect(wf); wf.connect(wg);  // viento a alta velocidad
  engine = { o1: mk('sawtooth'), o2: mk('square'), o3: mk('sawtooth'), f, g, n, dg, wg };
  // Rivales: un oscilador más fino por kart -> paso bajo -> paneo -> ganancia
  for (const [type, mul, lv] of [['square', 1.34, 0.036], ['sawtooth', 1.52, 0.04], ['triangle', 1.21, 0.085]]) {
    const o = ctx.createOscillator(), rf = ctx.createBiquadFilter(), rg = gainNode(0, engBus);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = type; rf.frequency.value = 800; o.connect(rf);
    if (p) { rf.connect(p); p.connect(rg); } else rf.connect(rg);
    o.start(); rivals.push({ o, f: rf, p, g: rg, mul, lv });
  }
}

export function updateEngine(speedRatio, drifting, boosting) {
  if (!engine) return;
  speedRatio = clamp(+speedRatio || 0, 0, 2);
  const e = engine, f = 55 + speedRatio * 150 + (boosting ? 40 : 0);
  glide(e.o1.frequency, f, 0.06); glide(e.o2.frequency, f * 0.5, 0.06); glide(e.o3.frequency, f * 1.012 + 0.7, 0.06);
  glide(e.f.frequency, 500 + speedRatio * 1400, 0.1);
  glide(e.g.gain, 0.03 + speedRatio * 0.03, 0.1);
  glide(e.wg.gain, speedRatio * speedRatio * 0.03, 0.2);
  glide(e.dg.gain, drifting ? 0.07 : 0, 0.05);
}

// list: hasta 3 objetos { pan: -1..1, gain: 0..1, pitch: 0..1.3 }; los huecos sobrantes se apagan
export function updateRivalEngines(list) {
  if (!engine) return;
  for (let i = 0; i < rivals.length; i++) {
    const r = rivals[i], k = list && list[i];
    if (!k) { glide(r.g.gain, 0, 0.12); continue; }
    const pt = clamp(+k.pitch || 0, 0, 1.5);
    glide(r.o.frequency, (62 + pt * 150) * r.mul, 0.08);
    glide(r.f.frequency, 600 + pt * 900, 0.1);
    if (r.p) glide(r.p.pan, clamp(+k.pan || 0, -1, 1), 0.08);
    glide(r.g.gain, clamp(+k.gain || 0, 0, 1) * r.lv, 0.1);
  }
}

// Túnel: los motores pasan además por un eco corto y resonante
export function setTunnel(on) {
  on = !!on;
  if (!ctx || on === tunnelOn) return;
  tunnelOn = on;
  tunSend.gain.setTargetAtTime(on ? 0.75 : 0, ctx.currentTime, 0.15);
}

export function stopEngine() {
  if (!engine) return;
  const e = engine, rs = rivals, t = ctx.currentTime;
  engine = null; rivals = []; setTunnel(false);
  const gs = [e.g, e.dg, e.wg, ...rs.map(r => r.g)];
  for (const g of gs) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.03); }
  e.o1.onended = () => gs.forEach(g => g.disconnect());
  for (const o of [e.o1, e.o2, e.o3, e.n, ...rs.map(r => r.o)]) try { o.stop(t + 0.2); } catch (err) { /* ya parado */ }
}

// ---------- Ambiente por mapa: lechos continuos + eventos sueltos al azar ----------
// Ruido del ambiente -> filtro -> ganancia
function bed(a, type, freq, q, gain, dest = a.out) {
  const f = ctx.createBiquadFilter(), g = gainNode(gain, dest);
  f.type = type; f.frequency.value = freq; f.Q.value = q; a.n.connect(f); f.connect(g);
  return { f, g };
}
// Oscilador continuo filtrado (zumbidos, brillos)
function hum(a, freq, type, gain, cut = 20000) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = gainNode(gain, a.out);
  o.type = type; o.frequency.value = freq; f.frequency.value = cut; o.connect(f); f.connect(g); o.start(); a.src.push(o);
  return g;
}
// LFO sobre varios parámetros: (parámetro, profundidad, ...)
function lfo(a, hz, type, ...targets) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz;
  for (let i = 0; i < targets.length; i += 2) o.connect(gainNode(targets[i + 1], targets[i]));
  o.start(); a.src.push(o);
}

// gap: segundos entre eventos · wx: nivel máximo de la capa de clima (a.wx) · ev(d): evento puntual hacia el destino d
const AMBS = {
  jungle: { gap: [0.5, 2.4], wx: 0.11,
    build(a) {
      bed(a, 'lowpass', 420, 0.5, 0.1);                                                    // brisa en el follaje
      lfo(a, 11, 'square', bed(a, 'bandpass', 5400, 16, 0.05).g.gain, 0.04);               // insectos
      bed(a, 'bandpass', 3800, 0.4, 1, a.wx);                                               // lluvia
    },
    ev(d) {
      const k = Math.random(), f = rnd(2200, 3800);
      if (k < 0.45) for (let i = 0; i < 2 + ((k * 20) | 0) % 3; i++) tone(f, 0.07, 'sine', 0.06, d, i * 0.12, f * 1.35);   // pío pío
      else if (k < 0.7) { tone(980, 0.16, 'sine', 0.06, d, 0, 760); tone(760, 0.24, 'sine', 0.06, d, 0.24, 690); }      // cu-cú
      else if (k < 0.9) for (let i = 0; i < 9; i++) tone(f * 0.9, 0.03, 'triangle', 0.035, d, i * 0.05);                // trino
      else for (let i = 0; i < 3; i++) tone(230, 0.08, 'square', 0.025, d, i * 0.16, 170);                              // rana
    } },
  beach: { gap: [3, 8],
    build(a) {
      const w = bed(a, 'lowpass', 650, 0.5, 0.08), s = bed(a, 'bandpass', 2600, 0.6, 0.012);                            // ola + espuma
      lfo(a, 0.11, 'sine', w.g.gain, 0.06, w.f.frequency, 380, s.g.gain, 0.011);
    },
    ev(d) { const n = 2 + ((Math.random() * 2) | 0), f = rnd(1300, 1700); for (let i = 0; i < n; i++) tone(f, 0.26, 'triangle', 0.05, d, i * 0.36, f * 0.72, 0.05, 26, 70); } }, // gaviota
  volcano: { gap: [0.4, 1.8], wx: 0.5,
    build(a) {
      lfo(a, 0.23, 'sine', bed(a, 'lowpass', 120, 1, 0.45).g.gain, 0.15);                                               // retumbo grave
      bed(a, 'bandpass', 2200, 0.5, 0.008);                                                                             // siseo de lava
      lfo(a, 7, 'triangle', bed(a, 'lowpass', 260, 3, 1, a.wx).g.gain, 0.4);                                            // erupción (temblor)
    },
    ev(d) { const n = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) { const f = rnd(120, 300); tone(f, 0.1, 'sine', 0.1, d, i * rnd(0.09, 0.2), f * 2.3); } } }, // burbujas
  ice: { gap: [2.5, 7], wx: 0.5,
    build(a) {
      const w = bed(a, 'bandpass', 620, 2.2, 0.13), g = bed(a, 'bandpass', 1150, 4, 0.6, a.wx);
      lfo(a, 0.09, 'sine', w.f.frequency, 240, w.g.gain, 0.06);                                                        // viento
      lfo(a, 0.31, 'sine', g.f.frequency, 480, g.g.gain, 0.35);                                                         // ráfagas de ventisca
    },
    ev(d) {
      if (Math.random() < 0.5) { const f = rnd(900, 1400); tone(f, 1.8, 'sine', 0.018, d, 0, f * 1.3, 0.8); }           // silbido del viento
      else for (let i = 0; i < 3; i++) fm(rnd(2400, 4200), 0.5, 0.03, d, i * 0.1, 3.5, 1.5, 0.2);                       // tintineo de hielo
    } },
  neon: { gap: [1.5, 5],
    build(a) {
      hum(a, 60, 'sawtooth', 0.05, 260); hum(a, 120.7, 'sine', 0.02);                                                   // zumbido eléctrico
      lfo(a, 0.07, 'sine', bed(a, 'lowpass', 800, 0.5, 0.035).g.gain, 0.015);                                           // tráfico lejano
    },
    ev(d) {
      const k = Math.random();
      if (k < 0.55) for (let i = 0; i < 3 + ((k * 20) | 0) % 3; i++) tone(pick([880, 1175, 1319, 1568]), 0.06, 'square', 0.018, d, i * 0.11); // pitidos
      else if (k < 0.8) tone(700, 2.6, 'triangle', 0.022, d, 0, 0, 0.4, 1.3, 150);                                      // sirena lejana
      else noise(1.3, 0.05, 'bandpass', 350, 1100, d, 0, 0.6);                                                          // coche que pasa
    } },
  temple: { gap: [0.5, 2.2],
    build(a) {
      const w = bed(a, 'bandpass', 800, 1, 0.03);
      lfo(a, 0.1, 'sine', w.g.gain, 0.015, w.f.frequency, 250);                                                         // brisa suave
      lfo(a, 0.17, 'sine', hum(a, 2093, 'sine', 0.004).gain, 0.004, hum(a, 3136, 'sine', 0.003).gain, -0.003);          // brillo
    },
    ev(d) { const n = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) fm(mtof(pick([72, 74, 76, 79, 81, 84, 86, 88])), 1.6, 0.045, d, i * rnd(0.1, 0.3), 3.5, 2, 0.5); } }, // campanillas
};

function killAmbience() {
  const a = amb;
  if (!a) return;
  amb = null; clearInterval(a.timer);
  const t = ctx.currentTime;
  a.out.gain.cancelScheduledValues(t); a.out.gain.setTargetAtTime(0, t, 0.08);
  for (const s of a.src) try { s.stop(t + 0.5); } catch (e) { /* ya parado */ }
  setTimeout(() => a.out.disconnect(), 700);
}

export function startAmbience(kind) {
  const def = AMBS[kind];
  ambWant = def ? kind : null;
  if (amb && amb.kind === kind) return;
  killAmbience();
  if (!ctx || !def) return;
  const a = amb = { kind, def, src: [], lvl: 0, out: gainNode(0, ambGain), next: ctx.currentTime + rnd(1, 3) };
  a.n = loopNoise(); a.src.push(a.n); a.wx = gainNode(0, a.out);
  def.build(a);
  a.out.gain.setTargetAtTime(1, ctx.currentTime, 0.4); // entrada suave
  a.timer = setInterval(() => {
    if (ctx.state !== 'running' || ctx.currentTime < a.next) return;
    a.next = ctx.currentTime + rnd(def.gap[0], def.gap[1]);
    def.ev(bus(rnd(-0.8, 0.8), rnd(0.5, 1), a.out));
  }, 200);
}

export function stopAmbience() { ambWant = null; killAmbience(); }

// Nivel 0..1 de la capa de clima del mapa (lluvia, ventisca, erupción); se puede llamar en cada fotograma
export function setAmbienceLevel(x) {
  if (!amb || !amb.def.wx) return;
  x = clamp(+x || 0, 0, 1);
  if (x === amb.lvl || (Math.abs(x - amb.lvl) < 0.01 && x > 0 && x < 1)) return;
  amb.lvl = x; amb.wx.gain.setTargetAtTime(x * amb.def.wx, ctx.currentTime, 0.25);
}

// ---------- Música procedural ----------
// Instrumentos melódicos: (frecuencia, duración, ganancia, destino, retardo)
const INST = {
  marimba: (f, d, g, o, t) => fm(f, 0.3, g * 1.3, o, t, 4, 1.4, 0.05),
  steel: (f, d, g, o, t) => fm(f, Math.max(d, 0.3), g * 1.2, o, t, 2.01, 1.7, 0.2),
  bell: (f, d, g, o, t) => fm(f, Math.max(d, 0.7), g, o, t, 3.51, 2.2, 0.5),
  glock: (f, d, g, o, t) => fm(f, 0.22, g, o, t, 3.51, 1.6, 0.1),
  ep: (f, d, g, o, t) => fm(f, Math.max(d, 0.3), g * 1.2, o, t, 1, 1.1, 0.25),
  flute: (f, d, g, o, t) => syn(f, d, g, o, t, 'triangle', 3000, 0.03, 0, 1),
  saw: (f, d, g, o, t) => syn(f, d, g * 0.8, o, t, 'sawtooth', 2400, 0.012, 8, 1),
  chip: (f, d, g, o, t) => syn(f, d, g * 0.6, o, t, 'square', 2600, 0.008, 0, 1),
  brass: (f, d, g, o, t) => syn(f, d, g * 0.9, o, t, 'sawtooth', 1700, 0.04, 5, 1),
  pluck: (f, d, g, o, t) => syn(f, Math.min(d, 0.16), g * 0.8, o, t, 'sawtooth', 1500, 0.004, 0),
  sad: (f, d, g, o, t) => { tone(f, d, 'triangle', g * 1.5, o, t, f * 0.92, 0.04, 5.5, f * 0.025); tone(f / 2, d, 'sawtooth', g * 0.3, o, t, f * 0.46, 0.04); },
};

// Batería (d = retardo, v = fuerza 0..1)
const kick = (d, v, heavy) => { tone(heavy ? 170 : 150, heavy ? 0.22 : 0.15, 'sine', 0.6 * v, mDry, d, 42); if (heavy) noise(0.03, 0.12 * v, 'lowpass', 3000, 300, mDry, d); };
const snare = (d, v, snap) => { noise(snap ? 0.2 : 0.13, 0.24 * v, snap ? 'highpass' : 'bandpass', snap ? 2200 : 1800, snap ? 0 : 900, mWet, d); tone(snap ? 230 : 200, 0.09, 'triangle', 0.16 * v, mDry, d, 130); };
const hat = (d, v, open) => noise(open ? 0.2 : 0.035, 0.085 * v, 'highpass', 7500, 0, mDry, d);
const PERC = {
  h: (d, v) => tone(270, 0.16, 'sine', 0.3 * v, mWet, d, 170),                 // toms / congas: agudo, medio, grave
  m: (d, v) => tone(200, 0.18, 'sine', 0.32 * v, mWet, d, 125),
  l: (d, v) => tone(140, 0.22, 'sine', 0.36 * v, mWet, d, 85),
  c: (d, v) => { noise(0.1, 0.17 * v, 'bandpass', 1300, 0, mWet, d); noise(0.08, 0.12 * v, 'bandpass', 1500, 0, mWet, d + 0.012); }, // palmas
  s: (d, v) => noise(0.05, 0.05 * v, 'bandpass', 6000, 0, mDry, d, 0.02),      // maraca
  j: (d, v) => noise(0.07, 0.06 * v, 'bandpass', 9000, 0, mDry, d, 0, 8),      // cascabeles
  b: (d, v) => tone(1100, 0.04, 'sine', 0.12 * v, mWet, d),                    // caja china
  o: (d, v) => hat(d, 0.8 * v, true),                                          // charles abierto
};
function bass(f, dur, type, d) {
  if (type === 'saw') syn(f, dur, 0.24, mDry, d, 'sawtooth', 420, 0.005, 0);
  else tone(f, dur, bassWave, 0.34, mDry, d);
}

// Estilos: patrones de 16 semicorcheas por compás.
// Batería: dígito = fuerza (perc: letras de PERC) · bass: r raíz, f quinta, o octava · arp: índice en TONES
// mel: ritmos de melodía (x ataque, - mantener, . silencio); el último es el de la sección B
// pad/sp: [onda, corte, ataque, ganancia] · gate: puerta rítmica del pad · stab: golpes de acorde · roll: redoble en notas largas
const TONES = [0, 2, 4, 7, 9, 11, 14];
const STYLES = {
  menu: { sw: 0.1, kick: '9.....6.9.......', sn: '....7.......7...', hat: '6.3.6.3.6.3.6.36', perc: '..s...s...s..bs.',
    bass: 'r..r..f.r..o..f.', arp: '0.1.2.1.3.2.1.2.', ai: 'ep', ao: 0, ag: 0.06, lead: 'flute', lo: 1, lg: 0.11,
    pad: ['triangle', 1600, 0.25, 0.045], dly: 0.2, rev: 0.25, mel: ['x-x-x---x-x-x---', 'x---x-x-x---x-x-', 'x-----x-x-----x-'] },
  jungle: { sw: 0.16, kick: '9..6..9...6.9...', sn: '....6.......6..4', hat: '6.36.36.6.36.363', perc: 'h..hl...h.hl.bl.',
    bass: 'r..r..r.f..f..o.', arp: '0.21.2.30.21.2.1', ai: 'marimba', ao: 0, ag: 0.07, lead: 'marimba', lo: 1, lg: 0.15, roll: 1,
    pad: ['triangle', 1200, 0.2, 0.03], dly: 0.15, rev: 0.2, mel: ['x-xx-x-.x-xx-x-.', 'x.x.x-x-x.x.x---', 'x--x--x-x--x--x-'] },
  beach: { sw: 0.14, kick: '9.....5.9.......', sn: '....7.......7...', hat: '7.4.7.4.7.4.7.47', perc: '..m..m.h..m..mh.',
    bass: 'r..r..f...r.f.o.', arp: '0..1..2.0..1..2.', ai: 'steel', ao: 0, ag: 0.035, lead: 'steel', lo: 1, lg: 0.14, roll: 1,
    stab: '..x...x...x...x.', sp: ['square', 2400, 0, 0.03], dly: 0.25, rev: 0.25, mel: ['..x-x-x-x--x--x-', 'x--x--x-x---x-x-', 'x---x--x--x-x---'] },
  volcano: { sw: 0, heavy: 1, kick: '9...9...9...9.7.', sn: '....9.......9..5', hat: '5.5.5.5.5.5.5.5.', perc: '..o...o...o.l.ll',
    bass: 'rrrorrrorrrorrof', bw: 'saw', bl: 0.9, arp: '0.2.3.2.0.2.4.3.', ai: 'pluck', ao: 0, ag: 0.05, lead: 'saw', lo: 1, lg: 0.1,
    pad: ['sawtooth', 900, 0.05, 0.035], dly: 0.22, rev: 0.15, mel: ['x-x-x-xxx-x-x---', 'x--x--x-x--x--x-', 'x-------x---x-x-'] },
  ice: { sw: 0, kick: '8.......8..5....', sn: '....5.......5...', hat: '4.2.4.2.4.2.4.2.', perc: 'j.j.j.j.j.j.j.j.',
    bass: 'r.......f...r...', bl: 4, arp: '0.2.3.2.1.2.3.2.', ai: 'glock', ao: 2, ag: 0.04, lead: 'bell', lo: 1, lg: 0.1,
    pad: ['triangle', 2600, 0.5, 0.05], dly: 0.25, rev: 0.45, mel: ['x---x-x-x---x---', 'x-x-x---x-----x-', 'x-----x-x---x---'] },
  neon: { sw: 0, snap: 1, kick: '9...9...9...9...', sn: '....9.......9...', hat: '4.4.4.4.4.4.4.4.', perc: '..o...o...o...o.',
    bass: 'r.o.r.o.r.o.r.o.', bw: 'saw', bl: 1.5, arp: '0123012301230124', ai: 'pluck', ao: 1, ag: 0.04, lead: 'saw', lo: 1, lg: 0.1,
    pad: ['sawtooth', 1500, 0.02, 0.04], gate: 'x.xxx.xxx.xxx.xx', dly: 0.3, rev: 0.3, mel: ['x--x--x-x--x--x-', 'x-x---x-x-x---x-', 'x-------x-----x-'] },
  temple: { sw: 0, kick: '9.....9.9.....9.', sn: '....8.......8.6.', hat: '6.6.6.6.6.6.6.6.', perc: 's.sss.sss.sss.ss',
    bass: 'r.o.r.o.f.o.r.o.', bl: 1.4, arp: '0231023102310232', ai: 'glock', ao: 2, ag: 0.035, lead: 'chip', lo: 1, lg: 0.1,
    pad: ['triangle', 2000, 0.2, 0.035], dly: 0.22, rev: 0.3, mel: ['x-x-x-x-x---x-x-', 'x-xx-x-xx-x-x---', 'x---x-x-x-x-x---'] },
  podium: { sw: 0.08, kick: '9.....9.9...9...', sn: '....8..5....8.55', hat: '6.3.6.3.6.3.6.3.', perc: '....c.......c...',
    bass: 'r...f...r...f.o.', bl: 2.5, arp: '0.2.3.2.1.3.2.3.', ai: 'glock', ao: 2, ag: 0.03, lead: 'brass', lo: 1, lg: 0.11,
    pad: ['sawtooth', 1100, 0.08, 0.03], stab: 'x.....x.x.......', sp: ['sawtooth', 1800, 0, 0.035], dly: 0.15, rev: 0.35, mel: ['x--xx---x--xx---', 'x-x-x---x--xx---', 'x---x---x-x-x-x-'] },
};

// Canción de 16 compases con forma A A' B A: un motivo que se repite, se transporta con la armonía y se varía
function buildSong(def) {
  const st = STYLES[def.style] || STYLES.menu, r = rng((def.seed || 1) * 977 + 13);
  const scale = SCALES[def.scale] || SCALES.major, P = def.prog && def.prog.length ? def.prog : [0, 3, 4, 0];
  const deg = d => scale[((d % 7) + 7) % 7] + Math.floor(d / 7) * 12; // grado de escala -> semitonos
  const near = c => c > 3 ? c - 7 : c;                                 // acorde en la octava más cercana a la tónica
  const chords = [];                                                   // B recoloca la progresión y acaba en la dominante
  for (let b = 0; b < 16; b++) chords.push(near(b >> 2 === 2 ? [P[2 % P.length], P[3 % P.length], P[2 % P.length], 4][b & 3] : P[b % P.length]));
  const snap = p => [-3, 0, 2, 4, 7, 9].reduce((a, c) => Math.abs(c - p) < Math.abs(a - p) ? c : a); // nota del acorde más cercana
  // Motivo: ritmo fijo + contorno en arco (sube y baja) en grados relativos al acorde.
  // Con `from` conserva el principio de `base` y reescribe el final subiendo (variación).
  const walk = (rh, p, from = 0, base = []) => {
    const ev = base.filter(e => e.s < from).map(e => ({ ...e, len: Math.min(e.len, from - e.s) }));
    if (ev.length) p = ev[ev.length - 1].o;
    for (let s = from; s < 16; s++) {
      if (rh[s] !== 'x') continue;
      let len = 1; while (rh[s + len] === '-') len++;
      if (ev.length) { const dir = from || s < 8 ? 1 : -1; p += (r() < 0.72 ? dir : -dir) * (r() < 0.25 ? 2 : 1); }
      if (p > 7) p -= 3; if (p < -2) p += 3;
      if (s % 8 === 0 || len > 3) p = snap(p);                         // tiempos fuertes y notas largas: nota del acorde
      ev.push({ s, len, o: p });
    }
    return ev;
  };
  // Cadencia: principio del motivo + nota larga (y anacrusa opcional)
  const cad = (m, end, pk) => walk('', 0, 8, m).concat({ s: 8, len: pk == null ? 7 : 5, o: end }, pk == null ? [] : { s: 14, len: 2, o: pk });
  const rhA = st.mel[Math.floor(r() * (st.mel.length - 1))], rhB = st.mel[st.mel.length - 1];
  const M = walk(rhA, [0, 2, 4][Math.floor(r() * 3)]), V = walk(rhA, 0, 8, M), M2 = M.map(e => ({ ...e, o: e.o + 2 }));
  const N = walk(rhB, r() < 0.5 ? 4 : 7), N2 = walk(rhB, 0, 8, N);
  const run = [0, 1, 2, 3, 4].map((o, k) => ({ s: k * 2, len: k === 4 ? 4 : 2, o })).concat({ s: 14, len: 2, o: 4 }); // escala de vuelta
  const e0 = chords[15] < -1 ? 4 : 0;                                  // final sin caer de registro
  const mel = [M, M, V, cad(M, 2), M, M2, V, cad(M, 4), N, N, N2, run, M, M, V, cad(M, e0, e0 - 1)];
  const root = isFinite(def.root) ? +def.root : 57;
  return { def, st, chords, mel, deg, root, minor: scale === SCALES.minor, step: 15 / clamp(+def.tempo || 120, 40, 600),
    arpR: [...st.arp].reverse().join(''), bRoot: 38 + (((root - 38) % 12) + 12) % 12 }; // bRoot: tónica del bajo entre re2 y do#3
}

function playStep(i, t0) {
  const s = song, st = s.st, b = (i >> 4) % 16, k = i & 15, sec = b >> 2, ch = s.chords[b], sd = s.step / tempoMul;
  const d = Math.max(0, t0 - ctx.currentTime) + (k & 1 ? st.sw * sd : 0);
  const hot = intensity > 0.5, full = sec > 0 || hot, B = sec === 2;
  // Nota del acorde/escala; en menor, la dominante lleva la sensible (7ª elevada) para que la cadencia tire a la tónica
  const N = (oct, x) => mtof(s.root + 12 * oct + s.deg(ch + x) + (s.minor && ch === -3 && (((ch + x) % 7) + 7) % 7 === 6 ? 1 : 0));
  let v;
  // Batería (+ redoble de toms cada 8 compases)
  if ((v = +st.kick[k])) kick(d, v / 9, st.heavy);
  if ((v = +st.sn[k])) snare(d, v / 9, st.snap);
  if ((v = +st.hat[k])) hat(d, v / 9);
  if (full && PERC[st.perc[k]]) PERC[st.perc[k]](d, 1);
  if ((b & 7) === 7 && k >= 12) PERC['hmll'[k - 12]](d, 1.1);
  if (hot) { if (k & 1) PERC.s(d, 1.2); if (k % 4 === 2) hat(d, 0.8, true); if (k % 8 === 4) PERC.c(d, 0.8); } // última vuelta: capa extra
  // Bajo
  const bc = st.bass[k];
  if (bc !== '.') bass(mtof(s.bRoot + s.deg(ch + (bc === 'f' ? 4 : 0)) + (bc === 'o' ? 12 : 0)), sd * (st.bl || 1.6), st.bw, d);
  // Acordes: colchón por compás y/o golpes
  if (k === 0 && st.pad) chord([N(0, 0), N(0, 2), N(0, 4)], sd * 16, st.pad[3] * (B ? 1.3 : 1), mWet, d, st.pad[0], st.pad[1], st.pad[2], st.gate, sd);
  if (st.stab && st.stab[k] === 'x') chord([N(0, 0), N(0, 2), N(0, 4)], sd * 1.1, st.sp[3], mWet, d, st.sp[0], st.sp[1], 0.005);
  // Arpegio (invertido en la sección B) y melodía
  if ((v = (B ? s.arpR : st.arp)[k]) !== '.') INST[st.ai](N(st.ao, TONES[v]), sd * 1.5, st.ag * (full ? 1 : 0.6), mWet, d);
  for (const e of s.mel[b]) {
    if (e.s === k) INST[st.lead](N(st.lo, e.o), e.len * sd, st.lg, mWet, d);
    else if (st.roll && e.len > 3 && k > e.s && k < e.s + e.len) INST[st.lead](N(st.lo, e.o), sd, st.lg * 0.45, mWet, d); // redoble en notas largas
  }
}

function tickMusic() {
  if (!ctx || ctx.state !== 'running' || !song) return;
  const now = ctx.currentTime;
  if (nextStepTime < now - 0.3) nextStepTime = now + 0.05;
  while (nextStepTime < now + 0.2) {
    tempoMul += ((intensity > 0.5 ? 1.12 : 1) - tempoMul) * 0.2; // el tempo cambia suave, en un compás aprox.
    playStep(stepIdx++, nextStepTime);
    nextStepTime += song.step / tempoMul;
  }
}

// def: { tempo, root (nota MIDI), scale: 'major'|'minor', prog: [grados], seed, style }
export function startMusic(def) {
  if (!def) return;
  intensity = 0;
  if (song && song.def === def && musicTimer) return; // ya suena: no se reinicia
  stopMusic();
  song = buildSong(def); tempoMul = 1;
  if (!ctx) return;
  const t = ctx.currentTime;
  mDry = gainNode(1, duck); mWet = gainNode(1, wetBus); // seco (bajo, bombo) y con efectos (melodía, acordes, caja)
  dly.delayTime.setValueAtTime(Math.min(0.9, song.step * 3), t);
  dlySend.gain.setTargetAtTime(song.st.dly, t, 0.05); revSend.gain.setTargetAtTime(song.st.rev, t, 0.05);
  stepIdx = 0; nextStepTime = t + 0.1;
  musicTimer = setInterval(tickMusic, 50);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null; song = null;
  if (!mDry) return;
  const a = mDry, b = mWet, t = ctx.currentTime; // apaga rápido las notas largas; el eco y la reverb se extinguen solos
  mDry = mWet = null;
  a.gain.setTargetAtTime(0, t, 0.06); b.gain.setTargetAtTime(0, t, 0.06);
  setTimeout(() => { a.disconnect(); b.disconnect(); }, 2500);
}

// 0 = normal · 1 = última vuelta (≈12 % más rápido + percusión extra); no reinicia la canción
export function setMusicIntensity(level) { intensity = clamp(+level || 0, 0, 1); }

// ---------- Jingles: ráfagas musicales por encima de la música, que se atenúa un momento ----------
// n: [semitonos sobre la raíz (o acorde), pulso de inicio, duración en pulsos] · h: golpes [pulso, tipo]
const JINGLES = {
  start: { bpm: 168, inst: 'brass', n: [[-5, 0, 0.5], [0, 0.5, 0.5], [4, 1, 0.5], [[7, 4, 0], 1.5, 2.2]], h: [[1.5, 'k'], [1.5, 'y']] },
  win: { bpm: 138, inst: 'brass', n: [[-5, 0, 0.45], [0, 0.5, 0.45], [4, 1, 0.45], [[7, 4, 0], 1.5, 1.2], [[4, 0, -3], 3, 0.45], [[12, 7, 4], 3.5, 3]], h: [[1.5, 'k'], [3.5, 'k'], [3.5, 'y']] },
  lose: { bpm: 132, inst: 'sad', root: 58, n: [[7, 0, 0.9], [6, 1, 0.9], [5, 2, 0.9], [4, 3, 2.6]], h: [[3, 'k']] },
  record: { bpm: 180, inst: 'bell', n: [[0, 0, 0.5], [4, 0.5, 0.5], [7, 1, 0.5], [12, 1.5, 0.5], [16, 2, 0.5], [19, 2.5, 0.5], [[24, 19, 16], 3, 3]], h: [[3, 'y']] },
  trophy: { bpm: 144, inst: 'brass', n: [[0, 0, 0.3], [0, 0.33, 0.3], [0, 0.67, 0.3], [[4, 0], 1, 0.9], [4, 2, 0.3], [4, 2.33, 0.3], [4, 2.67, 0.3], [[7, 4], 3, 0.9],
    [7, 4, 0.45], [9, 4.5, 0.45], [11, 5, 0.45], [[12, 7, 4, 0], 5.5, 3]], h: [[1, 'k'], [3, 'k'], [5, 't'], [5.25, 't'], [5.5, 'k'], [5.5, 'y']] },
};
const HITS = {
  k: t => tone(95, 0.5, 'sine', 0.5, jBus, t, 50),                 // timbal
  y: t => noise(1.3, 0.1, 'highpass', 6000, 0, jBus, t),           // platillo
  t: t => noise(0.1, 0.2, 'bandpass', 1800, 0, jBus, t),           // caja
};

export function playJingle(name) {
  const j = JINGLES[name];
  if (!j || !live()) return;
  const beat = 60 / j.bpm, t = ctx.currentTime;
  let end = 0;
  for (const [semi, at, len] of j.n) {
    const notes = [].concat(semi);
    for (const x of notes) INST[j.inst](mtof((j.root || 72) + x), len * beat, 0.17 / Math.sqrt(notes.length), jBus, 0.02 + at * beat);
    end = Math.max(end, (at + len) * beat);
  }
  for (const [at, kind] of j.h) HITS[kind](0.02 + at * beat);
  duck.gain.cancelScheduledValues(t); duck.gain.setTargetAtTime(0.25, t, 0.04); duck.gain.setTargetAtTime(1, t + end, 0.25);
}

// ---------- Vibración ----------
const HAPTICS = { ui: 8, bump: 25, land: 30, boost: 60, go: 90, hit: [160, 60, 90], finish: [60, 40, 60, 40, 60, 40, 220], meteor: 120 };

export function setHaptics(on) { hapticsOn = !!on; }

export function haptic(kind) {
  try {
    if (hapticsOn && HAPTICS[kind] != null && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(HAPTICS[kind]);
  } catch (e) { /* sin vibración */ }
  // con mando: la misma sacudida en sus motores, más fuerte cuanto más larga
  try {
    const h = HAPTICS[kind];
    if (!hapticsOn || h == null || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const ms = Array.isArray(h) ? h.reduce((a, b) => a + b, 0) : h, k = Math.min(1, 0.3 + ms / 220);
    for (const g of navigator.getGamepads()) {
      const v = g && g.vibrationActuator; if (!v || !v.playEffect) continue;
      const p = v.playEffect('dual-rumble', { startDelay: 0, duration: Math.max(40, ms), strongMagnitude: k, weakMagnitude: Math.min(1, k + 0.2) });
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* sin mando o sin motores */ }
}
