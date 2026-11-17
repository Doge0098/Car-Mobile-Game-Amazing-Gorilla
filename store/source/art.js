// Dibujo de los gráficos de la ficha de Google Play (icono y gráfico de funciones).
// Lo cargan icon-512.html y feature-graphic.html; render.mjs les hace la foto.
// Todo es dibujo original hecho con Canvas 2D, en el estilo del juego: colores vivos,
// contorno oscuro grueso y fondo a rayas, como el icono de icons/.

const NAVY = '#1a0b3a';
const YELLOW = '#ffd21f';

// El fondo del icono del juego: degradado rosa → morado → azul con rayas claras en diagonal.
// (x, y) es el centro de las rayas; `unit` es el tamaño del icono al que equivalen.
function drawBackdrop(c, width, height, unit) {
  const g = c.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#ff4fd8');
  g.addColorStop(0.5, '#7a2ce0');
  g.addColorStop(1, '#1a8aff');
  c.fillStyle = g;
  c.fillRect(0, 0, width, height);

  c.save();
  c.translate(width / 2, height / 2);
  c.scale(unit / 512, unit / 512);
  c.rotate(-0.5);
  c.fillStyle = 'rgba(255,255,255,.14)';
  const reach = Math.ceil((width + height) / (unit / 512) / 90) + 2;
  for (let i = -reach; i <= reach; i++) c.fillRect(i * 90, -3000, 40, 6000);
  c.restore();
}

// La cabeza de Bongo, el gorila del icono, con su gorra roja. Mismo trazado que icons/.
// Se dibuja centrada en el origen, a escala de un icono de 512 px.
function drawGorilla(c) {
  const blob = (x, y, rx, ry, color) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, 7);
    c.fillStyle = color;
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = NAVY;
    c.stroke();
  };
  c.lineJoin = 'round';
  blob(-150, -30, 50, 62, '#c79a7a');   // orejas
  blob(150, -30, 50, 62, '#c79a7a');
  blob(0, -20, 160, 170, '#5a3a26');    // cabeza
  blob(0, -150, 95, 70, '#5a3a26');     // copete
  blob(0, 10, 118, 112, '#c79a7a');     // cara
  blob(0, 80, 92, 68, '#d9ae8c');       // hocico
  c.fillStyle = '#5a3a26';              // cejas
  c.beginPath(); c.roundRect(-125, -78, 250, 48, 24); c.fill(); c.stroke();
  blob(-52, -12, 30, 32, '#fff');       // ojos
  blob(52, -12, 30, 32, '#fff');
  c.fillStyle = NAVY;
  c.beginPath(); c.arc(-46, -8, 14, 0, 7); c.arc(58, -8, 14, 0, 7); c.fill();
  c.beginPath(); c.ellipse(-16, 56, 8, 6, 0, 0, 7); c.ellipse(16, 56, 8, 6, 0, 0, 7); c.fill();
  c.lineWidth = 10; c.lineCap = 'round';
  c.beginPath(); c.arc(0, 78, 50, 0.25, Math.PI - 0.25); c.stroke();   // sonrisa
  c.fillStyle = '#ff3b3b';              // gorra
  c.beginPath(); c.ellipse(0, -150, 150, 74, 0, Math.PI, 0); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(-40, -158, 230, 34, 17); c.fill(); c.stroke();
  c.fillStyle = YELLOW;
  c.beginPath(); c.arc(0, -185, 24, 0, 7); c.fill(); c.stroke();
}

// Estrella de cómic (el «¡zas!» de detrás del gorila).
function drawBurst(c, x, y, outer, inner, points, color) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.lineWidth = 9;
  c.lineJoin = 'round';
  c.strokeStyle = NAVY;
  c.stroke();
}

// Un plátano: media luna amarilla con contorno.
function drawBanana(c, x, y, size, angle) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(size / 100, size / 100);
  c.beginPath();
  c.moveTo(-48, -8);
  c.quadraticCurveTo(0, 46, 50, -14);
  c.quadraticCurveTo(54, -20, 46, -24);
  c.quadraticCurveTo(2, 10, -40, -22);
  c.quadraticCurveTo(-52, -20, -48, -8);
  c.closePath();
  c.fillStyle = YELLOW;
  c.fill();
  c.lineWidth = 7;
  c.lineJoin = 'round';
  c.strokeStyle = NAVY;
  c.stroke();
  c.restore();
}

// Franja de bandera a cuadros.
function drawCheckers(c, x, y, cols, rows, cell) {
  c.save();
  c.translate(x, y);
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      c.fillStyle = (r + k) % 2 ? '#ffffff' : NAVY;
      c.fillRect(k * cell, r * cell, cell + 0.5, cell + 0.5);
    }
  }
  c.lineWidth = 6;
  c.strokeStyle = NAVY;
  c.strokeRect(0, 0, cols * cell, rows * cell);
  c.restore();
}

// Texto de cómic: inclinado, con sombra desplazada y contorno grueso. Se encoge lo que
// haga falta para caber en `maxWidth`. Devuelve el tamaño de letra que ha usado.
function drawComicText(c, text, x, y, size, maxWidth, fill) {
  const font = px => `900 ${px}px "Inter Display", "Inter", "Arial Black", "Trebuchet MS", sans-serif`;
  c.font = font(size);
  const width = c.measureText(text).width;
  if (width > maxWidth) size = Math.floor(size * maxWidth / width);
  c.font = font(size);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.save();
  c.translate(x, y);
  c.transform(1, 0, -0.16, 1, 0, 0);   // cursiva
  const stroke = Math.max(10, size * 0.17);
  c.lineWidth = stroke;
  c.strokeStyle = NAVY;
  c.fillStyle = NAVY;
  c.strokeText(text, size * 0.05, size * 0.075);   // sombra
  c.fillText(text, size * 0.05, size * 0.075);
  c.strokeText(text, 0, 0);
  c.fillStyle = fill;
  c.fillText(text, 0, 0);
  c.restore();
  return size;
}

// ---------------------------------------------------------------- icono 512 × 512

// Google Play quiere el icono cuadrado y sin esquinas transparentes (las redondea él).
// Es el icono de icons/icon-512.png tal cual, con su mismo fondo llegando hasta las esquinas.
function paintIcon(canvas, iconImage) {
  const c = canvas.getContext('2d');
  drawBackdrop(c, 512, 512, 512);
  // El icono original se recorta un par de píxeles por dentro de su borde redondeado
  // (radio del 20 %): fuera de él solo lleva restos semitransparentes de las rayas, que
  // aquí se verían dobles, y el propio borde dejaría una línea fina.
  c.save();
  c.beginPath();
  c.roundRect(2, 2, 508, 508, 512 * 0.2 - 2);
  c.clip();
  c.drawImage(iconImage, 0, 0, 512, 512);
  c.restore();
}

// ---------------------------------------------------------------- gráfico de funciones 1024 × 500

function paintFeatureGraphic(canvas) {
  const W = 1024, H = 500;
  const c = canvas.getContext('2d');
  drawBackdrop(c, W, H, 620);

  // Rayos de luz desde detrás del gorila.
  c.save();
  c.translate(240, 246);
  c.fillStyle = 'rgba(255,255,255,.10)';
  for (let i = 0; i < 18; i++) {
    c.rotate(Math.PI / 9);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(1400, -62); c.lineTo(1400, 62); c.closePath(); c.fill();
  }
  c.restore();

  // Trama de puntos de cómic en la esquina inferior derecha.
  c.fillStyle = 'rgba(26,11,58,.20)';
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 26; col++) {
      const x = W - 14 - col * 22 - (row % 2) * 11;
      const y = H - 12 - row * 19;
      const r = 8 - row * 0.45 - col * 0.2;
      if (r > 0.8) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    }
  }

  // Bandera a cuadros que cruza por abajo.
  c.save();
  c.translate(-20, 446);
  c.rotate(-0.035);
  drawCheckers(c, 0, 0, 44, 2, 25);
  c.restore();

  // Líneas de velocidad hacia el título.
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.85)';
  for (const [x, y, len, w] of [[470, 78, 120, 9], [436, 114, 70, 7], [926, 388, 66, 8], [884, 360, 44, 6], [448, 356, 86, 8]]) {
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y - len * 0.16); c.stroke();
  }

  // El gorila, sobre su estrella amarilla.
  drawBurst(c, 240, 240, 216, 164, 14, YELLOW);
  c.save();
  c.translate(240, 252);
  c.rotate(-0.09);
  c.scale(0.77, 0.77);
  drawGorilla(c);
  c.restore();

  // Plátanos sueltos.
  drawBanana(c, 462, 400, 70, -0.45);
  drawBanana(c, 956, 74, 60, 0.5);
  drawBanana(c, 58, 62, 52, 0.3);

  // El título.
  c.save();
  c.translate(714, 0);
  c.rotate(-0.045);
  drawComicText(c, 'AMAZING', -6, 132, 76, 400, '#ffffff');
  drawComicText(c, 'GORILLA', 2, 258, 150, 512, YELLOW);
  drawComicText(c, 'RACING', 14, 368, 120, 450, '#ffffff');
  c.restore();
}
