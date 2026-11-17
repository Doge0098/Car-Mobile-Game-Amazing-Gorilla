// Amazing Gorilla Racing — arranque, menús, HUD y bucle principal.
import * as THREE from './vendor/three.module.min.js';
import { CHARACTERS, KARTS, KART_COLORS, ITEMS, TRACKS, CUPS, DIFFICULTIES, CUP_POINTS, RACE_REWARD, RACERS, MENU_MUSIC, PODIUM_MUSIC, trackById, charById, kartById } from './data.js';
import { save, loadSave, persist, resetSave } from './save.js';
import * as A from './audio.js';
import { initInput, input, pollInput, consumePresses, enableTilt } from './input.js';
import { buildTrack } from './track.js';
import { Race } from './race.js';
import { Particles, Ambient } from './fx.js';
import { makeGorilla, makeKart, mountGorilla, animateGorilla, animateKart, blobShadow } from './models.js';
import { setOutline, setOutlineRes } from './outline.js';
import { Post } from './post.js';
import { Podium } from './podium.js';
import { SHOP, TRAILS, UPGRADES, UPGRADE_MAX, upgradeLevel, upgradePrice, upgradeTune, byId } from './shop.js';
import { MISSIONS, ACHIEVEMENTS, LIFETIME, fill, pickMissions, parTime, updateMissions, missionProgress, missionsReward, recordRace, addStat, statText, checkAchievements, achGoal, achValue, achDone } from './meta.js';

const { initAudio, sfx, setVolumes, startMusic, startEngine, stopEngine, updateEngine, suspendAudio } = A;
const $ = id => document.getElementById(id);
const hex = c => '#' + c.toString(16).padStart(6, '0');
const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };

loadSave();
if (save.settings.diff == null) save.settings.diff = 1;

// ---------- Render ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x1a0b3a);
const camera = new THREE.PerspectiveCamera(68, 1, 0.3, 2400);
const qualityK = () => ({ baja: 0.5, media: 0.8, alta: 1 }[save.settings.quality] || 1);
const post = new Post(renderer);
const usePost = () => !!save.settings.bloom && post.supported;
function render(scene, cam) {
  if (usePost()) post.render(scene, cam); else { renderer.setRenderTarget(null); renderer.render(scene, cam); }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  const q = save.settings.quality;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 'alta' ? 2 : q === 'media' ? 1.5 : 1));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  menuCam.aspect = w / h; placeShow(); applyShowOffset();
  if (usePost()) post.setSize(q === 'alta' ? 4 : 0); else if (post.supported) post.disposeTargets();
  const db = renderer.getDrawingBufferSize(new THREE.Vector2()); setOutlineRes(db.x, db.y); setOutline(save.settings.outline !== false);
  menuRing.material.color.set(0x22e6ff).multiplyScalar(usePost() ? 2.2 : 1);
}

// ---------- Escaparate del menú ----------
const menuScene = new THREE.Scene();
const menuCam = new THREE.PerspectiveCamera(42, 1, 0.3, 300);
let showModel = null, showKart = null, showGorilla = null, showPound = 0, showSpin = 0.6, menuRing = null;
{
  const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ vec3 n = normalize(vP); float h = n.y * 0.5 + 0.5;
      vec3 c = mix(vec3(1.0,0.31,0.75), vec3(0.16,0.06,0.5), smoothstep(0.35,0.95,h));
      c = mix(vec3(1.0,0.72,0.12), c, smoothstep(0.2,0.52,h));
      float rays = step(0.5, fract(atan(n.x, n.z) * 3.8197)); c += rays * 0.05 * (1.0 - h);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  menuScene.add(dome);
  menuScene.add(new THREE.HemisphereLight(0xffffff, 0xff7ad8, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 1.9); d.position.set(2, 4, 3); menuScene.add(d);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4, 0.5, 40), new THREE.MeshLambertMaterial({ color: 0x7a5cff }));
  plat.position.y = -0.26; menuScene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: 0x22e6ff }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0; menuScene.add(ring); menuRing = ring;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 40), new THREE.MeshLambertMaterial({ color: 0xff8ad8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; menuScene.add(floor);
  menuCam.position.set(0, 3.1, 10.5); menuCam.lookAt(0, 1.3, 0);
}
let showOff = [0, 0];
function applyShowOffset() {
  const w = innerWidth, h = innerHeight;
  menuCam.setViewOffset(w, h, -showOff[0] * w, showOff[1] * h, w, h);
  menuCam.fov = w < h ? 74 : 42;
  menuCam.updateProjectionMatrix();
}
let showTrail = null, showTrailDef = null; // vista previa de la estela en el garaje
const _hue = new THREE.Color(), hueHex = h => _hue.setHSL(h - Math.floor(h), 1, 0.56).getHex();
function setShowModel(charId, kartId, colorIdx, hat = null, wheels = null) {
  const ry = showModel ? showModel.rotation.y : 0;
  if (showModel) menuScene.remove(showModel);
  showModel = new THREE.Group(); showModel.rotation.y = ry;
  showKart = makeKart(kartById(kartId), KART_COLORS[colorIdx] || null, null, wheels);
  showGorilla = mountGorilla(showKart, makeGorilla(charById(charId), null, false, hat));
  showModel.add(showKart, showGorilla, blobShadow());
  menuScene.add(showModel);
}
const refreshShow = () => setShowModel(save.char, save.kart, save.color, save.hat, save.wheel);
// Cinta de muestra de la estela: opaca (no aditiva) para que se distinga sobre el fondo claro del escaparate
const ST_N = 14;
function makeShowTrail() {
  const g = new THREE.BufferGeometry(), idx = [];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ST_N * 6), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ST_N * 8), 4));
  for (let i = 0; i < ST_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.renderOrder = 3;
  return m;
}
function updateShowTrail() {
  if (!showTrailDef) { if (showTrail) showTrail.visible = false; return; }
  if (!showTrail) showTrail = makeShowTrail();
  if (showTrail.parent !== showModel) showModel.add(showTrail);
  showTrail.visible = true;
  const P = showTrail.geometry.attributes.position, C = showTrail.geometry.attributes.color, d = showTrailDef;
  for (let i = 0; i < ST_N; i++) {
    const f = 1 - i / (ST_N - 1), w = 0.9 * (0.3 + 0.7 * f), x = Math.sin(tGlobal * 7 - i * 0.55) * 0.035 * i, y = 0.8 + Math.sin(tGlobal * 5 - i * 0.4) * 0.02 * i, z = -2.3 - i * 0.25;
    if (d.rainbow) _hue.setHSL((tGlobal * 0.5 + i * 0.07) % 1, 1, 0.56); else _hue.set(i < 3 ? d.sparks[1] : d.color);
    P.setXYZ(i * 2, x + w, y, z); P.setXYZ(i * 2 + 1, x - w, y, z);
    C.setXYZW(i * 2, _hue.r, _hue.g, _hue.b, f); C.setXYZW(i * 2 + 1, _hue.r, _hue.g, _hue.b, f);
  }
  P.needsUpdate = C.needsUpdate = true;
}

// ---------- Pantallas ----------
let screen = 'title';
const OFFSETS = { title: [0.3, 0], menu: [0.2, 0], garage: [0.22, 0.02], tracks: [0, 0], cups: [0, 0], settings: [0, 0], meta: [0, 0] };
function placeShow() {
  const o = OFFSETS[screen]; if (!o) return;
  const portrait = innerWidth < innerHeight;
  showOff = portrait ? [0, screen === 'title' ? -0.2 : screen === 'garage' ? 0.22 : 0.2] : o;
  applyShowOffset();
}
function show(name, overlay) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(name === 'hud' ? 'hud' : 's-' + name);
  if (el) el.classList.add('active');
  if (overlay) $('hud').classList.toggle('active', overlay === 'hud');
  screen = name;
  if (name !== 'garage') showTrailDef = null;
  placeShow();
  syncWallet();
}
// Avisos: se muestran de uno en uno (los logros pueden llegar varios a la vez)
const toastQ = [];
function toast(msg) {
  if (msg === toast.now || toastQ.includes(msg) || toastQ.length > 5) return;
  toastQ.push(msg); if (!toast.now) nextToast();
}
function nextToast() {
  const t = $('toast'), msg = toastQ.shift();
  if (msg == null) { toast.now = null; return; }
  toast.now = msg; t.textContent = msg; t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); setTimeout(nextToast, 240); }, toastQ.length ? 1500 : 2200);
}
const syncWallet = () => document.querySelectorAll('.bananas').forEach(b => { b.textContent = save.bananas; });
// Plátanos ganados (cuentan para las estadísticas)
function earn(n) { save.bananas += n; addStat(save, 'earned', n); }
// Comprueba los logros, los paga y los anuncia
function awardAchievements() {
  const fresh = checkAchievements(save);
  for (const a of fresh) toast(fill('{icon} Logro: {name} · +{reward} 🍌', a));
  if (fresh.length) { persist(); sfx.buy(); syncWallet(); }
}

// ---------- Estado de carrera ----------
let race = null, track = null, raceScene = null, fxAdd = null, fxNorm = null, ambient = null;
let paused = false, mode = 'race', currentTrack = null, cupState = null, resultsShown = false, finishTimer = 0;
let miniBg = null, rollIcon = 0, rollT = 0, lastHud = {};
const podium = new Podium();
let podiumAfter = null, podiumT = 0, rampHints = 0, fpsAcc = 0, fpsN = 0, fpsHinted = false, inTunnel = false;
// misiones de la carrera en curso y su contexto (se reutiliza: sin basura por fotograma)
let missions = [], missionT = 0;
const mctx = { st: null, pos: 0, total: 0, time: 0, par: 0, finished: false, started: false };
const rivalBuf = [{ pan: 0, gain: 0, pitch: 0 }, { pan: 0, gain: 0, pitch: 0 }, { pan: 0, gain: 0, pitch: 0 }], rivalOut = [];

const cup1Unlocked = () => Object.keys(save.trophies).some(k => k.startsWith('platano_'));
const trackUnlocked = t => t.cup === 0 || cup1Unlocked();
const diff = () => DIFFICULTIES[save.settings.diff] || DIFFICULTIES[1];

// Parrilla de rivales al azar: [{ char, kart, color }] (en una copa se mantiene durante sus carreras)
function makeLineup(n) {
  const mix = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const chars = mix(CHARACTERS.filter(c => c.id !== save.char)), karts = mix(KARTS.slice()), c0 = Math.floor(Math.random() * 8);
  return Array.from({ length: n }, (_, i) => ({ char: chars[i % chars.length].id, kart: karts[i % karts.length].id, color: 1 + (c0 + i * 3) % (KART_COLORS.length - 1) }));
}

function disposeRace() {
  stopEngine(); A.stopAmbience?.(); A.setTunnel?.(false); A.setMusicIntensity?.(0);
  rivalOut.length = 0; A.updateRivalEngines?.(rivalOut);
  podium.active = false; inTunnel = false;
  if (race) race.dispose();
  if (track) track.dispose();
  if (ambient) ambient.dispose();
  if (fxAdd) { fxAdd.points.geometry.dispose(); fxAdd.mat.dispose(); fxNorm.points.geometry.dispose(); fxNorm.mat.dispose(); }
  race = track = raceScene = fxAdd = fxNorm = ambient = null;
  $('speedfx').classList.remove('on');
}

function startRace(trackId) {
  if (save.settings.controls === 'tilt') enableTilt(true);
  $('loading').classList.remove('hidden');
  setTimeout(() => {
    disposeRace();
    currentTrack = trackById(trackId);
    const q = qualityK();
    const gfx = { quality: q, bloom: usePost(), shadows: !!save.settings.shadows, outline: save.settings.outline !== false };
    renderer.shadowMap.enabled = gfx.shadows;
    track = buildTrack(currentTrack, gfx);
    raceScene = new THREE.Scene();
    raceScene.fog = track.fog; raceScene.background = new THREE.Color(currentTrack.theme.fog);
    raceScene.add(track.group);
    fxAdd = new Particles(q < 0.7 ? 400 : 900, true); fxNorm = new Particles(q < 0.7 ? 150 : 300, false);
    raceScene.add(fxAdd.points, fxNorm.points);
    ambient = new Ambient(currentTrack.theme.fx, currentTrack.theme.fxColor, q < 0.7 ? 60 : 140);
    raceScene.add(ambient.points);
    race = new Race({
      scene: raceScene, track, fx: { add: fxAdd, norm: fxNorm }, mode, difficulty: diff(), ...gfx,
      playerChar: save.char, playerKart: save.kart, playerColor: save.color,
      playerHat: save.hat, playerWheel: save.wheel, playerTrail: byId(TRAILS, save.trail), playerHorn: save.horn, playerTune: upgradeTune(save),
      rivals: cupState ? cupState.rivals : makeLineup(RACERS - 1),
      ghostData: mode === 'time' ? save.ghosts[trackId] : null, onEvent: onRaceEvent,
    });
    paused = false; resultsShown = false; finishTimer = 0; lastHud = {}; fpsAcc = 0; fpsN = 0;
    hint('');
    mctx.st = race.player.st; mctx.total = race.racers.length; mctx.par = parTime(mode, track.length, race.laps);
    missions = pickMissions(mode, mctx.par); missionT = 0; syncMissions();
    renderMissions($('hud-missions-list'), false);
    $('hud-missions').classList.toggle('hidden', !missions.length);
    buildMinimap();
    $('hud-total').textContent = mode === 'time' ? '' : '/' + race.racers.length;
    $('hud-laps').textContent = race.laps;
    $('hud-pos').parentElement.style.visibility = mode === 'time' ? 'hidden' : 'visible';
    $('hud').classList.toggle('tilt', save.settings.controls === 'tilt');
    $('hud-wrong').classList.add('hidden');
    show('hud');
    startMusic(currentTrack.music);
    A.startAmbience?.(currentTrack.music.style); A.playJingle?.('start');
    startEngine();
    hudMsg(currentTrack.name, true);
    $('loading').classList.add('hidden');
  }, 60);
}

function hudMsg(text, small) {
  const m = $('hud-msg'); m.textContent = text;
  m.className = 'hud-msg' + (small ? ' small' : ''); void m.offsetWidth; m.classList.add('show');
}

// ---------- Misiones de la carrera ----------
function syncMissions() {
  const p = race.player;
  mctx.pos = p.pos; mctx.time = race.time; mctx.finished = p.finished; mctx.started = race.state === 'racing' || race.state === 'finished';
  return updateMissions(missions, mctx);
}
// live: muestra el progreso («7/20») de las que aún no están decididas
function renderMissions(el, live) {
  el.innerHTML = missions.map(m => `<li class="${m.done ? 'ok' : m.failed ? 'ko' : ''}"><i>${m.done ? '✓' : m.failed ? '✗' : '•'}</i><span>${m.text}</span>` +
    `<b>${live && !m.done && !m.failed ? missionProgress(m, mctx) : ''}</b><em>+${m.reward} 🍌</em></li>`).join('');
  el.classList.toggle('hidden', !missions.length);
}

function hint(text) {
  const h = $('hud-hint'); h.textContent = text; h.classList.toggle('show', !!text);
  clearTimeout(hint.t); if (text) hint.t = setTimeout(() => h.classList.remove('show'), 4200);
}

function onRaceEvent(ev, data) {
  if (ev === 'count') { hudMsg(String(data)); sfx.count(); if (data === 3) hint('Pulsa DERRAPE justo en el «¡YA!» para una salida turbo'); }
  else if (ev === 'go') { hudMsg('¡YA!'); sfx.go(); flash(); hint(''); A.haptic?.('go'); sfx.crowd?.(0, 0.8); }
  else if (ev === 'startBoost') { setTimeout(() => hudMsg('¡Salida turbo!', true), 650); sfx.startBoost?.(); A.haptic?.('boost'); }
  else if (ev === 'stall') { setTimeout(() => hudMsg('¡Demasiado pronto!', true), 650); sfx.stall?.(); }
  else if (ev === 'ramp') { if (rampHints++ < 2) hint('¡Pulsa DERRAPE en el aire para hacer un truco!'); }
  else if (ev === 'trick') hudMsg('¡Truco! 🌀', true);
  else if (ev === 'mode') hudMsg({ glide: '¡Ala delta! 🪂', boat: '¡Al agua! 🚤', sub: '¡Inmersión! 🤿' }[data], true);
  else if (ev === 'lap') { hudMsg('Vuelta ' + data, true); sfx.lap(); sfx.crowd?.(0, 0.7); }
  else if (ev === 'finalLap') { hudMsg('¡Última vuelta!', true); sfx.finalLap(); A.setMusicIntensity?.(1); sfx.crowd?.(0, 0.9); }
  else if (ev === 'lightning') { flash(true); setTimeout(() => sfx.thunder?.(), 380); }
  else if (ev === 'flash') { flash(); setTimeout(() => sfx.thunder?.(0, 0.7), 150); }
  else if (ev === 'finish') {
    const good = mode === 'time' || data <= 3;
    hudMsg(mode === 'time' ? '¡META!' : data === 1 ? '¡1º! 🏆' : '¡META!');
    if (A.playJingle) A.playJingle(good ? 'win' : 'lose'); else if (good) sfx.finish(); else sfx.lose();
    A.haptic?.('finish'); sfx.crowd?.();
    flash(); finishTimer = 3.6;
  }
}
function flash(soft) { const f = $('flash'); f.classList.remove('go', 'soft'); void f.offsetWidth; f.classList.add(soft ? 'soft' : 'go'); }

// ---------- Minimapa ----------
function buildMinimap() {
  const S = 140, pad = 12, m = track.mini;
  const sc = Math.min((S - pad * 2) / (m.maxX - m.minX), (S - pad * 2) / (m.maxZ - m.minZ));
  const ox = (S - (m.maxX - m.minX) * sc) / 2, oz = (S - (m.maxZ - m.minZ) * sc) / 2;
  const map = (x, z) => [S - (ox + (x - m.minX) * sc), oz + (z - m.minZ) * sc];
  miniBg = document.createElement('canvas'); miniBg.width = miniBg.height = S;
  const c = miniBg.getContext('2d');
  c.lineJoin = c.lineCap = 'round';
  const path = () => { c.beginPath(); track.samples.forEach((s, i) => { const [x, y] = map(s.x, s.z); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); };
  path(); c.strokeStyle = 'rgba(26,11,58,.85)'; c.lineWidth = 9; c.stroke();
  path(); c.strokeStyle = '#fff'; c.lineWidth = 4.5; c.stroke();
  const s0 = track.samples[0], [sx, sy] = map(s0.x, s0.z);
  c.fillStyle = '#ff2f4a'; c.fillRect(sx - 3, sy - 3, 6, 6);
  miniBg.map = map;
}
function drawMinimap() {
  const c = $('minimap').getContext('2d');
  c.clearRect(0, 0, 140, 140); c.drawImage(miniBg, 0, 0);
  for (const r of race.racers) {
    const [x, y] = miniBg.map(r.x, r.z);
    c.beginPath(); c.arc(x, y, r.isPlayer ? 6 : 4, 0, 7);
    c.fillStyle = r.isPlayer ? '#ffd21f' : hex(r.char.fur === 0xf2f2f7 ? 0xdddddd : r.char.accColor === 0x111111 ? 0xff7a1a : r.char.accColor);
    c.fill(); c.lineWidth = 2; c.strokeStyle = '#1a0b3a'; c.stroke();
  }
}

// ---------- HUD ----------
const ITEM_KEYS = Object.keys(ITEMS);
function setText(id, v) { if (lastHud[id] !== v) { lastHud[id] = v; $(id).textContent = v; } }
function updateHud(dt) {
  const p = race.player;
  if (lastHud.pos !== p.pos) {
    if (lastHud.pos !== undefined) { const e = $('hud-pos').parentElement; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    lastHud.pos = p.pos; $('hud-pos').textContent = p.pos;
  }
  setText('hud-lap', Math.max(1, Math.min(race.laps, Math.floor(p.prog / track.N) + 1)));
  setText('hud-time', fmt(race.time));
  setText('hud-bananas', p.bananas);
  let icon = '', has = false;
  if (p.rolling > 0) {
    rollT -= dt; if (rollT <= 0) { rollT = 0.08; rollIcon = (rollIcon + 1) % ITEM_KEYS.length; sfx.tick(); }
    icon = ITEMS[ITEM_KEYS[rollIcon]].icon;
  } else if (p.item) { icon = ITEMS[p.item].icon; has = true; }
  setText('hud-item-icon', icon);
  setText('hud-item-count', p.itemCount > 1 ? '×' + p.itemCount : '');
  if (lastHud.has !== has) { lastHud.has = has; $('hud-item').classList.toggle('has', has); }
  const wrong = p.wrongT > 1.2 && race.state === 'racing';
  if (lastHud.wrong !== wrong) { lastHud.wrong = wrong; $('hud-wrong').classList.toggle('hidden', !wrong); }
  const boost = p.boostT > 0;
  if (lastHud.boost !== boost) { lastHud.boost = boost; $('speedfx').classList.toggle('on', boost); }
  const dm = p.drifting;
  if (lastHud.dm !== dm) { lastHud.dm = dm; $('drift-fill').parentElement.classList.toggle('on', dm); }
  if (dm) {
    const lvl = p.driftLevel(), f = $('drift-fill');
    f.style.width = Math.min(100, p.charge / 2.6 * 100) + '%';
    f.style.background = ['#ffffff', '#38b6ff', '#ff9a1a', '#e04dff'][lvl];
  }
  // misiones: se ven al empezar y se comprueban dos veces por segundo
  const mp = race.state === 'intro' || race.state === 'countdown' || (race.state === 'racing' && race.time < 2.5);
  if (lastHud.mp !== mp) { lastHud.mp = mp; $('hud-missions').classList.toggle('show', mp); }
  missionT -= dt;
  if (missionT <= 0 && missions.length) {
    missionT = 0.5;
    const m = syncMissions();
    if (m && race.state === 'racing') { hint(fill('✓ Misión cumplida: {text}', m)); sfx.item(); }
  }
  drawMinimap();
}

// ---------- Resultados ----------
function showResults() {
  if (resultsShown) return;
  resultsShown = true;
  const res = race.results(), me = res.find(r => r.isPlayer), d = diff();
  const list = $('r-list'); list.innerHTML = '';
  let reward = 0, sub = currentTrack.name, rewardTxt = '', record = false;
  $('r-retry').classList.toggle('hidden', mode === 'cup');
  if (mode === 'time') {
    const t = race.time, best = save.best[currentTrack.id];
    record = !best || t < best;
    $('r-title').textContent = record ? '¡Nuevo récord!' : 'Contrarreloj';
    list.innerHTML = `<li class="me"><b>⏱</b><span>Tu tiempo</span><span></span><span>${fmt(t)}</span></li>` +
      `<li><b>★</b><span>Mejor tiempo</span><span></span><span>${fmt(record ? t : best)}</span></li>`;
    if (record) { save.best[currentTrack.id] = Math.round(t * 100) / 100; save.ghosts[currentTrack.id] = race.rec; A.playJingle?.('record'); }
    reward = 20 + me.bananas + (record ? 50 : 0);
    rewardTxt = `+${reward} 🍌` + (record ? ' (récord +50)' : '');
    $('r-next').textContent = 'Menú ▶';
  } else {
    $('r-title').textContent = me.pos === 1 ? '¡Victoria!' : me.pos <= 3 ? '¡Podio!' : 'Resultados';
    if (mode === 'cup') {
      res.forEach(r => { cupState.pts[r.char.id] = (cupState.pts[r.char.id] || 0) + CUP_POINTS[r.pos - 1]; cupState.ride[r.char.id] = { kart: r.kart, color: r.color, hat: r.hat, wheels: r.wheels }; });
      sub = `${cupState.cup.name} · Carrera ${cupState.i + 1}/3 · ${currentTrack.name}`;
    }
    for (const r of res) {
      const li = document.createElement('li'); if (r.isPlayer) li.className = 'me';
      const extra = mode === 'cup' ? `+${CUP_POINTS[r.pos - 1]} (${cupState.pts[r.char.id]} pts)` : '';
      li.innerHTML = `<b>${r.pos}º</b><span>${r.name}${r.isPlayer ? ' (tú)' : ''}</span><span>${extra}</span><span>${r.time ? fmt(r.time) : '—'}</span>`;
      list.appendChild(li);
    }
    reward = Math.round(RACE_REWARD[me.pos - 1] * d.reward) + me.bananas;
    rewardTxt = `+${reward} 🍌`;
    $('r-next').textContent = mode === 'cup' ? (cupState.i < 2 ? 'Siguiente carrera ▶' : 'Ver clasificación ▶') : 'Menú ▶';
  }
  // misiones (se pagan una sola vez, aquí), estadísticas de por vida y logros
  mctx.finished = true; syncMissions(); renderMissions($('r-missions'), false);
  const mr = missionsReward(missions);
  if (mr) { reward += mr; rewardTxt = fill('+{total} 🍌 (misiones +{mr})', { total: reward, mr }) + (record ? ' · ¡récord!' : ''); }
  recordRace(save, { mode, pos: me.pos, st: me.st, time: race.time, missions: missions.filter(x => x.done).length, record });
  $('r-sub').textContent = sub;
  $('r-reward').textContent = rewardTxt;
  earn(reward); persist(); awardAchievements();
  if (mode === 'race') startPodium(res.slice(0, 3).map(r => ({ char: r.char, kart: r.kart, color: r.color, hat: r.hat, wheels: r.wheels, isPlayer: r.isPlayer })), me.pos, false);
  else show('results');
}

// Escena de podio antes del panel de resultados
function startPodium(top, myPos, trophy) {
  stopEngine(); A.stopAmbience?.(); rivalOut.length = 0; A.updateRivalEngines?.(rivalOut);
  $('speedfx').classList.remove('on');
  podium.setup(top); podiumT = 0;
  podiumAfter = () => show('results');
  startMusic(PODIUM_MUSIC);
  if (trophy) A.playJingle?.('trophy');
  $('podium-names').innerHTML = top.map((r, i) => `<span class="${r.isPlayer ? 'me' : ''}"><b>${i + 1}º</b> ${r.char.name}${r.isPlayer ? ' (tú)' : ''}</span>`).join('') +
    (myPos > 3 ? `<span class="me"><b>${myPos}º</b> Tú</span>` : '');
  $('podium-title').textContent = myPos === 1 ? '🏆 ¡Has ganado!' : myPos <= 3 ? '🎉 ¡Estás en el podio!' : 'Podio';
  show('podium');
}
function endPodium() {
  if (!podium.active || podiumT < 0.8) return;
  podium.active = false; sfx.ui();
  const f = podiumAfter; podiumAfter = null; if (f) f();
}

function showCupFinal() {
  const d = diff(), cup = cupState.cup;
  const rows = Object.entries(cupState.pts).map(([id, pts]) => ({ id, pts, ch: charById(id) })).sort((a, b) => b.pts - a.pts);
  const rank = rows.findIndex(r => r.id === save.char) + 1;
  const list = $('r-list'); list.innerHTML = '';
  rows.forEach((r, i) => {
    const li = document.createElement('li'); if (r.id === save.char) li.className = 'me';
    li.innerHTML = `<b>${i + 1}º</b><span>${r.ch.name}${r.id === save.char ? ' (tú)' : ''}</span><span></span><span>${r.pts} pts</span>`;
    list.appendChild(li);
  });
  let bonus = 0;
  if (rank <= 3) {
    const key = cup.id + '_' + d.id, wasLocked = !cup1Unlocked();
    save.trophies[key] = Math.min(save.trophies[key] || 9, rank);
    bonus = Math.round([300, 200, 120][rank - 1] * d.reward);
    earn(bonus); if (rank === 1) addStat(save, 'golds');
    if (wasLocked && cup.id === 'platano') setTimeout(() => toast('¡Copa Diamante desbloqueada! 💎'), 600);
    sfx.buy();
  }
  persist(); awardAchievements();
  $('r-title').textContent = rank === 1 ? '🏆 ¡Campeón!' : rank === 2 ? '🥈 ¡Segundo!' : rank === 3 ? '🥉 ¡Tercero!' : 'Fin de la copa';
  $('r-sub').textContent = `${cup.name} · ${d.name}`;
  $('r-reward').textContent = bonus ? `Premio: +${bonus} 🍌` : 'Queda entre los 3 primeros para ganar trofeo';
  $('r-next').textContent = 'Menú ▶';
  $('r-retry').classList.add('hidden');
  cupState.done = true; missions = []; renderMissions($('r-missions'), false);
  startPodium(rows.slice(0, 3).map(r => ({ char: r.ch, ...(cupState.ride[r.id] || {}), isPlayer: r.id === save.char })), rank, rank <= 3);
}

function toMenu() {
  disposeRace(); cupState = null;
  startMusic(MENU_MUSIC); refreshShow(); show('menu');
}

// ---------- Listas de selección ----------
function miniSvg(t) {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const a = i / 60 * Math.PI * 2; let r = 1;
    for (const [k, amp, ph] of t.waves) r += amp * Math.sin(k * a + ph);
    d += (i ? 'L' : 'M') + (50 - Math.cos(a) * r * 34).toFixed(1) + ' ' + (50 + Math.sin(a) * r * 34).toFixed(1);
  }
  return `<svg class="mini" viewBox="0 0 100 100"><path d="${d}Z" fill="none" stroke="#1a0b3a" stroke-width="13" stroke-linejoin="round"/><path d="${d}Z" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/></svg>`;
}
const cardBg = t => `linear-gradient(170deg, ${hex(t.theme.skyTop)} 0%, ${hex(t.theme.skyBottom)} 55%, ${hex(t.theme.ground)} 56%, ${hex(t.theme.ground2)} 100%)`;

function buildDiffSeg(el) {
  el.innerHTML = '';
  DIFFICULTIES.forEach((d, i) => {
    const b = document.createElement('button'); b.textContent = d.name; if (i === save.settings.diff) b.className = 'on';
    b.onclick = () => { save.settings.diff = i; persist(); sfx.ui(); buildDiffSeg($('diff-seg')); buildDiffSeg($('diff-seg2')); if (screen === 'cups') buildCups(); };
    el.appendChild(b);
  });
}

function buildTracks() {
  $('tracks-title').textContent = mode === 'time' ? 'Contrarreloj' : 'Carrera rápida';
  $('diff-seg').style.visibility = mode === 'time' ? 'hidden' : 'visible';
  buildDiffSeg($('diff-seg'));
  const box = $('track-cards'); box.innerHTML = '';
  for (const t of TRACKS) {
    const ok = trackUnlocked(t), c = document.createElement('button');
    c.className = 'card' + (ok ? '' : ' locked'); c.style.background = cardBg(t);
    const best = save.best[t.id];
    c.innerHTML = `${miniSvg(t)}<h3>${ok ? t.name : '🔒 ' + t.name}</h3><p>${ok ? (mode === 'time' ? (best ? '★ ' + fmt(best) : 'Sin tiempo') : CUPS[t.cup].name) : 'Gana un trofeo en la Copa Plátano'}</p>`;
    c.onclick = () => { if (!ok) { sfx.deny(); toast('Gana un trofeo en la Copa Plátano'); return; } sfx.ui(); startRace(t.id); };
    box.appendChild(c);
  }
}

function buildCups() {
  buildDiffSeg($('diff-seg2'));
  const box = $('cup-cards'); box.innerHTML = '';
  CUPS.forEach((cup, i) => {
    const ok = i === 0 || cup1Unlocked(), c = document.createElement('button');
    const t0 = trackById(cup.tracks[0]), tr = save.trophies[cup.id + '_' + diff().id];
    c.className = 'card' + (ok ? '' : ' locked'); c.style.background = cardBg(t0); c.style.minHeight = '150px';
    c.innerHTML = `<span class="emoji">${cup.icon}</span><h3>${ok ? cup.name : '🔒 ' + cup.name}</h3>` +
      `<p>${cup.tracks.map(id => trackById(id).name).join(' · ')}</p><p>${tr ? ['🏆 Oro', '🥈 Plata', '🥉 Bronce'][tr - 1] + ' en ' + diff().name : ok ? '3 carreras · sin trofeo aún' : 'Gana un trofeo en la Copa Plátano'}</p>`;
    c.onclick = () => {
      if (!ok) { sfx.deny(); toast('Gana un trofeo en la Copa Plátano'); return; }
      sfx.ui(); mode = 'cup'; cupState = { cup, i: 0, pts: {}, ride: {}, rivals: makeLineup(RACERS - 1) }; startRace(cup.tracks[0]);
    };
    box.appendChild(c);
  });
}

// ---------- Garaje ----------
// Pestañas con lista de compra y elección (gorilas, coches y la tienda de shop.js), además de pintura y mejoras
const GARAGE_LISTS = { chars: { list: CHARACTERS, owned: 'chars', cur: 'char' }, karts: { list: KARTS, owned: 'karts', cur: 'kart' } };
for (const s of SHOP) GARAGE_LISTS[s.tab] = s;
const GARAGE_TABS = [['chars', 'Gorilas'], ['karts', 'Coches'], ['colors', 'Color'], ['upgrades', 'Mejoras'], ...SHOP.map(s => [s.tab, s.label])];
let gTab = 'chars', gSel = null;
const STAT_NAMES = { speed: 'Velocidad', accel: 'Aceleración', handling: 'Manejo' };
const chipDot = it => (it.icon ? `<span class="dot ico">${it.icon}</span>` : `<span class="dot" style="background:${it.dot || hex(it.fur != null ? it.fur : it.color)}"></span>`);
function buildGarageTabs() {
  const box = $('garage-tabs'); box.innerHTML = '';
  for (const [id, label] of GARAGE_TABS) {
    const t = document.createElement('button'); t.className = 'tab'; t.dataset.tab = id; t.textContent = label;
    t.onclick = () => { gTab = id; gSel = null; sfx.ui(); refreshShow(); buildGarage(); t.scrollIntoView({ block: 'nearest', inline: 'center' }); };
    box.appendChild(t);
  }
}
function buildGarage() {
  document.querySelectorAll('#garage-tabs .tab').forEach(t => { t.classList.toggle('active', t.dataset.tab === gTab); if (t.dataset.tab === gTab) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  const strip = $('garage-strip'), act = $('g-action'); strip.innerHTML = '';
  act.classList.remove('hidden'); act.disabled = false; $('g-stats').innerHTML = ''; showTrailDef = null;
  if (gTab === 'colors') {
    KART_COLORS.forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'chip' + (i === save.color ? ' sel equipped' : '');
      b.innerHTML = `<span class="dot" style="background:${c === null ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : hex(c)}"></span>${c === null ? 'Original' : 'Color ' + i}`;
      b.onclick = () => { save.color = i; persist(); sfx.ui(); refreshShow(); showSpin = 3; buildGarage(); };
      strip.appendChild(b);
    });
    $('g-name').textContent = 'Pintura'; $('g-desc').textContent = 'Elige el color de tu coche. ¡Es gratis!';
    act.classList.add('hidden');
    return;
  }
  if (gTab === 'upgrades') {
    if (!UPGRADES.includes(gSel)) gSel = UPGRADES[0];
    for (const u of UPGRADES) {
      const b = document.createElement('button'); b.className = 'chip' + (u === gSel ? ' sel' : '');
      b.innerHTML = `<span class="dot ico">${u.icon}</span>${u.name}<small>${fill('Nivel {lv}/{max}', { lv: upgradeLevel(save, u.id), max: UPGRADE_MAX })}</small>`;
      b.onclick = () => { gSel = u; sfx.ui(); buildGarage(); };
      strip.appendChild(b);
    }
    const lv = upgradeLevel(save, gSel.id);
    $('g-name').textContent = gSel.name; $('g-desc').textContent = gSel.desc;
    $('g-stats').innerHTML = `<div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>` +
      `<small class="note">${fill('Nivel {lv} de {max} · solo para tu coche', { lv, max: UPGRADE_MAX })}</small>`;
    if (lv >= UPGRADE_MAX) { act.textContent = '✔ Nivel máximo'; act.disabled = true; } else act.textContent = fill('Mejorar por 🍌 {price}', { price: upgradePrice(lv) });
    return;
  }
  const L = GARAGE_LISTS[gTab], list = L.list, owned = save[L.owned], cur = save[L.cur];
  strip.classList.toggle('shop', !!L.hint); // en la tienda, lo no comprado se ve con su color real
  if (!gSel || !list.includes(gSel)) gSel = byId(list, cur);
  for (const it of list) {
    const has = owned.includes(it.id), b = document.createElement('button');
    b.className = 'chip' + (it === gSel ? ' sel' : '') + (it.id === cur ? ' equipped' : '') + (has ? '' : ' locked');
    b.innerHTML = `${chipDot(it)}${it.name}${has ? '' : `<small>🍌 ${it.price}</small>`}`;
    b.onclick = () => { gSel = it; sfx.ui(); showSpin = 2.5; previewSel(); buildGarage(); };
    strip.appendChild(b);
  }
  $('g-name').textContent = gSel.name;
  $('g-desc').textContent = gSel.desc || 'Combina sus estadísticas con las de tu gorila.';
  if (gSel.stats) $('g-stats').innerHTML = Object.keys(STAT_NAMES).map(k => `<div class="stat"><span>${STAT_NAMES[k]}</span><div class="bar"><i style="width:${gSel.stats[k] * 20}%"></i></div></div>`).join('');
  else if (L.hint) $('g-stats').innerHTML = `<small class="note">${L.hint}</small>`;
  if (gTab === 'trails') showTrailDef = gSel;
  if (gSel.id === cur) { act.textContent = '✔ Elegido'; act.disabled = true; }
  else if (owned.includes(gSel.id)) act.textContent = 'Elegir';
  else act.textContent = fill('Comprar por 🍌 {price}', gSel);
}
// Muestra en el escaparate lo que se está mirando (aunque no esté comprado); las bocinas se prueban de oído
function previewSel() {
  const o = { char: save.char, kart: save.kart, hat: save.hat, wheel: save.wheel }, L = GARAGE_LISTS[gTab];
  if (L && gSel) o[L.cur] = gSel.id;
  setShowModel(o.char, o.kart, save.color, o.hat, o.wheel);
  if (gTab === 'horns') sfx.horn(gSel.id);
}
function garageAction() {
  if (gTab === 'upgrades') {
    const lv = upgradeLevel(save, gSel.id), price = upgradePrice(lv);
    if (lv >= UPGRADE_MAX) return;
    if (save.bananas < price) { sfx.deny(); toast(fill('Te faltan {n} 🍌', { n: price - save.bananas })); return; }
    save.bananas -= price; save.upgrades[gSel.id] = lv + 1; sfx.buy();
  } else {
    const L = GARAGE_LISTS[gTab]; if (!L) return;
    const owned = save[L.owned];
    if (!owned.includes(gSel.id)) {
      if (save.bananas < gSel.price) { sfx.deny(); toast(fill('Te faltan {n} 🍌', { n: gSel.price - save.bananas })); return; }
      save.bananas -= gSel.price; owned.push(gSel.id); sfx.buy();
    } else sfx.ui();
    save[L.cur] = gSel.id;
    if (gTab === 'horns') sfx.horn(gSel.id);
  }
  persist(); refreshShow(); showPound = 1.2; showSpin = 4; buildGarage();
  syncWallet(); awardAchievements();
}

// ---------- Misiones y logros ----------
let mTab = 'ach';
function buildMeta() {
  document.querySelectorAll('#meta-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === mTab));
  const box = $('meta-body'); box.className = 'meta-body tab-' + mTab; box.scrollTop = 0;
  if (mTab === 'ach') {
    const got = ACHIEVEMENTS.filter(a => achDone(save, a)).length;
    box.innerHTML = `<p class="meta-note">${fill('Logros conseguidos: {got} de {all}', { got, all: ACHIEVEMENTS.length })}</p>` + ACHIEVEMENTS.map(a => {
      const done = achDone(save, a), goal = achGoal(a), v = done ? goal : achValue(save, a);
      return `<div class="ach${done ? ' done' : ''}"><span class="ach-ico">${a.icon}</span><div class="ach-txt"><h3>${a.name}</h3><p>${a.desc}</p>` +
        `<div class="bar"><i style="width:${Math.round(v / goal * 100)}%"></i></div></div><div class="ach-side"><b>${done ? '✔' : v + '/' + goal}</b><small>🍌 ${a.reward}</small></div></div>`;
    }).join('');
  } else if (mTab === 'missions') {
    box.innerHTML = '<p class="meta-note">En cada carrera recibes 3 misiones al azar (2 en contrarreloj). Cúmplelas para ganar plátanos extra al terminar.</p>' +
      MISSIONS.map(x => `<div class="ach"><span class="ach-ico">📋</span><div class="ach-txt"><h3>${fill(x.text, { n: x.n, par: 'un tiempo objetivo' })}</h3></div><div class="ach-side"><small>🍌 ${x.reward}</small></div></div>`).join('');
  } else {
    box.innerHTML = LIFETIME.map(d => `<div class="lstat"><span>${d.name}</span><b>${statText(save, d)}</b></div>`).join('');
  }
}

// ---------- Ajustes ----------
function buildSettings() {
  const s = save.settings;
  const seg = (id, key, after) => {
    $(id).querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.v === s[key]);
      b.onclick = async () => {
        if (key === 'controls' && b.dataset.v === 'tilt') {
          const ok = await enableTilt(true);
          if (!ok) { toast('No se pudo activar el sensor de inclinación'); return; }
        } else if (key === 'controls') enableTilt(false);
        s[key] = b.dataset.v; persist(); sfx.ui(); buildSettings(); if (after) after();
      };
    });
  };
  seg('set-controls', 'controls');
  // el nivel de gráficos también ajusta resplandor y sombras (luego se pueden cambiar por separado)
  seg('set-quality', 'quality', () => { s.bloom = s.quality !== 'baja'; s.shadows = s.quality === 'alta'; s.outline = s.quality !== 'baja'; persist(); resize(); buildSettings(); });
  const flag = (id, key, after) => {
    $(id).querySelectorAll('button').forEach(b => {
      const v = b.dataset.v === '1';
      b.classList.toggle('on', !!s[key] === v);
      b.onclick = () => { s[key] = v; persist(); sfx.ui(); buildSettings(); if (after) after(); };
    });
  };
  if (s.outline == null) s.outline = true;
  flag('set-outline', 'outline', resize); flag('set-bloom', 'bloom', resize); flag('set-shadows', 'shadows');
  flag('set-haptics', 'haptics', () => { A.setHaptics?.(!!s.haptics); A.haptic?.('hit'); });
  $('set-bloom').classList.toggle('off', !post.supported);
  $('set-music').value = s.music; $('set-sfx').value = s.sfx;
}

// ---------- Eventos de interfaz ----------
function wireUi() {
  // con el juego en pausa no se reactiva el sonido al tocar la pantalla
  document.addEventListener('pointerdown', () => { if (!paused) initAudio(); }, { passive: true });
  $('btn-start').onclick = () => { initAudio(); sfx.ui(); startMusic(MENU_MUSIC); show('menu'); };
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    sfx.ui(); const g = b.dataset.go;
    if (g === 'race' || g === 'time') { mode = g; buildTracks(); show('tracks'); }
    else if (g === 'cups') { buildCups(); show('cups'); }
    else if (g === 'garage') { gSel = null; show('garage'); buildGarage(); }
    else if (g === 'settings') { buildSettings(); show('settings'); }
    else if (g === 'meta') { mTab = 'ach'; buildMeta(); show('meta'); }
  });
  document.querySelectorAll('#meta-tabs .tab').forEach(t => t.onclick = () => { mTab = t.dataset.mtab; sfx.ui(); buildMeta(); });
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { sfx.back(); refreshShow(); show('menu'); });
  buildGarageTabs();
  $('g-action').onclick = garageAction;
  $('podium-next').onclick = endPodium;
  $('s-podium').addEventListener('pointerup', e => { if (e.target.id !== 'podium-next' && podiumT > 2) endPodium(); });
  $('set-music').oninput = e => { save.settings.music = +e.target.value; setVolumes(save.settings.music, save.settings.sfx); persist(); };
  $('set-sfx').oninput = e => { save.settings.sfx = +e.target.value; setVolumes(save.settings.music, save.settings.sfx); };
  $('set-sfx').onchange = () => { persist(); sfx.coin(); };
  $('set-reset').onclick = () => {
    if (confirm('¿Borrar todo el progreso (plátanos, trofeos, récords y compras)?')) { resetSave(); save.settings.diff = 1; refreshShow(); buildSettings(); A.setHaptics?.(true); resize(); toast('Partida borrada'); show('settings'); }
  };
  $('btn-pause').onclick = () => setPaused(true);
  $('p-resume').onclick = () => setPaused(false);
  $('p-restart').onclick = () => { sfx.ui(); suspendAudio(false); if (mode === 'cup') { cupState.i = 0; cupState.pts = {}; cupState.ride = {}; startRace(cupState.cup.tracks[0]); } else startRace(currentTrack.id); };
  $('p-quit').onclick = () => { sfx.back(); suspendAudio(false); toMenu(); };
  $('r-retry').onclick = () => { sfx.ui(); startRace(currentTrack.id); };
  $('r-next').onclick = () => {
    sfx.ui();
    if (mode === 'cup' && cupState && !cupState.done) {
      if (cupState.i < 2) { cupState.i++; startRace(cupState.cup.tracks[cupState.i]); } else showCupFinal();
    } else toMenu();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (race && !resultsShown && screen === 'hud') setPaused(true); else suspendAudio(true); }
    else if (!paused) suspendAudio(false);
  });
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('contextmenu', e => e.preventDefault());

  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('btn-install').classList.remove('hidden'); });
  $('btn-install').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('btn-install').classList.add('hidden'); };
  addEventListener('appinstalled', () => { $('btn-install').classList.add('hidden'); toast('¡Juego instalado! 🦍'); });
}

function setPaused(on) {
  if (!race || resultsShown) return;
  paused = on;
  if (on) { syncMissions(); renderMissions($('p-missions'), true); show('pause', 'hud'); suspendAudio(true); }
  else { suspendAudio(false); sfx.ui(); show('hud'); last = performance.now(); }
}

// ---------- Bucle principal ----------
let last = performance.now(), tGlobal = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const ps = renderer.domElement.height * 0.05;
  if (podium.active) {
    podiumT += dt;
    podium.update(dt, innerWidth / innerHeight); podium.fx.update(dt, ps);
    render(podium.scene, podium.camera);
    return;
  }
  if (race) {
    if (!paused) {
      pollInput(dt);
      if (input.pausePressed && !resultsShown) { consumePresses(); setPaused(true); return; }
      race.update(dt, input);
      consumePresses();
      race.updateCamera(camera, dt, camera.aspect);
      track.update(dt, race.t, camera.position, race.player);
      race.lateUpdate(dt, camera);
      fxAdd.update(dt, ps); fxNorm.update(dt, ps);
      const p = race.player, tun = track.samples[p.idx].tun;
      ambient.points.visible = !tun && !race.underwater.on;
      ambient.update(race.t, camera.position);
      // sonido continuo: motor propio, rivales cercanos, clima y eco del túnel
      updateEngine(Math.min(1.3, Math.abs(p.speed) / p.maxSpeed), p.drifting && p.hopY < 0.1, p.boostT > 0);
      if (!resultsShown) {
        const n = race.rivalAudio(rivalBuf); rivalOut.length = 0; for (let i = 0; i < n; i++) rivalOut.push(rivalBuf[i]);
        A.updateRivalEngines?.(rivalOut);
        A.setAmbienceLevel?.(race.weather.level);
        const muffled = tun || race.underwater.on;
        if (muffled !== inTunnel) { inTunnel = muffled; A.setTunnel?.(muffled); }
        updateHud(dt);
        if (finishTimer > 0) { finishTimer -= dt; if (finishTimer <= 0) showResults(); }
        // aviso si el móvil no puede con los gráficos
        if (race.state === 'racing' && !fpsHinted && race.time < 9) {
          fpsAcc += dt; fpsN++;
          if (fpsAcc > 6) { if (fpsN / fpsAcc < 24 && save.settings.quality !== 'baja') { fpsHinted = true; toast('¿Va lento? Baja los gráficos en Ajustes ⚙️'); } fpsAcc = -1e9; }
        }
      }
    } else if (input.pausePressed) { consumePresses(); setPaused(false); }
    render(raceScene, camera);
  } else {
    tGlobal += dt;
    if (showModel) {
      showSpin += (0.6 - showSpin) * Math.min(1, dt * 2);
      showModel.rotation.y += dt * showSpin;
      showPound = Math.max(0, showPound - dt);
      const idle = Math.sin(tGlobal * 0.7) > 0.86;
      animateGorilla(showGorilla, tGlobal, { steer: Math.sin(tGlobal * 1.3) * 0.5, mode: showPound > 0 ? 'pound' : idle ? 'cheer' : 'drive', face: showPound > 0 || idle ? 'happy' : 'neutral', speedK: 0.4, dt });
      animateKart(showKart, dt, 6, Math.sin(tGlobal * 1.3) * 0.5);
      updateShowTrail();
    }
    render(menuScene, menuCam);
  }
}

// ---------- Arranque ----------
initInput();
wireUi();
setVolumes(save.settings.music, save.settings.sfx);
A.setHaptics?.(save.settings.haptics !== false);
if (save.settings.controls === 'tilt') enableTilt(true);
refreshShow();
resize();
show('title');
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW: el juego sigue funcionando en línea */ }));
}

// Acceso para pruebas automáticas
window.__game = { get race() { return race; }, get track() { return track; }, get save() { return save; }, get missions() { return missions; }, get show() { return showModel; }, podium, post, showModel: setShowModel, startRace: (id, m = 'race') => { mode = m; startRace(id); }, showResults: () => showResults() };
