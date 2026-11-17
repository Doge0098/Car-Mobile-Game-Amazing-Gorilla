# 🦍 Amazing Gorilla Racing

Juego de carreras arcade en 3D para móvil: gorilas al volante, colores vivos y power-ups.
Es una **PWA**: se instala desde el navegador y después funciona **sin conexión**. También se puede descargar como **APK de Android**.

- **Jugar en el navegador:** https://doge0098.github.io/Car-Mobile-Game-Amazing-Gorilla/
- **APK de Android:** [descargar la última compilación](https://github.com/Doge0098/Car-Mobile-Game-Amazing-Gorilla/releases/download/apk-latest/amazing-gorilla-racing.apk) · [cómo instalarlo](docs/APK.md)

## Qué incluye

- **12 mapas** en 4 copas:
  - *Copa Plátano*: Selva Esmeralda, Playa Coco y Volcán Furioso.
  - *Copa Diamante*: Cumbre Helada, Ciudad Neón y Templo Arcoíris.
  - *Copa Aventura*: Reino de las Nubes (casi todo en ala delta), Mar Abierto (en barco) y Fondo Marino (en submarino).
  - *Copa Galaxia*: Dunas Doradas, Fábrica de Juguetes y Estación Estelar (con poca gravedad: los saltos duran mucho más).

  Cada copa se desbloquea ganando un trofeo en la anterior. Los mapas tienen cuestas, puente, túnel, rampas de salto y monumentos propios.
- **Coche que se transforma** en barco, ala delta o submarino según el tramo, con aros de impulso.
  Con el ala delta, DERRAPE sube y FRENO baja: los aros están a distinta altura. En el agua hay corrientes que empujan.
- **Atajos y bifurcaciones**: un trampolín verde en el arcén de algunas curvas lanza el coche por encima, y en otras la carretera
  se divide en dos: el carril estrecho es más corto y tiene acelerador. Los rivales también los usan.
- **Rebufo**: ir pegado detrás de un rival carga un impulso para adelantarlo.
- **Modos de juego**
  - Carrera rápida, Copas (con trofeos y podio) y Contrarreloj con el fantasma de tu mejor tiempo.
  - **Eliminación**: cada pocos segundos el último queda fuera. **Acrobacias**: gana quien sume más puntos con trucos y derrapes.
  - **Más modos**: Batalla de globos y Fiebre del plátano en tres arenas (Gorila, Glaciar y Volcán), **Circuito sorpresa** (un circuito nuevo generado al azar cada vez),
    **Reto diario** (una carrera con regla especial cada día, con racha) y duelos contra un **jefe** gigante por copa.
  - Todos los circuitos se pueden correr en **espejo** o en sentido **inverso**, y de día, al **atardecer** o de **noche** (con faros y fuegos artificiales).
  - En contrarreloj hay **medallas** de bronce, plata y oro por circuito, con una liebre dorada que marca el ritmo del oro.
- **5 rivales con IA** (esquivan, usan objetos, hacen trucos y se adaptan a la dificultad: Fácil / Normal / Difícil) y un
  **rival personal** que te reta en cada carrera y ajusta su nivel al tuyo. Acabar por delante da premio extra.
- **9 power-ups**: Turbo Plátano, Coco Misil, Cáscara, Escudo Hoja, Golpe de Pecho, Furia Gorila, Rayo (encoge a los rivales),
  Imán de Plátanos y Barril Rodante.
- **Conducción**: derrape con mini-turbo de 3 niveles, salida turbo, trucos en el aire, aceleradores y plátanos.
- **Progresión**: misiones en cada carrera, logros, estadísticas de por vida y un **tutorial** guiado.
- **Garaje**: 8 gorilas, 7 coches temáticos, pintura, **mejoras** de motor, neumáticos y turbo, y una tienda de
  sombreros, ruedas, estelas, bocinas, **pegatinas** para el coche, **bailes de victoria** y **gestos** que salen al tocar la bocina.
- **Repetición** de la carrera con cámaras de cine, en todos los modos y con los objetos lanzados; se puede **grabar en vídeo**.
  **Modo foto** desde la pausa.
- **Retos entre amigos**: tras una contrarreloj se crea un enlace o un código con tu tiempo y tu fantasma; quien lo abre corre
  contra ti. No pasa por ningún servidor: el reto viaja dentro del propio enlace.
- **Copia de seguridad**: la partida se exporta como un código de texto y se importa en otro dispositivo (Ajustes).
- **Obstáculos vivos** por mapa (barriles, cangrejos, géiseres de lava, pingüinos, robots, estrellas) y **clima**
  (chubascos con rayos, ventisca, meteoritos, estrellas fugaces).
- **Gráficos estilo cómic**: contorno oscuro, resplandor (bloom), sombras reales, cielo con nubes, montañas iluminadas,
  agua con oleaje, reflejos y espuma en la orilla. Cuatro niveles (**Bajos, Medios, Altos y Ultra**), **calidad automática** que baja
  sola los efectos si el móvil va justo, **ahorro de batería** (30 imágenes por segundo) y contador de FPS.
- **Controles configurables**: tamaño y opacidad de los botones, modo zurdo o dirección inclinando el móvil.
  También funciona con **mando** Bluetooth o USB, en carrera y en los menús.
  **Ayudas de conducción** opcionales: dirección asistida y derrape automático.
- **Solo horizontal**: la app y la PWA instalada están bloqueadas en horizontal; en el navegador se pasa a pantalla completa y,
  si el móvil está en vertical, se pide girarlo.
- **Sonido** generado por código (sin archivos de audio): música por mapa, voces de gorila, ambiente, motores rivales y vibración.
- **Idiomas**: español e inglés (Ajustes → Idioma).

## Controles

| Acción | Móvil | Teclado | Mando |
| --- | --- | --- | --- |
| Girar | ◀ ▶ o inclinar el móvil | Flechas / A-D | Palanca o cruceta |
| Derrape / truco en el aire / salida turbo / subir con el ala delta | DERRAPE | Espacio | A |
| Usar objeto (sin objeto, toca la bocina) | OBJETO o tocar la casilla | E / Mayús | X / RB |
| Frenar / bajar con el ala delta | FRENO | Flecha abajo / S | B / LT |
| Bocina | — | H | Y |
| Pausa | ❚❚ | P / Esc | Start |

El coche acelera solo. En los menús, con el mando, A acepta y B vuelve atrás.

## Probarlo en el ordenador

No necesita compilación. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

## Publicarlo e instalarlo en el móvil

1. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, elige la rama y la carpeta `/ (root)`.
2. Abre en el móvil la dirección `https://<usuario>.github.io/<repositorio>/`.
3. **Android (Chrome)**: botón “Instalar juego” del menú, o menú ⋮ → “Añadir a pantalla de inicio”.
   **iPhone (Safari)**: Compartir → “Añadir a pantalla de inicio”.

Tras abrirlo una vez con conexión, el juego queda guardado y se puede jugar offline.

El APK de Android se compila solo en GitHub Actions cada vez que cambia el juego; los detalles están en [docs/APK.md](docs/APK.md).
Instalado (como app de Android o desde el navegador), el juego se abre siempre en horizontal y a pantalla completa.

Para publicarlo en **Google Play**, la guía paso a paso es [docs/PLAY_STORE.md](docs/PLAY_STORE.md): la misma compilación fabrica la versión
firmada (AAB) cuando el repositorio tiene las claves del dueño. Los textos y gráficos de la ficha están en [`store/`](store/) y la
política de privacidad, en [`privacy.html`](privacy.html).

## Estructura

- `index.html`, `css/style.css`, `css/custom.css`, `css/share.css` — interfaz y HUD.
- `js/main.js` — menús, HUD, ajustes, repetición, modo foto y bucle principal.
- `js/race.js` — física, IA, power-ups, cámara, rival y fantasma.
- `js/extras.js` — atajos, corrientes y control de altura del ala delta.
- `js/variants.js` — hora del día (atardecer, noche) y generador del circuito sorpresa. `js/daily.js` — reto diario. `js/boss.js` — jefes.
- `js/rules.js` — reglas de Eliminación, Batalla de globos, Fiebre del plátano y Acrobacias. `js/replay.js` — grabación y repetición.
- `js/share.js`, `js/challenge.js` — retos entre amigos (código y enlace) y vídeo de la repetición. `js/emotes.js` — gestos sobre el coche.
- `js/track.js` — trazado con desnivel, terreno, cielo, agua/lava y elementos de pista (también en espejo e inverso).
- `js/scenery.js` — túnel, gradas, banderas, vallas, farolas, fauna y monumentos.
- `js/world.js` — clima, obstáculos vivos, ambiente submarino, marcas de derrape y estelas.
- `js/showroom.js` — escenario del menú y el garaje. `js/podium.js` — escena de podio.
- `js/post.js` — resplandor (bloom). `js/outline.js` — contorno cómic.
- `js/models.js`, `js/fx.js` — modelos 3D y partículas.
- `js/meta.js` — misiones, logros y estadísticas. `js/shop.js` — mejoras y tienda. `js/tutorial.js` — tutorial.
- `js/i18n.js`, `js/lang_en.js`, `js/lang_en_*.js` — idiomas: el código escribe en español y la página se traduce sola al inglés.
- `js/audio.js`, `js/input.js`, `js/save.js`, `js/data.js` — sonido, controles (táctil, teclado y mando), guardado (y copia de seguridad) y datos.
- `sw.js`, `manifest.webmanifest`, `icons/` — instalación y modo sin conexión.
- `scripts/`, `capacitor.config.json`, `package.json`, `.github/workflows/android-apk.yml` — empaquetado del APK y de la versión para Google Play.
- `store/`, `privacy.html`, `docs/` — ficha de la tienda (textos, gráficos y capturas), política de privacidad y guías.
- `js/vendor/three.module.min.js` — Three.js (licencia MIT).

Si cambias archivos, sube el número de `VERSION` en `sw.js` para que los móviles reciban la actualización.
Si añades archivos, inclúyelos también en la lista `FILES` de `sw.js` para que funcionen sin conexión.
Para añadir un texto nuevo en inglés, añade su traducción en `js/lang_en.js` (la clave es el texto en español).
