// Extras de conducción: atajo con trampolín, corrientes de agua y control de altura del ala delta.
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ¿Pisa el coche el trampolín del atajo? Empieza un vuelo guiado hasta el punto de aterrizaje.
export function tryShortcut(r, tr) {
  const sc = tr.shortcut;
  if (!sc || r.flight || r.hopY > 0.3 || r.speed < 16 || r.mode || r.spinT > 0) return false;
  const dx = r.x - sc.ex, dz = r.z - sc.ez;
  if (dx * dx + dz * dz > 8) return false;
  const dist = Math.hypot(sc.lx - r.x, sc.lz - r.z);
  r.flight = { t: 0, dur: dist / (Math.max(r.speed, 38) * 1.12), x0: r.x, z0: r.z, y0: r.y, h: Math.atan2(sc.lx - r.x, sc.lz - r.z) };
  r.drifting = false; r.charge = 0;
  return true;
}

// Avanza el vuelo del atajo. Devuelve true mientras el coche sigue en el aire.
export function stepFlight(r, dt, tr) {
  const f = r.flight, sc = tr.shortcut, N = tr.N;
  f.t += dt; const k = Math.min(1, f.t / f.dur);
  r.x = f.x0 + (sc.lx - f.x0) * k; r.z = f.z0 + (sc.lz - f.z0) * k;
  r.h += wrapA((k < 0.75 ? f.h : sc.lh) - r.h) * Math.min(1, dt * 7);
  r.vx = Math.sin(r.h) * r.speed; r.vz = Math.cos(r.h) * r.speed;
  r.y = f.y0 + (sc.ly - f.y0) * k; r.hopY = Math.sin(Math.PI * k) * 9; r.hopV = 0; r.steer *= 0.9;
  if (k < 1) return true;
  let d = sc.i1 - r.idx; if (d < -N / 2) d += N; if (d > N / 2) d -= N;
  r.prog += d; r.idx = sc.i1; r.y = sc.ly; r.hopY = 0; r.h = sc.lh; r.lat = sc.llat; r.flight = null;
  return false;
}

// Corrientes: devuelve el multiplicador de velocidad máxima y aplica el empuje lateral.
export function applyCurrents(r, tr, dt) {
  let k = 1; r.inCurrent = 0;
  for (const c of tr.currents) {
    let di = r.idx - c.i0; if (di < 0) di += tr.N;
    if (di > c.i1 - c.i0 || Math.abs(r.lat - c.lat) > c.w + 0.9) continue;
    if (c.kind === 'fwd') { k = 1.22; r.inCurrent = 1; }
    else { const s = tr.samples[r.idx]; r.vx += s.nx * c.dir * 24 * dt; r.vz += s.nz * c.dir * 24 * dt; r.x += s.nx * c.dir * 4.5 * dt; r.z += s.nz * c.dir * 4.5 * dt; r.inCurrent = 2; }
  }
  return k;
}

// Altura extra del ala delta: el jugador sube con DERRAPE y baja con FRENO; la IA busca el siguiente aro.
export function gliderAlt(r, ctl, tr, dt) {
  let target = 0;
  if (r.isPlayer && !r.finished) target = ctl.drift ? 3.4 : ctl.brake ? -3.0 : 0;
  else for (const rg of tr.rings) { if (!rg.air) continue; let di = rg.idx - r.idx; if (di < 0) di += tr.N; if (di < 26) { target = (rg.up - 0.9) * (r.skill > -0.01 ? 1 : 0.4); break; } }
  r.alt = (r.alt || 0) + (target - (r.alt || 0)) * Math.min(1, dt * 3.2);
  return r.alt;
}
