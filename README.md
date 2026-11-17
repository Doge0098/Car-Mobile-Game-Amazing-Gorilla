# 🦍 Amazing Gorilla Racing

Juego de carreras arcade en 3D para móvil: gorilas al volante, colores vivos y power-ups.
Es una **PWA**: se instala desde el navegador y después funciona **sin conexión**. También se puede descargar como **APK de Android**.

- **Jugar en el navegador:** https://doge0098.github.io/Car-Mobile-Game-Amazing-Gorilla/
- **APK de Android:** [descargar la última compilación](https://github.com/Doge0098/Car-Mobile-Game-Amazing-Gorilla/releases/download/apk-latest/amazing-gorilla-racing.apk) · [cómo instalarlo](docs/APK.md)

## Qué incluye

- **9 mapas** en 3 copas:
  - *Copa Plátano*: Selva Esmeralda, Playa Coco y Volcán Furioso.
  - *Copa Diamante*: Cumbre Helada, Ciudad Neón y Templo Arcoíris.
  - *Copa Aventura*: Reino de las Nubes (casi todo en ala delta), Mar Abierto (en barco) y Fondo Marino (en submarino).

  Cada copa se desbloquea ganando un trofeo en la anterior. Los mapas tienen cuestas, puente, túnel, rampas de salto y monumentos propios.
- **Coche que se transforma** en barco, ala delta o submarino según el tramo, con aros de impulso.
  Con el ala delta, DERRAPE sube y FRENO baja: los aros están a distinta altura. En el agua hay corrientes que empujan.
- **Atajos**: un trampolín verde en el arcén de algunas curvas lanza el coche por encima. Los rivales también los usan.
- **Modos de juego**
  - Carrera rápida, Copas (con trofeos y podio) y Contrarreloj con el fantasma de tu mejor tiempo.
  - **Eliminación**: cada pocos segundos el último queda fuera.
  - **Batalla de globos** en una arena: cada golpe revienta un globo y gana quien conserve más.
  - Todos los circuitos se pueden correr en **espejo** o en sentido **inverso**.
- **5 rivales con IA** (esquivan, usan objetos, hacen trucos y se adaptan a la dificultad: Fácil / Normal / Difícil) y un
  **rival personal** que te reta en cada carrera y ajusta su nivel al tuyo. Acabar por delante da premio extra.
- **9 power-ups**: Turbo Plátano, Coco Misil, Cáscara, Escudo Hoja, Golpe de Pecho, Furia Gorila, Rayo (encoge a los rivales),
  Imán de Plátanos y Barril Rodante.
- **Conducción**: derrape con mini-turbo de 3 niveles, salida turbo, trucos en el aire, aceleradores y plátanos.
- **Progresión**: misiones en cada carrera, logros, estadísticas de por vida y un **tutorial** guiado.
- **Garaje**: 8 gorilas, 7 coches temáticos, pintura, **mejoras** de motor, neumáticos y turbo, y una tienda de
  sombreros, ruedas, estelas y bocinas.
- **Repetición** de la carrera con cámaras de cine y **modo foto** desde la pausa.
- **Obstáculos vivos** por mapa (barriles, cangrejos, géiseres de lava, pingüinos, robots, estrellas) y **clima**
  (chubascos con rayos, ventisca, meteoritos, estrellas fugaces).
- **Gráficos estilo cómic**: contorno oscuro, resplandor (bloom), sombras reales, cielo con nubes, montañas iluminadas,
  agua con oleaje, reflejos y espuma en la orilla. La **calidad automática** baja sola los efectos si el móvil va justo.
- **Controles configurables**: tamaño y opacidad de los botones, modo zurdo o dirección inclinando el móvil.
- **Sonido** generado por código (sin archivos de audio): música por mapa, voces de gorila, ambiente, motores rivales y vibración.
- **Idiomas**: español e inglés (Ajustes → Idioma).

## Controles

| Acción | Móvil | Teclado |
| --- | --- | --- |
| Girar | ◀ ▶ o inclinar el móvil | Flechas / A-D |
| Derrape / truco en el aire / salida turbo / subir con el ala delta | DERRAPE | Espacio |
| Usar objeto (sin objeto, toca la bocina) | OBJETO o tocar la casilla | E / Mayús |
| Frenar / bajar con el ala delta | FRENO | Flecha abajo / S |
| Bocina | — | H |
| Pausa | ❚❚ | P / Esc |

El coche acelera solo.

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

- `index.html`, `css/style.css` — interfaz y HUD.
- `js/main.js` — menús, HUD, ajustes, repetición, modo foto y bucle principal.
- `js/race.js` — física, IA, power-ups, cámara, rival y fantasma.
- `js/extras.js` — atajos, corrientes y control de altura del ala delta.
- `js/rules.js` — reglas de Eliminación y Batalla de globos. `js/replay.js` — grabación y repetición.
- `js/track.js` — trazado con desnivel, terreno, cielo, agua/lava y elementos de pista (también en espejo e inverso).
- `js/scenery.js` — túnel, gradas, banderas, vallas, farolas, fauna y monumentos.
- `js/world.js` — clima, obstáculos vivos, ambiente submarino, marcas de derrape y estelas.
- `js/showroom.js` — escenario del menú y el garaje. `js/podium.js` — escena de podio.
- `js/post.js` — resplandor (bloom). `js/outline.js` — contorno cómic.
- `js/models.js`, `js/fx.js` — modelos 3D y partículas.
- `js/meta.js` — misiones, logros y estadísticas. `js/shop.js` — mejoras y tienda. `js/tutorial.js` — tutorial.
- `js/i18n.js`, `js/lang_en.js` — idiomas: el código escribe en español y la página se traduce sola al inglés.
- `js/audio.js`, `js/input.js`, `js/save.js`, `js/data.js` — sonido, controles, guardado y datos.
- `sw.js`, `manifest.webmanifest`, `icons/` — instalación y modo sin conexión.
- `scripts/`, `capacitor.config.json`, `package.json`, `.github/workflows/android-apk.yml` — empaquetado del APK.
- `js/vendor/three.module.min.js` — Three.js (licencia MIT).

Si cambias archivos, sube el número de `VERSION` en `sw.js` para que los móviles reciban la actualización.
Para añadir un texto nuevo en inglés, añade su traducción en `js/lang_en.js` (la clave es el texto en español).
