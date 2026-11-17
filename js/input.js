// Entrada: teclado, botones táctiles e inclinación del móvil.
export const input = { steer: 0, drift: false, brake: false, itemPressed: false, hornPressed: false, pausePressed: false };

const keys = {};
const touch = { left: false, right: false, drift: false, brake: false };
let tilt = 0, tiltEnabled = false, steerSmooth = 0;

export function initInput() {
  addEventListener('keydown', e => {
    if (e.repeat) return;
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
  if (keys.ArrowLeft || keys.KeyA || touch.left) target -= 1;
  if (keys.ArrowRight || keys.KeyD || touch.right) target += 1;
  if (tiltEnabled && target === 0) {
    target = Math.abs(tilt) < 0.08 ? 0 : tilt;
    steerSmooth = target;
  } else {
    // Suavizado para que los botones no sean bruscos
    const k = Math.min(1, dt * (target === 0 ? 10 : 7));
    steerSmooth += (target - steerSmooth) * k;
  }
  input.steer = steerSmooth;
  input.drift = !!(keys.Space || touch.drift);
  input.brake = !!(keys.ArrowDown || keys.KeyS || touch.brake);
}

export function consumePresses() { input.itemPressed = false; input.hornPressed = false; input.pausePressed = false; }
