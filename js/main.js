// Amazing Gorilla Racing — arranque, menús, HUD y bucle principal.
import * as THREE from './vendor/three.module.min.js';
import { CHARACTERS, KARTS, KART_COLORS, ITEMS, TRACKS, EXTRA_TRACKS, CUPS, DIFFICULTIES, CUP_POINTS, RACE_REWARD, RACERS, MENU_MUSIC, PODIUM_MUSIC, trackById, charById, kartById } from './data.js';
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
import { Tutorial, TUTORIAL } from './tutorial.js';
import { buildShowroom } from './showroom.js';
import { share } from './share.js';
import { todDef, surpriseTrack } from './variants.js';
import { dailyChallenge, isYesterday, DAILY_REWARD, DAILY_STREAK_BONUS, DAILY_STREAK_MAX } from './daily.js';
import { BOSSES, BOSS_REWARD } from './boss.js';
import { t, lang, setLang, initI18n } from './i18n.js';
import { medalTimes, MEDAL_NAMES, MEDAL_REWARD, MISSIONS, MISSION_COUNT, ACHIEVEMENTS, LIFETIME, fill, pickMissions, parTime, updateMissions, missionProgress, missionsReward, recordRace, addStat, statText, checkAchievements, achGoal, achValue, achDone } from './meta.js';

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
const qualityK = () => ({ baja: 0.5, media: 0.8, alta: 1, ultra: 1.3 }[save.settings.quality] || 1);
const post = new Post(renderer);
// ---------- Calidad automática ----------
// Gráficos efectivos = ajustes del jugador menos los pasos de reducción automática ya aplicados (settings.autoQ):
//  1 sin sombras · 2 resolución 1,5× · 3 sin contorno · 4 sin resplandor · 5 resolución 1×   (nunca por debajo del nivel «Bajos»)
const AUTO_STEPS = 5, AUTO_FPS = 26, AUTO_HOLD = 4, AUTO_GAP = 6; // umbral de FPS, segundos por debajo y pausa entre pasos
const G = { shadows: false, outline: true, bloom: false, pr: 1, msaa: 0 };
const autoN = () => (save.settings.autoQuality !== false ? Math.max(0, Math.min(AUTO_STEPS, save.settings.autoQ | 0)) : 0);
function syncGfx() {
  const s = save.settings, n = autoN();
  G.shadows = !!s.shadows && n < 1; G.outline = s.outline !== false && n < 3; G.bloom = !!s.bloom && n < 4;
  G.pr = s.quality === 'ultra' ? 3 : s.quality === 'alta' ? 2 : s.quality === 'media' ? 1.5 : 1;
  if (n >= 2) G.pr = Math.min(G.pr, 1.5); if (n >= 5) G.pr = 1;
  G.msaa = (s.quality === 'alta' || s.quality === 'ultra') && n < 2 ? 4 : 0;
}
const usePost = () => G.bloom && post.supported;
function render(scene, cam) {
  if (usePost()) post.render(scene, cam); else { renderer.setRenderTarget(null); renderer.render(scene, cam); }
}

function resize() {
  if (innerHeight > innerWidth && isTouch() && race && !paused && !resultsShown && screen === 'hud') setPaused(true); // en vertical la carrera se detiene
  syncGfx();
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, G.pr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  menuCam.aspect = w / h; placeShow(); applyShowOffset();
  if (usePost()) post.setSize(G.msaa); else if (post.supported) post.disposeTargets();
  const db = renderer.getDrawingBufferSize(new THREE.Vector2()); setOutlineRes(db.x, db.y); setOutline(G.outline);
  menuRing.material.color.set(0x22e6ff).multiplyScalar(usePost() ? 2.2 : 1);
}

// ---------- Escaparate del menú ----------
const menuScene = new THREE.Scene();
const menuCam = new THREE.PerspectiveCamera(42, 1, 0.3, 700);
let showModel = null, showKart = null, showGorilla = null, showPound = 0, showSpin = 0.6, menuRing = null, showroom = null;
{
  // el escenario (cielo, colinas, vegetación, banderines y focos) está en showroom.js
  showroom = buildShowroom(menuScene);
  menuScene.add(new THREE.HemisphereLight(0xffffff, 0x9be8a0, 1.45));
  const d = new THREE.DirectionalLight(0xfff4d8, 1.9); d.position.set(-3, 5, 4); menuScene.add(d);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4, 0.5, 40), new THREE.MeshLambertMaterial({ color: 0x7a5cff }));
  plat.position.y = -0.26; menuScene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: 0x22e6ff }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0; menuScene.add(ring); menuRing = ring;
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
const OFFSETS = { title: [0.3, 0], menu: [0.2, 0], garage: [0.22, 0.02], tracks: [0, 0], cups: [0, 0], settings: [0, 0], meta: [0, 0], tutoask: [0.2, 0], modes: [0, 0], privacy: [0, 0] };
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
let podiumAfter = null, podiumT = 0, rampHints = 0, inTunnel = false;
let frameAvg = 1 / 60, lowT = 0, stepGap = 0; // calidad automática: media móvil del fotograma, tiempo con pocos FPS y espera tras un paso
// misiones de la carrera en curso y su contexto (se reutiliza: sin basura por fotograma)
let missions = [], missionT = 0;
const mctx = { st: null, pos: 0, total: 0, time: 0, par: 0, finished: false, started: false };
const rivalBuf = [{ pan: 0, gain: 0, pitch: 0 }, { pan: 0, gain: 0, pitch: 0 }, { pan: 0, gain: 0, pitch: 0 }], rivalOut = [];

// Reglas propias de cada modo; lo que no aparece usa los valores normales. Los modos nuevos se añaden aquí.
//  laps · rivals (número de rivales) · difficulty · tune (ajustes del jugador en lugar de sus mejoras)
//  aiItems: false (los rivales no cogen objetos) · noHazards (sin obstáculos) · podium (escena de podio al acabar)
//  track: pista fija del modo
const MODE_RULES = {
  race: { podium: true },
  cup: {},
  time: {},
  elim: { podium: true },                                      // eliminación: el último queda fuera cada pocos segundos
  battle: { podium: true, arena: true, noHazards: true },      // batalla de globos en una arena
  fever: { podium: true, arena: true, noHazards: true },       // fiebre del plátano: gana quien recoja más
  stunt: { podium: true },                                     // acrobacias: gana quien sume más puntos
  surprise: { podium: true },                                  // circuito generado al azar
  daily: { podium: true },                                     // reto diario (daily.js)
  boss: { rivals: 1 },                                         // duelo contra un jefe (boss.js)
  tutorial: TUTORIAL,
};
const VARIANT_MODES = ['race', 'time', 'elim', 'stunt']; // modos en los que se elige espejo/inverso y la hora del día
let tod = '', arenaId = 'arena', surprise = null, daily = null, bossNow = null, builtDef = null; // hora del día, arena elegida, circuito sorpresa, reto del día, jefe y circuito tal como se ha construido
const bossTrack = b => CUPS[b.cup].tracks[CUPS[b.cup].tracks.length - 1]; // cada jefe espera en el último circuito de su copa
let variant = '', raceKind = 'race';            // variante del circuito ('' | 'mirror' | 'reverse') y tipo de carrera rápida ('race' | 'elim')
let replaying = false, photo = false, glideHints = 0, curHints = 0, draftHints = 0;
const ph = { a: 0, e: 0.22, d: 10, keep: null }; // cámara del modo foto: ángulo, elevación y distancia
const recKey = () => currentTrack.id + (variant ? ':' + variant : ''); // clave de récords y fantasmas
const rules = () => MODE_RULES[mode] || {};
let tuto = null, tutoRev = -1; // tutorial en curso
const TUTO_BTNS = ['btn-left', 'btn-right', 'btn-drift', 'btn-item', 'btn-brake', 'hud-item'];

// cada copa se desbloquea con un trofeo en la anterior
const cupUnlocked = i => i <= 0 || Object.keys(save.trophies).some(k => k.startsWith(CUPS[i - 1].id + '_'));
const trackUnlocked = t => cupUnlocked(t.cup);
const lockText = i => fill(t('Gana un trofeo en la {cup}'), { cup: t(CUPS[i - 1].name) });

// Rival personal: un gorila fijo que te reta en cada carrera y se adapta a tu nivel (save.rival)
const RIVAL_MIN = -3, RIVAL_MAX = 6, RIVAL_BONUS = 25;
function rivalDef() {
  const rv = save.rival;
  if (!rv.char || rv.char === save.char || !CHARACTERS.some(c => c.id === rv.char)) {
    const pool = CHARACTERS.filter(c => c.id !== save.char); rv.char = pool[Math.floor(Math.random() * pool.length)].id; persist();
  }
  return { char: rv.char, level: Math.max(RIVAL_MIN, Math.min(RIVAL_MAX, rv.level | 0)) };
}
const hasRival = () => mode !== 'tutorial' && mode !== 'time' && mode !== 'boss';
const diff = () => DIFFICULTIES[save.settings.diff] || DIFFICULTIES[1];

// Parrilla de rivales al azar: [{ char, kart, color }] (en una copa se mantiene durante sus carreras)
function makeLineup(n) {
  const mix = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const chars = mix(CHARACTERS.filter(c => c.id !== save.char)), karts = mix(KARTS.slice());
  if (hasRival()) { const rc = rivalDef().char, i = chars.findIndex(c => c.id === rc); if (i > 0) chars.unshift(chars.splice(i, 1)[0]); } // el rival siempre corre
  // cada modelo de coche rival lleva siempre el mismo color: así las geometrías en caché no crecen sin límite
  return Array.from({ length: n }, (_, i) => { const k = karts[i % karts.length]; return { char: chars[i % chars.length].id, kart: k.id, color: 1 + (KARTS.indexOf(k) * 3) % (KART_COLORS.length - 1) }; });
}

function disposeRace() {
  stopEngine(); A.stopAmbience?.(); A.setTunnel?.(false); A.setMusicIntensity?.(0);
  rivalOut.length = 0; A.updateRivalEngines?.(rivalOut);
  podium.active = false; inTunnel = false;
  if (race) race.dispose();
  if (track) track.dispose();
  if (ambient) ambient.dispose();
  if (fxAdd) { fxAdd.points.geometry.dispose(); fxAdd.mat.dispose(); fxNorm.points.geometry.dispose(); fxNorm.mat.dispose(); }
  race = track = raceScene = fxAdd = fxNorm = ambient = tuto = null;
  replaying = photo = false; gliderButtons(false);
  $('speedfx').classList.remove('on');
}

function startRace(trackId) {
  if (save.settings.controls === 'tilt') enableTilt(true);
  $('loading').classList.remove('hidden');
  setTimeout(() => {
    disposeRace();
    const R = rules();
    currentTrack = mode === 'surprise' ? surprise : trackById(R.arena ? arenaId : mode === 'daily' ? daily.track : mode === 'boss' ? bossTrack(bossNow) : R.track || trackId);
    if (mode === 'daily') variant = daily.variant; else if (!VARIANT_MODES.includes(mode)) variant = '';
    const X = mode === 'daily' ? daily.mod.opts : {}; // reglas especiales del reto diario
    builtDef = todDef(currentTrack, mode === 'daily' ? daily.tod : VARIANT_MODES.includes(mode) ? tod : '');
    syncGfx();
    const q = qualityK();
    const gfx = { quality: q, bloom: usePost(), shadows: G.shadows, outline: G.outline };
    renderer.shadowMap.enabled = gfx.shadows; renderer.shadowMap.type = q > 1.1 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; // en Ultra, sombras suaves
    track = buildTrack(builtDef, { ...gfx, variant: variant || null });
    raceScene = new THREE.Scene();
    raceScene.fog = track.fog; raceScene.background = new THREE.Color(builtDef.theme.fog);
    raceScene.add(track.group);
    fxAdd = new Particles(q < 0.7 ? 400 : q > 1.1 ? 1400 : 900, true); fxNorm = new Particles(q < 0.7 ? 150 : q > 1.1 ? 450 : 300, false);
    raceScene.add(fxAdd.points, fxNorm.points);
    ambient = new Ambient(currentTrack.theme.fx, currentTrack.theme.fxColor, q < 0.7 ? 60 : q > 1.1 ? 220 : 140);
    raceScene.add(ambient.points);
    race = new Race({
      scene: raceScene, track, fx: { add: fxAdd, norm: fxNorm }, mode, difficulty: R.difficulty || (mode === 'daily' && daily.mod.hard ? DIFFICULTIES[2] : diff()), laps: X.laps || R.laps, ...gfx,
      night: !!builtDef.theme.night, forceItem: X.forceItem, gravityK: X.gravityK, boxRespawn: X.boxRespawn, rivalSize: X.rivalSize,
      paceTime: mode === 'time' ? (medalTimes(currentTrack.id) || [0])[0] : 0,
      playerChar: save.char, playerKart: save.kart, playerColor: save.color,
      playerHat: save.hat, playerWheel: save.wheel, playerTrail: byId(TRAILS, save.trail), playerHorn: save.horn, playerTune: R.tune || upgradeTune(save),
      rivals: mode === 'boss' ? [{ char: bossNow.id, charDef: bossNow.char, kart: bossNow.kart, color: bossNow.color, size: bossNow.size, boss: bossNow }]
        : cupState ? cupState.rivals : makeLineup(R.rivals || RACERS - 1), aiItems: R.aiItems, noHazards: R.noHazards,
      rivalDef: hasRival() ? rivalDef() : null, assistSteer: !!save.settings.assistSteer, autoDrift: !!save.settings.autoDrift,
      ghostData: mode === 'time' ? (share.ghost(currentTrack.id, variant) || save.ghosts[recKey()]) : null, onEvent: onRaceEvent,
    });
    paused = false; resultsShown = false; finishTimer = 0; lastHud = {}; frameAvg = 1 / 60; lowT = 0; stepGap = 2;
    hint('');
    mctx.st = race.player.st; mctx.total = race.racers.length; mctx.par = parTime(mode, track.length, race.laps);
    missions = pickMissions(mode, mctx.par); missionT = 0; syncMissions();
    renderMissions($('hud-missions-list'), false);
    $('hud-missions').classList.toggle('hidden', !missions.length);
    tuto = mode === 'tutorial' ? new Tutorial(race, { tilt: save.settings.controls === 'tilt' }) : null;
    $('hud').classList.toggle('tuto', !!tuto); renderTuto();
    buildMinimap();
    $('hud-total').textContent = mode === 'time' ? '' : '/' + race.racers.length;
    $('hud-laps').textContent = race.laps;
    $('hud-pos').parentElement.style.visibility = mode === 'time' ? 'hidden' : 'visible';
    $('hud').classList.toggle('tilt', save.settings.controls === 'tilt');
    $('hud-wrong').classList.add('hidden');
    $('hud-lapbox').classList.toggle('hidden', !!race.rules); $('hud-mode').classList.toggle('hidden', !race.rules);
    show('hud');
    startMusic(currentTrack.music);
    const amb = currentTrack.extras.ambience; // '' = sin sonido de ambiente (bajo el mar)
    if (amb !== '') A.startAmbience?.(amb || currentTrack.music.style);
    A.playJingle?.('start');
    startEngine();
    hudMsg(mode === 'boss' ? '👑 ' + bossNow.name : t(currentTrack.name), true);
    if (mode === 'elim') hint('Cada pocos segundos, el último queda eliminado. ¡No te quedes atrás!');
    else if (mode === 'battle') hint('Golpea a tus rivales con objetos para reventar sus globos. ¡Protege los tuyos!');
    else if (mode === 'fever') hint('Recoge más plátanos que nadie antes de que acabe el tiempo. ¡Cada golpe te quita plátanos!');
    else if (mode === 'stunt') hint('Suma puntos con trucos, derrapes, aros y atajos antes de que acabe el tiempo');
    else if (mode === 'boss') hint(fill(t('👑 {name}: {tip}'), { name: bossNow.name, tip: t(bossNow.tip) }));
    else if (mode === 'daily') hint(fill(t('📅 Reto diario · {name}: {desc}'), { name: t(daily.mod.name), desc: t(daily.mod.desc) }));
    else if (race.rival && !tuto) hint(fill(t('⚔️ Tu rival es {name}: acaba por delante para ganar un premio extra'), race.rival.char));
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

// ---------- Tutorial ----------
function startTutorial() { mode = 'tutorial'; cupState = null; startRace(TUTORIAL.track); }
// Pinta el aviso del tutorial y resalta los botones que toca usar
function renderTuto() {
  const el = $('hud-tuto'), text = tuto ? tuto.text : '';
  tutoRev = tuto ? tuto.rev : -1;
  el.classList.toggle('show', !!text);
  if (text) { $('hud-tuto-text').textContent = text; el.classList.toggle('good', tuto.good); }
  for (const id of TUTO_BTNS) $(id).classList.toggle('tuto-hl', !!tuto && tuto.hl.includes(id));
}
function showTutorialResults() {
  const first = save.tutorial !== 'done', reward = first ? TUTORIAL.reward : 0;
  $('r-title').textContent = '¡Tutorial completado!';
  $('r-sub').textContent = 'Esto es lo que has practicado. Puedes repetirlo cuando quieras desde el menú.';
  $('r-list').innerHTML = '';
  $('r-missions').innerHTML = tuto.summary().map(l => `<li class="${l.done ? 'ok' : 'ko'}"><i>${l.done ? '✓' : '✗'}</i><span>${l.text}</span><b></b><em></em></li>`).join('');
  $('r-missions').classList.remove('hidden');
  $('r-reward').textContent = first ? fill('+{n} 🍌 por terminar el tutorial', { n: reward }) : 'Ya tenías el premio del tutorial';
  $('r-retry').classList.remove('hidden'); $('r-next').textContent = 'Menú ▶'; $('r-replay').classList.add('hidden');
  save.tutorial = 'done'; if (reward) earn(reward);
  persist(); renderTuto();
  show('results');
}

function hint(text) {
  if (tuto && text) return; // en el tutorial solo hablan sus propios avisos
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
  else if (ev === 'mode') {
    if (data) hudMsg({ glide: '¡Ala delta! 🪂', boat: '¡Al agua! 🚤', sub: '¡Inmersión! 🤿' }[data], true);
    gliderButtons(data === 'glide');
    if (data === 'glide' && glideHints++ < 3) hint('Ala delta: DERRAPE sube y FRENO baja. ¡Busca los aros!');
  }
  else if (ev === 'shortcut') hudMsg('¡Atajo! 🚀', true);
  else if (ev === 'draft') hudMsg('¡Rebufo! 💨', true);
  else if (ev === 'score') hint('+' + data + ' 🌀');
  else if (ev === 'bossWarn') { hudMsg('⚡ ¡Cuidado!', true); sfx.count(); }
  else if (ev === 'drafting') { if (draftHints++ < 2) hint('Rebufo: quédate pegado detrás de un rival para cargar un impulso'); }
  else if (ev === 'current') { if (curHints++ < 2) hint(data === 1 ? 'Corriente a favor: ¡síguela para ir más rápido!' : 'Corriente lateral: ¡te empuja hacia un lado!'); }
  else if (ev === 'out') { if (!data.isPlayer) hint(fill(t('💥 {name} queda fuera · quedan {left}'), data)); sfx.thud?.(0, 0.8); $('hud-total').textContent = '/' + (data.left + (race.player.out ? 1 : 0)); }
  else if (ev === 'rival') { if (race.rival) hint(fill(t(data ? '⚔️ ¡{name} te ha adelantado!' : '⚔️ ¡Has adelantado a {name}!'), race.rival.char)); }
  else if (ev === 'lap') { hudMsg('Vuelta ' + data, true); sfx.lap(); sfx.crowd?.(0, 0.7); }
  else if (ev === 'finalLap') { hudMsg('¡Última vuelta!', true); sfx.finalLap(); A.setMusicIntensity?.(1); sfx.crowd?.(0, 0.9); }
  else if (ev === 'lightning') { flash(true); setTimeout(() => sfx.thunder?.(), 380); }
  else if (ev === 'flash') { flash(); setTimeout(() => sfx.thunder?.(0, 0.7), 150); }
  else if (ev === 'finish') {
    const good = mode === 'time' || data <= 3;
    hudMsg(race.rules ? (data === 1 ? '¡Victoria! 🏆' : race.player.out ? '¡Eliminado!' : '¡Fin!') : mode === 'time' ? '¡META!' : data === 1 ? '¡1º! 🏆' : '¡META!');
    if (A.playJingle) A.playJingle(good ? 'win' : 'lose'); else if (good) sfx.finish(); else sfx.lose();
    A.haptic?.('finish'); sfx.crowd?.();
    flash(); finishTimer = 3.6;
  }
}
// En el ala delta los botones de derrape y freno pasan a subir y bajar
let gliderOn = false;
function gliderButtons(on) {
  if (on === gliderOn) return;
  gliderOn = on;
  $('btn-drift').textContent = on ? '▲ SUBIR' : 'DERRAPE'; $('btn-brake').textContent = on ? '▼ BAJAR' : 'FRENO';
}
function flash(soft) { const f = $('flash'); f.classList.remove('go', 'soft'); void f.offsetWidth; f.classList.add(soft ? 'soft' : 'go'); }

// Calidad automática: se llama en cada fotograma de carrera con su duración real (s)
function autoQualityTick(rdt) {
  if (save.settings.autoQuality === false || !(rdt > 0) || rdt > 0.5) return; // los parones (pestaña oculta, carga) no cuentan
  frameAvg += (rdt - frameAvg) * Math.min(1, rdt * 1.2);
  stepGap -= rdt;
  lowT = frameAvg > 1 / AUTO_FPS ? lowT + rdt : 0;
  if (lowT > AUTO_HOLD && stepGap <= 0) { lowT = 0; stepGap = autoStepDown() ? AUTO_GAP : 30; }
}
// Quita lo siguiente de la lista que de verdad cambie algo. Devuelve false si ya no queda nada.
function autoStepDown() {
  const s = save.settings, b = { ...G }, n0 = autoN();
  let n = n0;
  while (n < AUTO_STEPS) {
    s.autoQ = ++n; syncGfx();
    if (G.shadows === b.shadows && G.outline === b.outline && G.bloom === b.bloom && G.pr === b.pr) continue; // paso sin efecto con estos ajustes
    if (b.shadows && !G.shadows) { // sin sombras reales: vuelven las sombras redondas bajo los coches
      renderer.shadowMap.enabled = false;
      if (track && track.dir) track.dir.castShadow = false;
      if (race) { race.shadows = false; for (const r of race.racers) r.shadow.visible = true; }
    }
    resize(); persist();
    toast('Gráficos ajustados para ir más fluido');
    return true;
  }
  s.autoQ = n0; syncGfx(); // nada que quitar: se queda como estaba
  return false;
}

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
    if (r.out && !r.isPlayer) continue;
    const [x, y] = miniBg.map(r.x, r.z);
    c.beginPath(); c.arc(x, y, r.isPlayer ? 6 : r.isRival ? 5 : 4, 0, 7);
    c.fillStyle = r.isPlayer ? '#ffd21f' : r.isRival ? '#ff2f4a' : hex(r.char.fur === 0xf2f2f7 ? 0xdddddd : r.char.accColor === 0x111111 ? 0xff7a1a : r.char.accColor);
    c.fill(); c.lineWidth = 2; c.strokeStyle = r.isRival ? '#fff' : '#1a0b3a'; c.stroke();
  }
}

// ---------- HUD ----------
const ITEM_KEYS = Object.keys(ITEMS);
function setText(id, v) { if (lastHud[id] !== v) { lastHud[id] = v; $(id).textContent = v; } }
function updateHud(dt) {
  const p = race.player;
  if (lastHud.pos !== p.pos) {
    if (lastHud.pos !== undefined) { const e = $('hud-pos').parentElement; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    lastHud.pos = p.pos; $('hud-pos').textContent = p.pos; $('hud-pos-suf').textContent = lang() === 'en' ? ['st', 'nd', 'rd'][p.pos - 1] || 'th' : 'º';
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
  // modos especiales: cuenta atrás de la eliminación o globos y tiempo de la batalla
  const ru = race.rules;
  if (ru) {
    const s = Math.max(0, Math.ceil(ru.timer)), val = ru.kind === 'battle' ? p.balloons || 0 : ru.kind === 'fever' ? p.bananas : ru.kind === 'stunt' ? p.score : 0, key = s * 100000 + val * 2 + (p.out ? 1 : 0);
    if (lastHud.rk !== key) {
      lastHud.rk = key;
      const clock = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      $('hud-mode').textContent = ru.kind === 'elim' ? fill(t('⏱ {s} s · quedan {n}'), { s, n: ru.active().length })
        : ru.kind === 'battle' ? ('🎈'.repeat(Math.max(0, p.balloons)) || '💥') + ' · ' + clock : (ru.kind === 'fever' ? '🍌 ' : '🌀 ') + val + ' · ' + clock;
    }
    const danger = ru.kind === 'elim' ? ru.danger && race.state === 'racing' : ru.kind === 'battle' && p.balloons === 1;
    if (lastHud.dg !== danger) { lastHud.dg = danger; $('hud-mode').classList.toggle('danger', danger); }
  }
  const wrong = p.wrongT > 1.2 && race.state === 'racing' && mode !== 'battle';
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
  if (tuto) { showTutorialResults(); return; }
  const res = race.results(), me = res.find(r => r.isPlayer), d = diff();
  const list = $('r-list'); list.innerHTML = '';
  let reward = 0, sub = currentTrack.name, record = false;
  const extras = []; // desglose del premio: récord, misiones...
  $('r-retry').classList.toggle('hidden', mode === 'cup');
  if (mode === 'time') {
    const tm = race.time, best = save.best[recKey()];
    record = !best || tm < best;
    $('r-title').textContent = record ? '¡Nuevo récord!' : 'Contrarreloj';
    list.innerHTML = `<li class="me"><b>⏱</b><span>Tu tiempo</span><span></span><span>${fmt(tm)}</span></li>` +
      `<li><b>★</b><span>Mejor tiempo</span><span></span><span>${fmt(record ? tm : best)}</span></li>`;
    if (record) { save.best[recKey()] = Math.round(tm * 100) / 100; save.ghosts[recKey()] = race.rec; A.playJingle?.('record'); }
    reward = 20 + me.bananas + (record ? 50 : 0);
    if (record) extras.push('récord +50');
    reward += share.timeResult({ time: tm, record, list, extras, track: currentTrack, variant, rec: race.rec, char: save.char, kart: save.kart }) || 0;
    // medallas: tiempos de bronce, plata y oro de cada circuito (cada una se premia la primera vez)
    const mt = medalTimes(currentTrack.id);
    if (mt) {
      const got = tm <= mt[0] ? 3 : tm <= mt[1] ? 2 : tm <= mt[2] ? 1 : 0, had = save.medals[recKey()] | 0;
      list.insertAdjacentHTML('beforeend', `<li><b>${['·', '🥉', '🥈', '🥇'][got]}</b><span>${t(got ? MEDAL_NAMES[got] : 'Sin medalla')}</span><span></span><span>${got < 3 ? t(MEDAL_NAMES[got + 1]) + ': ' + fmt(mt[2 - got]) : ''}</span></li>`);
      if (got > had) {
        let b = 0; for (let k = had + 1; k <= got; k++) b += MEDAL_REWARD[k];
        save.medals[recKey()] = got; reward += b; extras.push(fill(t('medalla +{b}'), { b })); if (got === 3) addStat(save, 'goldMedals');
      }
    }
    $('r-next').textContent = 'Menú ▶';
  } else {
    $('r-title').textContent = me.pos === 1 ? '¡Victoria!' : me.pos <= 3 ? '¡Podio!' : 'Resultados';
    if (mode === 'cup') {
      res.forEach(r => { cupState.pts[r.char.id] = (cupState.pts[r.char.id] || 0) + CUP_POINTS[r.pos - 1]; cupState.ride[r.char.id] = { kart: r.kart, color: r.color, hat: r.hat, wheels: r.wheels }; });
      sub = `${cupState.cup.name} · Carrera ${cupState.i + 1}/3 · ${currentTrack.name}`;
    }
    const ru = race.rules;
    for (const r of res) {
      const li = document.createElement('li'); li.className = (r.isPlayer ? 'me' : '') + (r.isRival ? ' rival' : '') + (r.out ? ' out' : '');
      const extra = mode === 'cup' ? `+${CUP_POINTS[r.pos - 1]} (${cupState.pts[r.char.id]} pts)` : '';
      // en los modos especiales no hay tiempos: globos y golpes, o quién ha sobrevivido
      const last = !ru ? (r.time ? fmt(r.time) : '—') : ru.kind === 'fever' ? '🍌 ' + r.bananas : ru.kind === 'stunt' ? r.score + ' pts' : ru.kind === 'battle' ? ('🎈'.repeat(r.balloons) || '—') + (r.pops ? ' 💥' + r.pops : '') : t(r.out ? 'Eliminado' : 'Sigue en pie');
      li.innerHTML = `<b>${r.pos}º</b><span>${r.name}${r.isPlayer ? t(' (tú)') : ''}</span><span>${extra}</span><span>${last}</span>`;
      list.appendChild(li);
    }
    const MODE_SUB = { elim: 'Eliminación', battle: 'Batalla de globos', fever: 'Fiebre del plátano', stunt: 'Acrobacias', daily: 'Reto diario' };
    if (MODE_SUB[mode]) sub = t(MODE_SUB[mode]) + ' · ' + t(sub); else if (mode === 'surprise') sub = t(sub) + ' #' + surprise.surprise; else if (mode === 'boss') sub = '👑 ' + bossNow.name + ' · ' + t(sub);
    reward = Math.round(RACE_REWARD[me.pos - 1] * d.reward) + me.bananas;
    // rival personal: si acabas por delante sube de nivel (y hay premio); si no, afloja
    const rv = res.find(r => r.isRival);
    if (rv) {
      const won = me.pos < rv.pos, s = save.rival;
      s.level = Math.max(RIVAL_MIN, Math.min(RIVAL_MAX, (s.level | 0) + (won ? 1 : -1)));
      if (won) { s.wins = (s.wins | 0) + 1; addStat(save, 'rivalWins'); const b = Math.round(RIVAL_BONUS * d.reward); reward += b; extras.push(fill(t('rival +{b}'), { b })); } else s.losses = (s.losses | 0) + 1;
    }
    $('r-next').textContent = mode === 'cup' ? (cupState.i < 2 ? 'Siguiente carrera ▶' : 'Ver clasificación ▶') : 'Menú ▶';
  }
  if (mode === 'boss') { // duelo contra un jefe: el premio grande se da la primera vez que se le gana
    const won = me.pos === 1;
    $('r-title').textContent = won ? '¡Jefe derrotado! 👑' : 'El jefe te ha ganado';
    if (won && !save.bosses[bossNow.id]) { save.bosses[bossNow.id] = 1; const b = Math.round(BOSS_REWARD * d.reward); reward += b; extras.push(fill(t('jefe +{b}'), { b })); addStat(save, 'bosses'); }
  } else if (mode === 'daily') { // reto diario: premio una vez al día, mayor con la racha de días seguidos
    const s = save.daily, ok = me.pos <= 3;
    $('r-title').textContent = ok ? '¡Reto superado! 📅' : 'Reto no superado';
    if (ok && s.done !== daily.key) {
      s.streak = isYesterday(s.done) ? Math.min(DAILY_STREAK_MAX, (s.streak | 0) + 1) : 1; s.done = daily.key;
      const b = DAILY_REWARD + (s.streak - 1) * DAILY_STREAK_BONUS; reward += b; extras.push(fill(t('reto diario +{b}'), { b })); addStat(save, 'dailies');
    }
  }
  // misiones (se pagan una sola vez, aquí), estadísticas de por vida y logros
  mctx.finished = true; syncMissions(); renderMissions($('r-missions'), false);
  const mr = missionsReward(missions);
  if (mr) { reward += mr; extras.push(fill('misiones +{mr}', { mr })); }
  recordRace(save, { mode, pos: me.pos, st: me.st, time: race.time, missions: missions.filter(x => x.done).length, record });
  $('r-sub').textContent = sub;
  $('r-replay').classList.toggle('hidden', race.replay.frames.length < 30);
  $('r-reward').textContent = `+${reward} 🍌` + (extras.length ? ` (${extras.join(' · ')})` : '');
  earn(reward); persist(); awardAchievements();
  if (rules().podium) startPodium(res.slice(0, 3).map(r => ({ char: r.char, kart: r.kart, color: r.color, hat: r.hat, wheels: r.wheels, isPlayer: r.isPlayer })), me.pos, false);
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
    const key = cup.id + '_' + d.id, ci = CUPS.indexOf(cup), next = CUPS[ci + 1], wasLocked = next && !cupUnlocked(ci + 1);
    save.trophies[key] = Math.min(save.trophies[key] || 9, rank);
    bonus = Math.round([300, 200, 120][rank - 1] * d.reward);
    earn(bonus); if (rank === 1) addStat(save, 'golds');
    if (wasLocked) setTimeout(() => toast(fill(t('¡{cup} desbloqueada! {icon}'), { cup: t(next.name), icon: next.icon })), 600);
    sfx.buy();
  }
  persist(); awardAchievements();
  $('r-title').textContent = rank === 1 ? '🏆 ¡Campeón!' : rank === 2 ? '🥈 ¡Segundo!' : rank === 3 ? '🥉 ¡Tercero!' : 'Fin de la copa';
  $('r-sub').textContent = `${cup.name} · ${d.name}`;
  $('r-reward').textContent = bonus ? `Premio: +${bonus} 🍌` : 'Queda entre los 3 primeros para ganar trofeo';
  $('r-next').textContent = 'Menú ▶';
  $('r-retry').classList.add('hidden'); $('r-replay').classList.add('hidden');
  cupState.done = true; missions = []; renderMissions($('r-missions'), false);
  startPodium(rows.slice(0, 3).map(r => ({ char: r.ch, ...(cupState.ride[r.id] || {}), isPlayer: r.id === save.char })), rank, rank <= 3);
}

function toMenu() {
  disposeRace(); cupState = null; share.reset(); if (mode === 'tutorial') mode = 'race';
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

function segSet(id, cur, on) {
  $(id).querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === cur); b.onclick = () => { sfx.ui(); on(b.dataset.v); }; });
}
function buildTracks() {
  const time = mode === 'time';
  if (!time) mode = raceKind;
  $('tracks-title').textContent = time ? 'Contrarreloj' : mode === 'elim' ? 'Eliminación' : mode === 'stunt' ? 'Acrobacias' : 'Carrera rápida';
  $('diff-seg').style.visibility = time ? 'hidden' : 'visible';
  $('kind-seg').classList.toggle('hidden', time);
  segSet('kind-seg', raceKind, v => { raceKind = v; buildTracks(); });
  segSet('variant-seg', variant, v => { variant = v; buildTracks(); });
  segSet('tod-seg', tod, v => { tod = v; buildTracks(); });
  buildDiffSeg($('diff-seg'));
  const box = $('track-cards'); box.innerHTML = ''; box.classList.toggle('mirror', variant === 'mirror');
  for (const t of TRACKS) { // (aquí t es el circuito; los textos los traduce el observador de i18n)
    const ok = trackUnlocked(t), c = document.createElement('button');
    c.className = 'card' + (ok ? '' : ' locked'); c.style.background = cardBg(t);
    const mk = t.id + (variant ? ':' + variant : ''), best = save.best[mk];
    c.innerHTML = `${miniSvg(t)}<h3>${ok ? t.name : '🔒 ' + t.name}</h3><p>${ok ? (time ? (best ? ['', '🥉 ', '🥈 ', '🥇 '][save.medals[mk] | 0] + '★ ' + fmt(best) : 'Sin tiempo') : CUPS[t.cup].name) : lockText(t.cup)}</p>`;
    c.onclick = () => { if (!ok) { sfx.deny(); toast(lockText(t.cup)); return; } sfx.ui(); startRace(t.id); };
    box.appendChild(c);
  }
}

function buildCups() {
  buildDiffSeg($('diff-seg2'));
  const box = $('cup-cards'); box.innerHTML = '';
  CUPS.forEach((cup, i) => {
    const ok = cupUnlocked(i), c = document.createElement('button');
    const t0 = trackById(cup.tracks[0]), tr = save.trophies[cup.id + '_' + diff().id];
    c.className = 'card' + (ok ? '' : ' locked'); c.style.background = cardBg(t0); c.style.minHeight = '150px';
    c.innerHTML = `<span class="emoji">${cup.icon}</span><h3>${ok ? cup.name : '🔒 ' + cup.name}</h3>` +
      `<p>${cup.tracks.map(id => trackById(id).name).join(' · ')}</p><p>${tr ? ['🏆 Oro', '🥈 Plata', '🥉 Bronce'][tr - 1] + ' en ' + diff().name : ok ? '3 carreras · sin trofeo aún' : lockText(i)}</p>`;
    c.onclick = () => {
      if (!ok) { sfx.deny(); toast(lockText(i)); return; }
      sfx.ui(); mode = 'cup'; cupState = { cup, i: 0, pts: {}, ride: {}, rivals: makeLineup(RACERS - 1) }; startRace(cup.tracks[0]);
    };
    box.appendChild(c);
  });
}

// ---------- Más modos: batalla, fiebre del plátano, circuito sorpresa, reto diario y jefes ----------
function buildModes() {
  const arenas = EXTRA_TRACKS.filter(a => a.arena || a.id === 'arena'), seg = $('arena-seg');
  if (!arenas.some(a => a.id === arenaId)) arenaId = arenas[0].id;
  seg.innerHTML = ''; seg.classList.toggle('hidden', arenas.length < 2);
  for (const a of arenas) {
    const b = document.createElement('button'); b.textContent = t(a.name); if (a.id === arenaId) b.className = 'on';
    b.onclick = () => { arenaId = a.id; sfx.ui(); buildModes(); }; seg.appendChild(b);
  }
  daily = dailyChallenge();
  const arena = trackById(arenaId), dTrack = trackById(daily.track), dDone = save.daily.done === daily.key;
  const cards = [
    { icon: '🎈', name: 'Batalla de globos', desc: 'Cada golpe revienta un globo. Gana quien conserve más.', bg: arena, go: () => { mode = 'battle'; startRace(arenaId); } },
    { icon: '🍌', name: 'Fiebre del plátano', desc: 'Gana quien tenga más plátanos cuando acabe el tiempo.', bg: arena, go: () => { mode = 'fever'; startRace(arenaId); } },
    { icon: '🎲', name: 'Circuito sorpresa', desc: 'Un circuito nuevo, generado al azar, cada vez.', bg: TRACKS[(daily.key + 3) % TRACKS.length],
      go: () => { surprise = surpriseTrack(1 + Math.floor(Math.random() * 9998)); mode = 'surprise'; startRace('sorpresa'); } },
    { icon: daily.mod.icon, name: 'Reto diario', desc: fill(t('{mod} en {track}'), { mod: t(daily.mod.name), track: t(dTrack.name) }),
      note: dDone ? fill(t('✔ Superado hoy · racha de {n}'), { n: save.daily.streak | 0 }) : fill(t('Queda entre los 3 primeros · +{n} 🍌'), { n: DAILY_REWARD }), bg: dTrack, go: () => { mode = 'daily'; startRace(daily.track); } },
  ];
  for (const b of BOSSES) {
    if (!CUPS[b.cup]) continue;
    const ok = Object.keys(save.trophies).some(k => k.startsWith(CUPS[b.cup].id + '_'));
    cards.push({ icon: b.icon, name: fill(t('Jefe: {name}'), b), desc: ok ? b.tip : fill(t('Gana un trofeo en la {cup}'), { cup: t(CUPS[b.cup].name) }), note: save.bosses[b.id] ? '👑 Derrotado' : '',
      bg: trackById(bossTrack(b)), locked: !ok, go: () => { bossNow = b; mode = 'boss'; startRace(bossTrack(b)); } });
  }
  const box = $('mode-cards'); box.innerHTML = '';
  for (const c of cards) {
    const el = document.createElement('button'); el.className = 'card' + (c.locked ? ' locked' : ''); el.style.background = cardBg(c.bg);
    el.innerHTML = `<span class="emoji">${c.icon}</span><h3>${c.locked ? '🔒 ' : ''}${c.name}</h3><p>${c.desc}</p>${c.note ? `<p>${c.note}</p>` : ''}`;
    el.onclick = () => { if (c.locked) { sfx.deny(); toast(c.desc); return; } sfx.ui(); cupState = null; c.go(); };
    box.appendChild(el);
  }
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
    box.innerHTML = `<p class="meta-note">${fill('En cada carrera recibes {n} misiones al azar ({t} en contrarreloj). Cúmplelas para ganar plátanos extra al terminar.', { n: MISSION_COUNT.default, t: MISSION_COUNT.time })}</p>` +
      MISSIONS.map(x => `<div class="ach"><span class="ach-ico">📋</span><div class="ach-txt"><h3>${fill(x.text, { n: x.n, par: 'un tiempo objetivo' })}</h3></div><div class="ach-side"><small>🍌 ${x.reward}</small></div></div>`).join('');
  } else {
    box.innerHTML = LIFETIME.map(d => `<div class="lstat"><span>${d.name}</span><b>${statText(save, d)}</b></div>`).join('');
  }
}

// ---------- Ajustes ----------
// Botones táctiles: tamaño, opacidad y modo zurdo (variables CSS y clase del HUD)
const BTN_SIZES = { s: 0.82, m: 1, l: 1.2 };
function applyControls() {
  const s = save.settings, hud = $('hud');
  hud.style.setProperty('--ctl-k', BTN_SIZES[s.btnSize] || 1);
  hud.style.setProperty('--ctl-a', Math.max(0.3, Math.min(1, +s.btnAlpha || 1)));
  hud.classList.toggle('lefty', !!s.lefty);
}
const applyFps = () => $('fps').classList.toggle('hidden', !save.settings.fps);
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
  $('set-lang').querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === lang());
    b.onclick = () => { setLang(b.dataset.v); persist(); sfx.ui(); buildSettings(); };
  });
  seg('set-controls', 'controls');
  seg('set-btnsize', 'btnSize', applyControls);
  // el nivel de gráficos también ajusta resplandor y sombras (luego se pueden cambiar por separado)
  // (cambiar los gráficos a mano anula la reducción automática)
  seg('set-quality', 'quality', () => { s.bloom = s.quality !== 'baja'; s.shadows = s.quality === 'alta' || s.quality === 'ultra'; s.outline = s.quality !== 'baja'; s.autoQ = 0; persist(); resize(); buildSettings(); });
  const flag = (id, key, after) => {
    $(id).querySelectorAll('button').forEach(b => {
      const v = b.dataset.v === '1';
      b.classList.toggle('on', !!s[key] === v);
      b.onclick = () => { s[key] = v; persist(); sfx.ui(); buildSettings(); if (after) after(); };
    });
  };
  if (s.outline == null) s.outline = true;
  const manual = () => { s.autoQ = 0; persist(); resize(); buildSettings(); };
  flag('set-outline', 'outline', manual); flag('set-bloom', 'bloom', manual); flag('set-shadows', 'shadows', manual);
  if (s.autoQuality == null) s.autoQuality = true;
  flag('set-autoq', 'autoQuality', manual);
  $('set-autoq-info').textContent = autoN() ? fill('Reducidos ahora: paso {n} de {max}', { n: autoN(), max: AUTO_STEPS }) : '';
  flag('set-haptics', 'haptics', () => { A.setHaptics?.(!!s.haptics); A.haptic?.('hit'); });
  flag('set-lefty', 'lefty', applyControls);
  flag('set-battery', 'battery'); flag('set-fps', 'fps', applyFps); flag('set-assist', 'assistSteer'); flag('set-autodrift', 'autoDrift');
  $('set-btnalpha').value = s.btnAlpha;
  $('set-bloom').classList.toggle('off', !post.supported);
  $('set-music').value = s.music; $('set-sfx').value = s.sfx;
}

// ---------- Eventos de interfaz ----------
function wireUi() {
  // con el juego en pausa no se reactiva el sonido al tocar la pantalla
  document.addEventListener('pointerdown', () => { if (!paused) initAudio(); }, { passive: true });
  // la primera vez se ofrece el tutorial
  $('btn-start').onclick = () => { initAudio(); sfx.ui(); startMusic(MENU_MUSIC); goLandscape(); if (!save.tutorial) { save.tutorial = 'seen'; persist(); show('tutoask'); } else { show('menu'); share.afterStart(); } };
  $('tuto-reward').textContent = TUTORIAL.reward;
  $('tuto-yes').onclick = () => { sfx.ui(); startTutorial(); };
  $('tuto-no').onclick = () => { sfx.back(); show('menu'); };
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    sfx.ui(); const g = b.dataset.go;
    if (g === 'race' || g === 'time') { mode = g === 'time' ? 'time' : raceKind; buildTracks(); show('tracks'); }
    else if (g === 'modes') { buildModes(); show('modes'); }
    else if (g === 'cups') { buildCups(); show('cups'); }
    else if (g === 'garage') { gSel = null; show('garage'); buildGarage(); }
    else if (g === 'settings') { buildSettings(); show('settings'); }
    else if (g === 'meta') { mTab = 'ach'; buildMeta(); show('meta'); }
    else if (g === 'tutorial') startTutorial();
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
  $('set-btnalpha').oninput = e => { save.settings.btnAlpha = +e.target.value; applyControls(); };
  $('set-btnalpha').onchange = () => persist();
  $('set-privacy').onclick = () => { sfx.ui(); const f = $('privacy-frame'); if (!f.getAttribute('src')) f.src = 'privacy.html'; show('privacy'); };
  $('set-reset').onclick = () => {
    if (confirm(t('¿Borrar todo el progreso (plátanos, trofeos, récords y compras)?'))) { resetSave(); save.settings.diff = 1; refreshShow(); buildSettings(); applyControls(); A.setHaptics?.(true); resize(); toast('Partida borrada'); show('settings'); }
  };
  $('btn-pause').onclick = () => setPaused(true);
  $('p-resume').onclick = () => { goLandscape(); setPaused(false); };
  $('rotate').onclick = goLandscape;
  $('p-restart').onclick = () => { sfx.ui(); suspendAudio(false); if (mode === 'cup') { cupState.i = 0; cupState.pts = {}; cupState.ride = {}; startRace(cupState.cup.tracks[0]); } else startRace(currentTrack.id); };
  $('p-quit').onclick = () => { sfx.back(); suspendAudio(false); toMenu(); };
  $('r-retry').onclick = () => { sfx.ui(); startRace(currentTrack.id); };
  $('r-replay').onclick = startReplay;
  $('replay-skip').onclick = endReplay;
  $('p-photo').onclick = () => setPhoto(true);
  $('photo-back').onclick = () => setPhoto(false);
  $('photo-save').onclick = savePhoto;
  $('photo-zoom').oninput = e => { ph.d = +e.target.value; };
  // modo foto: arrastrar para girar la cámara, rueda del ratón para acercar
  const sp = $('s-photo'); let drag = null;
  sp.addEventListener('pointerdown', e => { if (e.target.closest('.photo-bar')) return; drag = { x: e.clientX, y: e.clientY }; try { sp.setPointerCapture(e.pointerId); } catch (err) { /* no soportado */ } sp.querySelector('.photo-tip').style.opacity = 0; });
  sp.addEventListener('pointermove', e => {
    if (!drag) return;
    ph.a -= (e.clientX - drag.x) * 0.008; ph.e = Math.max(-0.12, Math.min(1.35, ph.e + (e.clientY - drag.y) * 0.006));
    drag.x = e.clientX; drag.y = e.clientY;
  });
  for (const ev of ['pointerup', 'pointercancel']) sp.addEventListener(ev, () => { drag = null; });
  sp.addEventListener('wheel', e => { ph.d = Math.max(4, Math.min(30, ph.d + Math.sign(e.deltaY))); $('photo-zoom').value = ph.d; }, { passive: true });
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

// ---------- Repetición ----------
function startReplay() {
  if (!race || replaying || race.replay.frames.length < 30) return;
  sfx.ui(); replaying = true; race.replay.start(); startEngine(); share.replayStart();
  $('speedfx').classList.remove('on');
  show('replay');
}
function endReplay() {
  if (!replaying) return;
  replaying = false; share.replayEnd();
  if (race.replay.playing) race.replay.stop();
  stopEngine(); race.fov = camera.fov;
  show('results');
}

// ---------- Modo foto (desde la pausa) ----------
function setPhoto(on) {
  if (!race || on === photo) return;
  photo = on;
  if (on) {
    ph.keep = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
    ph.a = race.player.h + Math.PI * 0.82; ph.e = 0.22; ph.d = +$('photo-zoom').value;
    $('s-photo').classList.remove('shot'); $('s-photo').querySelector('.photo-tip').style.opacity = 1;
    show('photo');
  } else {
    const k = ph.keep; camera.position.copy(k.pos); camera.quaternion.copy(k.quat); camera.fov = k.fov; camera.updateProjectionMatrix();
    race.camPos.copy(camera.position);
    show('pause', 'hud');
  }
}
function photoCam() {
  const p = race.player, cy = p.y + p.hopY + p.bob + 1.3, ce = Math.cos(ph.e);
  camera.position.set(p.x + Math.sin(ph.a) * ce * ph.d, Math.max(p.y + 0.5, cy + Math.sin(ph.e) * ph.d), p.z + Math.cos(ph.a) * ce * ph.d);
  if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
  camera.lookAt(p.x, cy, p.z);
  race.camPos.copy(camera.position);
}
// Guarda la imagen del juego como PNG. Donde el navegador no deja descargar (la app de Android),
// se esconden los botones unos segundos para hacer una captura de pantalla.
function savePhoto() {
  const hideUi = () => { const el = $('s-photo'); el.classList.add('shot'); setTimeout(() => el.classList.remove('shot'), 4500); };
  if (window.Capacitor) { toast('Haz ahora una captura de pantalla 📸'); setTimeout(hideUi, 900); return; }
  photoCam(); render(raceScene, camera);
  canvas.toBlob(blob => {
    if (!blob) { toast('Haz ahora una captura de pantalla 📸'); setTimeout(hideUi, 900); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gorilla-racing-' + Date.now() + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast('📸 Foto guardada en Descargas');
  }, 'image/png');
  flash(true);
}

// El juego es solo horizontal. En móviles se pasa a pantalla completa y se bloquea el giro donde el navegador lo permite
// (la app instalada y el APK ya vienen bloqueados); donde no, en vertical se muestra el aviso de girar el móvil.
const isTouch = () => matchMedia('(pointer: coarse)').matches;
function goLandscape() {
  if (!isTouch() || window.Capacitor) return;
  const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => { /* no permitido */ }); } catch (e) { /* no soportado */ } };
  const el = document.documentElement;
  try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, lock); else lock(); } catch (e) { lock(); }
}

function setPaused(on) {
  if (!race || resultsShown) return;
  paused = on;
  if (on) { syncMissions(); renderMissions($('p-missions'), true); show('pause', 'hud'); suspendAudio(true); }
  else { suspendAudio(false); sfx.ui(); show('hud'); last = performance.now(); }
}

// ---------- Bucle principal ----------
let last = performance.now(), tGlobal = 0;
let fpsN = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (save.settings.battery && now - last < 30) return; // ahorro de batería: como mucho 30 imágenes por segundo
  const rdt = (now - last) / 1000, dt = Math.min(0.05, rdt); last = now;
  fpsN++; fpsT += rdt;
  if (fpsT >= 0.5) { if (save.settings.fps) $('fps').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = fpsT = 0; }
  const ps = renderer.domElement.height * 0.05;
  if (podium.active) {
    podiumT += dt;
    podium.update(dt, innerWidth / innerHeight); podium.fx.update(dt, ps);
    render(podium.scene, podium.camera);
    return;
  }
  if (race) {
    if (replaying) {
      // repetición: los coches siguen lo grabado y la cámara va cambiando de plano
      const ok = race.replay.update(dt, camera);
      track.update(dt, race.t, camera.position, race.player);
      race.lateUpdate(dt, camera);
      fxAdd.update(dt, ps); fxNorm.update(dt, ps);
      ambient.points.visible = !race.underwater.on; ambient.update(race.t, camera.position);
      const p = race.player; updateEngine(Math.min(1.3, Math.abs(p.speed) / p.maxSpeed), p.drifting && p.hopY < 0.1, p.boostT > 0);
      consumePresses();
      if (!ok) endReplay();
    } else if (photo) {
      if (input.pausePressed) { consumePresses(); setPhoto(false); }
      else { photoCam(); track.update(0, race.t, camera.position, race.player); race.underwater.update(dt, camera.position); }
    } else if (!paused) {
      pollInput(dt);
      if (input.pausePressed && !resultsShown) { consumePresses(); setPaused(true); return; }
      race.update(dt, input);
      if (tuto) { tuto.update(dt, input); if (tuto.rev !== tutoRev) renderTuto(); }
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
        // si el móvil no puede con los gráficos, se van reduciendo solos
        if (race.state === 'racing') autoQualityTick(rdt);
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
    if (showroom) showroom.update(tGlobal);
    render(menuScene, menuCam);
  }
}

// ---------- Arranque ----------
initInput();
wireUi();
setVolumes(save.settings.music, save.settings.sfx);
A.setHaptics?.(save.settings.haptics !== false);
if (save.settings.controls === 'tilt') enableTilt(true);
applyControls(); applyFps();
initI18n();
share.init({ $, show, toast, sfx, get save() { return save; }, persist, earn, fmt, t, lang, canvas, getRace: () => race, getTrack: () => track, getScreen: () => screen, getMode: () => mode, getVariant: () => variant,
  startTimeTrial: (id, v = '') => { mode = 'time'; variant = v; cupState = null; startRace(id); }, toMenu });
refreshShow();
resize();
show('title');
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW: el juego sigue funcionando en línea */ }));
}

// Acceso para pruebas automáticas
window.__game = { get race() { return race; }, get track() { return track; }, get save() { return save; }, get missions() { return missions; }, get show() { return showModel; }, get tuto() { return tuto; }, get mode() { return mode; }, get gfx() { return G; }, autoTick: autoQualityTick, renderer, podium, post, showModel: setShowModel, startRace: (id, m = 'race', v = '') => {
    mode = m; cupState = null;
    if (m === 'surprise') { surprise = surpriseTrack(+v || 1); v = ''; } else if (m === 'battle' || m === 'fever') arenaId = id; else if (m === 'daily') daily = dailyChallenge(); else if (m === 'boss') bossNow = BOSSES.find(b => b.id === id) || BOSSES[0];
    variant = v; if (m === 'race' || m === 'elim' || m === 'stunt') raceKind = m; startRace(id);
  }, showResults: () => showResults(), setTod: v => { tod = v; }, buildModes, get daily() { return daily; },
  startReplay, endReplay, setPhoto, get replaying() { return replaying; }, get photo() { return photo; }, camera };
