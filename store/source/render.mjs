#!/usr/bin/env node
// Genera los gráficos de la ficha de Google Play que se pueden fabricar con código:
//
//   store/graphics/icon-512.png                  icono, 512 × 512, PNG de 32 bits
//   store/graphics/feature-graphic-1024x500.png  gráfico de funciones, PNG de 24 bits sin transparencia
//
// Los dibujos están en art.js; aquí solo se abren icon-512.html y feature-graphic.html en
// un Chromium sin ventana y se guarda la foto de su <canvas>.
//
// No forma parte de la compilación ni de CI: los PNG ya están guardados en el repositorio.
// Solo hace falta volver a ejecutarlo si se cambia el dibujo. Necesita Playwright con su
// Chromium, que no es una dependencia de este proyecto:
//
//   npm install --global playwright && npx playwright install chromium
//   NODE_PATH="$(npm root --global)" node store/source/render.mjs
//
// El título usa la fuente Inter (peso 900) si está instalada; si no, la sans-serif más
// gruesa que encuentre, y el resultado cambia un poco.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { decodePng, encodePng } from '../../scripts/png-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, '..', 'graphics');

// Google Play pide el icono en PNG de 32 bits (con canal alfa) y el gráfico de funciones
// en PNG de 24 bits (sin él). Las dos imágenes son opacas; solo cambia cómo se escriben.
const ASSETS = [
  { page: 'icon-512.html', file: 'icon-512.png', width: 512, height: 512, alpha: true },
  { page: 'feature-graphic.html', file: 'feature-graphic-1024x500.png', width: 1024, height: 500, alpha: false },
];

// PNG RGBA de 8 bits por canal. Chromium y png-lite escriben RGB cuando la imagen es
// opaca, así que el icono se escribe aquí para que conserve el canal alfa.
function encodeRgbaPng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 1;   // filtro «Sub»: cada byte menos el del píxel de su izquierda
    for (let x = 0; x < stride; x++) {
      raw[row + 1 + x] = (data[y * stride + x] - (x >= 4 ? data[y * stride + x - 4] : 0)) & 0xff;
    }
  }
  const chunk = (type, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;   // bits por canal
  header[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('render: no se encuentra Playwright. Mira cómo instalarlo al principio de este archivo.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const asset of ASSETS) {
    const page = await browser.newPage({ viewport: { width: asset.width, height: asset.height }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(join(HERE, asset.page)).href);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    const shot = await page.locator('#art').screenshot({ type: 'png' });
    await page.close();

    const image = decodePng(shot);
    if (image.width !== asset.width || image.height !== asset.height) {
      throw new Error(`${asset.file}: mide ${image.width} × ${image.height} y tenía que medir ${asset.width} × ${asset.height}`);
    }
    for (let i = 3; i < image.data.length; i += 4) {
      if (image.data[i] !== 255) throw new Error(`${asset.file}: tiene píxeles transparentes y Google Play lo quiere opaco`);
    }
    const png = asset.alpha ? encodeRgbaPng(image) : encodePng(image);   // png-lite escribe RGB si es opaca

    const path = join(OUT, asset.file);
    writeFileSync(path, png);
    console.log(`render: ${relative(ROOT, path)} (${asset.width} × ${asset.height}, ${(png.length / 1024).toFixed(0)} KB)`);
  }
} finally {
  await browser.close();
}
