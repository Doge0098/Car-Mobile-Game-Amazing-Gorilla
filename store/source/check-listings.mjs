#!/usr/bin/env node
// Cuenta los caracteres de los textos de la ficha de Google Play (store/listing-*.md) y
// comprueba que caben en los límites de Play y que la cuenta escrita debajo de cada
// recuadro es la real.
//
//   node store/source/check-listings.mjs          comprueba
//   node store/source/check-listings.mjs --fix    además, corrige las cuentas escritas
//
// Cada texto es un recuadro ```text … ``` seguido de una línea «N de M caracteres.»
// (o «N of M characters.»). M es el límite de Google Play: 30 el nombre, 80 la
// descripción breve, 4000 la completa y 500 las novedades de la versión.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMITS = [30, 80, 4000, 500];
const fix = process.argv.includes('--fix');
// Recuadro de texto y, después de una línea en blanco, la línea con la cuenta.
const BLOCK = /```text\n([\s\S]*?)\n```\n\n(\d+) (de|of) (\d+) (caracteres|characters)\./g;

let errors = 0;
for (const file of readdirSync(STORE).filter(name => /^listing-.*\.md$/.test(name)).sort()) {
  const path = join(STORE, file);
  const source = readFileSync(path, 'utf8');
  const limits = [];
  const fixed = source.replace(BLOCK, (match, text, stated, word, limit, unit) => {
    // Google Play cuenta caracteres; un emoji u otro símbolo «doble» puede contar por dos.
    const count = [...text].length;
    const wide = text.length !== count;
    const problems = [];
    if (count > Number(limit)) problems.push(`se pasa del límite (${count} > ${limit})`);
    if (Number(stated) !== count && !fix) problems.push(`debajo pone ${stated} y son ${count}`);
    if (wide) problems.push('lleva emojis o símbolos que Play puede contar doble');
    if (/[ \t]$/m.test(text)) problems.push('hay espacios al final de alguna línea');
    limits.push(Number(limit));
    errors += problems.length;
    const first = text.split('\n')[0];
    console.log(`${problems.length ? 'MAL' : 'ok '} ${file}: ${String(count).padStart(4)} de ${String(limit).padEnd(4)} «${first.length > 44 ? `${first.slice(0, 44)}…` : first}»${problems.length ? ` → ${problems.join('; ')}` : ''}`);
    return `\`\`\`text\n${text}\n\`\`\`\n\n${count} ${word} ${limit} ${unit}.`;
  });
  if (limits.join() !== LIMITS.join()) {
    errors++;
    console.log(`MAL ${file}: se esperaban cuatro textos con límites ${LIMITS.join(', ')} y hay ${limits.join(', ') || 'ninguno'}`);
  }
  if (fix && fixed !== source) {
    writeFileSync(path, fixed);
    console.log(`    ${file}: cuentas corregidas`);
  }
}
if (errors) {
  console.error(`check-listings: ${errors} problema(s).`);
  process.exit(1);
}
console.log('check-listings: todo cabe y las cuentas coinciden.');
