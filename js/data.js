// Datos del juego: personajes, coches, mapas, copas y power-ups.

export const CHARACTERS = [
  { id: 'bongo', voice: 1.0, name: 'Bongo', fur: 0x5a3a26, skin: 0xc79a7a, acc: 'cap', accColor: 0xff3b3b,
    stats: { speed: 3, accel: 3, handling: 3 }, price: 0, desc: 'Equilibrado y siempre sonriente.' },
  { id: 'tita', voice: 1.28, name: 'Tita', fur: 0x33303d, skin: 0xb98f9c, acc: 'bow', accColor: 0xff4fd8,
    stats: { speed: 2, accel: 4, handling: 4 }, price: 0, desc: 'Ágil y rapidísima al arrancar.' },
  { id: 'rocco', voice: 0.74, name: 'Rocco', fur: 0x8a4b1c, skin: 0xd9a066, acc: 'glasses', accColor: 0x111111,
    stats: { speed: 4, accel: 2, handling: 3 }, price: 150, desc: 'Grandullón con mucha punta.' },
  { id: 'nube', voice: 1.12, name: 'Nube', fur: 0xf2f2f7, skin: 0xffc9b0, acc: 'headphones', accColor: 0x29d3ff,
    stats: { speed: 3, accel: 4, handling: 4 }, price: 300, desc: 'Gorila blanco amante de la música.' },
  { id: 'zafiro', voice: 0.94, name: 'Zafiro', fur: 0x2456d8, skin: 0x9fd0ff, acc: 'mohawk', accColor: 0xffe600,
    stats: { speed: 4, accel: 3, handling: 5 }, price: 550, desc: 'Azul eléctrico, derrapa como nadie.' },
  { id: 'mambo', voice: 0.8, name: 'Rey Mambo', fur: 0xd99a1c, skin: 0xffe2a8, acc: 'crown', accColor: 0xffd700,
    stats: { speed: 5, accel: 4, handling: 3 }, price: 900, desc: 'El rey dorado de la selva.' },
];

export const KARTS = [
  { id: 'platano', name: 'Platanomóvil', color: 0xffd21f, color2: 0x2d2d3a, shape: 0,
    stats: { speed: 3, accel: 3, handling: 3 }, price: 0 },
  { id: 'rayo', name: 'Cocodrilo Veloz', color: 0x29e06b, color2: 0x10301c, shape: 1,
    stats: { speed: 4, accel: 3, handling: 2 }, price: 200 },
  { id: 'coco', name: 'Barril Tanque', color: 0xa8643a, color2: 0x3a2a22, shape: 2,
    stats: { speed: 3, accel: 2, handling: 5 }, price: 200 },
  { id: 'cometa', name: 'Cohete Cometa', color: 0x31b6ff, color2: 0xffffff, shape: 3,
    stats: { speed: 5, accel: 3, handling: 3 }, price: 600 },
  { id: 'aurora', name: 'Platillo Aurora', color: 0xc04dff, color2: 0x22e6ff, shape: 4,
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
  bolt: { name: 'Rayo', icon: '⚡', color: '#ffe600' },
  magnet: { name: 'Imán de Plátanos', icon: '🧲', color: '#ff3b4a' },
  barrel: { name: 'Barril Rodante', icon: '🛢️', color: '#a8643a' },
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
      shore: 0xe8d79a, rock: 0x8a8f7a, peak: 0xa6e86a, cloudAmt: 0.5,
      fx: 'fireflies', fxColor: 0xf6ff8a, hills: 26, mountains: 0x2a9d6a, clouds: 0xffffff,
    },
    music: { tempo: 132, root: 57, scale: 'major', prog: [0, 3, 4, 0], seed: 3 , style: 'jungle' },
    hills: [[0, 0], [0.06, 1.2], [0.25, 5], [0.33, 9], [0.39, 10], [0.455, 14], [0.6, 7], [0.68, 6], [0.76, 4], [0.795, 1.5], [0.96, 0.6], [1, 0]],
    boat: [0.105, 0.17], glide: [0.475, 0.53, 15, 5], sub: [0.812, 0.918, 0.036, 5.5], tunnel: [0.61, 0.68], bridge: [0.355, 0.425], ramps: [0.25, 0.76],
    extras: { weather: 'rain', hazard: 'barrel', life: 'birds', liquidMode: 0, lamp: 0xff9a2a, deck: 0x9a6a3a, tunnelCol: 0x6f7f6a, tunnelGlow: 0xffd98a, puddle: 0x8fdcff, mark: 0x15151c },
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
      shore: 0xfff0c0, rock: 0xc9a878, peak: 0x9be07a, cloudAmt: 0.38,
      fx: 'bubbles', fxColor: 0xffffff, hills: 16, mountains: 0x35c2a8, clouds: 0xffffff,
    },
    music: { tempo: 124, root: 60, scale: 'major', prog: [0, 4, 5, 3], seed: 8 , style: 'beach' },
    hills: [[0, 0], [0.07, 2], [0.14, 5], [0.2, 7], [0.3, 1.2], [0.455, 1.5], [0.5, 4], [0.55, 3], [0.575, 0.8], [0.72, 3], [0.76, 5], [0.82, 6], [0.9, 5], [0.95, 2], [1, 0]],
    boat: [0.59, 0.68], glide: [0.22, 0.28, 9, 2], sub: [0.315, 0.445, 0.04, 6], tunnel: [0.84, 0.9], bridge: [0.105, 0.175], ramps: [0.5, 0.76],
    extras: { weather: 'none', hazard: 'crab', life: 'birds', liquidMode: 0, lamp: 0xff5ec4, deck: 0xc79a5a, tunnelCol: 0xd9b98a, tunnelGlow: 0xfff0b0, puddle: 0x9ff0ff, mark: 0x2a2220 },
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
      shore: 0x2a1a22, rock: 0x4a3440, peak: 0x8a4a48, cloudAmt: 0.62,
      fx: 'embers', fxColor: 0xffa23a, hills: 34, mountains: 0x4a1a2e, clouds: 0x7a3a4a, propGlow: 0xff5a1a,
    },
    music: { tempo: 140, root: 52, scale: 'minor', prog: [0, 5, 3, 4], seed: 5 , style: 'volcano' },
    hills: [[0, 0], [0.06, 1.5], [0.25, 8], [0.33, 14], [0.4, 16], [0.455, 20], [0.6, 11], [0.64, 12], [0.7, 10], [0.76, 6], [0.795, 1.8], [0.96, 0.6], [1, 0]],
    boat: [0.1, 0.17], glide: [0.475, 0.53, 22, 9], sub: [0.812, 0.918, 0.036, 5.5], tunnel: [0.355, 0.43], bridge: [0.6, 0.68], ramps: [0.25, 0.76],
    extras: { weather: 'ash', hazard: 'geyser', life: null, liquidMode: 1, lamp: 0xff6a1a, deck: 0x4a3a44, tunnelCol: 0x3a2630, tunnelGlow: 0xff7a1a, puddle: null, mark: 0x0c0a0e },
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
      shore: 0xcdeaff, rock: 0x8fb4d8, peak: 0xffffff, cloudAmt: 0.5,
      fx: 'snow', fxColor: 0xffffff, hills: 38, mountains: 0xb8dcff, clouds: 0xffffff,
    },
    music: { tempo: 128, root: 62, scale: 'major', prog: [0, 5, 3, 4], seed: 12 , style: 'ice' },
    hills: [[0, 0], [0.08, 3], [0.14, 5], [0.2, 6], [0.25, 5], [0.3, 1.5], [0.455, 2], [0.55, 1.2], [0.72, 3], [0.76, 6], [0.82, 9], [0.87, 10], [0.93, 5], [0.97, 1.5], [1, 0]],
    boat: [0.585, 0.675], glide: [0.475, 0.53, 6, 1.5], sub: [0.315, 0.445, 0.04, 6], tunnel: [0.105, 0.175], bridge: [0.84, 0.9], ramps: [0.25, 0.76],
    extras: { weather: 'blizzard', hazard: 'penguin', life: null, liquidMode: 0, lamp: 0x7fe0ff, deck: 0xbfe6ff, tunnelCol: 0x9fd6ff, tunnelGlow: 0xcff4ff, puddle: 0xe6f8ff, mark: 0x26304a },
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
      shore: 0x2a1a6a, rock: 0x1a1240, peak: 0x4a2a9a, cloudAmt: 0.3,
      fx: 'fireflies', fxColor: 0xff5ef0, hills: 6, mountains: 0x2a0f5a, clouds: 0x5a2a9a, stars: true,
      propGlow: 0xff2fd0, neon: true,
    },
    music: { tempo: 138, root: 55, scale: 'minor', prog: [0, 3, 5, 4], seed: 21 , style: 'neon' },
    hills: [[0, 0], [0.06, 1.5], [0.3, 3], [0.39, 8], [0.455, 6], [0.5, 7], [0.55, 6], [0.64, 9], [0.7, 8], [0.76, 6], [0.795, 1.8], [0.96, 0.6], [1, 0]],
    boat: [0.105, 0.17], glide: [0.22, 0.28, 8, 2.5], sub: [0.812, 0.918, 0.036, 5.5], tunnel: [0.6, 0.69], bridge: [0.355, 0.425], ramps: [0.5, 0.76],
    extras: { weather: 'none', hazard: 'drone', life: 'beams', liquidMode: 2, lamp: 0x00f0ff, deck: 0x2a1a6a, tunnelCol: 0x1a1240, tunnelGlow: 0xff2fd0, puddle: null, mark: 0x00c8e0 },
  },
  {
    id: 'arcoiris', name: 'Templo Arcoíris', cup: 1, R: 314, width: 15.5,
    waves: [[3, 0.14, 1.4], [6, 0.056, 0.0], [10, 0.0336, 2.0]], seed: 67,
    theme: {
      skyTop: 0x2a1a8a, skyBottom: 0xff8ad8, fog: 0xffa0e0, fogNear: 140, fogFar: 540,
      ground: 0xffc4ec, ground2: 0xc9a0ff, liquid: 0x8a5cff, liquidLevel: -1.8, liquidGlow: 1,
      road: '#ffffff', line: '#7a4cff', curbA: 0xffffff, curbB: 0xffe600,
      sun: 0xffffff, light: 1.2, ambientSky: 0xffd8ff, ambientGround: 0xc090ff,
      props: [['candytree', 120], ['crystal', 90], ['mushroom', 70], ['column', 50]],
      shore: 0xfff0fa, rock: 0xb890ff, peak: 0xffffff, cloudAmt: 0.45,
      fx: 'stars', fxColor: 0xffffff, hills: 22, mountains: 0x9a6aff, clouds: 0xffffff, stars: true,
      rainbow: true, propGlow: 0xffffff,
    },
    music: { tempo: 144, root: 59, scale: 'major', prog: [0, 4, 5, 3], seed: 30 , style: 'temple' },
    hills: [[0, 0], [0.08, 3], [0.135, 6], [0.2, 8], [0.25, 7], [0.3, 1.5], [0.455, 2], [0.57, 6], [0.64, 10], [0.7, 9], [0.76, 6], [0.815, 1.0], [0.96, 0.8], [1, 0]],
    boat: [0.83, 0.9], glide: [0.475, 0.53, 6, 2.5], sub: [0.315, 0.445, 0.04, 6], tunnel: [0.105, 0.165], bridge: [0.6, 0.68], ramps: [0.25, 0.76],
    extras: { weather: 'stars', hazard: 'star', life: null, liquidMode: 3, lamp: 0xffe600, deck: 0xffffff, tunnelCol: 0xd0a8ff, tunnelGlow: 0xffffff, puddle: null, mark: 0xffffff },
  },
  {
    id: 'nubes', name: 'Reino de las Nubes', cup: 2, R: 325, width: 15.5,
    waves: [[3, 0.13, 0.7], [5, 0.07, 2.2], [8, 0.035, 1.0]], seed: 71,
    theme: {
      skyTop: 0x1a5cff, skyBottom: 0xffe9f4, fog: 0xeef4ff, fogNear: 150, fogFar: 560,
      ground: 0xffffff, ground2: 0xdfe9ff, liquid: 0xf6f9ff, liquidLevel: -3, liquidGlow: 0,
      road: '#fbf6ff', line: '#ffb21f', curbA: 0xffd21f, curbB: 0xffffff,
      sun: 0xfff6d8, light: 1.3, ambientSky: 0xeaf2ff, ambientGround: 0xbcd0ff,
      props: [['cloudpuff', 170], ['column', 60], ['crystal', 50], ['candytree', 40]],
      shore: 0xffffff, rock: 0xcfdcff, peak: 0xffffff, cloudAmt: 0.62,
      fx: 'stars', fxColor: 0xffffff, hills: 16, mountains: 0xc8d8ff, clouds: 0xffffff, propGlow: 0xffe9a0,
    },
    music: { tempo: 136, root: 64, scale: 'major', prog: [0, 4, 5, 3], seed: 51, style: 'temple' },
    hills: [[0, 0], [0.05, 1.5], [0.26, 6], [0.335, 9], [0.4, 13], [0.6, 7], [0.66, 8], [0.74, 10], [0.94, 1.5], [1, 0]],
    glide: [[0.12, 0.19, 14, 5], [0.465, 0.54, 18, 6], [0.815, 0.895, 13, 3]], bridge: [0.3, 0.37], ramps: [0.26, 0.62],
    extras: { weather: 'none', hazard: 'star', life: 'birds', liquidMode: 4, lamp: 0xffe9a0, deck: 0xffffff, tunnelCol: 0xdfe9ff, tunnelGlow: 0xffe9a0, puddle: null, mark: 0xbcd0ff, ambience: 'temple' },
  },
  {
    id: 'oceano', name: 'Mar Abierto', cup: 2, R: 355, width: 19,
    waves: [[2, 0.17, 1.1], [3, 0.08, 0.2], [5, 0.04, 2.9]], seed: 83,
    theme: {
      skyTop: 0x1f7bff, skyBottom: 0xd8f6ff, fog: 0xcdefff, fogNear: 170, fogFar: 600,
      ground: 0xffe08a, ground2: 0xf2c868, liquid: 0x18b4e6, liquidLevel: -1.2, liquidGlow: 0,
      road: '#9a744a', line: '#fff6c9', curbA: 0xff3b4a, curbB: 0xffffff,
      sun: 0xffffff, light: 1.35, ambientSky: 0xdff6ff, ambientGround: 0x7ad0e8,
      props: [['palm', 90], ['rock', 60], ['umbrella', 20]],
      shore: 0xfff0c0, rock: 0xb8a078, peak: 0x8fd96a, cloudAmt: 0.55,
      fx: 'bubbles', fxColor: 0xffffff, hills: 20, mountains: 0x4ab8d8, clouds: 0xffffff,
    },
    music: { tempo: 130, root: 62, scale: 'major', prog: [0, 5, 3, 4], seed: 64, style: 'beach' },
    hills: [[0, 0.6], [1, 0.6]], boat: [[0.035, 0.965]], ramps: [0.26, 0.5, 0.86], hazardInZones: true, noShortcut: true,
    extras: { weather: 'rain', hazard: 'barrel', life: 'birds', liquidMode: 0, lamp: 0xff5ec4, deck: 0xa8744a, tunnelCol: 0xd9b98a, tunnelGlow: 0xfff0b0, puddle: null, mark: 0x3a2a20, ambience: 'beach' },
  },
  {
    id: 'abismo', name: 'Fondo Marino', cup: 2, R: 318, width: 15,
    waves: [[2, 0.13, 2.6], [4, 0.09, 0.4], [7, 0.05, 1.7]], seed: 97,
    theme: {
      skyTop: 0x0a6ad8, skyBottom: 0x9fe8ff, fog: 0x0f5aa8, fogNear: 30, fogFar: 200,
      ground: 0xe8d79a, ground2: 0xd2b878, liquid: 0x1a9ae8, liquidLevel: 0, liquidGlow: 0,
      road: '#3a4a6a', line: '#7ff0ff', curbA: 0x22e6ff, curbB: 0xffffff,
      sun: 0xcfefff, light: 1.15, ambientSky: 0x9fd8ff, ambientGround: 0x3a6a9a,
      props: [['coral', 170], ['seaweed', 150], ['rock', 70], ['shell', 80], ['crystal', 40]], underwater: true,
      shore: 0xe8d79a, rock: 0x7a8aa0, peak: 0xcfd8e0, cloudAmt: 0.4,
      fx: 'bubbles', fxColor: 0xdff8ff, hills: 14, mountains: 0x2a6aa8, clouds: 0xffffff, propGlow: 0x7ff0ff,
    },
    music: { tempo: 122, root: 57, scale: 'minor', prog: [0, 5, 3, 4], seed: 77, style: 'ice' },
    hills: [[0, -9], [0.1, -8], [0.2, -11], [0.32, -8.5], [0.45, -12], [0.58, -9], [0.7, -11], [0.82, -8], [0.92, -9.5], [1, -9]],
    deepAll: true, tunnel: [0.61, 0.68], ringsAt: [0.14, 0.25, 0.38, 0.5, 0.75, 0.88], ramps: [],
    extras: { weather: 'none', hazard: 'crab', life: null, liquidMode: 0, lamp: 0x7ff0ff, deck: 0x6a7a9a, tunnelCol: 0x4a6a8a, tunnelGlow: 0x7ff0ff, puddle: null, mark: 0x2a3a5a, ambience: '' },
  },
];

// Pistas que no aparecen en las listas de carrera
export const EXTRA_TRACKS = [
  {
    // pista pequeña y ancha para la batalla de globos (no aparece en las listas de carrera)
    id: 'arena', name: 'Arena Gorila', cup: -1, hidden: true, R: 108, width: 26,
    waves: [[2, 0.1, 0.5]], seed: 5,
    theme: {
      skyTop: 0x2a7bff, skyBottom: 0xffe2b0, fog: 0xffd8b0, fogNear: 120, fogFar: 480,
      ground: 0x4ad65a, ground2: 0x2aae42, liquid: 0x1ec8ff, liquidLevel: -2.2, liquidGlow: 0,
      road: '#5a4a6a', line: '#ffd21f', curbA: 0xff4fd8, curbB: 0xffffff,
      sun: 0xfff0c0, light: 1.25, ambientSky: 0xdfeaff, ambientGround: 0x3a8a3a,
      props: [['tree', 60], ['palm', 40], ['flower', 60], ['mushroom', 20]],
      shore: 0xe8d79a, rock: 0x8a8f7a, peak: 0xa6e86a, cloudAmt: 0.5,
      fx: 'fireflies', fxColor: 0xfff0a0, hills: 14, mountains: 0x6a9ad8, clouds: 0xffffff,
    },
    music: { tempo: 142, root: 55, scale: 'minor', prog: [0, 3, 5, 4], seed: 91, style: 'neon' },
    hills: [[0, 0], [1, 0]], ramps: [0.25, 0.75], noShortcut: true,
    extras: { weather: 'none', hazard: null, life: 'birds', liquidMode: 0, lamp: 0xff4fd8, deck: 0x9a6a3a, tunnelCol: 0x6f7f6a, tunnelGlow: 0xffd98a, puddle: null, mark: 0x15151c, ambience: 'jungle' },
  },
];

export const CUPS = [
  { id: 'platano', name: 'Copa Plátano', icon: '🍌', tracks: ['selva', 'playa', 'volcan'] },
  { id: 'diamante', name: 'Copa Diamante', icon: '💎', tracks: ['hielo', 'neon', 'arcoiris'] },
  { id: 'aventura', name: 'Copa Aventura', icon: '🧭', tracks: ['nubes', 'oceano', 'abismo'] },
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

export const MENU_MUSIC = { tempo: 116, root: 57, scale: 'major', prog: [0, 5, 3, 4], seed: 1, style: 'menu' };
export const PODIUM_MUSIC = { tempo: 126, root: 60, scale: 'major', prog: [0, 3, 4, 0], seed: 44, style: 'podium' };

export function trackById(id) { return TRACKS.find(t => t.id === id) || EXTRA_TRACKS.find(t => t.id === id); }
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
