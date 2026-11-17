# Ficha de Google Play en español

Textos para copiar y pegar en la **ficha de Play Store principal** de Play Console (en el menú, dentro de
«Presencia en Google Play Store»; Google cambia de vez en cuando los nombres de los menús).
Sirven tal cual para los idiomas «Español (España) – es-ES» y «Español (Latinoamérica) – es-419».
La versión en inglés está en [listing-en.md](listing-en.md) y los pasos, en [docs/PLAY_STORE.md](../docs/PLAY_STORE.md).

Cada texto va dentro de un recuadro: copia solo lo de dentro. Debajo de cada uno pone cuántos caracteres
ocupa y cuántos admite Google Play. Si cambias un texto, vuelve a contar con:

```bash
node store/source/check-listings.mjs
```

Los textos solo cuentan cosas que el juego tiene de verdad. Si se añade o se quita algo del juego, hay que
repasarlos: Google Play retira fichas que prometen lo que la app no hace.

## Nombre de la app

```text
Amazing Gorilla Racing
```

22 de 30 caracteres.

El nombre es el mismo en todos los idiomas. No le añadas palabras como «gratis», «mejor» o «n.º 1», ni
emojis: Google Play no las admite en el nombre.

## Descripción breve

```text
Carreras de karts en 3D con gorilas: derrapa, lanza cocos y gana todas las copas
```

80 de 80 caracteres.

## Descripción completa

```text
¡Agarra el volante, que vienen los gorilas!

Amazing Gorilla Racing es un juego de carreras de karts en 3D, rápido y lleno de color, hecho para el móvil. Elige tu gorila, derrapa en las curvas, lanza un coco al que va delante y cruza la meta antes que nadie. Funciona sin conexión y no tiene anuncios ni compras.

KARTS QUE SE TRANSFORMAN
Tu kart no se queda en el asfalto: según el tramo se convierte en barco, en ala delta o en submarino. Navega entre corrientes, planea de aro en aro por encima de las nubes y bucea por el fondo del mar.

CIRCUITOS Y COPAS
• Circuitos agrupados en copas: selva, playa, volcán, hielo, ciudad de neón, nubes, mar abierto, fondo marino, desierto, fábrica de juguetes y una estación espacial con poca gravedad.
• Cada copa se desbloquea ganando un trofeo en la anterior.
• Atajos, rampas de salto, aceleradores y obstáculos vivos en cada circuito.
• Clima que cambia la carrera: chubascos, ventiscas, meteoritos.
• Todos los circuitos se pueden correr también en espejo y en sentido inverso, de día, al atardecer o de noche.
• Circuito sorpresa: un trazado nuevo generado al azar cada vez.

MODOS DE JUEGO
• Carrera rápida: elige circuito y a correr.
• Copas: varias carreras seguidas, con podio y trofeos.
• Contrarreloj: bate tu mejor tiempo contra tu propio fantasma y gana medallas de bronce, plata y oro.
• Eliminación: cada pocos segundos, el último queda fuera.
• Acrobacias: gana quien sume más puntos con trucos y derrapes.
• Batalla de globos y Fiebre del plátano en tres arenas.
• Duelos contra jefes gigantes y un reto distinto cada día.

CONDUCCIÓN ARCADE
• Derrapes con mini-turbo: cuanto más aguantas el derrape, más impulso.
• Salida turbo, trucos en el aire y rebufo para adelantar.
• Power-ups para atacar y defenderte: turbos, cocos, cáscaras de plátano, escudos, rayos, barriles y más.
• Rivales controlados por el juego, con varios niveles de dificultad.
• Un rival personal que te reta en cada carrera y se adapta a tu nivel.

TU GARAJE
• Desbloquea gorilas y karts con los plátanos que ganas corriendo.
• Mejora el motor, los neumáticos y el turbo.
• Personaliza tu kart con pintura, sombreros, ruedas, estelas, bocinas y pegatinas, y elige tu baile de victoria.

SIEMPRE HAY ALGO QUE HACER
• Misiones en cada carrera y logros por conseguir.
• Tutorial guiado para aprender a conducir y a derrapar.
• Repetición de la carrera con cámaras de cine y modo foto.
• Reta a tus amigos: envíales un enlace con tu tiempo y correrán contra tu fantasma.

HECHO PARA EL MÓVIL
• Se juega con el móvil en horizontal.
• El kart acelera solo: tú giras, derrapas y usas los objetos.
• Controles a tu gusto: tamaño y opacidad de los botones, modo para zurdos o dirección inclinando el móvil.
• También se puede jugar con mando.
• La calidad gráfica se ajusta sola a tu móvil.
• En español y en inglés.

SIN LETRA PEQUEÑA
• Sin anuncios.
• Sin compras: todo se desbloquea jugando.
• Sin cuentas ni registros.
• No recoge ningún dato. Tu partida se guarda solo en tu dispositivo.
• Funciona sin conexión a Internet.

Tres, dos, uno… ¡a correr!
```

3080 de 4000 caracteres.

## Novedades de la versión

Es el texto «Notas de la versión» que se escribe al crear cada versión en Play Console. Para la primera:

```text
Primera versión de Amazing Gorilla Racing:
• Carreras de karts en 3D con gorilas.
• Karts que se transforman en barco, ala delta y submarino.
• Carrera rápida, copas, contrarreloj, eliminación, acrobacias, batalla de globos y jefes.
• Garaje con gorilas, karts, mejoras y accesorios.
• En español e inglés, sin anuncios y sin conexión.
```

335 de 500 caracteres.

En las siguientes versiones, cuenta en dos o tres líneas lo que cambia de verdad para quien juega
(«Circuitos nuevos», «Corregido un fallo al…»). En Play Console se pega dentro de las etiquetas del idioma,
por ejemplo entre `<es-ES>` y `</es-ES>`.

## Categoría y etiquetas

En Play Console, en **Configuración de la tienda** (junto a la ficha de Play Store):

| Campo | Qué elegir |
| --- | --- |
| Tipo de aplicación | Juego |
| Categoría | Carreras |
| Etiquetas | Hasta cinco, de la lista que ofrece Google. Las que mejor describen el juego: **Carreras**, **Carreras de karts**, **Arcade**, **Casual**, **Un jugador**, **Sin conexión**. Elige las que existan en la lista; si no aparece alguna, déjala. |

No elijas etiquetas de cosas que el juego no tiene (multijugador, mundo abierto, simulación…).

## Gráficos

| Qué pide Google Play | Archivo |
| --- | --- |
| Icono de la app, 512 × 512, PNG de 32 bits | [graphics/icon-512.png](graphics/icon-512.png) |
| Gráfico de funciones, 1024 × 500, PNG de 24 bits sin transparencia | [graphics/feature-graphic-1024x500.png](graphics/feature-graphic-1024x500.png) |
| Capturas de pantalla | Carpeta `screenshots/` (medidas en [docs/PLAY_STORE.md](../docs/PLAY_STORE.md#capturas-de-pantalla)) |

Los dos gráficos se generan con `store/source/render.mjs` a partir del dibujo de `store/source/art.js`.
Sirven para todos los idiomas: el único texto que llevan es el nombre del juego.
