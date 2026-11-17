// Datos del juego: personajes, coches, mapas, copas y power-ups.

export const CHARACTERS = [
  { id: 'bongo', name: 'Bongo', fur: 0x5a3a26, skin: 0xc79a7a, acc: 'cap', accColor: 0xff3b3b,
    stats: { speed: 3, accel: 3, handling: 3 }, price: 0, desc: 'Equilibrado y siempre sonriente.' },
  { id: 'tita', name: 'Tita', fur: 0x33303d, skin: 0xb98f9c, acc: 'bow', accColor: 0xff4fd8,
    stats: { speed: 2, accel: 4, handling: 4 }, price: 0, desc: 'Ágil y rapidísima al arrancar.' },
  { id: 'rocco', name: 'Rocco', fur: 0x8a4b1c, skin: 0xd9a066, acc: 'glasses', accColor: 0x111111,
    stats: { speed: 4, accel: 2, handling: 3 }, price: 150, desc: 'Grandullón con mucha punta.' },
  { id: 'nube', name: 'Nube', fur: 0xf2f2f7, skin: 0xffc9b0, acc: 'headphones', accColor: 0x29d3ff,
    stats: { speed: 3, accel: 4, handling: 4 }, price: 300, desc: 'Gorila blanco amante de la música.' },
  { id: 'zafiro', name: 'Zafiro', fur: 0x2456d8, skin: 0x9fd0ff, acc: 'mohawk', accColor: 0xffe600,
    stats: { speed: 4, accel: 3, handling: 5 }, price: 550, desc: 'Azul eléctrico, derrapa como nadie.' },
  { id: 'mambo', name: 'Rey Mambo', fur: 0xd99a1c, skin: 0xffe2a8, acc: 'crown', accColor: 0xffd700,
    stats: { speed: 5, accel: 4, handling: 3 }, price: 900, desc: 'El rey dorado de la selva.' },
];

export const KARTS = [
  { id: 'platano', name: 'Platanomóvil', color: 0xffd21f, color2: 0x2d2d3a, shape: 0,
    stats: { speed: 3, accel: 3, handling: 3 }, price: 0 },
  { id: 'rayo', name: 'Rayo Selva', color: 0x29e06b, color2: 0x10301c, shape: 1,
    stats: { speed: 4, accel: 3, handling: 2 }, price: 200 },
  { id: 'coco', name: 'Coco Tanque', color: 0xff7a1a, color2: 0x4a2a12, shape: 2,
    stats: { speed: 3, accel: 2, handling: 5 }, price: 200 },
  { id: 'cometa', name: 'Cometa', color: 0x31b6ff, color2: 0xffffff, shape: 3,
    stats: { speed: 5, accel: 3, handling: 3 }, price: 600 },
  { id: 'aurora', name: 'Aurora', color: 0xc04dff, color2: 0x22e6ff, shape: 4,
    stats: { speed: 5, accel: 4, handling: 4 }, price: 1200 },
];

export const KART_COLORS = [null, 0xff3b4a, 0x29e06b, 0x31b6ff, 0xff7a1a, 0xc04dff, 0xff5ec4, 0xf5f5f5, 0x22e6d0];

export const ITEMS = {
  turbo: { name: 'Turbo Plátano', icon: '🍌', color: '#ffd21f' },
  coco: { name: 'Coco Misil', icon: '🥥', color: '#b0703a' },
  peel: { name: 'Cáscara', icon: '🍂', color: '#f2c200' },
  shield: { name: 'Escudo Hoja', icon: '🛡️', color: '#35e08a' },
  drum: { name: 'Golpe de Pecho', icon: '🥁', color: '#ff5a3c' },
  fury: { name: 'Furia Gorila', icon: '🦍', color: '#c04dff' },
};

// Cada mapa: forma (curva polar => nunca se cruza), tema visual y música.
export const TRACKS = [
  {
    id: 'selva', name: 'Selva Esmeralda', cup: 0, R: 311, width: 15,
    waves: [[2, 0.15, 0.4], [5, 0.085, 1.9], [8, 0.051, 0.3]], seed: 11,
    theme: {
      skyTop: 0x1fa8ff, skyBottom: 0xbff7ff, fog: 0xa8f0e0, fogNear: 140, fogFar: 520,
      ground: 0x35c94a, ground2: 0x1f9e3c, liquid: 0x1ec8ff, liquidLevel: -2.2, liquidGlow: 0,
      road: '#4b4f63', line: '#ffffff', curbA: 0xff3b4a, curbB: 0xffffff,
      sun: 0xfff3b0, light: 1.25, ambientSky: 0xcfefff, ambientGround: 0x3a8a3a,
      props: [['tree', 150], ['palm', 60], ['rock', 40], ['flower', 110], ['mushroom', 30]],
      fx: 'fireflies', fxColor: 0xf6ff8a, hills: 26, mountains: 0x2a9d6a, clouds: 0xffffff,
    },
    music: { tempo: 132, root: 57, scale: 'major', prog: [0, 3, 4, 0], seed: 3 },
  },
  {
    id: 'playa', name: 'Playa Coco', cup: 0, R: 315, width: 16,
    waves: [[2, 0.2, 2.2], [6, 0.067, 0.5], [9, 0.0268, 4.0]], seed: 23,
    theme: {
      skyTop: 0x1877ff, skyBottom: 0xffe9b8, fog: 0xffe6c2, fogNear: 160, fogFar: 560,
      ground: 0xffdf8a, ground2: 0xf5c35e, liquid: 0x12d6e8, liquidLevel: -1.2, liquidGlow: 0,
      road: '#6b5a52', line: '#fff6c9', curbA: 0x18b6ff, curbB: 0xffffff,
      sun: 0xffffff, light: 1.35, ambientSky: 0xdff6ff, ambientGround: 0xffd28a,
      props: [['palm', 150], ['rock', 40], ['umbrella', 50], ['flower', 40], ['shell', 60]],
      fx: 'bubbles', fxColor: 0xffffff, hills: 16, mountains: 0x35c2a8, clouds: 0xffffff,
    },
    music: { tempo: 124, root: 60, scale: 'major', prog: [0, 4, 5, 3], seed: 8 },
  },
  {
    id: 'volcan', name: 'Volcán Furioso', cup: 0, R: 301, width: 14.5,
    waves: [[3, 0.16, 0.2], [7, 0.0752, 3.0], [10, 0.0376, 1.1]], seed: 37,
    theme: {
      skyTop: 0x3a0b4a, skyBottom: 0xff7a2a, fog: 0xff6a3a, fogNear: 110, fogFar: 460,
      ground: 0x5a3246, ground2: 0x3a2030, liquid: 0xff5a00, liquidLevel: -1.6, liquidGlow: 1,
      road: '#2e2632', line: '#ffb21f', curbA: 0xffb21f, curbB: 0x1a1218,
      sun: 0xffb060, light: 1.25, ambientSky: 0xff9a6a, ambientGround: 0x7a2a2a,
      props: [['lavarock', 130], ['deadtree', 70], ['crystal', 60], ['rock', 70]],
      fx: 'embers', fxColor: 0xffa23a, hills: 34, mountains: 0x4a1a2e, clouds: 0x7a3a4a, propGlow: 0xff5a1a,
    },
    music: { tempo: 140, root: 52, scale: 'minor', prog: [0, 5, 3, 4], seed: 5 },
  },
  {
    id: 'hielo', name: 'Cumbre Helada', cup: 1, R: 311, width: 15,
    waves: [[2, 0.12, 1.2], [5, 0.0936, 0.1], [9, 0.0468, 2.6]], seed: 41,
    theme: {
      skyTop: 0x2b6cff, skyBottom: 0xe6f6ff, fog: 0xdaf0ff, fogNear: 120, fogFar: 480,
      ground: 0xf4fbff, ground2: 0xc6e6ff, liquid: 0x6fd8ff, liquidLevel: -1.8, liquidGlow: 0,
      road: '#5c6f94', line: '#ffffff', curbA: 0x2b9dff, curbB: 0xffffff,
      sun: 0xffffff, light: 1.3, ambientSky: 0xe6f2ff, ambientGround: 0x9fc6ff,
      props: [['pine', 170], ['icecrystal', 70], ['snowman', 30], ['rock', 40]],
      fx: 'snow', fxColor: 0xffffff, hills: 38, mountains: 0xb8dcff, clouds: 0xffffff,
    },
    music: { tempo: 128, root: 62, scale: 'major', prog: [0, 5, 3, 4], seed: 12 },
  },
  {
    id: 'neon', name: 'Ciudad Neón', cup: 1, R: 318, width: 15,
    waves: [[4, 0.1, 0.0], [7, 0.052, 0.9], [11, 0.0156, 2.4]], seed: 53,
    theme: {
      skyTop: 0x05021a, skyBottom: 0x6a1aa8, fog: 0x3a0f6a, fogNear: 120, fogFar: 520,
      ground: 0x1a1240, ground2: 0x120a30, liquid: 0x00f0ff, liquidLevel: -1.5, liquidGlow: 1,
      road: '#16122e', line: '#00f0ff', curbA: 0xff2fd0, curbB: 0x00f0ff,
      sun: 0xff9cf0, light: 1.25, ambientSky: 0xa070ff, ambientGround: 0x2a1a6a,
      props: [['building', 150], ['neonpole', 80], ['crystal', 40]],
      fx: 'fireflies', fxColor: 0xff5ef0, hills: 6, mountains: 0x2a0f5a, clouds: 0x5a2a9a, stars: true,
      propGlow: 0xff2fd0, neon: true,
    },
    music: { tempo: 138, root: 55, scale: 'minor', prog: [0, 3, 5, 4], seed: 21 },
  },
  {
    id: 'arcoiris', name: 'Templo Arcoíris', cup: 1, R: 314, width: 15.5,
    waves: [[3, 0.14, 1.4], [6, 0.056, 0.0], [10, 0.0336, 2.0]], seed: 67,
    theme: {
      skyTop: 0x2a1a8a, skyBottom: 0xff8ad8, fog: 0xffa0e0, fogNear: 140, fogFar: 540,
      ground: 0xffc4ec, ground2: 0xc9a0ff, liquid: 0x8a5cff, liquidLevel: -1.8, liquidGlow: 1,
      road: '#ffffff', line: '#ffffff', curbA: 0xffffff, curbB: 0xffe600,
      sun: 0xffffff, light: 1.2, ambientSky: 0xffd8ff, ambientGround: 0xc090ff,
      props: [['candytree', 120], ['crystal', 90], ['mushroom', 70], ['column', 50]],
      fx: 'stars', fxColor: 0xffffff, hills: 22, mountains: 0x9a6aff, clouds: 0xffffff, stars: true,
      rainbow: true, propGlow: 0xffffff,
    },
    music: { tempo: 144, root: 59, scale: 'major', prog: [0, 4, 5, 3], seed: 30 },
  },
];

export const CUPS = [
  { id: 'platano', name: 'Copa Plátano', icon: '🍌', tracks: ['selva', 'playa', 'volcan'] },
  { id: 'diamante', name: 'Copa Diamante', icon: '💎', tracks: ['hielo', 'neon', 'arcoiris'] },
];

export const DIFFICULTIES = [
  { id: 'facil', name: 'Fácil', ai: 0.86, reward: 1 },
  { id: 'normal', name: 'Normal', ai: 0.93, reward: 1.5 },
  { id: 'dificil', name: 'Difícil', ai: 1.0, reward: 2 },
];

export const CUP_POINTS = [10, 8, 6, 4, 2, 1];
export const RACE_REWARD = [60, 40, 30, 20, 15, 10];
export const LAPS = 3;
export const RACERS = 6;

export const MENU_MUSIC = { tempo: 116, root: 57, scale: 'major', prog: [0, 5, 3, 4], seed: 1 };

export function trackById(id) { return TRACKS.find(t => t.id === id); }
export function charById(id) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; }
export function kartById(id) { return KARTS.find(k => k.id === id) || KARTS[0]; }

// Generador pseudoaleatorio determinista
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
