// Tienda del garaje: mejoras del coche y personalización del jugador (sombreros, ruedas, estelas, bocinas, pegatinas, bailes y gestos).
// Solo datos: los modelos están en models.js (HAT_BUILD, WHEEL_STYLES, STICKER_DRAW, los bailes de animateGorilla), los sonidos en audio.js (sfx.horn) y los bocadillos en emotes.js.

// ---------- Mejoras del coche (solo para el jugador) ----------
export const UPGRADE_MAX = 5;
export const UPGRADE_PRICES = [120, 250, 450, 700, 1000]; // precio del nivel 1, 2, 3...
// fx: lo que suma cada nivel a las propiedades del corredor (ver Racer en race.js)
export const UPGRADES = [
  { id: 'motor', name: 'Motor', icon: '⚙️', desc: 'Más velocidad punta y mejor aceleración.', fx: { maxSpeed: 0.7, accel: 0.8 } },
  { id: 'ruedas', name: 'Neumáticos', icon: '🔩', desc: 'Gira mejor y se agarra más en las curvas.', fx: { turnRate: 0.03, grip: 0.35 } },
  { id: 'turbo', name: 'Turbo', icon: '🚀', desc: 'Todos los impulsos duran un 7 % más por nivel.', fx: { boostK: 0.07 } },
];
export const upgradeLevel = (save, id) => Math.max(0, Math.min(UPGRADE_MAX, (save.upgrades && save.upgrades[id]) | 0));
export const upgradePrice = level => UPGRADE_PRICES[Math.min(level, UPGRADE_PRICES.length - 1)];
// Suma de los efectos de todas las mejoras compradas: { maxSpeed, accel, turnRate, grip, boostK }
export function upgradeTune(save) {
  const out = {};
  for (const u of UPGRADES) { const lv = upgradeLevel(save, u.id); for (const k in u.fx) out[k] = (out[k] || 0) + u.fx[k] * lv; }
  return out;
}

// ---------- Sombreros (sustituyen al accesorio del gorila; 'none' deja el suyo) ----------
export const HATS = [
  { id: 'none', name: 'Original', icon: '🦍', price: 0, desc: 'El accesorio propio de cada gorila.' },
  { id: 'fiesta', name: 'Cono de fiesta', icon: '🥳', price: 100, desc: '¡Cada carrera es un cumpleaños!' },
  { id: 'flor', name: 'Flor', icon: '🌺', price: 120, desc: 'Una flor tropical tras la oreja.' },
  { id: 'gorra', name: 'Gorra hacia atrás', icon: '🧢', price: 150, desc: 'Con la visera mirando a los rivales.' },
  { id: 'chistera', name: 'Chistera', icon: '🎩', price: 200, desc: 'Elegancia a toda velocidad.' },
  { id: 'pirata', name: 'Pirata', icon: '☠️', price: 250, desc: '¡Al abordaje de la meta!' },
  { id: 'casco', name: 'Casco', icon: '⛑️', price: 300, desc: 'Casco de piloto profesional.' },
  { id: 'vikingo', name: 'Vikingo', icon: '⚔️', price: 400, desc: 'Cuernos para embestir sin miedo.' },
  { id: 'corona', name: 'Corona', icon: '👑', price: 600, desc: 'Solo para la realeza del asfalto.' },
];

// ---------- Ruedas ----------
export const WHEELS = [
  { id: 'std', name: 'Estándar', dot: '#2a2a36', price: 0, desc: 'Las de toda la vida.' },
  { id: 'blancas', name: 'Blancas', dot: '#f4f4f4', price: 150, desc: 'Banda blanca de coche clásico.' },
  { id: 'oro', name: 'Doradas', dot: '#ffd21f', price: 300, desc: 'Llantas de oro macizo.' },
  { id: 'neon', name: 'Neón', dot: '#22e6ff', price: 350, desc: 'Brillan en la oscuridad.' },
  { id: 'monstruo', name: 'Monstruo', dot: '#7a4a22', price: 400, desc: 'Enormes y con tacos. Solo cambia el aspecto.' },
];

// ---------- Estelas del turbo ----------
// color: cinta luminosa · sparks: chispas del escape · rainbow: el color recorre el arcoíris
export const TRAILS = [
  { id: 'fuego', name: 'Fuego', dot: 'linear-gradient(#ffe45a, #ff7a1a)', price: 0, color: 0xffa030, sparks: [0xff7a1a, 0xffe45a], desc: 'La llamarada clásica.' },
  { id: 'hielo', name: 'Hielo', dot: 'linear-gradient(#ffffff, #38b6ff)', price: 200, color: 0x4ac8ff, sparks: [0x9fe6ff, 0xffffff], desc: 'Un rastro helado.' },
  { id: 'toxica', name: 'Tóxica', dot: 'linear-gradient(#d6ff5a, #18b65a)', price: 200, color: 0x6dff3a, sparks: [0x35e08a, 0xd6ff5a], desc: 'Verde radiactivo.' },
  { id: 'rosa', name: 'Rosa', dot: 'linear-gradient(#ffc4ec, #ff4fd8)', price: 250, color: 0xff5ec4, sparks: [0xff4fd8, 0xffc4ec], desc: 'Chicle a reacción.' },
  { id: 'arcoiris', name: 'Arcoíris', dot: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', price: 500, color: 0xffffff, sparks: [0xffffff, 0xffe45a], rainbow: true, desc: 'Todos los colores a la vez.' },
];

// ---------- Bocinas ----------
export const HORNS = [
  { id: 'clasica', name: 'Clásica', icon: '📯', price: 0, desc: '¡Mec, mec!' },
  { id: 'camion', name: 'Camión', icon: '🚚', price: 100, desc: 'Grave y contundente.' },
  { id: 'payaso', name: 'Payaso', icon: '🤡', price: 150, desc: 'La bocina de goma del circo.' },
  { id: 'melodia', name: 'La Cucaracha', icon: '🎺', price: 250, desc: 'Un clásico de las carreteras.' },
  { id: 'espacial', name: 'Espacial', icon: '🛸', price: 250, desc: 'Sonido de otro planeta.' },
];

// ---------- Pegatinas del coche (dibujadas en models.js: STICKER_DRAW) ----------
export const STICKERS = [
  { id: 'none', name: 'Sin pegatina', icon: '🚫', price: 0, desc: 'La carrocería, tal cual sale de fábrica.' },
  { id: 'rayo', name: 'Rayo', icon: '⚡', price: 100, desc: 'Para ir como una centella.' },
  { id: 'llama', name: 'Llama', icon: '🔥', price: 120, desc: 'El clásico de los bólidos.' },
  { id: 'estrella', name: 'Estrella', icon: '⭐', price: 120, desc: 'Naciste para brillar.' },
  { id: 'corazon', name: 'Corazón', icon: '❤️', price: 150, desc: 'Corre con el corazón.' },
  { id: 'huella', name: 'Huella', icon: '🐾', price: 150, desc: 'La marca de la manada.' },
  { id: 'platano', name: 'Plátano', icon: '🍌', price: 200, desc: 'El emblema oficial de la selva.' },
  { id: 'calavera', name: 'Calavera', icon: '💀', price: 250, desc: 'Aviso para los rivales.' },
  { id: 'dorsal', name: 'Dorsal 7', icon: '🏁', price: 300, desc: 'El número de la suerte.' },
];

// ---------- Bailes de victoria ----------
// mode: modo de animateGorilla (models.js); el clásico no tiene: usa la celebración de siempre
export const DANCES = [
  { id: 'clasico', name: 'Clásico', icon: '🙌', price: 0, mode: '', desc: 'La celebración de toda la vida.' },
  { id: 'robot', name: 'Robot', icon: '🤖', price: 200, mode: 'robot', desc: 'Movimientos secos, de hojalata.' },
  { id: 'disco', name: 'Disco', icon: '🕺', price: 250, mode: 'disco', desc: 'Un dedo al cielo y a la pista.' },
  { id: 'molino', name: 'Molino', icon: '🌀', price: 300, mode: 'molino', desc: 'Los brazos giran como aspas.' },
  { id: 'peonza', name: 'Peonza', icon: '💫', price: 400, mode: 'peonza', desc: 'Saltos y vueltas sin marearse.' },
];

// ---------- Gestos (bocadillo sobre el coche al tocar la bocina) ----------
export const EMOTES = [
  { id: 'hola', name: 'Saludo', icon: '👋', price: 0, desc: '¡Hola y adiós!' },
  { id: 'risa', name: 'Carcajada', icon: '😂', price: 80, desc: 'Para cuando adelantas.' },
  { id: 'guay', name: 'Crack', icon: '😎', price: 100, desc: 'Con mucho estilo.' },
  { id: 'burla', name: 'Burla', icon: '😜', price: 100, desc: '¡A que no me pillas!' },
  { id: 'fuerza', name: 'Fuerza', icon: '💪', price: 120, desc: 'Puro músculo de gorila.' },
  { id: 'monito', name: 'Monito', icon: '🙈', price: 150, desc: 'Mejor no mirar.' },
  { id: 'beso', name: 'Besito', icon: '😘', price: 150, desc: 'Con cariño para los de atrás.' },
];

// Pestañas de personalización del garaje: lista, campos de la partida (comprados / elegido) y nota de ayuda
export const SHOP = [
  { tab: 'hats', label: 'Sombreros', list: HATS, owned: 'hats', cur: 'hat', hint: 'Lo llevarás en carrera, en el podio y en tu fantasma.' },
  { tab: 'wheels', label: 'Ruedas', list: WHEELS, owned: 'wheels', cur: 'wheel', hint: 'Valen para todos tus coches.' },
  { tab: 'trails', label: 'Estelas', list: TRAILS, owned: 'trails', cur: 'trail', hint: 'La estela que dejas cuando llevas turbo.' },
  { tab: 'horns', label: 'Bocinas', list: HORNS, owned: 'horns', cur: 'horn', hint: 'En carrera: pulsa OBJETO cuando no lleves ninguno (tecla H).' },
  { tab: 'stickers', label: 'Pegatinas', list: STICKERS, owned: 'stickers', cur: 'sticker', hint: 'Va en los dos lados y en el capó de todos tus coches.' },
  { tab: 'dances', label: 'Bailes', list: DANCES, owned: 'dances', cur: 'dance', hint: 'Lo bailas en el podio y al acabar entre los 3 primeros.' },
  { tab: 'emotes', label: 'Gestos', list: EMOTES, owned: 'emotes', cur: 'emote', hint: 'Aparece sobre tu coche cuando tocas la bocina.' },
];

export const byId = (list, id) => list.find(x => x.id === id) || list[0];
