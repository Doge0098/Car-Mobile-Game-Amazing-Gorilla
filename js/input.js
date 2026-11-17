// Entrada: teclado, botones táctiles, inclinación del móvil y mando (Gamepad API).
export const input = { steer: 0, drift: false, brake: false, itemPressed: false, hornPressed: false, pausePressed: false };

const keys = {};
const touch = { left: false, right: false, drift: false, brake: false };
let tilt = 0, tiltEnabled = false, steerSmooth = 0;

export function initInput() {
  addEventListener('keydown', e => {
    if (e.repeat || (e.target && e.target.tagName === 'TEXTAREA')) return; // al escribir en un cuadro de texto las teclas son suyas
    keys[e.code] = true;
    if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Enter') input.itemPressed = true;
    if (e.code === 'KeyH') input.hornPressed = true;
    if (e.code === 'Escape' || e.code === 'KeyP') input.pausePressed = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in touch) touch[k] = false; });

  const bind = (id, name, onPress) => {
    const el = document.getElementById(id);
    if (!el) return;
    const down = e => {
      e.preventDefault();
      if (name) touch[name] = true;
      el.classList.add('pressed');
      if (onPress) onPress();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* no soportado */ }
    };
    const up = e => { e.preventDefault(); if (name) touch[name] = false; el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  bind('btn-left', 'left');
  bind('btn-right', 'right');
  bind('btn-drift', 'drift');
  bind('btn-brake', 'brake');
  bind('btn-item', null, () => { input.itemPressed = true; });
  bind('hud-item', null, () => { input.itemPressed = true; });

  addEventListener('deviceorientation', e => {
    if (e.beta == null) return;
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    let v;
    if (ang === 90) v = e.beta; else if (ang === 270 || ang === -90) v = -e.beta; else v = e.gamma;
    tilt = Math.max(-1, Math.min(1, v / 22));
  });
}

// En iOS hay que pedir permiso tras un toque del usuario.
export async function enableTilt(on) {
  tiltEnabled = on;
  if (on && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') { tiltEnabled = false; return false; }
    } catch (e) { tiltEnabled = false; return false; }
  }
  return true;
}

export function pollInput(dt) {
  let target = 0;
  if (keys.ArrowLeft || keys.KeyA || touch.left || pad.left) target -= 1;
  if (keys.ArrowRight || keys.KeyD || touch.right || pad.right) target += 1;
  if (pad.x && target === 0) steerSmooth = pad.x; // la palanca del mando ya es progresiva
  else if (tiltEnabled && target === 0) {
    target = Math.abs(tilt) < 0.08 ? 0 : tilt;
    steerSmooth = target;
  } else {
    // Suavizado para que los botones no sean bruscos
    const k = Math.min(1, dt * (target === 0 ? 10 : 7));
    steerSmooth += (target - steerSmooth) * k;
  }
  input.steer = steerSmooth;
  input.drift = !!(keys.Space || touch.drift || pad.drift);
  input.brake = !!(keys.ArrowDown || keys.KeyS || touch.brake || pad.brake);
}

export function consumePresses() { input.itemPressed = false; input.hornPressed = false; input.pausePressed = false; }

// ---------- Mando (Bluetooth o USB) ----------
// En carrera: palanca izquierda o cruceta = dirección · A derrape · B o gatillo izquierdo freno · X o RB objeto · Y bocina · Start pausa.
// En los menús (cualquier pantalla que no sea el HUD de carrera): la palanca o la cruceta mueven un foco visible por los
// botones, A pulsa el que está enfocado y B vuelve atrás. Sin mando conectado nada de esto se ejecuta.
const B = { A: 0, B: 1, X: 2, Y: 3, RB: 5, LT: 6, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 }; // botones del mando con la distribución estándar
const DEAD = 0.18, NAV_TILT = 0.55, NAV_FIRST = 0.4, NAV_NEXT = 0.14; // zona muerta, inclinación que cuenta en los menús y repetición (s)
const FOCUSABLE = 'button, input[type=range]';
const FIRST = '#btn-start, #r-next, #podium-next, #p-resume, #tuto-yes, #bk-close, .chip.sel, .card:not(.locked), .menu .btn'; // dónde empieza el foco
const BACK = '[data-back], [data-padback], #p-resume, #tuto-no, #replay-skip, #photo-back';                                 // lo que pulsa B
export const pad = { on: false, x: 0, left: false, right: false, drift: false, brake: false, nav: false, focus: null, scr: null }; // nav: se está usando en los menús · focus/scr: botón enfocado y su pantalla
let padApi = {}, probeT = 0, lastT = 0, held = [], navDir = '', navT = 0, focusIdx = 0;

// api: { onConnect(), onDisconnect(), onMove() } (avisos y sonido; todo opcional)
export function initPad(api = {}) {
  padApi = api;
  addEventListener('gamepadconnected', () => { probeT = 0; });
  // quien toca la pantalla o usa el ratón deja de ver el foco del mando
  addEventListener('pointerdown', () => { if (pad.nav) { pad.nav = false; setFocus(null); } }, { passive: true, capture: true });
}

function readPad() {
  let list = null, best = null;
  try { list = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { /* API bloqueada */ }
  // el primero conectado, mejor si declara la distribución estándar de botones
  for (let i = 0; list && i < list.length; i++) { const g = list[i]; if (g && g.connected !== false && g.buttons && g.buttons.length >= 4 && (!best || (g.mapping === 'standard' && best.mapping !== 'standard'))) best = g; }
  return best;
}

const there = el => el.getClientRects().length > 0 && !el.disabled;
const shown = el => { if (!there(el)) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.pointerEvents !== 'none'; };
// pantalla de menú visible, o null en plena carrera (solo el HUD)
function menuScreen() {
  let top = null;
  for (const s of document.querySelectorAll('.screen.active')) if (s.id !== 'hud') top = s;
  return top;
}
function setFocus(el, list) {
  if (pad.focus && pad.focus !== el) pad.focus.classList.remove('pad-focus');
  pad.focus = el;
  if (!el) return;
  el.classList.add('pad-focus'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (list) focusIdx = list.indexOf(el);
}
const focused = scr => { const f = pad.focus; return !!f && f.isConnected && scr.contains(f) && there(f); };
// Deja el foco en un botón válido de la pantalla. Si la pantalla ha cambiado empieza por su botón principal;
// si solo se ha redibujado la lista (garaje, dificultad...) vuelve al mismo puesto.
function keepFocus(scr) {
  if (focused(scr)) return pad.focus;
  const list = [...scr.querySelectorAll(FOCUSABLE)].filter(shown), f = pad.focus;
  if (!list.length) { setFocus(null); return null; }
  let el = f && !f.isConnected && pad.scr === scr ? list[Math.min(focusIdx, list.length - 1)] : null;
  if (!el) el = [...scr.querySelectorAll(FIRST)].find(shown) || list.find(x => !x.matches(BACK)) || list[0];
  pad.scr = scr; setFocus(el, list);
  return el;
}
// Mueve el foco al botón más cercano en esa dirección (dx, dy = -1, 0 o 1)
function moveFocus(scr, dx, dy) {
  const cur = keepFocus(scr); if (!cur) return;
  if (cur.type === 'range' && dx) { // los deslizadores se ajustan con izquierda y derecha
    const st = +cur.step || 1, v = Math.max(+cur.min, Math.min(+cur.max, +cur.value + dx * st));
    if (v !== +cur.value) { cur.value = v; cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true })); }
    return;
  }
  const list = [...scr.querySelectorAll(FOCUSABLE)].filter(shown), a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = 1e9;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    // distancia en el sentido de la marcha (entre bordes) y desvío lateral (hasta el punto más cercano del botón)
    const along = dx ? (dx > 0 ? r.left - a.right : a.left - r.right) : (dy > 0 ? r.top - a.bottom : a.top - r.bottom);
    const side = dx ? Math.max(0, r.top - ay, ay - r.bottom) : Math.max(0, r.left - ax, ax - r.right);
    if (along < -2) continue;
    const sc = Math.max(0, along) + side * 3 + (dx ? Math.abs(r.top + r.height / 2 - ay) : Math.abs(r.left + r.width / 2 - ax)) * 0.05;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) { setFocus(best, list); if (padApi.onMove) padApi.onMove(); }
}

// Se llama al principio de cada fotograma con su marca de tiempo (ms)
export function padFrame(now) {
  if (!pad.on && now < probeT) return; // sin mando solo se mira una vez por segundo
  probeT = now + 1000;
  const dt = Math.min(0.1, (now - lastT) / 1000) || 0; lastT = now;
  const gp = readPad();
  if (!gp) {
    if (pad.on) { pad.on = pad.left = pad.right = pad.drift = pad.brake = pad.nav = false; pad.x = 0; held = []; setFocus(null); if (padApi.onDisconnect) padApi.onDisconnect(); }
    return;
  }
  if (!pad.on) { pad.on = true; held = gp.buttons.map(() => true); if (padApi.onConnect) padApi.onConnect(); } // lo ya pulsado al conectar no cuenta
  const down = i => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
  const hit = i => down(i) && !held[i];
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, scr = menuScreen();
  if (!scr) {
    // carrera: el estado continuo lo lee pollInput y las pulsaciones se apuntan aquí
    pad.x = Math.abs(ax) < DEAD ? 0 : Math.sign(ax) * (Math.abs(ax) - DEAD) / (1 - DEAD);
    pad.left = down(B.LEFT); pad.right = down(B.RIGHT); pad.drift = down(B.A); pad.brake = down(B.B) || down(B.LT);
    if (hit(B.X) || hit(B.RB)) input.itemPressed = true;
    if (hit(B.Y)) input.hornPressed = true;
    if (hit(B.START)) input.pausePressed = true;
    if (pad.x || pad.left || pad.right || pad.drift || pad.brake) pad.nav = true; // quien conduce con el mando lo usará también en los menús
    if (pad.focus) setFocus(null);
    navDir = '';
  } else {
    pad.x = 0; pad.left = pad.right = pad.drift = pad.brake = false;
    const dir = down(B.LEFT) || ax < -NAV_TILT ? 'l' : down(B.RIGHT) || ax > NAV_TILT ? 'r' : down(B.UP) || ay < -NAV_TILT ? 'u' : down(B.DOWN) || ay > NAV_TILT ? 'd' : '';
    const press = hit(B.A), back = hit(B.B), start = hit(B.START), step = () => moveFocus(scr, dir === 'l' ? -1 : dir === 'r' ? 1 : 0, dir === 'u' ? -1 : dir === 'd' ? 1 : 0);
    // la primera pulsación solo enseña dónde está el foco (salvo en el título, donde A ya empieza)
    const fresh = (dir || press) && !(pad.nav && focused(scr)) && scr.id !== 's-title';
    if (dir || press || back || start) pad.nav = true;
    if (pad.nav) keepFocus(scr);
    // mantener la dirección repite el movimiento
    if (dir !== navDir) { navDir = dir; navT = NAV_FIRST; if (dir && !fresh) step(); }
    else if (dir && (navT -= dt) <= 0) { navT = NAV_NEXT; step(); }
    if (press && !fresh && pad.focus && pad.focus.type !== 'range') pad.focus.click();
    else if (back) { const b = [...scr.querySelectorAll(BACK)].find(shown); if (b) b.click(); }
    else if (start) { if (scr.id === 's-title') document.getElementById('btn-start').click(); else if (scr.id === 's-pause' || scr.id === 's-photo') input.pausePressed = true; }
  }
  for (let i = 0; i < gp.buttons.length; i++) held[i] = down(i);
}
