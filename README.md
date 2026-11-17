# 🦍 Amazing Gorilla Racing

Juego de carreras arcade en 3D para móvil: gorilas al volante, colores vivos y power-ups.
Es una **PWA**: se instala desde el navegador y después funciona **sin conexión**.

## Qué incluye

- **6 mapas** en 2 copas: Selva Esmeralda, Playa Coco, Volcán Furioso, Cumbre Helada, Ciudad Neón y Templo Arcoíris.
  Todos tienen cuestas, un puente, un túnel y rampas de salto.
- **5 rivales con IA** (esquivan, usan objetos, hacen trucos y se adaptan a la dificultad: Fácil / Normal / Difícil).
- **9 power-ups**: Turbo Plátano, Coco Misil, Cáscara, Escudo Hoja, Golpe de Pecho, Furia Gorila, Rayo (encoge a los rivales),
  Imán de Plátanos y Barril Rodante.
- **Conducción**: derrape con mini-turbo de 3 niveles, salida turbo, trucos en el aire, aceleradores y plátanos.
- **Obstáculos vivos** por mapa: barriles, cangrejos, géiseres de lava, pingüinos, robots y estrellas saltarinas.
- **Clima**: chubascos con rayos en la selva, ventisca en la cumbre, meteoritos en el volcán y estrellas fugaces en el templo.
- **Modos**: Carrera rápida, Copas (con trofeos y podio) y Contrarreloj con fantasma de tu mejor tiempo.
- **Garaje**: 6 gorilas y 5 coches con estadísticas distintas, y pintura para el coche.
- **Gráficos**: resplandor (bloom), sombras reales, agua y lava animadas, público, vallas, banderas, marcas de derrape y estelas.
  Tres niveles de calidad y opciones para desactivar resplandor y sombras en móviles modestos.
- **Sonido** generado por código (sin archivos de audio): música por mapa, voces de gorila, ambiente, motores rivales y vibración.

## Controles

| Acción | Móvil | Teclado |
| --- | --- | --- |
| Girar | ◀ ▶ o inclinar el móvil | Flechas / A-D |
| Derrape / truco en el aire / salida turbo | DERRAPE | Espacio |
| Usar objeto | OBJETO o tocar la casilla | E / Mayús |
| Frenar | FRENO | Flecha abajo / S |
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

## Estructura

- `index.html`, `css/style.css` — interfaz y HUD.
- `js/main.js` — menús, HUD, ajustes y bucle principal.
- `js/race.js` — física, IA, power-ups, cámara y fantasma.
- `js/track.js` — trazado con desnivel, terreno, agua/lava y elementos de pista.
- `js/scenery.js` — túnel, gradas, banderas, vallas, farolas y fauna.
- `js/world.js` — clima, obstáculos vivos, marcas de derrape y estelas.
- `js/post.js` — resplandor (bloom). `js/podium.js` — escena de podio.
- `js/models.js`, `js/fx.js` — modelos 3D y partículas.
- `js/audio.js`, `js/input.js`, `js/save.js`, `js/data.js` — sonido, controles, guardado y datos.
- `sw.js`, `manifest.webmanifest`, `icons/` — instalación y modo sin conexión.
- `js/vendor/three.module.min.js` — Three.js (licencia MIT).

Si cambias archivos, sube el número de `VERSION` en `sw.js` para que los móviles reciban la actualización.
