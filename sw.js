// Service worker: guarda todo el juego para jugar sin conexión.
const VERSION = 'agr-v8';
const FILES = [
  './', 'index.html', 'privacy.html', 'manifest.webmanifest', 'css/style.css', 'css/custom.css',
  'js/main.js', 'js/data.js', 'js/save.js', 'js/audio.js', 'js/input.js', 'js/track.js',
  'js/race.js', 'js/fx.js', 'js/models.js', 'js/scenery.js', 'js/world.js', 'js/post.js', 'js/podium.js', 'js/outline.js', 'js/rules.js', 'js/replay.js', 'js/extras.js', 'js/showroom.js', 'js/i18n.js', 'js/lang_en.js', 'js/meta.js', 'js/shop.js', 'js/tutorial.js', 'js/share.js', 'js/variants.js', 'js/daily.js', 'js/boss.js', 'js/emotes.js', 'js/lang_en_custom.js', 'js/vendor/three.module.min.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
