// Retos entre amigos: un código corto con el circuito, la variante, el tiempo, el gorila, el coche y el fantasma comprimido.
// Solo lleva datos de la partida (nada personal) y no pasa por ningún servidor: viaja dentro del enlace o copiado a mano.
//
// Formato v1 — bytes en base64url (sin relleno):
//   versión · variante (0 normal, 1 espejo, 2 inverso) · ids de circuito, gorila y coche (longitud + ASCII)
//   tiempo en centésimas y nº de muestras del fantasma a 0,1 s (varint) · rumbo inicial (256 pasos por vuelta)
//   primer punto en cuartos de metro (zigzag + varint) · los demás puntos, uno cada 0,2 s, como segunda diferencia
//   (zigzag en grupos de 3 bits con bit de continuación: medio byte para los valores pequeños) · 2 bytes de comprobación
// El rumbo no se guarda: se deduce del movimiento. Al decodificar se vuelve a 0,1 s con una curva de Hermite.
import { TRACKS } from './data.js';

export const VERSION = 1;
const SKIP = 2, Q = 4;                          // una de cada 2 muestras · cuartos de metro
const MAX_SAMPLES = 3000, MAX_CODE = 6000;      // 5 minutos de fantasma · caracteres del código
const MAX_POS = 4000 * Q, MAX_STEP = 80 * Q;    // ±4 km · salto máximo entre dos puntos seguidos
const VARIANTS = ['', 'mirror', 'reverse'];
const ID = /^[a-z0-9]{1,12}$/;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64I = {}; for (let i = 0; i < 64; i++) B64I[B64[i]] = i;
const TAU = Math.PI * 2;
const zig = v => (v < 0 ? -2 * v - 1 : 2 * v), unzig = u => (u & 1 ? -(u + 1) / 2 : u / 2);
const wrapA = a => a - Math.round(a / TAU) * TAU;

function toB64(b) {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = b[i] << 16 | (b[i + 1] || 0) << 8 | (b[i + 2] || 0);
    s += B64[n >> 18] + B64[n >> 12 & 63] + (i + 1 < b.length ? B64[n >> 6 & 63] : '') + (i + 2 < b.length ? B64[n & 63] : '');
  }
  return s;
}
function fromB64(s) {
  const n = s.length, rem = n % 4; if (rem === 1) return null;
  const out = new Uint8Array(Math.floor(n * 3 / 4));
  let acc = 0, bits = 0, o = 0;
  for (let i = 0; i < n; i++) {
    const v = B64I[s[i]]; if (v === undefined) return null;
    acc = (acc << 6 | v) & 0xffffff; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = acc >> bits & 255; }
  }
  if (acc & ((1 << bits) - 1)) return null; // los bits sobrantes deben ir a cero: cada reto tiene un único código
  return out;
}
// FNV-1a de los n primeros bytes: plegado a 16 bits es la comprobación; entero es la huella corta con la que se recuerdan los retos superados
function fnv(b, n) { let h = 0x811c9dc5; for (let i = 0; i < n; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); } return h >>> 0; }
const check = (b, n) => { const h = fnv(b, n); return (h >>> 16 ^ h) & 0xffff; };

// Crea el código de un reto. c = { track, variant, time (s), char, kart, ghost: [x, z, rumbo, ...] cada 0,1 s }.
// Devuelve null si los datos no sirven (circuito desconocido, fantasma vacío o demasiado largo...).
export function encode(c) {
  try {
    const g = c.ghost, N = g.length / 3, vi = VARIANTS.indexOf(c.variant || ''), cs = Math.round(c.time * 100);
    if (!TRACKS.some(t => t.id === c.track) || vi < 0 || !ID.test(c.track) || !ID.test(c.char) || !ID.test(c.kart)) return null;
    if (!Number.isInteger(N) || N < 10 || N > MAX_SAMPLES || !(cs >= 100) || Math.abs(N - cs / 10) > 6) return null;
    const b = [VERSION, vi];
    const vint = u => { while (u > 127) { b.push(u & 127 | 128); u >>>= 7; } b.push(u); };
    for (const s of [c.track, c.char, c.kart]) { b.push(s.length); for (let i = 0; i < s.length; i++) b.push(s.charCodeAt(i)); }
    vint(cs); vint(N);
    b.push(Math.round(wrapA(+g[2] || 0) / TAU * 256) & 255);
    let hi = -1;
    const nib = n => { if (hi < 0) hi = n; else { b.push(hi << 4 | n); hi = -1; } };
    const small = v => { let u = zig(v); do { const d = u & 7; u >>>= 3; nib(u ? d | 8 : d); } while (u); };
    const K = Math.ceil((N - 1) / SKIP) + 1;
    let px = 0, pz = 0, dx = 0, dz = 0;
    for (let k = 0; k < K; k++) {
      const i = Math.min(k * SKIP, N - 1) * 3, x = Math.round(g[i] * Q), z = Math.round(g[i + 1] * Q);
      if (!(Math.abs(x) <= MAX_POS && Math.abs(z) <= MAX_POS)) return null; // también descarta NaN
      if (!k) { vint(zig(x)); vint(zig(z)); }
      else {
        if (Math.abs(x - px) > MAX_STEP || Math.abs(z - pz) > MAX_STEP) return null;
        small(x - px - dx); small(z - pz - dz); dx = x - px; dz = z - pz;
      }
      px = x; pz = z;
    }
    if (hi >= 0) b.push(hi << 4);
    const sum = check(b, b.length); b.push(sum >> 8, sum & 255);
    const code = toB64(b);
    return code.length <= MAX_CODE ? code : null;
  } catch (e) { return null; }
}

// Lee los bytes de un código. Lanza una excepción (o devuelve null) ante cualquier dato que no encaje.
function unpack(code) {
  if (code.length < 24 || code.length > MAX_CODE) return null;
  const b = fromB64(code); if (!b) return null;
  const n = b.length - 2; if (n < 16 || check(b, n) !== (b[n] << 8 | b[n + 1])) return null;
  let p = 0, half = false;
  const byte = () => { if (p >= n) throw 0; return b[p++]; };
  const vint = () => { let u = 0; for (let s = 0; s < 21; s += 7) { const v = byte(); u |= (v & 127) << s; if (v < 128) return u; } throw 0; };
  const str = () => { let s = ''; for (let l = byte(); l > 0; l--) s += String.fromCharCode(byte()); if (!ID.test(s)) throw 0; return s; };
  const nib = () => { if (half) { half = false; return b[p++] & 15; } if (p >= n) throw 0; half = true; return b[p] >> 4; };
  const small = () => { let u = 0; for (let s = 0; s < 15; s += 3) { const v = nib(); u |= (v & 7) << s; if (v < 8) return unzig(u); } throw 0; };
  if (byte() !== VERSION) return null;
  const variant = VARIANTS[byte()]; if (variant === undefined) return null;
  const track = str(), char = str(), kart = str();
  if (!TRACKS.some(t => t.id === track)) return null;
  const cs = vint(), N = vint(), h0 = byte() / 256 * TAU;
  if (cs < 100 || N < 10 || N > MAX_SAMPLES || Math.abs(N - cs / 10) > 6) return null;
  const K = Math.ceil((N - 1) / SKIP) + 1, X = new Float64Array(K), Z = new Float64Array(K), T = new Int32Array(K);
  let x = unzig(vint()), z = unzig(vint()), dx = 0, dz = 0;
  for (let k = 0; k < K; k++) {
    if (k) { dx += small(); dz += small(); if (Math.abs(dx) > MAX_STEP || Math.abs(dz) > MAX_STEP) return null; x += dx; z += dz; }
    if (Math.abs(x) > MAX_POS || Math.abs(z) > MAX_POS) return null;
    X[k] = x / Q; Z[k] = z / Q; T[k] = Math.min(k * SKIP, N - 1);
  }
  if (half) { if (b[p++] & 15) return null; }
  if (p !== n) return null; // ni bytes de más ni de menos
  return { v: VERSION, track, variant, time: cs / 100, char, kart, ghost: expand(X, Z, T, N, h0), id: fnv(b, b.length).toString(36), code };
}

// Vuelve al formato del juego (una muestra cada 0,1 s): Hermite cúbico entre los puntos y rumbo según el movimiento
function expand(X, Z, T, N, h0) {
  const K = X.length, MX = new Float64Array(K), MZ = new Float64Array(K), g = new Array(N * 3);
  for (let k = 1; k < K - 1; k++) { const d = T[k + 1] - T[k - 1]; MX[k] = (X[k + 1] - X[k - 1]) / d; MZ[k] = (Z[k + 1] - Z[k - 1]) / d; }
  // extremos: como una parábola (el coche sale parado)
  const end = (a, c, o) => { const d = T[c] - T[a]; MX[a] = 2 * (X[c] - X[a]) / d - MX[o]; MZ[a] = 2 * (Z[c] - Z[a]) / d - MZ[o]; };
  if (K > 2) { end(0, 1, 1); end(K - 1, K - 2, K - 2); } else { MX[0] = MX[1] = (X[1] - X[0]) / (T[1] - T[0]); MZ[0] = MZ[1] = (Z[1] - Z[0]) / (T[1] - T[0]); }
  for (let i = 0, k = 0; i < N; i++) {
    while (k < K - 2 && i > T[k + 1]) k++;
    const h = T[k + 1] - T[k], s = (i - T[k]) / h, s2 = s * s, s3 = s2 * s;
    const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * h, c = 3 * s2 - 2 * s3, d = (s3 - s2) * h;
    g[i * 3] = Math.round((a * X[k] + b * MX[k] + c * X[k + 1] + d * MX[k + 1]) * 100) / 100;
    g[i * 3 + 1] = Math.round((a * Z[k] + b * MZ[k] + c * Z[k + 1] + d * MZ[k + 1]) * 100) / 100;
  }
  // rumbo: hacia donde avanza; casi parado se conserva el anterior, y nunca gira más rápido que un coche
  let hd = h0;
  for (let i = 0; i < N; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1), mx = g[i1 * 3] - g[i0 * 3], mz = g[i1 * 3 + 1] - g[i0 * 3 + 1];
    if (i && mx * mx + mz * mz > 0.09 * (i1 - i0) * (i1 - i0)) hd += Math.max(-0.5, Math.min(0.5, wrapA(Math.atan2(mx, mz) - hd)));
    g[i * 3 + 2] = Math.round(wrapA(hd) * 100) / 100;
  }
  return g;
}

// Lee un reto de un código o de un enlace pegado (con «#reto=...»). Nunca lanza excepciones: si algo no encaja, devuelve null.
// Resultado: { v, track, variant, time, char, kart, ghost, id (huella corta), code (código limpio) }
export function decode(text) {
  if (typeof text !== 'string' || text.length > MAX_CODE * 3) return null;
  const flat = text.replace(/\s+/g, ''), tries = [];
  for (const s of [text, flat]) { const m = /reto=([A-Za-z0-9_-]+)/.exec(s); if (m) tries.push(m[1]); }
  if (/^[A-Za-z0-9_-]+$/.test(flat)) tries.push(flat);
  for (const code of tries) {
    try { const c = unpack(code); if (c) return c; } catch (e) { /* código dañado */ }
  }
  return null;
}
