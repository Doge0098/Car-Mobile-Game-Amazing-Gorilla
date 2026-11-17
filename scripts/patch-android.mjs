#!/usr/bin/env node
// Adapta el proyecto Android que genera `npx cap add android` a este juego:
//   - pantalla siempre en horizontal, a pantalla completa y sin apagarse mientras se juega
//   - fondo y pantalla de arranque oscuros (el color de capacitor.config.json)
//   - iconos de la app generados a partir de icons/
//   - permiso de vibración (navigator.vibrate)
//   - número de versión sacado del número de ejecución de CI
//   - firma de depuración con una clave fija, para que cada APK nuevo actualice al anterior
//   - firma de publicación (Google Play) si quien compila pasa su clave por variables de entorno
//
// La carpeta android/ no se guarda en el repositorio: se crea de cero en cada compilación,
// así que todo lo que haya que cambiar en ella tiene que estar aquí. Se puede ejecutar
// varias veces seguidas: el resultado es el mismo.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centerOnCanvas, circleMask, decodePng, encodePng, resize } from './png-lite.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');
const APP = join(ANDROID, 'app');
const MAIN = join(APP, 'src', 'main');
const RES = join(MAIN, 'res');
const KEYSTORE = join(ROOT, 'scripts', 'signing', 'debug.keystore');

const rel = p => relative(ROOT, p).split(sep).join('/');
const log = msg => console.log(`patch-android: ${msg}`);
function warn(msg) {
  // "::warning::" hace que GitHub Actions lo muestre destacado en el resumen de la ejecución.
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=patch-android::${msg}` : `patch-android: AVISO: ${msg}`);
}
function fail(msg) {
  console.error(process.env.GITHUB_ACTIONS ? `::error title=patch-android::${msg}` : `patch-android: ERROR: ${msg}`);
  process.exit(1);
}
// Lee un archivo que tiene que existir. Si falta, la plantilla de Capacitor ha cambiado y
// es mejor parar aquí con un mensaje claro que seguir y fabricar una app a medias.
function read(path) {
  if (!existsSync(path)) fail(`no se encuentra ${rel(path)}. ¿Ha cambiado la plantilla de Capacitor?`);
  return readFileSync(path, 'utf8');
}
function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------- datos de partida

if (!existsSync(join(MAIN, 'AndroidManifest.xml'))) {
  fail('no existe android/app/src/main/AndroidManifest.xml. Ejecuta antes "npx cap add android".');
}

const config = JSON.parse(read(join(ROOT, 'capacitor.config.json')));
const pkg = JSON.parse(read(join(ROOT, 'package.json')));
const appId = config.appId;
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(appId || '')) fail(`appId no válido en capacitor.config.json: ${appId}`);

const background = (config.android?.backgroundColor || config.backgroundColor || '#1a0b3a').toUpperCase();
if (!/^#[0-9A-F]{6}$/.test(background)) fail(`backgroundColor debe tener la forma #rrggbb y es "${background}"`);

// En CI el número de compilación es el número de ejecución del workflow (1, 2, 3…), que
// siempre sube: Android solo deja instalar encima un APK con versionCode igual o mayor.
const buildNumber = Number(process.env.APK_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || 1);
if (!Number.isInteger(buildNumber) || buildNumber < 1 || buildNumber > 2_000_000_000) {
  fail(`número de compilación no válido: "${process.env.APK_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER}"`);
}
// Desplazamiento opcional (variable ANDROID_VERSION_CODE_OFFSET del repositorio). Solo hace
// falta si la cuenta de ejecuciones vuelve a empezar (workflow renombrado o repositorio
// nuevo): Google Play no admite un versionCode igual o menor que uno ya subido.
const offsetRaw = (process.env.APK_VERSION_CODE_OFFSET || '').trim();
const offset = offsetRaw === '' ? 0 : Number(offsetRaw);
if (!/^\d*$/.test(offsetRaw) || !Number.isInteger(offset)) {
  fail(`ANDROID_VERSION_CODE_OFFSET tiene que ser un número entero sin signo y es "${offsetRaw}"`);
}
// 2 100 000 000 es el versionCode más alto que acepta Google Play.
const versionCode = buildNumber + offset;
if (versionCode > 2_100_000_000) fail(`versionCode demasiado alto: ${versionCode} (el máximo de Google Play es 2100000000)`);
const [major = '1', minor = '0'] = String(pkg.version || '1.0.0').split('.');
const versionName = `${major}.${minor}.${versionCode}`;

// API de Android que Google Play exige como objetivo (targetSdkVersion) a las apps nuevas
// y a las actualizaciones. Comprobado el 17-11-2026: API 36 (Android 16) desde el
// 31-08-2026. Sube más o menos una vez al año, a finales de agosto.
// https://developer.android.com/google/play/requirements/target-sdk
const PLAY_TARGET_SDK = 36;

// ---------------------------------------------------------------- AndroidManifest.xml

// Pone (o cambia) un atributo en la etiqueta de apertura `tag`.
function setAttr(tag, name, value) {
  const existing = new RegExp(`(\\s)${escapeRe(name)}\\s*=\\s*"[^"]*"`);
  if (existing.test(tag)) return tag.replace(existing, `$1${name}="${value}"`);
  const indent = (tag.match(/\n([ \t]+)\S/) || [null, '        '])[1];
  return tag.replace(/\s*(\/?>)$/, `\n${indent}${name}="${value}"$1`);
}

function patchManifest() {
  const path = join(MAIN, 'AndroidManifest.xml');
  let xml = read(path);

  const application = xml.match(/<application\b[^>]*>/);
  if (!application) fail('AndroidManifest.xml: no se encuentra <application>');
  let tag = application[0];
  // "game" hace que Android 16+ respete la orientación fija también en tabletas y plegables.
  tag = setAttr(tag, 'android:appCategory', 'game');
  tag = setAttr(tag, 'android:hardwareAccelerated', 'true'); // WebGL
  xml = xml.replace(application[0], () => tag);

  const activity = [...xml.matchAll(/<activity\b[^>]*>/g)].map(m => m[0])
    .find(t => /android:name\s*=\s*"[^"]*\.MainActivity"/.test(t));
  if (!activity) fail('AndroidManifest.xml: no se encuentra la actividad .MainActivity');
  // Horizontal en los dos sentidos: gira si se le da la vuelta al móvil, nunca se pone en vertical.
  const landscape = setAttr(activity, 'android:screenOrientation', 'sensorLandscape');
  xml = xml.replace(activity, () => landscape);

  // navigator.vibrate() no hace nada en un WebView si la app no declara este permiso.
  if (!/<uses-permission\b[^>]*"android\.permission\.VIBRATE"/.test(xml)) {
    if (!xml.includes('</manifest>')) fail('AndroidManifest.xml: no se encuentra </manifest>');
    xml = xml.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
  }

  write(path, xml);
  log(`${rel(path)}: sensorLandscape, appCategory=game, permiso VIBRATE`);
}

// ---------------------------------------------------------------- MainActivity.java

function writeMainActivity() {
  const path = join(MAIN, 'java', ...appId.split('.'), 'MainActivity.java');
  if (!existsSync(path)) fail(`no se encuentra ${rel(path)} (¿cambió el appId después de crear android/?)`);
  write(path, `package ${appId};

import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Generado por scripts/patch-android.mjs. Los cambios se hacen allí, no aquí.
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        // La pantalla no se apaga mientras el juego está abierto.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // El juego también ocupa la zona de la cámara frontal; la web ya deja su margen
        // con env(safe-area-inset-*).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = window.getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attrs);
        }

        // "Atrás" manda el juego a segundo plano en vez de cerrarlo: al volver, la
        // carrera sigue donde estaba.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                moveTaskToBack(true);
            }
        });

        hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    // Pantalla completa: sin barra de estado ni de navegación. Deslizando desde el borde
    // aparecen un momento y se vuelven a esconder solas.
    private void hideSystemBars() {
        Window window = getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
`);
  log(`${rel(path)}: pantalla completa, pantalla siempre encendida, botón atrás`);
}

// ---------------------------------------------------------------- colores y temas

// Sustituye el <style name="…"> entero por `block`; si no existe, lo añade.
function upsertStyle(xml, name, block) {
  const re = new RegExp(`[ \\t]*<style\\s+name="${escapeRe(name)}"[^>]*>[\\s\\S]*?</style>`);
  if (re.test(xml)) return xml.replace(re, () => block);
  if (!xml.includes('</resources>')) fail('styles.xml: no se encuentra </resources>');
  return xml.replace('</resources>', () => `${block}\n</resources>`);
}

function patchTheme() {
  write(join(RES, 'values', 'agr_colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="agr_background">${background}</color>
</resources>
`);
  write(join(RES, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${background}</color>
</resources>
`);

  const path = join(RES, 'values', 'styles.xml');
  let xml = read(path);

  // Tema del juego en marcha: el fondo de la ventana es oscuro, así no hay destello
  // blanco antes de que cargue la web ni alrededor de ella.
  xml = upsertStyle(xml, 'AppTheme.NoActionBar', `    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">@color/agr_background</item>
        <item name="android:statusBarColor">@color/agr_background</item>
        <item name="android:navigationBarColor">@color/agr_background</item>
    </style>`);

  // Pantalla de arranque: fondo oscuro con el icono en el centro.
  xml = upsertStyle(xml, 'AppTheme.NoActionBarLaunch', `    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/agr_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/agr_splash_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`);

  write(path, xml);

  // Las imágenes de arranque de la plantilla (logo de Capacitor) ya no se usan.
  let removed = 0;
  for (const dir of readdirSync(RES)) {
    const splash = join(RES, dir, 'splash.png');
    if (dir.startsWith('drawable') && existsSync(splash)) { rmSync(splash); removed++; }
  }
  log(`${rel(path)}: fondo ${background}, pantalla de arranque propia${removed ? ` (${removed} splash.png de la plantilla borrados)` : ''}`);
}

// ---------------------------------------------------------------- iconos

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Un icono adaptativo de Android mide 108 dp, de los que solo se garantiza que se ve un
// círculo central de 66 dp. Un icono "maskable" de la web garantiza el círculo central
// del 80 %. Para que las dos zonas seguras coincidan, la imagen ocupa 66/0,8 = 82,5 dp.
const MASKABLE_SHARE = 66 / 0.8 / 108;
// Sin icono maskable, el icono normal entero se mete dentro de la zona segura.
const PLAIN_SHARE = 66 / 108;
// Lo que un lanzador enseña de esos 108 dp es el centro de 72 dp.
const VISIBLE_SHARE = 72 / 108;

function loadIcon(name) {
  const path = join(ROOT, 'icons', name);
  if (!existsSync(path)) return null;
  const img = decodePng(readFileSync(path));
  if (img.width !== img.height) throw new Error(`icons/${name} no es cuadrado (${img.width}x${img.height})`);
  return img;
}

function writeIcons() {
  const icon = loadIcon('icon-512.png');
  if (!icon) throw new Error('falta icons/icon-512.png');
  const maskable = loadIcon('icon-maskable-512.png');

  // Primero se prepara todo en memoria y solo al final se escribe: si un icono no se
  // puede leer, no se queda la carpeta con iconos a medias.
  const files = [];

  // Primer plano del icono adaptativo, a tamaño grande; luego se reduce a cada densidad.
  const source = maskable || icon;
  const canvas = Math.round(source.width / (maskable ? MASKABLE_SHARE : PLAIN_SHARE));
  const foreground = centerOnCanvas(source, canvas, { mirror: Boolean(maskable) });

  // Icono redondo antiguo: lo mismo que enseñaría un lanzador con máscara circular.
  const round = maskable
    ? circleMask(centerOnCanvas(foreground, Math.round(canvas * VISIBLE_SHARE)))
    : icon;

  for (const [density, scale] of Object.entries(DENSITIES)) {
    const dir = join(RES, `mipmap-${density}`);
    files.push([join(dir, 'ic_launcher.png'), encodePng(resize(icon, 48 * scale, 48 * scale))]);
    files.push([join(dir, 'ic_launcher_round.png'), encodePng(resize(round, 48 * scale, 48 * scale))]);
    files.push([join(dir, 'ic_launcher_foreground.png'), encodePng(resize(foreground, 108 * scale, 108 * scale))]);
  }

  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  files.push([join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive]);
  files.push([join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive]);

  // Icono de la pantalla de arranque: Android lo dibuja en un cuadro del que solo se ve
  // el círculo central (2/3), así que el icono va al 50 % con margen transparente.
  const splashIcon = icon.width > 512 ? resize(icon, 512, 512) : icon;
  files.push([join(RES, 'drawable-nodpi', 'agr_splash_icon.png'), encodePng(centerOnCanvas(splashIcon, splashIcon.width * 2))]);

  for (const [path, content] of files) write(path, content);
  rmSync(join(RES, 'drawable', 'agr_splash_icon.xml'), { force: true });

  log(`iconos generados desde icons/icon-512.png${maskable ? ' e icons/icon-maskable-512.png (icono adaptativo)' : ''}`);
}

function writeFallbackSplashIcon() {
  // El tema de arranque necesita que exista @drawable/agr_splash_icon aunque no haya iconos.
  write(join(RES, 'drawable', 'agr_splash_icon.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@android:color/transparent" />
</shape>
`);
}

// ---------------------------------------------------------------- app/build.gradle

const BLOCK_START = '// >>> agr-patch';
const BLOCK_END = '// <<< agr-patch';

function patchGradle() {
  const path = join(APP, 'build.gradle');
  let gradle = read(path);
  // El bloque de abajo está escrito en Groovy y cuenta con el plugin de aplicación Android.
  if (!/com\.android\.application/.test(gradle)) {
    fail(`${rel(path)} no aplica el plugin com.android.application. ¿Ha cambiado la plantilla de Capacitor?`);
  }

  const previous = new RegExp(`\\n*${escapeRe(BLOCK_START)}[\\s\\S]*?${escapeRe(BLOCK_END)}\\n?`);
  gradle = gradle.replace(previous, '').replace(/\s*$/, '\n');

  // Los runners de CI crean una clave de depuración nueva cada vez; con ella cada APK
  // tendría una firma distinta y Android se negaría a actualizar la app ya instalada
  // (habría que desinstalarla y se perdería la partida). Por eso se usa siempre la
  // misma clave de depuración, guardada en el repositorio.
  let debugSigning = '';
  if (existsSync(KEYSTORE)) {
    const storeFile = relative(APP, KEYSTORE).split(sep).join('/');
    debugSigning = `
        debug {
            storeFile file('${storeFile}')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`;
  } else {
    warn(`falta ${rel(KEYSTORE)}: el APK se firmará con una clave nueva y no podrá actualizar una instalación anterior.`);
  }

  gradle += `
${BLOCK_START} (generado por scripts/patch-android.mjs; se regenera en cada compilación)
// Estos valores mandan sobre los de la plantilla de más arriba.

// Firma de publicación (Google Play). Solo existe si quien compila pasa su almacén de
// claves por variables de entorno, como hace el trabajo "play" del workflow. Ni la clave
// ni sus contraseñas se escriben en ningún archivo: Gradle las lee del entorno al compilar.
def agrReleaseStore = System.getenv('AGR_RELEASE_STORE_FILE')

android {
    defaultConfig {
        versionCode ${versionCode}
        versionName "${versionName}"
    }
    signingConfigs {${debugSigning}
        if (agrReleaseStore) {
            release {
                storeFile file(agrReleaseStore)
                storePassword System.getenv('AGR_RELEASE_STORE_PASSWORD')
                keyAlias System.getenv('AGR_RELEASE_KEY_ALIAS')
                keyPassword System.getenv('AGR_RELEASE_KEY_PASSWORD')
            }
        }
    }
    if (agrReleaseStore) {
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
}

dependencies {
    // Las usa MainActivity directamente (pantalla completa y botón atrás).
    implementation "androidx.core:core:\${project.findProperty('androidxCoreVersion') ?: '1.17.0'}"
    implementation "androidx.activity:activity:\${project.findProperty('androidxActivityVersion') ?: '1.11.0'}"
}
${BLOCK_END}
`;
  write(path, gradle);
  log(`${rel(path)}: versionCode ${versionCode}, versionName ${versionName}${debugSigning ? ', firma de depuración fija' : ''}, firma de publicación si se pasa la clave`);
}

// ---------------------------------------------------------------- versiones del SDK

// Lo que la plantilla de Capacitor fija en android/variables.gradle. Aquí no se cambia:
// solo se lee, para dejarlo escrito en el registro y avisar si Google Play ya pide más.
function reportSdk() {
  const path = join(ANDROID, 'variables.gradle');
  const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const level = key => {
    const m = text.match(new RegExp(`\\b${key}\\s*=\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const sdk = { min: level('minSdkVersion'), compile: level('compileSdkVersion'), target: level('targetSdkVersion') };
  if (sdk.target === null) {
    warn(`no se pudo leer targetSdkVersion en ${rel(path)}. Comprueba a mano que es ${PLAY_TARGET_SDK} o más: es lo que exige Google Play.`);
    return sdk;
  }
  log(`SDK de Android: mínimo ${sdk.min ?? '?'}, compilación ${sdk.compile ?? '?'}, objetivo ${sdk.target} (Google Play exige objetivo ${PLAY_TARGET_SDK} o más)`);
  if (sdk.target < PLAY_TARGET_SDK) {
    warn(`la app apunta a la API ${sdk.target} de Android y Google Play exige la ${PLAY_TARGET_SDK} o más: Play rechazará esta versión. Hay que actualizar Capacitor en package.json.`);
  }
  return sdk;
}

// ---------------------------------------------------------------- comprobación final

// Relee lo que ha quedado escrito. Si algo no está como debe (por ejemplo, porque la
// plantilla de Capacitor ha cambiado de forma), la compilación se para aquí en vez de
// fabricar una app que gira a vertical o que no se puede publicar.
function verify() {
  const problems = [];
  const count = (text, re) => (text.match(re) || []).length;

  const manifest = read(join(MAIN, 'AndroidManifest.xml'));
  const activity = [...manifest.matchAll(/<activity\b[^>]*>/g)].map(m => m[0])
    .find(t => /android:name\s*=\s*"[^"]*\.MainActivity"/.test(t)) || '';
  if (count(activity, /android:screenOrientation\s*=/g) !== 1
    || !/android:screenOrientation\s*=\s*"sensorLandscape"/.test(activity)) {
    problems.push('la actividad principal no tiene android:screenOrientation="sensorLandscape" (una sola vez)');
  }
  const application = (manifest.match(/<application\b[^>]*>/) || [''])[0];
  if (!/android:appCategory\s*=\s*"game"/.test(application)) problems.push('<application> no tiene android:appCategory="game"');
  if (count(manifest, /"android\.permission\.VIBRATE"/g) !== 1) problems.push('el permiso VIBRATE no aparece exactamente una vez');

  const activityJava = read(join(MAIN, 'java', ...appId.split('.'), 'MainActivity.java'));
  for (const piece of [`package ${appId};`, 'FLAG_KEEP_SCREEN_ON', 'controller.hide(WindowInsetsCompat.Type.systemBars())']) {
    if (!activityJava.includes(piece)) problems.push(`MainActivity.java no contiene "${piece}"`);
  }

  const styles = read(join(RES, 'values', 'styles.xml'));
  for (const name of ['AppTheme.NoActionBar', 'AppTheme.NoActionBarLaunch']) {
    if (count(styles, new RegExp(`<style\\s+name="${escapeRe(name)}"`, 'g')) !== 1) problems.push(`styles.xml no tiene una sola vez el estilo ${name}`);
  }

  const gradle = read(join(APP, 'build.gradle'));
  if (gradle.split(BLOCK_START).length !== 2 || gradle.split(BLOCK_END).length !== 2) {
    problems.push('app/build.gradle no tiene exactamente un bloque agr-patch');
  } else {
    const block = gradle.slice(gradle.indexOf(BLOCK_START), gradle.indexOf(BLOCK_END));
    for (const piece of [`versionCode ${versionCode}\n`, `versionName "${versionName}"`, 'signingConfig signingConfigs.release']) {
      if (!block.includes(piece)) problems.push(`el bloque agr-patch de app/build.gradle no contiene "${piece.trim()}"`);
    }
  }

  if (problems.length) fail(`el proyecto Android no ha quedado como se esperaba: ${problems.join('; ')}.`);
  log('comprobado: horizontal fijo, pantalla completa, versión y firma en su sitio');
}

// ---------------------------------------------------------------- ejecución

patchManifest();
writeMainActivity();
patchTheme();
try {
  writeIcons();
} catch (err) {
  // Un icono que no se puede leer no debe impedir tener APK: se quedan los iconos que
  // hubiera en android/ (recién creado, los genéricos de Capacitor).
  if (!existsSync(join(RES, 'drawable-nodpi', 'agr_splash_icon.png'))) writeFallbackSplashIcon();
  warn(`no se pudieron generar los iconos (${err.message}). El APK llevará el icono genérico de Capacitor.`);
}
patchGradle();
if (existsSync(join(ANDROID, 'gradlew'))) chmodSync(join(ANDROID, 'gradlew'), 0o755);
verify();
const sdk = reportSdk();

// Para que el workflow pueda poner la versión en la página de descarga.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT,
    `version_code=${versionCode}\nversion_name=${versionName}\ntarget_sdk=${sdk.target ?? ''}\n`);
}
log('listo');
