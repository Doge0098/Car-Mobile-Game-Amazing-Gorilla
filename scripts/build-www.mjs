#!/usr/bin/env node
// Monta la carpeta www/ que Capacitor empaqueta dentro del APK.
// El juego es una web estática sin compilación: aquí solo se copian sus archivos.
// Las carpetas se copian enteras para que los archivos nuevos de js/ o css/ entren solos.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');

// Lo que forma el juego. Si algún día se añade otra carpeta (p. ej. audio/), hay que
// ponerla aquí y en los `paths` de .github/workflows/android-apk.yml.
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['css', 'js', 'icons'];

function fail(msg) {
  console.error(process.env.GITHUB_ACTIONS ? `::error title=build-www::${msg}` : `build-www: ERROR: ${msg}`);
  process.exit(1);
}
function warn(msg) {
  // "::warning::" hace que GitHub Actions lo muestre destacado en el resumen de la ejecución.
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=build-www::${msg}` : `build-www: AVISO: ${msg}`);
}

for (const name of [...FILES, ...DIRS]) {
  if (!existsSync(join(ROOT, name))) fail(`falta "${name}" en la raíz del repositorio`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Ni archivos ocultos ni basura del sistema dentro del APK.
const keep = src => {
  const base = src.split(/[\\/]/).pop();
  return !base.startsWith('.') && base !== 'Thumbs.db';
};

for (const name of FILES) cpSync(join(ROOT, name), join(OUT, name));
for (const name of DIRS) cpSync(join(ROOT, name), join(OUT, name), { recursive: true, filter: keep });

// Aviso (no error) si el juego pide archivos que no han entrado en www/: lo normal es
// que se haya añadido una carpeta nueva al juego y falte apuntarla arriba, en DIRS.
const inWww = ref => {
  const target = resolve(OUT, ref.replace(/^\//, ''));
  return (target === OUT || target.startsWith(OUT + sep)) && existsSync(target);
};
const isLocal = ref => !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref); // ni http:, ni data:, ni //cdn…
const missing = new Set();

// 1) Lo que enlaza index.html.
const html = readFileSync(join(OUT, 'index.html'), 'utf8');
for (const m of html.matchAll(/<(?:link|script|img|source|audio|video)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"'#?]+)/gi)) {
  if (isLocal(m[1]) && !inWww(m[1])) missing.add(m[1]);
}
// 2) La lista de archivos que sw.js guarda para jugar sin conexión.
const sw = readFileSync(join(OUT, 'sw.js'), 'utf8');
const list = sw.match(/\bFILES\s*=\s*\[([\s\S]*?)\]/);
if (list) {
  for (const m of list[1].matchAll(/["']([^"']+)["']/g)) {
    if (isLocal(m[1]) && !inWww(m[1])) missing.add(m[1]);
  }
}
if (missing.size) {
  warn(`el juego usa archivos que no están en www/ y no irán dentro del APK: ${[...missing].join(', ')}. ` +
    'Si es una carpeta nueva, añádela a DIRS en scripts/build-www.mjs.');
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}
const files = walk(OUT);
const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(`build-www: ${files.length} archivos, ${(bytes / 1024).toFixed(0)} KB -> ${relative(ROOT, OUT)}/`);
