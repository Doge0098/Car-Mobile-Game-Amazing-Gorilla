// Música y efectos generados con WebAudio (sin archivos externos).
import { rng } from './data.js';

let ctx = null, master, musicGain, sfxGain, noiseBuf;
let engine = null, driftNode = null;
let musicTimer = null, song = null, nextStepTime = 0, stepIdx = 0;
let vol = { music: 0.6, sfx: 0.8 };

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createDynamicsCompressor();
  master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = vol.music * 0.5; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (song) startMusic(song.def);
}

export function setVolumes(music, sfx) {
  vol.music = music; vol.sfx = sfx;
  if (!ctx) return;
  musicGain.gain.value = music * 0.5;
  sfxGain.gain.value = sfx;
}

export function suspendAudio(on) {
  if (!ctx) return;
  if (on) ctx.suspend(); else ctx.resume();
}

function tone(freq, dur, type = 'square', gain = 0.2, dest = sfxGain, t0 = 0, slideTo = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, gain = 0.2, filterType = 'highpass', f0 = 4000, f1 = 0, dest = sfxGain, t0 = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t); s.stop(t + dur + 0.02);
}

export const sfx = {
  ui() { tone(660, 0.07, 'square', 0.12); tone(990, 0.08, 'square', 0.1, sfxGain, 0.05); },
  back() { tone(500, 0.07, 'square', 0.1); tone(330, 0.09, 'square', 0.1, sfxGain, 0.05); },
  buy() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.22, sfxGain, i * 0.07)); },
  deny() { tone(160, 0.2, 'sawtooth', 0.15); },
  count() { tone(440, 0.18, 'square', 0.2); },
  go() { tone(880, 0.5, 'square', 0.22); tone(1320, 0.5, 'triangle', 0.15); },
  coin() { tone(1320, 0.06, 'square', 0.1); tone(1760, 0.1, 'square', 0.1, sfxGain, 0.05); },
  tick() { tone(1200, 0.03, 'square', 0.07); },
  item() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.14, sfxGain, i * 0.05)); },
  boost() { noise(0.7, 0.3, 'bandpass', 500, 5000); tone(180, 0.6, 'sawtooth', 0.14, sfxGain, 0, 900); },
  miniturbo() { noise(0.35, 0.2, 'bandpass', 900, 5000); tone(300, 0.3, 'sawtooth', 0.1, sfxGain, 0, 1000); },
  hit() { tone(500, 0.5, 'sawtooth', 0.22, sfxGain, 0, 70); noise(0.3, 0.3, 'lowpass', 1800, 200); },
  bump() { noise(0.12, 0.25, 'lowpass', 900, 200); tone(120, 0.1, 'sine', 0.25); },
  throw() { tone(300, 0.25, 'triangle', 0.18, sfxGain, 0, 900); },
  drop() { tone(500, 0.15, 'triangle', 0.15, sfxGain, 0, 200); },
  shield() { tone(520, 0.3, 'sine', 0.2, sfxGain, 0, 1040); tone(780, 0.3, 'sine', 0.12, sfxGain, 0.1, 1560); },
  shieldBreak() { noise(0.25, 0.25, 'highpass', 3000, 800); tone(900, 0.2, 'triangle', 0.15, sfxGain, 0, 300); },
  drum() { for (let i = 0; i < 6; i++) { tone(110, 0.16, 'sine', 0.5, sfxGain, i * 0.1, 50); noise(0.06, 0.2, 'lowpass', 500, 0, sfxGain, i * 0.1); } },
  fury() { tone(90, 0.9, 'sawtooth', 0.25, sfxGain, 0, 240); tone(135, 0.9, 'sawtooth', 0.15, sfxGain, 0.05, 360); noise(0.8, 0.15, 'lowpass', 700, 1500); },
  lap() { [659, 880, 1319].forEach((f, i) => tone(f, 0.14, 'square', 0.16, sfxGain, i * 0.09)); },
  finalLap() { [659, 659, 659, 1047].forEach((f, i) => tone(f, i === 3 ? 0.4 : 0.09, 'square', 0.18, sfxGain, i * 0.11)); },
  finish() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.18, sfxGain, i * 0.13)); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, sfxGain, i * 0.18)); },
  jump() { tone(300, 0.18, 'sine', 0.15, sfxGain, 0, 700); },
};

// ---------- Motor y derrape (sonidos continuos) ----------
export function startEngine() {
  if (!ctx || engine) return;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square';
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  const g = ctx.createGain(); g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxGain);
  o1.start(); o2.start();
  engine = { o1, o2, f, g };
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 3;
  const dg = ctx.createGain(); dg.gain.value = 0;
  s.connect(bf); bf.connect(dg); dg.connect(sfxGain); s.start();
  driftNode = { s, bf, g: dg };
}

export function updateEngine(speedRatio, drifting, boosting) {
  if (!engine) return;
  const t = ctx.currentTime;
  const f = 55 + speedRatio * 150 + (boosting ? 40 : 0);
  engine.o1.frequency.setTargetAtTime(f, t, 0.06);
  engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
  engine.f.frequency.setTargetAtTime(500 + speedRatio * 1400, t, 0.1);
  engine.g.gain.setTargetAtTime(0.05 + speedRatio * 0.05, t, 0.1);
  driftNode.g.gain.setTargetAtTime(drifting ? 0.07 : 0, t, 0.05);
}

export function stopEngine() {
  if (!engine) return;
  try { engine.o1.stop(); engine.o2.stop(); driftNode.s.stop(); } catch (e) { /* ya parado */ }
  engine.g.disconnect(); driftNode.g.disconnect();
  engine = null; driftNode = null;
}

// ---------- Música procedural ----------
function buildSong(def) {
  const r = rng(def.seed * 977 + 13);
  const scale = SCALES[def.scale];
  const deg = d => { // grado de escala -> semitonos
    const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
    return scale[i] + o * 12;
  };
  const bars = [];
  let last = 4;
  for (let b = 0; b < 8; b++) {
    const chord = def.prog[b % def.prog.length];
    const mel = [];
    for (let s = 0; s < 8; s++) {
      const x = r();
      if (x < 0.22 && s !== 0) { mel.push(null); continue; }
      let d;
      if (s % 4 === 0 || x > 0.75) d = chord + [0, 2, 4, 7][Math.floor(r() * 4)];
      else d = last + Math.floor(r() * 5) - 2;
      while (d > 11) d -= 7; while (d < 0) d += 7;
      last = d; mel.push(d);
    }
    bars.push({ chord, mel });
  }
  const bassPat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0].map((v, i) => v && (r() > 0.12 || i === 0));
  const hatPat = Array.from({ length: 16 }, (_, i) => i % 2 === 0 ? (i % 4 === 2 ? 1 : 0.5) : (r() > 0.6 ? 0.3 : 0));
  return { def, bars, deg, bassPat, hatPat, step: 60 / def.tempo / 4 };
}

function playStep(i, t0) {
  const s = song, bar = s.bars[Math.floor(i / 16) % 8], st = i % 16, root = s.def.root;
  const d = Math.max(0, t0 - ctx.currentTime);
  if (st % 4 === 0) tone(140, 0.14, 'sine', 0.55, musicGain, d, 45);
  if (st % 8 === 4) noise(0.12, 0.22, 'bandpass', 1800, 900, musicGain, d);
  if (s.hatPat[st]) noise(0.035, 0.09 * s.hatPat[st], 'highpass', 7000, 0, musicGain, d);
  if (s.bassPat[st]) tone(mtof(root - 24 + s.deg(bar.chord)), s.step * 1.7, 'triangle', 0.42, musicGain, d);
  if (st % 2 === 0) {
    const arp = [0, 2, 4, 7, 4, 2, 4, 7][st / 2];
    tone(mtof(root + s.deg(bar.chord + arp)), s.step * 1.2, 'square', 0.035, musicGain, d);
    const m = bar.mel[st / 2];
    if (m !== null) tone(mtof(root + 12 + s.deg(m)), s.step * 2.6, 'sawtooth', 0.07, musicGain, d);
  }
}

export function startMusic(def) {
  if (song && song.def === def && musicTimer) return;
  stopMusic();
  song = buildSong(def);
  if (!ctx) return;
  stepIdx = 0; nextStepTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    if (nextStepTime < ctx.currentTime - 0.3) nextStepTime = ctx.currentTime + 0.05;
    while (nextStepTime < ctx.currentTime + 0.2) {
      playStep(stepIdx++, nextStepTime);
      nextStepTime += song.step;
    }
  }, 60);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
