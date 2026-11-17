# Instalar el juego en Android con un APK

Además de la versión web, GitHub fabrica solo una **app de Android (APK)** del juego.
Todo lo de esta guía se puede hacer desde el móvil, con el navegador.

En los enlaces, cambia `<usuario>` y `<repositorio>` por los de este repositorio.

## Dónde está el APK

Siempre en el mismo sitio, y siempre es el más reciente:

- **Descarga directa:**
  `https://github.com/<usuario>/<repositorio>/releases/download/apk-latest/amazing-gorilla-racing.apk`
- **Página con la fecha y la versión:**
  `https://github.com/<usuario>/<repositorio>/releases/tag/apk-latest`
  (también se llega desde la página del repositorio → **Releases** → «Amazing Gorilla Racing · APK más reciente»).

Guarda el primer enlace en favoritos: no cambia nunca.

- Si el enlace da un error 404, todavía no ha terminado bien ninguna compilación:
  mira la pestaña **Actions** (apartado [Si la compilación falla](#si-la-compilación-falla)).
- Si el repositorio es privado, tienes que haber iniciado sesión en GitHub en ese navegador.

## Descargar e instalar, paso a paso

Con Chrome en el móvil Android:

1. Abre el enlace de **descarga directa** de arriba.
2. Chrome avisa de que el archivo puede ser dañino (lo dice de cualquier APK).
   Toca **Descargar de todos modos**.
3. Cuando termine, toca **Abrir** en el aviso de descarga.
   Si se te escapa el aviso: menú **⋮** de Chrome → **Descargas** → toca `amazing-gorilla-racing.apk`.
4. La primera vez, Android dice que el navegador no tiene permiso para instalar aplicaciones:
   1. Toca **Ajustes** en ese mismo aviso.
   2. Activa **Permitir de esta fuente** (en algunos móviles: «Autorizar descargas de esta fuente»).
   3. Vuelve atrás con la flecha.
5. Toca **Instalar**.
6. Si aparece un aviso de **Play Protect** («no reconoce al desarrollador» o «app no segura»):
   toca **Más detalles** → **Instalar de todos modos**.
   Si ofrece **analizar la aplicación**, acepta y, cuando acabe, toca **Instalar**.
7. Toca **Abrir**. El juego queda en el cajón de aplicaciones como **Amazing Gorilla Racing**
   y funciona sin conexión.

Si en el paso 4 no aparece el botón de Ajustes, el permiso está en
**Ajustes → Aplicaciones → Acceso especial → Instalar aplicaciones desconocidas → Chrome**.
El nombre del menú cambia según la marca; lo más rápido es escribir «desconocidas» en el
buscador de Ajustes.

## Actualizar el juego

1. Descarga otra vez el APK con el mismo enlace.
2. Ábrelo y toca **Actualizar**. La partida guardada (plátanos, coches, trofeos) se conserva.

Para saber qué versión tienes: **Ajustes → Aplicaciones → Amazing Gorilla Racing**; abajo
pone `1.0.N`. Ese `N` es el número de compilación y aparece también en la página de la release.

Dos cosas que conviene saber:

- La app de Android y el juego instalado desde el navegador son independientes:
  cada uno guarda su propia partida.
- Si al actualizar sale **«No se ha instalado la aplicación»**, mira el apartado
  [Qué es una compilación de pruebas](#qué-es-una-compilación-de-pruebas).

## Cuándo se fabrica un APK nuevo

- **Solo**, cada vez que se suben cambios del juego a GitHub (en cualquier rama).
- **A mano**, cuando quieras (apartado siguiente).

Tarda unos minutos (la primera vez, algo más). La release `apk-latest` se queda con el
último que haya terminado, sea de la rama que sea; en su página pone de qué rama y de qué
cambio salió.

## Lanzar una compilación a mano desde el móvil

1. Abre en el navegador:
   `https://github.com/<usuario>/<repositorio>/actions/workflows/android-apk.yml`
   (o entra en el repositorio → pestaña **Actions** → **Compilar APK Android**).
2. Toca **Run workflow**.
3. En **Use workflow from**, elige la rama que quieres compilar (normalmente `main`).
4. Toca el botón verde **Run workflow**.
5. Recarga la página pasado un momento. Verás la compilación con un círculo amarillo
   (en marcha). Cuando cambie a ✅ verde, el APK nuevo ya está en el enlace de siempre.

Si no ves el botón **Run workflow**:

- Pide la versión de escritorio de la página: menú **⋮** de Chrome → **Vista ordenador**
  (en algunos móviles, «Sitio de escritorio»).
- El botón solo existe cuando el archivo `.github/workflows/android-apk.yml` está en la
  rama principal del repositorio. Mientras solo esté en otra rama, los APK se fabrican
  igualmente cada vez que se sube un cambio a esa rama, pero no se pueden pedir a mano.
- Tienes que haber iniciado sesión con una cuenta que pueda escribir en el repositorio.

## Qué es una compilación de pruebas

Este APK lleva **firma de depuración**: sirve para instalar y probar el juego, no para publicarlo.

- **Las actualizaciones tienen que venir de este mismo sitio.** Android solo deja instalar
  una versión nueva encima de la anterior si las dos tienen la misma firma. Todos los APK
  de este repositorio se firman con la misma clave (`scripts/signing/debug.keystore`), así
  que entre ellos se actualizan sin problema. Un APK fabricado de otra manera (en otro
  ordenador, con otra herramienta, o una futura versión de Google Play) no se puede
  instalar encima: Android dirá **«No se ha instalado la aplicación»**.
- **El número de versión tiene que subir.** Sube solo con cada compilación. Si algún día
  se borra o se renombra el archivo del workflow, la cuenta vuelve a empezar y Android
  rechazará el APK nuevo por ser «más antiguo».
- En los dos casos la solución es **desinstalar el juego e instalar el APK nuevo**.
  Al desinstalar se pierde la partida guardada en la app.
- **No vale para Google Play tal cual.** Play exige una firma privada de publicación y
  otro formato de archivo (AAB), entre otros requisitos.
- La clave de depuración está a la vista en el repositorio, como es habitual con estas
  claves: no protege nada. Por eso, **instala solo el APK descargado de este repositorio**
  y no uno que te llegue por otro lado con el mismo nombre.

## Si la compilación falla

Verás una ❌ roja en la pestaña **Actions**. El APK anterior sigue disponible en el enlace
de siempre; no se rompe nada.

1. Abre **Actions** → toca la compilación con la ❌ → toca **Compilar APK**.
2. Mira qué paso tiene la ❌ y ábrelo: el error está en las últimas líneas.
3. Primero prueba otra vez: arriba a la derecha, **Re-run jobs** → **Re-run failed jobs**.
   Muchos fallos son de red y a la segunda pasan.
4. Si vuelve a fallar, copia el nombre del paso y sus últimas 20–30 líneas y pásaselas a
   quien mantiene el código (o a tu asistente de programación).

Qué suele significar cada paso en rojo:

| Paso | Causa habitual |
| --- | --- |
| Preparar Node.js / Preparar Java / Recuperar la caché | Fallo pasajero de GitHub. Reintenta. |
| Comprobar el SDK de Android | La máquina de GitHub no trae el SDK de Android. Hay que revisar el workflow. |
| Instalar dependencias | `package.json` y `package-lock.json` no coinciden. Hay que regenerar el segundo con `npm install`. |
| Montar la web (www/) | Falta `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/` o `icons/`. |
| Crear / Adaptar / Sincronizar el proyecto Android | Cambió algo de Capacitor o de `capacitor.config.json`. El mensaje dice el archivo. |
| Compilar el APK | Error de Gradle. Si no es de red (reintenta), hace falta enviar el registro. |
| Publicar en la release apk-latest | GitHub no dejó crear o cambiar la release: permisos de Actions recortados en la cuenta u organización, o reglas que protegen etiquetas o releases. |

Si lo único que falla es el último paso, el APK de esa compilación está igualmente en la
página de la ejecución, abajo, en **Artifacts** → `amazing-gorilla-racing-apk`. Se descarga
como `.zip`: ábrelo con la app Archivos y dentro está el `.apk`. Se guarda 30 días.

Un aviso amarillo ⚠️ no es un fallo: el APK se ha fabricado, pero conviene leerlo. Por
ejemplo, avisa si el juego usa una carpeta nueva que todavía no se copia dentro del APK.

## Para quien toque el código

El juego sigue siendo una web sin compilación. El empaquetado vive en estos archivos:

| Archivo | Para qué |
| --- | --- |
| `.github/workflows/android-apk.yml` | La compilación en GitHub Actions. |
| `package.json`, `package-lock.json` | Versiones fijas de Capacitor 8 (pide Node 22 o superior y Java 21). |
| `capacitor.config.json` | Identificador (`com.amazinggorilla.racing`), nombre, color de fondo y barras ocultas. |
| `scripts/build-www.mjs` | Copia `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/` e `icons/` a `www/`. |
| `scripts/patch-android.mjs` | Ajusta el proyecto Android generado: horizontal, pantalla completa, pantalla encendida, iconos, arranque oscuro, vibración, versión y firma. |
| `scripts/png-lite.mjs` | Lector y escalador de PNG sin dependencias, para los iconos. |
| `scripts/signing/debug.keystore` | Clave de depuración fija (contraseña `android`, alias `androiddebugkey`). |

Las carpetas `android/`, `www/` y `node_modules/` se generan y no se suben (`.gitignore`).

Si el juego estrena una carpeta nueva (por ejemplo `audio/`), hay que añadirla en dos sitios:
la lista `DIRS` de `scripts/build-www.mjs` y los `paths` del workflow.

Para compilar en un ordenador con Node 22+, Java 21 y el SDK de Android:

```bash
npm ci
node scripts/build-www.mjs
npx cap add android            # solo si no existe la carpeta android/
node scripts/patch-android.mjs
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
