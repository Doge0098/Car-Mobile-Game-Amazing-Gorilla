# 🦍 Amazing Gorilla Racing

Juego de carreras arcade en 3D para móvil: gorilas al volante, colores vivos y power-ups.
Es una **PWA**: se instala desde el navegador y después funciona **sin conexión**.

## Qué incluye

- **6 mapas** en 2 copas: Selva Esmeralda, Playa Coco, Volcán Furioso, Cumbre Helada, Ciudad Neón y Templo Arcoíris.
- **5 rivales con IA** (esquivan, usan objetos y se adaptan a la dificultad: Fácil / Normal / Difícil).
- **6 power-ups**: Turbo Plátano, Coco Misil, Cáscara, Escudo Hoja, Golpe de Pecho y Furia Gorila.
- **Derrape con mini-turbo** de 3 niveles, aceleradores en pista y plátanos para coger.
- **Modos**: Carrera rápida, Copas (con trofeos) y Contrarreloj con fantasma de tu mejor vuelta.
- **Garaje**: 6 gorilas y 5 coches con estadísticas distintas, y pintura para el coche.
- Música y efectos generados por código (no hay archivos de audio), controles táctiles o por inclinación.

## Controles

| Acción | Móvil | Teclado |
| --- | --- | --- |
| Girar | ◀ ▶ o inclinar el móvil | Flechas / A-D |
| Derrape | DERRAPE (mantener y soltar) | Espacio |
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
- `js/main.js` — menús, HUD y bucle principal.
- `js/race.js` — física, IA, power-ups, cámara y fantasma.
- `js/track.js` — generación de circuitos y decorado.
- `js/models.js`, `js/fx.js` — modelos 3D y partículas.
- `js/audio.js`, `js/input.js`, `js/save.js`, `js/data.js` — sonido, controles, guardado y datos.
- `sw.js`, `manifest.webmanifest`, `icons/` — instalación y modo sin conexión.
- `js/vendor/three.module.min.js` — Three.js (licencia MIT).

Si cambias archivos, sube el número de `VERSION` en `sw.js` para que los móviles reciban la actualización.
