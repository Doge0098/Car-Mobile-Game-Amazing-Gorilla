# Publicar el juego en Google Play

Esta guía lleva **Amazing Gorilla Racing** desde este repositorio hasta Google Play, paso a paso y **solo con
el móvil y el navegador**. No hace falta ordenador ni instalar Android Studio.

- Para instalar el juego sin pasar por Google Play (el APK de pruebas), la guía es [APK.md](APK.md).
- Google cambia de vez en cuando los nombres de los menús de Play Console. Si uno no coincide con lo que
  pone aquí, busca el que más se parezca: el orden de los pasos no cambia.
- Lo que dice esta guía sobre las normas de Google se comprobó el **17 de noviembre de 2026**
  (al final está [qué se comprobó y dónde](#datos-comprobados-y-fecha)).

## Antes de empezar: qué cuesta, cuánto tarda y qué solo puedes hacer tú

| Paso | Cuesta | Tarda | Quién lo hace |
| --- | --- | --- | --- |
| Cuenta de desarrollador de Google Play | **25 USD, una sola vez** (con tarjeta) | Unos minutos, más la verificación de tu identidad: de unas horas a varios días | **Solo tú**: pide tu documento de identidad y tus datos |
| Clave de subida y secretos de GitHub | Nada | Media hora | Tú, con los comandos de esta guía |
| Fabricar la versión para Play (AAB) | Nada | Unos 10 minutos cada vez | GitHub, solo |
| Formularios y ficha de la tienda | Nada | Una o dos horas | Tú. Los textos y los gráficos ya están en [`store/`](../store/) |
| **Prueba cerrada** | Nada | **Mínimo 14 días seguidos**, y necesitas **12 personas** | Tú y 12 personas con móvil Android |
| Permiso para publicar («acceso a producción») | Nada | Normalmente 7 días o menos | Google |
| Revisión de la app | Nada | De unas horas a varios días | Google |

Cuenta con **entre tres y cinco semanas** desde que pagas la cuenta hasta que el juego aparece en la
tienda. Casi todo ese tiempo es esperar: la prueba cerrada de 14 días es obligatoria para las cuentas
personales nuevas y no se puede acortar.

Lo que **ya está hecho** y no tienes que tocar:

- El juego está fijado en **horizontal** y a **pantalla completa**, tanto en la app de Android como instalado
  desde el navegador.
- La app cumple la versión de Android que exige Google Play: desde el 31 de agosto de 2026 hay que apuntar
  a **Android 16 (API 36)**, y la app apunta a la API 36.
- GitHub fabrica solo el archivo que pide Google Play (un **AAB**) en cuanto existan tus claves.
- Los textos de la ficha en español y en inglés, el icono, el gráfico de funciones y la
  [política de privacidad](../privacy.html).

Lo que **falta** y depende de ti: la cuenta, la clave, tu correo de contacto en la política de privacidad,
las capturas de pantalla, los formularios y las 12 personas de la prueba.

## Paso 1. Crea tu cuenta de desarrollador

1. Abre <https://play.google.com/console/signup> en Chrome, con la cuenta de Google que quieras usar para
   publicar. Esa cuenta necesita la verificación en dos pasos activada.
2. Elige el tipo de cuenta **personal** (la de «organización» es para empresas y pide un número D-U-N-S).
3. Rellena tus datos: nombre y dirección legales, correo y teléfono de contacto, y un
   **nombre de desarrollador**, que es el que se ve en la tienda y no tiene por qué ser tu nombre real.
4. Paga la cuota de registro: **25 USD una sola vez**. No hay cuota anual.
5. **Verifica tu identidad** subiendo una foto de tu documento. Los datos tienen que coincidir exactamente
   con los que has escrito. Google tarda de unas horas a varios días en aprobarlo.
6. **Verifica tu dispositivo**: instala desde Google Play la app **Google Play Console** en tu móvil
   (Android 10 o superior, sin *root*), inicia sesión y sigue lo que pide. Es obligatorio en las cuentas
   personales nuevas. Después verifica el teléfono y el correo con los códigos que te envía.

Dos cosas que conviene saber antes de aceptar:

- **Parte de tus datos será pública.** En la ficha del juego se ve el nombre de desarrollador y un correo
  de contacto, y según el país y el tipo de cuenta puede verse algo más (por ejemplo, tu país). El
  formulario marca qué será público: léelo. Crea un correo solo para el juego en vez de usar el personal.
- Con la cuenta de Play quedas registrado también en la **verificación de desarrolladores de Android**, que
  Google está activando por países (cuatro desde el 30 de septiembre de 2026, el resto del mundo a partir
  de 2027). No tienes que hacer nada más.

Play Console está pensada para pantallas grandes. En el móvil funciona mejor con Chrome, el móvil en
horizontal y, si una página se ve cortada, el menú **⋮ → Vista ordenador**.

## Paso 2. Crea tu clave de subida (sin ordenador)

### Qué es y por qué importa

Google Play solo acepta una versión del juego si va **firmada con tu clave**. Así sabe que la subes tú.
Esa clave es un archivo pequeño protegido con una contraseña.

Con el sistema que usa Google hoy («firma de apps de Play») hay dos claves:

- La **clave de firma de la app**, la definitiva. La crea y la guarda Google. Tú nunca la tienes.
- Tu **clave de subida**, que es la que vas a crear ahora. Solo sirve para subir versiones a tu cuenta.

Por eso perder la clave de subida no es una catástrofe: se puede pedir a Google que la sustituya por otra
(tarda unos días). Aun así, trátala como la llave de tu casa.

> **Este repositorio es público. La clave y su contraseña no pueden aparecer en él jamás:** ni en un
> archivo, ni en un comentario, ni en una incidencia, ni en una captura de pantalla. Lo que se sube a un
> repositorio público se queda en su historial aunque luego se borre. Tampoco se las envíes a nadie ni se
> las pegues a un asistente de inteligencia artificial.
>
> Solo hay dos sitios donde pueden estar: los **secretos** de GitHub (paso 3) y tu **gestor de contraseñas**.

### Cómo crearla desde el móvil

Hace falta un terminal durante cinco minutos. GitHub presta uno gratis dentro del navegador: se llama
**Codespace**. Las cuentas personales tienen cada mes un cupo gratuito de sobra para esto y no hace falta
tarjeta.

1. **Decide la contraseña antes de empezar** y guárdala ya en tu gestor de contraseñas (el de Google sirve).
   Que tenga 16 caracteres o más, solo letras sin tilde y números, sin espacios.
2. Con tu sesión de GitHub iniciada, abre <https://github.com/codespaces>. En el apartado de plantillas
   (*Explore quick start templates*), toca **Use this template** en la plantilla **Blank**. Si no la ves,
   está también en <https://github.com/codespaces/templates>.
   Es un espacio en blanco que no tiene nada que ver con este repositorio: así es imposible subir la clave
   al repositorio por error. No uses en él el botón **Publish to GitHub**.
3. Se abre un editor (Visual Studio Code) dentro del navegador. Pon el móvil en horizontal. Abajo hay un
   panel llamado **Terminal**; si no está, ábrelo con el menú **☰ → Terminal → New Terminal**.
4. Copia esta línea, pégala en el terminal (mantén el dedo sobre el terminal y elige **Pegar**) y pulsa
   Intro:

   ```bash
   mkdir -p ~/clave && cd ~/clave && keytool -genkeypair -v -storetype PKCS12 -keystore upload-keystore.p12 -alias agrplay -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Amazing Gorilla Racing"
   ```

   Te pide la contraseña dos veces (`Enter keystore password` y `Re-enter new password`). **Mientras la
   escribes no se ve nada en pantalla**: es normal. Al terminar pone `[Storing upload-keystore.p12]`.

   Si responde `keytool: command not found`, ejecuta primero
   `sudo apt-get update && sudo apt-get install -y default-jre-headless` y repite.
5. Comprueba la clave y apunta su huella:

   ```bash
   keytool -list -keystore upload-keystore.p12 -alias agrplay
   ```

   Pide la contraseña y enseña una línea que acaba en `Certificate fingerprint (SHA-256): 4A:…`. Esa
   **huella** no es secreta. Apúntala: más adelante tiene que salir la misma en GitHub y en Play Console.
6. Convierte el archivo en texto, que es como lo guarda GitHub:

   ```bash
   base64 -w0 upload-keystore.p12 > upload-keystore.txt && code upload-keystore.txt
   ```

   Se abre una pestaña con una sola línea larguísima de letras y números. **Ese texto es tu clave.**
7. Cópialo entero: menú **☰ → Selection → Select All** y después **☰ → Edit → Copy**.
8. Sin cerrar esta pestaña, sigue con el paso 3 en otra pestaña del navegador.

¿No consigues copiar el texto en el móvil? Usa el [plan B](#plan-b-guardar-los-secretos-desde-el-terminal),
que no necesita copiar nada.

Este es el único paso incómodo en un móvil: el editor está pensado para pantallas grandes y los menús
quedan pequeños. Si se te resiste, se puede hacer exactamente igual desde el navegador de una tableta o de
un ordenador prestado: todo pasa dentro de tu cuenta de GitHub y en ese aparato no queda nada instalado
(cierra la sesión de GitHub al terminar).

## Paso 3. Guarda la clave en los secretos del repositorio

Los **secretos** son una caja fuerte de GitHub: se pueden escribir y cambiar, pero **nadie puede volver a
leerlos**, ni siquiera tú. La compilación los usa sin enseñarlos nunca.

1. Abre
   <https://github.com/Doge0098/Car-Mobile-Game-Amazing-Gorilla/settings/secrets/actions>
   (o entra en el repositorio → **Settings** → **Secrets and variables** → **Actions**).
2. Toca **New repository secret** y crea estos cuatro, uno por uno. El nombre va en **Name** y el valor en
   **Secret**:

   | Name (exacto, en mayúsculas) | Secret |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | El texto larguísimo que acabas de copiar |
   | `ANDROID_KEYSTORE_PASSWORD` | La contraseña de la clave |
   | `ANDROID_KEY_ALIAS` | `agrplay` |
   | `ANDROID_KEY_PASSWORD` | La misma contraseña otra vez |

   No dejes espacios ni saltos de línea al final de la contraseña ni de `agrplay`.
3. Al terminar, la lista tiene que enseñar los cuatro nombres.
4. **Copia de seguridad (recomendada):** guarda también el texto larguísimo en tu gestor de contraseñas,
   como nota segura, junto a la contraseña. Con ese texto y la contraseña se puede reconstruir la clave.
   Si no la guardas y algún día se pierden los secretos, tendrás que pedir a Google una clave de subida
   nueva ([cómo](#si-pierdes-la-clave-o-crees-que-alguien-la-tiene)).
5. **Borra el Codespace**: abre <https://github.com/codespaces>, toca **⋯** junto al tuyo y elige
   **Delete**. Con él desaparece la copia de la clave que quedaba allí.

### Plan B: guardar los secretos desde el terminal

Si no pudiste copiar el texto, haz que el propio terminal del Codespace guarde los secretos. Sigue en el
terminal del paso 2:

1. Da permiso al terminal para escribir en tus repositorios:

   ```bash
   unset GITHUB_TOKEN GH_TOKEN && gh auth login --hostname github.com --git-protocol https --web
   ```

   Enseña un código de ocho caracteres (`XXXX-XXXX`). Apúntalo, pulsa Intro, abre
   <https://github.com/login/device> en otra pestaña, escribe el código y acepta. Si antes pregunta
   `Authenticate Git with your GitHub credentials?`, pulsa Intro.
2. Guarda los cuatro secretos, una línea cada vez:

   ```bash
   cd ~/clave
   gh secret set ANDROID_KEYSTORE_BASE64 --repo Doge0098/Car-Mobile-Game-Amazing-Gorilla < upload-keystore.txt
   gh secret set ANDROID_KEY_ALIAS --repo Doge0098/Car-Mobile-Game-Amazing-Gorilla --body agrplay
   gh secret set ANDROID_KEYSTORE_PASSWORD --repo Doge0098/Car-Mobile-Game-Amazing-Gorilla
   gh secret set ANDROID_KEY_PASSWORD --repo Doge0098/Car-Mobile-Game-Amazing-Gorilla
   ```

   Las dos últimas preguntan `Paste your secret`: escribe la contraseña (no se ve) y pulsa Intro.
3. Cierra la sesión del terminal con `gh auth logout --hostname github.com`, comprueba en la página de
   secretos que están los cuatro y borra el Codespace como en el punto 5 de arriba.

Con este plan no te quedas con copia de la clave. No pasa nada: si algún día hiciera falta, se pide una
clave de subida nueva a Google.

## Paso 4. Fabrica la versión para Play y descárgala

1. Abre <https://github.com/Doge0098/Car-Mobile-Game-Amazing-Gorilla/actions/workflows/android-apk.yml>,
   toca **Run workflow**, elige la rama principal y toca el botón verde **Run workflow**
   (si no ves el botón, mira [APK.md](APK.md#lanzar-una-compilación-a-mano-desde-el-móvil)).
2. Espera unos 10 minutos y abre la ejecución. Tiene dos trabajos: **Compilar APK** (el de pruebas, como
   siempre) y **Compilar versión para Google Play**.
3. Cuando los dos estén en verde, baja en esa página hasta el recuadro
   **«Versión para Google Play lista»**. Ahí están:
   - el enlace al archivo **`.aab`**, que es el que se sube a Play Console;
   - el enlace a un **`.apk`** de esa misma versión, por si quieres probarla antes en tu móvil;
   - la **huella SHA-256** de tu clave: tiene que ser la que apuntaste en el paso 2.

   Los mismos archivos están al final de la página, en **Artifacts**. Se descargan tal cual, sin `.zip`.
4. Toca el `.aab` para descargarlo. Se queda en la carpeta Descargas del móvil.

Qué conviene saber:

- **Cada ejecución lleva un número de versión nuevo** (`1.0.N`), y Google Play no admite repetir número.
  Para sacar otra versión, lanza una ejecución nueva con **Run workflow**. No uses **Re-run jobs** para
  eso: repite el mismo número.
- Los archivos se guardan **30 días**. Pasado ese tiempo, lanza otra ejecución.
- Si el recuadro dice **«Ensayo de la versión para Google Play»**, es que faltan los secretos: sin ellos
  solo se comprueba que la compilación funciona y no se guarda ningún archivo.
- El `.apk` de publicación **no se puede instalar encima del APK de pruebas** (llevan firmas distintas).
  Hay que desinstalar antes el de pruebas, y con él se borra su partida guardada.
- Estos archivos no se publican en la release pública `apk-latest`, que sigue siendo solo para el APK de
  pruebas. Los puede descargar desde la página de la ejecución cualquiera con sesión iniciada en GitHub,
  y no es un problema: llevan tu firma pero **no tu clave**. Es el mismo juego que estará en la tienda.

Si el trabajo de Google Play sale en rojo, mira [Si algo falla](#si-algo-falla). El APK de pruebas no se
ve afectado.

## Paso 5. Pon tu correo en la política de privacidad

Google exige una política de privacidad con una forma de contacto. La página ya está escrita, en español
y en inglés, pero le falta tu correo.

1. Abre [`privacy.html`](../privacy.html) en GitHub, toca el lápiz (**Edit this file**) y busca
   `[CORREO-DE-CONTACTO-PENDIENTE]`. Aparece **dos veces**: una en la parte en español y otra en la parte
   en inglés.
2. Sustituye las dos por tu correo de contacto (mejor el que creaste para el juego) y toca
   **Commit changes**.
3. Pasados unos minutos, comprueba que se ve bien en
   <https://doge0098.github.io/Car-Mobile-Game-Amazing-Gorilla/privacy.html>. **Esa es la dirección que
   pide Play Console.**

Dos avisos:

- Google pide además que la política se pueda abrir **desde dentro del juego**. Comprueba que en los
  ajustes del juego hay un enlace a «Privacidad»; si no lo hay, pídeselo a quien mantiene el código antes
  de enviar el juego a revisión.
- Lo que dice la página es verdad hoy: el juego no recoge datos. Si algún día se le añaden anuncios,
  cuentas, estadísticas o marcadores en línea, hay que cambiar **a la vez** esta página y el formulario
  «Seguridad de los datos» del paso 8.

## Paso 6. Crea la app en Play Console

1. En <https://play.google.com/console>, toca **Crear aplicación**.
2. Rellena:
   - **Nombre de la app:** `Amazing Gorilla Racing`
   - **Idioma predeterminado:** el que verá quien no hable ninguno de los idiomas de la ficha. Lo más
     útil es **Inglés (Estados Unidos)** y añadir después el español como traducción.
   - **App o juego:** Juego.
   - **Gratis o de pago:** Gratis. (Una app gratis no se puede convertir después en de pago.)
3. Acepta las declaraciones y toca **Crear aplicación**.

El identificador interno del juego es `com.amazinggorilla.racing`. **Una vez subido el primer archivo no se
puede cambiar nunca.** Si Play Console dijera que ese identificador ya está cogido, no sigas: hay que
cambiarlo en `capacitor.config.json` (campo `appId`) y fabricar otra versión.

## Paso 7. Sube el AAB a la prueba interna

La prueba interna sirve para ver el juego instalado desde Google Play en tu propio móvil. No pasa
revisión y está disponible en minutos.

1. En el menú de la app: **Probar y publicar → Pruebas → Prueba interna → Crear versión**.
2. La primera vez aparece el apartado **Firma de aplicaciones de Play** (*Play App Signing*). Deja la
   opción por defecto: **Google genera y guarda la clave de firma de la app**. Acepta las condiciones.
3. En **App bundles**, toca **Subir** y elige el `.aab` de la carpeta Descargas.
4. En **Notas de la versión**, pega las de [`store/listing-es.md`](../store/listing-es.md) y
   [`store/listing-en.md`](../store/listing-en.md).
5. Toca **Siguiente**, y después **Guardar y publicar** (el botón puede llamarse «Iniciar lanzamiento»).
6. En la pestaña **Testers**, crea una lista con tu propio correo, copia el **enlace para unirse**, ábrelo
   en tu móvil, acepta e instala el juego desde Google Play. Si tienes el APK de pruebas, desinstálalo
   antes.
7. Comprueba la firma: en **Probar y publicar → Integridad de la app → Firma de aplicaciones de Play**
   aparece el **certificado de la clave de subida** con su huella SHA-256. Tiene que ser la del paso 2.

## Paso 8. Rellena «Contenido de la app»

Está en **Políticas y programas → Contenido de la app** (*App content*). Son varios formularios cortos.
Responde siempre la verdad: Google compara las respuestas con lo que hace la app.

| Formulario | Qué responder | Por qué |
| --- | --- | --- |
| **Política de privacidad** | `https://doge0098.github.io/Car-Mobile-Game-Amazing-Gorilla/privacy.html` | La del paso 5. |
| **Acceso a la app** | Todas las funciones están disponibles sin acceso especial | No hay cuentas ni zonas de pago. |
| **Anuncios** | No, mi app no contiene anuncios | No tiene. |
| **Clasificación de contenido** | Ver abajo | Cuestionario. |
| **Público objetivo y contenido** | Ver abajo | Es la decisión más importante de este paso. |
| **Seguridad de los datos** | Ver abajo | El juego no recoge datos. |
| **ID de publicidad** | No | No lo usa. |
| Apps gubernamentales, funciones financieras, salud, noticias | No / ninguna | No aplica. |

### Clasificación de contenido

Elige la categoría **Juego** y responde al cuestionario pensando en lo que se ve en una carrera:

- **Violencia:** hay golpes de dibujos animados (cocos, barriles y cáscaras que hacen girar a los karts).
  No hay sangre, ni heridas, ni armas reales, ni personas. Si el cuestionario lo pregunta, es violencia
  **leve, de dibujos animados o de fantasía**.
- **Miedo, sexo, lenguaje malsonante, drogas, alcohol, tabaco, apuestas:** no.
- **Los usuarios pueden comunicarse entre sí o compartir su ubicación:** no. El juego no tiene chat ni
  nada parecido. Si tiene un botón de compartir (un reto, una foto, un vídeo), lo que hace es abrir el menú
  de compartir del móvil: el contenido lo envía la app que elija el jugador, no el juego. Si alguna
  pregunta habla expresamente de compartir contenido con otras personas, responde según eso.
- **Compras dentro de la app:** no.

Lo normal es que salga una clasificación para todos los públicos (PEGI 3 o PEGI 7 en Europa).

### Público objetivo: qué implica decir que es para niños

Aquí eliges las edades a las que va dirigido el juego. Hay dos caminos:

**A. Incluir a menores de 13 años** (por ejemplo, de 6 a 8, de 9 a 12 y los grupos mayores). Es lo que
corresponde a un juego apto para niños. Al hacerlo, la app queda sujeta a la **política de Familias** de
Google Play, que exige:

- contenido apropiado para niños en el juego **y** en la ficha de la tienda;
- política de privacidad y formulario de datos exactos;
- no recoger datos personales ni identificadores del dispositivo de los niños;
- si hubiera anuncios, solo de redes certificadas por Google para familias y nunca personalizados;
- cumplir las leyes de protección de menores (COPPA en Estados Unidos, RGPD en Europa);
- si los jugadores pueden compartir o intercambiar información, declararlo y poner protecciones.

**Hoy el juego lo cumple**: no tiene anuncios, ni compras, ni cuentas, ni chat, y no recoge nada. A cambio:

- La revisión de Google es más estricta y puede tardar más.
- Te ata para el futuro: antes de añadir anuncios, estadísticas, cuentas, marcadores en línea o cualquier
  función para compartir, hay que comprobar que cumple esa política. Saltársela puede acabar con la app
  retirada de la tienda.
- Si el juego tiene un botón de compartir (retos, vídeos), decláralo en el cuestionario cuando pregunte
  por compartir información.

**B. Elegir solo edades de 13 años en adelante.** Evita la política de Familias, pero entonces Play Console
pregunta si la ficha puede atraer a niños sin querer. Con gorilas de dibujos animados, la respuesta
honesta es que sí, y Google puede no aceptar la declaración y pedirte que la cambies.

Si el juego es para todos, el camino A es el que dice la verdad. Marca solo las edades para las que el
juego está pensado de verdad: un juego de carreras con varios botones no es para «5 años o menos».

### Seguridad de los datos

1. **¿Tu app recoge o comparte alguno de los tipos de datos de usuario obligatorios?** → **No.**
2. Play Console enseña el resumen que verá la gente: **«No se recogen datos»** y **«No se comparten datos
   con terceros»**. Guarda y envía.

Es la respuesta correcta porque:

- el juego no tiene anuncios, ni cuentas, ni estadísticas, ni se conecta a ningún servidor para jugar;
- la partida se guarda solo en el dispositivo, y lo que no sale del dispositivo no cuenta como recogida;
- la copia de seguridad de Android, si el usuario la tiene activada, la hace el sistema en la cuenta del
  propio usuario; el desarrollador no recibe nada.

## Paso 9. Rellena la ficha de la tienda

En **Aumentar usuarios → Presencia en Google Play Store → Ficha de Play Store principal**.

1. **Textos:** copia el nombre, la descripción breve y la descripción completa de
   [`store/listing-en.md`](../store/listing-en.md) (inglés) y de
   [`store/listing-es.md`](../store/listing-es.md) (español). Para añadir el segundo idioma:
   **Gestionar traducciones → Añadir idiomas**. El texto en español vale para «Español (España)» y
   «Español (Latinoamérica)».
2. **Icono de la app:** [`store/graphics/icon-512.png`](../store/graphics/icon-512.png).
3. **Gráfico de funciones:**
   [`store/graphics/feature-graphic-1024x500.png`](../store/graphics/feature-graphic-1024x500.png).
4. **Capturas de pantalla:** las de la carpeta `store/screenshots/` (ver abajo).
5. En **Configuración de la tienda**: categoría **Carreras**, las etiquetas sugeridas en `store/listing-es.md`
   y los **datos de contacto** (el correo es obligatorio y público; como sitio web puedes poner
   <https://doge0098.github.io/Car-Mobile-Game-Amazing-Gorilla/>).

Para bajar un gráfico al móvil, ábrelo en GitHub y toca **Download raw file** (el icono de la flecha hacia
abajo), o mantén el dedo sobre la imagen y elige **Descargar imagen**.

### Capturas de pantalla

Lo que pide Google Play para las capturas de teléfono:

| Requisito | Valor |
| --- | --- |
| Cuántas | Mínimo 2, máximo 8 |
| Formato | JPEG o PNG de 24 bits, **sin transparencia** |
| Tamaño | Cada lado entre 320 y 3840 píxeles |
| Proporción | El lado largo no puede medir más del doble que el corto |
| Para que Google pueda destacar el juego | Al menos 3 capturas **horizontales de 16:9 y 1920 × 1080 píxeles o más** |

En la práctica: **capturas horizontales de 1920 × 1080 píxeles exactos**, entre 4 y 8, con imágenes reales
del juego.

- Ojo con las capturas hechas directamente con un móvil moderno: suelen medir 2400 × 1080, que es más del
  doble de largo que de alto, y Google Play las rechaza. Hay que recortarlas a 1920 × 1080.
- Tienen que enseñar el juego de verdad. Si llevan texto encima, que sea poco, y sin palabras como
  «gratis», «el mejor» o «n.º 1».
- Las capturas para tabletas de 7 y 10 pulgadas son opcionales. Si se ponen, siguen las mismas reglas y
  para las de 10 pulgadas el lado corto tiene que medir al menos 1080 píxeles.
- El vídeo de presentación también es opcional (se pone con un enlace de YouTube).

## Paso 10. La prueba cerrada: 12 personas, 14 días

Las cuentas personales creadas después del 13 de noviembre de 2023 no pueden publicar directamente.
Primero tienen que hacer una **prueba cerrada con al menos 12 personas apuntadas durante 14 días seguidos**.

1. **Probar y publicar → Pruebas → Prueba cerrada**. Abre la pista que ya existe y toca **Crear versión**.
2. En vez de subir otra vez el archivo, usa **Añadir desde la biblioteca** y elige el AAB de la prueba
   interna. Pega las notas de la versión.
3. En **Países**, elige dónde se podrá probar. En **Testers**, crea una lista con los correos de Google de
   tus 12 personas (mejor alguna más, por si alguien se borra).
4. Envía la versión a revisión. Esta sí la revisa Google: puede tardar de unas horas a varios días.
5. Cuando esté aprobada, copia el **enlace para unirse** y envíaselo a tus testers. Cada uno tiene que
   abrirlo en su móvil Android, aceptar e instalar el juego desde Google Play.
6. **Los 14 días empiezan a contar cuando hay 12 personas apuntadas a la vez.** Si alguien se borra y
   bajáis de 12, la cuenta no sigue. El panel de Play Console enseña cuántos hay y cuántos días lleváis.
7. Pídeles que jueguen de verdad y que te cuenten qué les ha parecido. Google pregunta después por ello.

Sirven familiares, amigos y compañeros con móvil Android y cuenta de Google. No hace falta que sepan de
tecnología. Desconfía de los servicios que venden testers: Google mira si la gente usa la app de verdad.

## Paso 11. Pide el acceso a producción y publica

1. Cuando se cumplan los 14 días, en el **Panel** de la app aparece **Solicitar acceso a producción**.
   El formulario pregunta por la prueba (cómo encontraste a los testers, qué opinaron, qué cambiaste), por
   el juego y por si está listo.
2. Google responde por correo, **normalmente en 7 días o menos**. Si pide más pruebas, hay que mantener la
   prueba cerrada y volver a solicitarlo.
3. Con el acceso concedido: **Probar y publicar → Producción → Crear versión → Añadir desde la biblioteca**
   (o sube un AAB más nuevo). Elige los países y envía la versión a revisión.
4. Cuando Google la apruebe, el juego aparece en la tienda en unas horas, en
   `https://play.google.com/store/apps/details?id=com.amazinggorilla.racing`.

## Publicar una actualización

1. Cuando el juego cambie en la rama principal, GitHub fabrica solo una versión nueva. Abre la última
   ejecución en **Actions** y descarga su `.aab` (o lanza una con **Run workflow**).
2. En Play Console: **Producción → Crear versión**, sube el `.aab`, escribe las novedades y envíala.
3. Si ha cambiado lo que hace el juego, repasa los textos de la ficha, la política de privacidad y el
   formulario de seguridad de los datos.

Una vez al año, a finales de agosto, Google sube la versión de Android a la que tienen que apuntar las
actualizaciones. Si al subir un AAB Play Console dice que la API objetivo es demasiado baja, hay que
actualizar Capacitor en `package.json` (es trabajo para quien mantiene el código).

## Si algo falla

### En GitHub (trabajo «Compilar versión para Google Play»)

Abre la ejecución, toca el trabajo y mira qué paso tiene la ❌. El mensaje sale también arriba, en
**Annotations**.

| Mensaje | Qué hacer |
| --- | --- |
| `faltan N de los 4 secretos de firma` | Crea los que nombra el mensaje (paso 3). |
| `ANDROID_KEYSTORE_BASE64 no es texto en base64 válido` o `no contiene un almacén de claves` | El texto no se copió entero. Vuelve a copiarlo y sustituye el secreto. |
| `ANDROID_KEYSTORE_PASSWORD no abre el almacén de claves` | La contraseña no es la de la clave, o el texto de la clave está incompleto. |
| `no hay ninguna clave con el alias` | El secreto `ANDROID_KEY_ALIAS` tiene que ser `agrplay`. |
| `ANDROID_KEY_PASSWORD no es la contraseña de la clave` | Pon la misma contraseña que en `ANDROID_KEYSTORE_PASSWORD`. |
| `tiene espacios o saltos de línea` | Borra ese secreto y créalo otra vez sin nada detrás del valor. |
| `es la clave de pruebas pública` | Has guardado la clave de pruebas del repositorio. Crea la tuya (paso 2). |
| ❌ en **Compilar el AAB y el APK de publicación** | Error de la compilación. Prueba **Re-run failed jobs**; si sigue, pasa las últimas 30 líneas del paso a quien mantiene el código. |

Para cambiar un secreto, entra en la página de secretos, toca el lápiz junto a su nombre y escribe el
valor nuevo.

### En Play Console, al subir el AAB

| Mensaje (más o menos) | Qué hacer |
| --- | --- |
| «Ya se ha usado el código de versión N» | Ese archivo ya se subió. Lanza una ejecución nueva y sube el AAB nuevo. |
| El código de versión es **menor** que el de una versión anterior | Solo pasa si se renombra el archivo del workflow o se cambia de repositorio, porque la cuenta vuelve a empezar. Crea la variable `ANDROID_VERSION_CODE_OFFSET` en **Settings → Secrets and variables → Actions → pestaña Variables** con un número mayor que el último código usado (por ejemplo `1000`). Se suma a todos los números de versión. No la bajes ni la borres después. |
| «Firmado con una clave incorrecta» o «el certificado no coincide» | El AAB no lleva la clave de subida que conoce Google. Si cambiaste los secretos, vuelve a poner los de antes; si no los tienes, pide una clave de subida nueva (abajo). |
| «Firmado en modo de depuración» | Has subido el APK de pruebas. El archivo bueno es el `.aab` del trabajo de Google Play. |
| «La API objetivo debe ser N o superior» | Hay que actualizar Capacitor. Avisa a quien mantiene el código. |
| «El nombre del paquete ya existe» | Mira el final del paso 6. |

### Si pierdes la clave o crees que alguien la tiene

1. Crea una clave nueva como en el paso 2 y, en ese mismo terminal, saca su certificado:

   ```bash
   keytool -export -rfc -keystore upload-keystore.p12 -alias agrplay -file upload_certificate.pem
   ```

2. Baja ese archivo `.pem` al móvil. El certificado no es secreto, así que puede pasar por la carpeta de
   trabajo del Codespace: ejecuta `cp upload_certificate.pem /workspaces/*/`, abre el explorador de
   archivos del editor (**☰ → View → Explorer**), mantén el dedo sobre el archivo y elige **Download**.
3. En Play Console: **Probar y publicar → Integridad de la app → Firma de aplicaciones de Play →
   Solicitar el restablecimiento de la clave de subida**, y sube el `.pem`.
4. Cuando Google lo confirme (tarda unos días), sustituye los cuatro secretos por los de la clave nueva.

Mientras tanto nadie puede publicar nada en tu nombre solo con la clave de subida: también necesitaría
entrar en tu cuenta de Play Console. Por eso lo más importante es proteger tus cuentas de Google y de
GitHub con la verificación en dos pasos.

## Seguridad de la clave, en corto

- La clave y la contraseña viven **solo** en los secretos de GitHub y en tu gestor de contraseñas. Nunca
  en el repositorio, ni en un mensaje, ni en una captura.
- `scripts/signing/debug.keystore` es **otra cosa**: la clave de pruebas, pública a propósito. No vale para
  Google Play, y la compilación se niega a usarla como clave de subida.
- Quien puede escribir en el repositorio puede cambiar la compilación para que use los secretos. No des
  permiso de escritura a nadie en quien no confíes del todo, y revisa los cambios que toquen
  `.github/workflows/`, también los que proponga un asistente de programación.
- Los registros de las compilaciones son públicos. La compilación está hecha para no escribir nunca la
  clave ni la contraseña en ellos, y GitHub tapa con `***` cualquier secreto que apareciera.
- Activa la verificación en dos pasos en GitHub y en Google.

## Para quien toque el código

| Archivo | Para qué |
| --- | --- |
| `.github/workflows/android-apk.yml`, trabajo `play` | Compila `bundleRelease` y `assembleRelease` y guarda el AAB y el APK como artefactos (30 días, sin comprimir). Solo tiene permiso de lectura del repositorio. |
| `scripts/release-signing.mjs` | `prepare` decide el modo (**propia** si están los cuatro secretos, **ensayo** si no hay ninguno, error si faltan algunos), deja el almacén de claves en `$RUNNER_TEMP` y lo prueba firmando un archivo; `collect` verifica la firma del AAB (`jarsigner`, `keytool`) y del APK (`apksigner`) y lee con `aapt2` la versión, la API objetivo y la orientación; `summary` escribe el resumen. |
| `scripts/patch-android.mjs` | Añade a `app/build.gradle` una firma `release` que solo existe si está la variable de entorno `AGR_RELEASE_STORE_FILE` (con `AGR_RELEASE_STORE_PASSWORD`, `AGR_RELEASE_KEY_ALIAS` y `AGR_RELEASE_KEY_PASSWORD`). Fija el horizontal, la pantalla completa y la versión, y al final comprueba que todo ha quedado escrito. |
| `privacy.html` | Política de privacidad. Se sirve con GitHub Pages y también viaja dentro de la app (`scripts/build-www.mjs`). |
| `store/` | Textos de la ficha, gráficos y sus fuentes (`store/source/`). |

- **Número de versión:** `versionCode` = número de ejecución del workflow + `ANDROID_VERSION_CODE_OFFSET`
  (variable opcional). `versionName` = `1.0.<versionCode>`. El APK de pruebas y el AAB de una misma
  ejecución llevan el mismo.
- **Sin secretos**, el trabajo `play` hace un ensayo: compila lo mismo firmando con la clave de pruebas y
  no guarda nada. Así se sabe que la compilación de Play funciona aunque nadie tenga todavía una clave.
- **API objetivo:** la fija la plantilla de Capacitor en `android/variables.gradle` (Capacitor 8.6.2:
  mínima 24, compilación 36, objetivo 36). `patch-android.mjs` la escribe en el registro y avisa si es menor
  que la que exige Google Play (constante `PLAY_TARGET_SDK`, que hay que revisar cada agosto).
- Los disparadores del workflow son `push` y `workflow_dispatch`. No añadas `pull_request_target` ni nada
  que ejecute código de otras personas con acceso a los secretos.

Para compilar la versión de Play en un ordenador con el SDK de Android, después de los pasos de
[APK.md](APK.md#para-quien-toque-el-código):

```bash
cd android
AGR_RELEASE_STORE_FILE=/ruta/a/upload-keystore.p12 AGR_RELEASE_STORE_PASSWORD='…' \
AGR_RELEASE_KEY_ALIAS=agrplay AGR_RELEASE_KEY_PASSWORD='…' ./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

## Datos comprobados y fecha

Comprobado el **17 de noviembre de 2026**. Las normas de Google cambian; si ha pasado tiempo, vuelve a
mirarlas.

| Dato | Dónde se comprobó |
| --- | --- |
| Desde el 31-08-2026, las apps nuevas y las actualizaciones tienen que apuntar a Android 16 (API 36) | <https://developer.android.com/google/play/requirements/target-sdk> |
| Capacitor 8.6.2 genera `minSdk` 24, `compileSdk` 36 y `targetSdk` 36 | Generando el proyecto con `npx cap add android` y leyendo `android/variables.gradle` |
| Firma de apps de Play obligatoria para apps nuevas; clave de subida y cómo restablecerla; validez mínima de la clave (después del 22-10-2033) | <https://developer.android.com/studio/publish/app-signing> |
| Prueba cerrada con 12 testers durante 14 días seguidos para cuentas personales creadas después del 13-11-2023; respuesta a la solicitud en unos 7 días | Ayuda de Play Console, «App testing requirements for new personal developer accounts» (artículo 14151465) |
| Verificación del dispositivo con la app Play Console (Android 10 o superior, sin *root*) | Ayuda de Play Console, artículo 14316361 |
| Icono de 512 × 512 (PNG de 32 bits), gráfico de funciones de 1024 × 500 y reglas de las capturas | Ayuda de Play Console, «Add preview assets to showcase your app» (artículo 9866151) |
| Política de privacidad obligatoria en Play Console y dentro de la app; formulario de seguridad de los datos obligatorio aunque no se recojan datos | Ayuda de Play Console, artículos 10144311, 9859455 y 10787469 |
| Política de Familias | Ayuda de Play Console, artículo 9893335 |
| Verificación de desarrolladores de Android: 30-09-2026 en Brasil, Indonesia, Singapur y Tailandia; resto del mundo a partir de 2027 | <https://developer.android.com/developer-verification/guides> |

Las páginas de `developer.android.com` se leyeron directamente. Las de la Ayuda de Play Console
(`support.google.com`) y la cuota de 25 USD se comprobaron a través de resultados de búsqueda, no abriendo
la página: antes de pagar o de enviar un formulario, fíate de lo que ponga la propia Play Console.
