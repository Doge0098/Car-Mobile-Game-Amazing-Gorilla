#!/usr/bin/env node
// Firma de publicación para Google Play. Lo usa el trabajo "play" de
// .github/workflows/android-apk.yml en tres momentos:
//
//   node scripts/release-signing.mjs prepare   antes de compilar: comprueba la clave de firma
//   node scripts/release-signing.mjs collect   después: comprueba y recoge el AAB y el APK
//   node scripts/release-signing.mjs summary   al final: escribe el resumen de la ejecución
//
// Hay dos modos:
//   propia  el repositorio tiene los cuatro secretos ANDROID_*: se firma con la clave de
//           subida del dueño y los archivos se ofrecen como artefactos de la ejecución.
//   ensayo  no hay secretos: se compila igual, firmando con la clave de pruebas pública
//           (scripts/signing/debug.keystore), solo para saber que la compilación de
//           Google Play funciona. No se guarda ningún archivo.
//
// Reglas de este archivo: nunca escribe en el registro un secreto ni la salida en bruto de
// una herramienta que lo haya recibido, y el almacén de claves del dueño solo se escribe
// en la carpeta temporal del runner, fuera del repositorio. Cómo crear la clave y dónde
// guardarla: docs/PLAY_STORE.md
import { spawnSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEBUG_KEYSTORE = join(ROOT, 'scripts', 'signing', 'debug.keystore');
const DEBUG_ALIAS = 'androiddebugkey';
const DEBUG_PASSWORD = 'android';
const SECRETS = ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
const BASE_NAME = 'amazing-gorilla-racing-play';
const GUIDE = 'docs/PLAY_STORE.md';
// Google Play no admite claves cuyo certificado caduque antes de esta fecha.
const PLAY_MIN_VALID_UNTIL = new Date('2033-10-22T00:00:00Z');

const rel = p => relative(ROOT, p).split(sep).join('/');
const log = msg => console.log(`release-signing: ${msg}`);
const annotate = (kind, msg) => (process.env.GITHUB_ACTIONS ? `::${kind} title=release-signing::${msg}` : `release-signing: ${kind.toUpperCase()}: ${msg}`);
const notice = msg => console.log(annotate('notice', msg));
const warn = msg => console.warn(annotate('warning', msg));
function fail(msg) {
  console.error(annotate('error', msg));
  process.exit(1);
}
function setOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(''));
}

// Ejecuta una herramienta sin pasar por el intérprete de órdenes. Las contraseñas viajan
// en variables de entorno (`extraEnv`), nunca en la línea de órdenes.
function tool(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, { env: { ...process.env, ...extraEnv }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) fail(`no se pudo ejecutar ${cmd.split(/[\\/]/).pop()}${r.error.code === 'ENOENT' ? ': no está instalado' : ` (${r.error.code || r.error.message})`}`);
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}
// keytool y jarsigner traducen sus mensajes; aquí se leen, así que se piden en inglés.
const JAVA_EN = '-J-Duser.language=en';

const pemBlocks = text => text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
// Certificados con los que está firmado un .jar, un .aab o un .apk con firma v1.
function signerCerts(file) {
  const r = tool('keytool', [JAVA_EN, '-printcert', '-rfc', '-jarfile', file]);
  return r.ok ? pemBlocks(r.out).map(pem => new X509Certificate(pem)) : [];
}
// "AA:BB:…" o "aabb…" → "AABB…", para comparar huellas vengan de donde vengan.
const bareHex = fingerprint => String(fingerprint || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
const sha256File = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const megabytes = path => `${(statSync(path).size / (1024 * 1024)).toFixed(1)} MB`;

// ---------------------------------------------------------------- prepare

// Por qué no se pudo firmar, dicho de forma que se pueda arreglar desde Ajustes → Secrets.
function explainSigningFailure(out) {
  if (/password was incorrect/i.test(out)) {
    return 'ANDROID_KEYSTORE_PASSWORD no abre el almacén de claves. O la contraseña no es esa, o ANDROID_KEYSTORE_BASE64 no se copió entero.';
  }
  if (/Certificate chain not found/i.test(out)) {
    return 'en el almacén de claves no hay ninguna clave con el alias de ANDROID_KEY_ALIAS. Con la guía, el alias es "agrplay".';
  }
  if (/not a private key|recover key/i.test(out)) {
    return 'ANDROID_KEY_PASSWORD no es la contraseña de la clave. Con la guía, es la misma que ANDROID_KEYSTORE_PASSWORD.';
  }
  if (/keystore load/i.test(out)) {
    return 'ANDROID_KEYSTORE_BASE64 no contiene un almacén de claves que se pueda abrir. Vuelve a copiarlo entero.';
  }
  return 'no se pudo firmar con la clave de los secretos ANDROID_* (motivo no reconocido). Revisa los cuatro secretos.';
}

function decodeKeystore(base64Text) {
  const b64 = base64Text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0) {
    fail('ANDROID_KEYSTORE_BASE64 no es texto en base64 válido. Tiene que ser lo que escribe "base64 -w0" con el archivo de la clave, copiado entero.');
  }
  const bytes = Buffer.from(b64, 'base64');
  // PKCS12 empieza por una secuencia ASN.1 (0x30); JKS y JCEKS, por un número mágico.
  const magic = bytes.length >= 4 ? bytes.readUInt32BE(0) : 0;
  if (bytes.length < 64 || !(bytes[0] === 0x30 || magic === 0xfeedfeed || magic === 0xcececece)) {
    fail('ANDROID_KEYSTORE_BASE64 no contiene un almacén de claves (.p12, .jks o .keystore). Comprueba que copiaste el archivo de la clave en base64, entero.');
  }
  return bytes;
}

function prepare() {
  const value = Object.fromEntries(SECRETS.map(name => [name, process.env[name] ?? '']));
  const missing = SECRETS.filter(name => value[name].trim() === '');

  let mode;
  let store;
  let alias;
  let storePassword;
  let keyPassword;
  const workDir = join(process.env.RUNNER_TEMP || tmpdir(), 'agr-signing');
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true, mode: 0o700 });

  if (missing.length === SECRETS.length) {
    mode = 'ensayo';
    if (!existsSync(DEBUG_KEYSTORE)) fail(`falta ${rel(DEBUG_KEYSTORE)}: no se puede ensayar la compilación de Google Play.`);
    [store, alias, storePassword, keyPassword] = [DEBUG_KEYSTORE, DEBUG_ALIAS, DEBUG_PASSWORD, DEBUG_PASSWORD];
    notice('El repositorio no tiene claves de firma (secretos ANDROID_*). Se ensaya la compilación de Google Play con la clave de pruebas y no se guarda ningún archivo. ' +
      `Para publicar: ${GUIDE}`);
  } else if (missing.length) {
    fail(`faltan ${missing.length} de los 4 secretos de firma: ${missing.join(', ')}. Créalos en Settings → Secrets and variables → Actions (${GUIDE}).`);
  } else {
    mode = 'propia';
    for (const name of SECRETS.slice(1)) {
      if (value[name] !== value[name].trim()) {
        fail(`el secreto ${name} tiene espacios o saltos de línea al principio o al final. Bórralo y créalo otra vez con el valor exacto.`);
      }
    }
    const bytes = decodeKeystore(value.ANDROID_KEYSTORE_BASE64);
    // El nombre no lleva ninguna palabra que pueda coincidir con un secreto (GitHub las tapa en el registro).
    store = join(workDir, 'agr-release.keystore');
    writeFileSync(store, bytes, { mode: 0o600 });
    chmodSync(store, 0o600);
    [alias, storePassword, keyPassword] = [value.ANDROID_KEY_ALIAS, value.ANDROID_KEYSTORE_PASSWORD, value.ANDROID_KEY_PASSWORD];
    log(`almacén de claves de los secretos: ${bytes.length} bytes`);
  }

  // Prueba de verdad: se firma un archivo diminuto. Así se comprueban de una vez el
  // almacén, el alias y las dos contraseñas antes de gastar minutos en compilar.
  const probeDir = join(workDir, 'probe');
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(join(probeDir, 'probe.txt'), 'Amazing Gorilla Racing\n');
  const probeJar = join(workDir, 'probe.jar');
  if (!tool('jar', ['--create', '--file', probeJar, '-C', probeDir, 'probe.txt']).ok) fail('no se pudo crear el archivo de prueba para comprobar la firma (jar).');
  const signed = tool('jarsigner', [JAVA_EN, '-keystore', store, '-storepass:env', 'AGR_PROBE_STORE_PASSWORD',
    '-keypass:env', 'AGR_PROBE_KEY_PASSWORD', probeJar, alias],
  { AGR_PROBE_STORE_PASSWORD: storePassword, AGR_PROBE_KEY_PASSWORD: keyPassword });
  if (!signed.ok) {
    // En el ensayo la clave es pública: se puede enseñar el mensaje tal cual.
    fail(mode === 'propia' ? explainSigningFailure(signed.out) : `la clave de pruebas no pudo firmar: ${signed.out.trim().split('\n').pop()}`);
  }
  const [cert] = signerCerts(probeJar);
  if (!cert) fail('se firmó el archivo de prueba pero no se pudo leer su certificado (keytool).');
  rmSync(probeDir, { recursive: true, force: true });
  rmSync(probeJar, { force: true });

  const validUntil = new Date(cert.validTo);
  const until = Number.isNaN(validUntil.getTime()) ? cert.validTo : validUntil.toISOString().slice(0, 10);
  if (mode === 'propia') {
    const debug = existsSync(DEBUG_KEYSTORE)
      ? tool('keytool', [JAVA_EN, '-exportcert', '-rfc', '-keystore', DEBUG_KEYSTORE, '-alias', DEBUG_ALIAS, '-storepass', DEBUG_PASSWORD])
      : { ok: false, out: '' };
    const [debugPem] = debug.ok ? pemBlocks(debug.out) : [];
    if (debugPem && bareHex(new X509Certificate(debugPem).fingerprint256) === bareHex(cert.fingerprint256)) {
      fail(`ANDROID_KEYSTORE_BASE64 es la clave de pruebas pública de este repositorio. Google Play no la admite: crea tu propia clave (${GUIDE}).`);
    }
    if (validUntil < PLAY_MIN_VALID_UNTIL) {
      warn(`el certificado de la clave caduca el ${until} y Google Play pide que dure hasta después del 22-10-2033. Crea la clave con "-validity 10000" (${GUIDE}).`);
    }
  }

  log(`modo ${mode}: se firmará con ${mode === 'propia' ? 'la clave de subida de los secretos' : `la clave de pruebas (${rel(store)})`}`);
  log(`huella SHA-256 del certificado: ${cert.fingerprint256} (válido hasta ${until})`);
  setOutputs({ mode, store_file: store, fingerprint: cert.fingerprint256 });
}

// ---------------------------------------------------------------- collect

// Herramienta de las build-tools del SDK de Android (apksigner, aapt2), en su versión más nueva.
function buildTool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const dir = sdk ? join(sdk, 'build-tools') : '';
  if (!dir || !existsSync(dir)) return null;
  const versions = readdirSync(dir).filter(v => existsSync(join(dir, v, name)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return versions.length ? join(dir, versions[versions.length - 1], name) : null;
}

function collect() {
  const mode = process.env.SIGNING_MODE;
  const expected = bareHex(process.env.SIGNING_FINGERPRINT);
  if (!['propia', 'ensayo'].includes(mode) || expected.length !== 64) {
    fail('faltan SIGNING_MODE o SIGNING_FINGERPRINT: "collect" tiene que ejecutarse después de "prepare", con sus resultados.');
  }
  const versionName = process.env.VERSION_NAME || '';
  const versionCode = process.env.VERSION_CODE || '';

  const outputs = join(ROOT, 'android', 'app', 'build', 'outputs');
  const aab = join(outputs, 'bundle', 'release', 'app-release.aab');
  const apk = join(outputs, 'apk', 'release', 'app-release.apk');
  if (!existsSync(aab)) fail(`Gradle terminó pero no dejó el AAB en ${rel(aab)}`);
  if (!existsSync(apk)) {
    const unsigned = join(dirname(apk), 'app-release-unsigned.apk');
    fail(existsSync(unsigned)
      ? `Gradle dejó el APK de publicación sin firmar (${rel(unsigned)}): la firma de publicación no llegó a Gradle.`
      : `Gradle terminó pero no dejó el APK en ${rel(apk)}`);
  }

  // --- AAB: es lo que se sube a Google Play. Lleva firma de tipo JAR.
  const verified = tool('jarsigner', [JAVA_EN, '-verify', aab]);
  if (!verified.ok || !/jar verified/i.test(verified.out)) fail('el AAB no está firmado o su firma no es válida (jarsigner -verify).');
  const aabCerts = signerCerts(aab);
  if (!aabCerts.length) fail('no se pudo leer el certificado con el que está firmado el AAB.');
  if (bareHex(aabCerts[0].fingerprint256) !== expected) {
    fail(`el AAB está firmado con otra clave (huella ${aabCerts[0].fingerprint256}) y no con la esperada. No lo subas a Google Play.`);
  }
  log(`AAB firmado con la clave esperada (${aabCerts[0].fingerprint256})`);

  // --- APK: para probar en un móvil la misma versión. Lleva firma v2, que lee apksigner.
  const apksigner = buildTool('apksigner');
  if (!apksigner) {
    warn('no se encontró apksigner en el SDK de Android: no se ha comprobado la firma del APK de publicación (la del AAB, sí).');
  } else {
    const r = tool(apksigner, ['verify', '--print-certs', apk]);
    if (!r.ok) fail('el APK de publicación no pasa la comprobación de firma (apksigner verify).');
    const digest = (r.out.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f]{64})/i) || [])[1];
    if (!digest) warn('apksigner dio el APK por bueno pero no se pudo leer la huella de su certificado.');
    else if (bareHex(digest) !== expected) fail('el APK de publicación está firmado con otra clave, no con la esperada.');
    else log('APK firmado con la clave esperada');
  }

  // --- Lo que Google Play va a leer dentro del paquete. Es informativo, salvo que el
  // número de versión no sea el que se pidió: eso sí sería un error de la compilación.
  const aapt2 = buildTool('aapt2');
  if (!aapt2) {
    warn('no se encontró aapt2 en el SDK de Android: no se ha podido leer la versión ni la API objetivo del APK.');
  } else {
    const badging = tool(aapt2, ['dump', 'badging', apk]).out;
    const field = re => (badging.match(re) || [])[1] ?? '?';
    const built = {
      id: field(/^package: name='([^']+)'/m),
      code: field(/versionCode='([^']+)'/),
      name: field(/versionName='([^']+)'/),
      min: field(/^(?:sdkVersion|minSdkVersion):'([^']+)'/m),
      target: field(/^targetSdkVersion:'([^']+)'/m),
    };
    log(`dentro del APK: paquete ${built.id}, versionCode ${built.code}, versionName ${built.name}, API mínima ${built.min}, API objetivo ${built.target}`);
    if (versionCode && built.code !== '?' && built.code !== versionCode) {
      fail(`el APK lleva versionCode ${built.code} y se esperaba ${versionCode}.`);
    }
    const manifest = tool(aapt2, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml']).out;
    const orientation = (manifest.match(/screenOrientation[^\n=]*=\s*(?:\(type 0x10\))?\s*(?:0x)?([0-9a-f]+)/i) || [])[1];
    // 6 es el valor de "sensorLandscape" en el manifiesto compilado.
    if (orientation === undefined) warn('no se pudo leer la orientación de pantalla dentro del APK.');
    else if (parseInt(orientation, 16) === 6) log('dentro del APK: orientación 6 (sensorLandscape, horizontal fijo)');
    else warn(`dentro del APK la orientación de pantalla es ${orientation} y se esperaba 6 (sensorLandscape).`);
  }

  if (mode === 'ensayo') {
    log(`ensayo superado: AAB de ${megabytes(aab)} y APK de ${megabytes(apk)} compilados y firmados con la clave de pruebas. No se guardan.`);
    return;
  }

  const tag = /^[0-9A-Za-z.-]+$/.test(versionName) ? versionName : (/^\d+$/.test(versionCode) ? versionCode : 'sin-version');
  const dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  const aabOut = join(dist, `${BASE_NAME}-${tag}.aab`);
  const apkOut = join(dist, `${BASE_NAME}-${tag}.apk`);
  copyFileSync(aab, aabOut);
  copyFileSync(apk, apkOut);
  for (const file of [aabOut, apkOut]) log(`${rel(file)}: ${megabytes(file)}, sha256 ${sha256File(file)}`);
  setOutputs({ aab: rel(aabOut), apk: rel(apkOut), aab_name: `${BASE_NAME}-${tag}.aab`, apk_name: `${BASE_NAME}-${tag}.apk` });
}

// ---------------------------------------------------------------- summary

function summary() {
  const env = process.env;
  const repoUrl = `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY || ''}`;
  const guideUrl = env.GITHUB_REPOSITORY ? `${repoUrl}/blob/${env.GITHUB_SHA || 'HEAD'}/${GUIDE}` : GUIDE;
  const version = `${env.VERSION_NAME || '?'} (versionCode ${env.VERSION_CODE || '?'})`;
  const target = env.TARGET_SDK ? ` · API objetivo ${env.TARGET_SDK}` : '';
  const link = (name, url) => (url ? `[${name}](${url})` : `\`${name}\` (abajo, en **Artifacts**)`);

  const lines = env.SIGNING_MODE === 'propia'
    ? [
      '## Versión para Google Play lista',
      '',
      `- **Versión:** ${version}${target}`,
      `- **Para subir a Play Console (AAB):** ${link(env.AAB_NAME || 'el archivo .aab', env.AAB_URL)}`,
      `- **Para probarla antes en un móvil (APK):** ${link(env.APK_NAME || 'el archivo .apk', env.APK_URL)}`,
      `- **Huella SHA-256 de tu clave de subida:** \`${env.SIGNING_FINGERPRINT || '?'}\``,
      '',
      'Los enlaces piden haber iniciado sesión en GitHub y dejan de funcionar a los 30 días.',
      `Qué hacer con estos archivos: [${GUIDE}](${guideUrl}).`,
    ]
    : [
      '## Ensayo de la versión para Google Play: correcto',
      '',
      'El repositorio no tiene claves de firma (secretos `ANDROID_*`). Se han compilado el AAB y el APK de',
      'publicación y se han firmado con la clave de pruebas, solo para comprobar que esa compilación funciona.',
      '**No se ha guardado ningún archivo.**',
      '',
      `- **Versión ensayada:** ${version}${target}`,
      '',
      `Para publicar el juego en Google Play: [${GUIDE}](${guideUrl}).`,
    ];
  const text = `${lines.join('\n')}\n`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text);
  else process.stdout.write(text);
}

// ---------------------------------------------------------------- ejecución

const commands = { prepare, collect, summary };
const command = commands[process.argv[2]];
if (!command) fail(`uso: node scripts/release-signing.mjs <${Object.keys(commands).join('|')}>`);
command();
