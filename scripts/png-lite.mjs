// PNG mínimo en JavaScript puro (solo usa zlib, que viene con Node): leer, escalar,
// recortar y volver a escribir. Sirve para generar los iconos de Android sin instalar
// ImageMagick, sharp ni ninguna otra herramienta de imágenes en CI.
//
// Una imagen es { width, height, data } con `data` en RGBA de 8 bits sin premultiplicar.
// Lee PNG no entrelazados de cualquier tipo de color y profundidad; escribe RGB/RGBA de 8 bits.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// ---------------------------------------------------------------- leer

export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('no es un archivo PNG');

  let header = null, palette = null, trns = null;
  const idat = [];
  for (let pos = 8; pos + 8 <= buf.length;) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + length);
    if (body.length !== length) throw new Error('PNG truncado');
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0), height: body.readUInt32BE(4),
        depth: body[8], colorType: body[9], interlace: body[12],
      };
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  if (!header) throw new Error('PNG sin cabecera IHDR');
  const { width, height, depth, colorType, interlace } = header;
  if (interlace !== 0) throw new Error('PNG entrelazado (Adam7) no admitido: guárdalo sin entrelazar');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels || ![1, 2, 4, 8, 16].includes(depth)) throw new Error(`formato PNG no admitido (tipo ${colorType}, ${depth} bits)`);
  if (colorType === 3 && !palette) throw new Error('PNG con paleta pero sin PLTE');
  if (!width || !height || width > 8192 || height > 8192) throw new Error(`tamaño PNG no admitido (${width}x${height})`);

  const bitsPerPixel = channels * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);           // distancia en bytes que usan los filtros
  const stride = Math.ceil((width * bitsPerPixel) / 8);  // bytes por fila
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error('datos PNG incompletos');

  // Deshacer los filtros de cada fila.
  const pix = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const cur = y * stride, prev = cur - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pix[cur + x - bpp] : 0;
      const b = y > 0 ? pix[prev + x] : 0;
      const c = x >= bpp && y > 0 ? pix[prev + x - bpp] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`filtro PNG desconocido (${filter})`);
      pix[cur + x] = v & 0xff;
    }
  }

  // Muestra `i` de la fila `y`, tal cual está en el archivo (sin escalar).
  const maxVal = (1 << depth) - 1;
  const sample = (y, i) => {
    const row = y * stride;
    if (depth === 8) return pix[row + i];
    if (depth === 16) return (pix[row + i * 2] << 8) | pix[row + i * 2 + 1];
    const bit = i * depth;
    return (pix[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & maxVal;
  };
  const to8 = v => (depth === 8 ? v : Math.round((v * 255) / maxVal));

  // Color declarado transparente (tRNS) en imágenes grises o RGB.
  const keyGray = colorType === 0 && trns && trns.length >= 2 ? trns.readUInt16BE(0) : -1;
  const keyRgb = colorType === 2 && trns && trns.length >= 6
    ? [trns.readUInt16BE(0), trns.readUInt16BE(2), trns.readUInt16BE(4)] : null;

  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let r, g, b, a = 255;
      if (colorType === 0) {
        const v = sample(y, x);
        r = g = b = to8(v);
        if (v === keyGray) a = 0;
      } else if (colorType === 2) {
        const sr = sample(y, x * 3), sg = sample(y, x * 3 + 1), sb = sample(y, x * 3 + 2);
        r = to8(sr); g = to8(sg); b = to8(sb);
        if (keyRgb && sr === keyRgb[0] && sg === keyRgb[1] && sb === keyRgb[2]) a = 0;
      } else if (colorType === 3) {
        const index = sample(y, x);
        if (index * 3 + 2 >= palette.length) throw new Error('índice de paleta PNG fuera de rango');
        r = palette[index * 3]; g = palette[index * 3 + 1]; b = palette[index * 3 + 2];
        if (trns && index < trns.length) a = trns[index];
      } else if (colorType === 4) {
        r = g = b = to8(sample(y, x * 2));
        a = to8(sample(y, x * 2 + 1));
      } else {
        r = to8(sample(y, x * 4)); g = to8(sample(y, x * 4 + 1)); b = to8(sample(y, x * 4 + 2));
        a = to8(sample(y, x * 4 + 3));
      }
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
    }
  }
  return { width, height, data };
}

// ---------------------------------------------------------------- escribir

function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'latin1');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

export function encodePng(img) {
  const { width, height, data } = img;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { opaque = false; break; }
  const ch = opaque ? 3 : 4;
  const stride = width * ch;

  const rows = new Uint8Array(stride * height);
  for (let i = 0, o = 0; i < data.length; i += 4) {
    rows[o++] = data[i]; rows[o++] = data[i + 1]; rows[o++] = data[i + 2];
    if (!opaque) rows[o++] = data[i + 3];
  }

  // Por cada fila se prueba cada filtro PNG y se queda el que deja los bytes más pequeños.
  const raw = Buffer.alloc((stride + 1) * height);
  const tries = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const cur = y * stride, prev = cur - stride;
    const cost = [0, 0, 0, 0, 0];
    for (let x = 0; x < stride; x++) {
      const v = rows[cur + x];
      const a = x >= ch ? rows[cur + x - ch] : 0;
      const b = y > 0 ? rows[prev + x] : 0;
      const c = x >= ch && y > 0 ? rows[prev + x - ch] : 0;
      const vals = [v, v - a, v - b, v - ((a + b) >> 1), v - paeth(a, b, c)];
      for (let f = 0; f < 5; f++) {
        const byte = vals[f] & 0xff;
        tries[f][x] = byte;
        cost[f] += byte < 128 ? byte : 256 - byte;
      }
    }
    let best = 0;
    for (let f = 1; f < 5; f++) if (cost[f] < cost[best]) best = f;
    raw[y * (stride + 1)] = best;
    raw.set(tries[best], y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;               // 8 bits por canal
  ihdr[9] = opaque ? 2 : 6;  // RGB o RGBA
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- operaciones

export function blank(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

// Pesos de un filtro de caja: qué píxeles de origen (y cuánto) forman cada píxel de destino.
function boxWeights(srcN, dstN) {
  const scale = srcN / dstN;
  const taps = [];
  for (let d = 0; d < dstN; d++) {
    const from = d * scale, to = (d + 1) * scale;
    const list = [];
    for (let s = Math.floor(from); s < Math.ceil(to) && s < srcN; s++) {
      const w = Math.min(to, s + 1) - Math.max(from, s);
      if (w > 1e-9) list.push([s, w / scale]);
    }
    taps.push(list);
  }
  return taps;
}

// Escala promediando áreas (pensado para reducir). El alfa se premultiplica para que
// los bordes transparentes no dejen halos.
export function resize(img, width, height) {
  if (img.width === width && img.height === height) return { width, height, data: img.data.slice() };
  const sw = img.width, sh = img.height;

  const pre = new Float64Array(sw * sh * 4);
  for (let i = 0; i < pre.length; i += 4) {
    const a = img.data[i + 3] / 255;
    pre[i] = img.data[i] * a; pre[i + 1] = img.data[i + 1] * a; pre[i + 2] = img.data[i + 2] * a;
    pre[i + 3] = img.data[i + 3];
  }

  const wx = boxWeights(sw, width);
  const mid = new Float64Array(width * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (const [s, w] of wx[x]) {
        const i = (y * sw + s) * 4;
        mid[o] += pre[i] * w; mid[o + 1] += pre[i + 1] * w; mid[o + 2] += pre[i + 2] * w; mid[o + 3] += pre[i + 3] * w;
      }
    }
  }

  const wy = boxWeights(sh, height);
  const out = blank(width, height);
  const px = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      px[0] = px[1] = px[2] = px[3] = 0;
      for (const [s, w] of wy[y]) {
        const i = (s * width + x) * 4;
        px[0] += mid[i] * w; px[1] += mid[i + 1] * w; px[2] += mid[i + 2] * w; px[3] += mid[i + 3] * w;
      }
      const o = (y * width + x) * 4;
      const a = px[3] / 255;
      if (a > 0) {
        out.data[o] = Math.min(255, Math.round(px[0] / a));
        out.data[o + 1] = Math.min(255, Math.round(px[1] / a));
        out.data[o + 2] = Math.min(255, Math.round(px[2] / a));
      }
      out.data[o + 3] = Math.min(255, Math.round(px[3]));
    }
  }
  return out;
}

// Lienzo de `size`x`size` con la imagen centrada. Lo que sobra queda transparente o,
// con `mirror`, se rellena reflejando la imagen (sus bordes continúan sin corte).
// Si `size` es menor que la imagen, el resultado es un recorte centrado.
export function centerOnCanvas(img, size, { mirror = false } = {}) {
  const out = blank(size, size);
  const offX = Math.floor((size - img.width) / 2), offY = Math.floor((size - img.height) / 2);
  const reflect = (i, n) => {
    const period = 2 * n;
    const m = ((i % period) + period) % period;
    return m < n ? m : period - 1 - m;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sx = x - offX, sy = y - offY;
      if (mirror) { sx = reflect(sx, img.width); sy = reflect(sy, img.height); }
      else if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const i = (sy * img.width + sx) * 4, o = (y * size + x) * 4;
      out.data[o] = img.data[i]; out.data[o + 1] = img.data[i + 1];
      out.data[o + 2] = img.data[i + 2]; out.data[o + 3] = img.data[i + 3];
    }
  }
  return out;
}

// Deja visible solo el círculo inscrito (borde suavizado con 4x4 muestras por píxel).
export function circleMask(img) {
  const { width, height } = img;
  const out = { width, height, data: img.data.slice() };
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let cover = 1;
      if (d >= r + 1) cover = 0;
      else if (d > r - 1) {
        let inside = 0;
        for (let j = 0; j < 4; j++) {
          for (let i = 0; i < 4; i++) {
            if (Math.hypot(x + (i + 0.5) / 4 - cx, y + (j + 0.5) / 4 - cy) <= r) inside++;
          }
        }
        cover = inside / 16;
      }
      if (cover < 1) out.data[(y * width + x) * 4 + 3] = Math.round(out.data[(y * width + x) * 4 + 3] * cover);
    }
  }
  return out;
}
