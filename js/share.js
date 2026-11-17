// Compartir: retos entre amigos (código o enlace con tu tiempo y tu fantasma) y vídeo de la repetición.
// main.js llama a estos ganchos; aquí vive toda la lógica y su interfaz.
// Nada sale del móvil por su cuenta: el reto viaja en el enlace o el código que el jugador decide enviar, y solo lleva
// datos de la partida (circuito, variante, tiempo, gorila, coche y fantasma).
import * as THREE from './vendor/three.module.min.js';
import { trackById, charById, kartById } from './data.js';
import { makeGorilla, makeKart, mountGorilla, animateGorilla, canvasTex } from './models.js';
import { encode, decode } from './challenge.js';

const BONUS = 40;       // plátanos por superar el reto de un amigo (una sola vez por código)
const KEEP_IDS = 300;   // retos que se recuerdan en la partida guardada
const REC_MAX = 60;     // segundos máximos de vídeo
// Dirección pública del juego. Solo se usa donde la página no tiene una dirección que otro pueda abrir (la app de Android).
const WEB_URL = 'https://doge0098.github.io/Car-Mobile-Game-Amazing-Gorilla/';
const VARIANT_NAMES = { mirror: 'Espejo', reverse: 'Inverso' };
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

export const share = {
  api: null,
  inbox: null, inboxBad: false, // reto que llegó por enlace y aún no se ha enseñado
  pending: null, from: 'menu',  // reto que se está ofreciendo y pantalla a la que se vuelve si se rechaza
  active: null,                 // reto aceptado: se corre contra su fantasma hasta volver al menú
  last: null, out: null,        // última contrarreloj terminada y lo que se envía de ella
  dress: null,                  // materiales del fantasma del amigo
  rec: null, video: null, inReplay: false, recMax: REC_MAX, recTimer: 0, typeOrder: null, badType: '',
  codec: { encode, decode },

  // Se llama una vez al arrancar. api = utilidades de main.js:
  //  $, show(name, overlay), toast, sfx, save (siempre la partida actual), persist, earn(n), fmt(seg), t(texto, vars), lang(), canvas,
  //  getRace(), getTrack(), getScreen(), getMode(), getVariant(), startTimeTrial(trackId, variant), toMenu()
  init(api) {
    this.api = api;
    const { $ } = api, on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    // retos
    on('r-reto', () => this.send());
    on('retoout-share', () => { api.sfx.ui(); this.shareLink(); });
    on('retoout-copy', () => { api.sfx.ui(); this.copy(this.out.code, '📋 Código copiado'); });
    on('retoout-close', () => { api.sfx.back(); api.show('results'); });
    on('tracks-reto', () => { api.sfx.ui(); $('retoin-text').value = ''; $('retoin-err').textContent = ''; api.show('retoin'); });
    on('retoin-ok', () => this.submit());
    on('retoin-cancel', () => { api.sfx.back(); api.show('tracks'); });
    on('retoin-paste', () => this.paste());
    on('reto-yes', () => this.accept());
    on('reto-no', () => { this.pending = null; api.sfx.back(); api.show(this.from); });
    $('retoin-paste')?.classList.toggle('hidden', !(navigator.clipboard && navigator.clipboard.readText));
    // las teclas escritas en los cuadros de texto no deben llegar al juego (E, H, P, Intro y las flechas son controles)
    for (const id of ['retoin-text', 'retoout-code']) for (const ev of ['keydown', 'keyup']) $(id)?.addEventListener(ev, e => e.stopPropagation());
    $('retoout-code')?.addEventListener('focus', e => e.target.select());
    // un reto pendiente se enseña al llegar al menú, también al rechazar el tutorial la primera vez o al volver de otra pantalla
    for (const b of [$('tuto-no'), ...document.querySelectorAll('[data-back]')]) b?.addEventListener('click', () => this.afterStart());
    this.readHash();
    addEventListener('hashchange', () => { if (this.readHash()) this.afterStart(); });
    // vídeo
    on('replay-rec', () => this.recButton());
    on('video-save', () => { api.sfx.ui(); this.videoSave(); this.videoClose(); });
    on('video-share', () => { api.sfx.ui(); this.videoShare(() => this.videoClose()); });
    on('video-close', () => { api.sfx.back(); this.videoClose(); });
    this.recUi();
    setTimeout(() => { if (window.__game) window.__game.share = this; }, 0); // acceso para pruebas automáticas
  },

  // Tras pulsar «¡A CORRER!» en la pantalla de título (para avisar de un reto que llegó por enlace)
  afterStart() {
    const api = this.api;
    if (this.inboxBad) { this.inboxBad = false; this.clearHash(); api.toast('Ese enlace de reto no es válido'); return; }
    const c = this.inbox; if (!c || api.getRace() || api.getScreen() !== 'menu') return;
    this.inbox = null; this.clearHash(); this.offer(c, 'menu');
  },

  // Fantasma que debe usar la contrarreloj en este circuito, o null para usar el mejor tiempo propio
  ghost(trackId, variant) {
    const c = this.active;
    if (!c) return null;
    if (c.track !== trackId || c.variant !== (variant || '')) { this.active = null; return null; }
    setTimeout(() => this.dressGhost(), 0); // en cuanto exista la carrera, el fantasma se viste de amigo
    return c.ghost;
  },

  // Al terminar una contrarreloj. ctx = { time, record, list (elemento <ol>), extras (textos del desglose del premio),
  //  track, variant, rec (fantasma recién grabado), char, kart }. Devuelve los plátanos extra que haya que sumar.
  timeResult(ctx) {
    const { $, t, fmt, save } = this.api, variant = ctx.variant || '';
    const L = this.last = { track: ctx.track.id, variant, time: ctx.time, char: ctx.char, kart: ctx.kart };
    L.code = encode({ ...L, ghost: ctx.rec });
    $('r-reto')?.classList.toggle('hidden', !L.code);
    const c = this.active;
    if (!c || c.track !== L.track || c.variant !== variant) return 0;
    // reto de un amigo: su tiempo en la lista y si se ha superado
    const won = ctx.time < c.time, li = document.createElement('li');
    li.className = 'reto' + (won ? ' won' : '');
    li.innerHTML = '<b>🤝</b><span>Tu amigo</span><span></span><span></span>';
    li.children[2].textContent = won ? '¡Superado!' : `Te faltaron ${(ctx.time - c.time).toFixed(2)} s`;
    li.children[3].textContent = fmt(c.time);
    ctx.list.appendChild(li);
    if (!won) return 0;
    $('r-title').textContent = '🤝 ¡Reto superado!';
    if (!Array.isArray(save.retos)) save.retos = [];
    if (save.retos.includes(c.id)) return 0;
    this.remember(c.id); // el premio se da una sola vez por código (main.js guarda la partida al pagar)
    ctx.extras.push(t('reto +{n}', { n: BONUS }));
    return BONUS;
  },

  // Empieza y termina la repetición de la carrera
  replayStart() { this.inReplay = true; this.dropVideo(); this.recUi(); },
  replayEnd() {
    this.inReplay = false;
    if (this.rec) this.recStop();                           // el vídeo se ofrece cuando el grabador entrega el archivo
    else if (this.video) setTimeout(() => this.videoOffer(), 0); // grabado antes de acabar: se ofrece ya en los resultados
    this.recUi();
  },

  // Al volver al menú
  reset() {
    this.active = this.last = this.out = this.pending = null; this.inReplay = false;
    this.undress();
    if (this.rec) { this.rec.drop = true; this.recStop(); }
    this.dropVideo(); this.recUi();
    this.api.$('r-reto')?.classList.add('hidden');
    if (this.inbox || this.inboxBad) setTimeout(() => this.afterStart(), 0); // reto pendiente (p. ej. tras el tutorial)
  },

  // ---------- Retos: recibir ----------
  // Lee «#reto=...» de la dirección. Devuelve true si había uno (válido o no).
  readHash() {
    const m = /[#&]reto=([^&]*)/.exec(location.hash || '');
    if (!m) return false;
    this.inbox = decode(m[1]); this.inboxBad = !this.inbox;
    return true;
  },
  clearHash() {
    if (!/[#&]reto=/.test(location.hash || '')) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  },
  label(c) { return trackById(c.track).name + (VARIANT_NAMES[c.variant] ? ' · ' + VARIANT_NAMES[c.variant] : '') + ' · ⏱ ' + this.api.fmt(c.time); },
  // Enseña el reto (circuito, variante y tiempo del amigo) para aceptarlo o dejarlo
  offer(c, from) {
    const { $, save } = this.api;
    this.pending = c; this.from = from;
    $('reto-text').textContent = Array.isArray(save.retos) && save.retos.includes(c.id) ? 'Este reto ya no da premio, pero puedes correrlo otra vez.'
      : `Un amigo te reta a superar su tiempo. Si lo consigues, ganas ${BONUS} 🍌.`;
    $('reto-info').textContent = this.label(c);
    $('reto-who').textContent = `Su gorila: ${charById(c.char).name}. Su coche: ${kartById(c.kart).name}.`;
    this.api.show('reto');
  },
  // Los circuitos bloqueados también se pueden correr con un reto
  accept() {
    const c = this.pending; if (!c) return;
    this.pending = null; this.active = c;
    this.api.sfx.ui(); this.api.startTimeTrial(c.track, c.variant);
  },
  submit() {
    const { $, sfx } = this.api, c = decode($('retoin-text').value);
    if (!c) { sfx.deny(); $('retoin-err').textContent = 'Ese código no es válido. Cópialo entero y pégalo otra vez.'; return; }
    sfx.ui(); this.offer(c, 'tracks');
  },
  paste() {
    const { $, sfx } = this.api;
    sfx.ui();
    navigator.clipboard.readText().then(s => { if (s) { $('retoin-text').value = s.trim(); $('retoin-err').textContent = ''; } })
      .catch(() => { $('retoin-err').textContent = 'No se pudo leer el portapapeles. Mantén pulsado el cuadro y elige «Pegar».'; });
  },
  remember(id) {
    const s = this.api.save;
    if (!Array.isArray(s.retos)) s.retos = [];
    if (!s.retos.includes(id)) s.retos.push(id);
    if (s.retos.length > KEEP_IDS) s.retos.splice(0, s.retos.length - KEEP_IDS);
  },
  // El fantasma del amigo: su gorila y su coche, en naranja y con un cartel, para distinguirlo del fantasma propio
  dressGhost() {
    const race = this.api.getRace(), c = this.active;
    this.undress();
    if (!race || !c || !race.ghost || race.ghostData !== c.ghost) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.4, depthWrite: false });
    const kart = makeKart(kartById(c.kart), null, mat), gorilla = mountGorilla(kart, makeGorilla(charById(c.char), mat));
    animateGorilla(gorilla, 0, {});
    const word = this.api.t('AMIGO'), tex = canvasTex(192, 56, g => {
      g.fillStyle = '#1a0b3a'; g.fillRect(0, 0, 192, 56); g.fillStyle = '#ff9a1a'; g.fillRect(5, 5, 182, 46);
      g.fillStyle = '#fff'; g.font = 'italic 900 32px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, 96, 30, 172);
    });
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false, transparent: true, opacity: 0.9 }));
    tag.scale.set(4.1, 1.2, 1); tag.position.y = 4.5;
    const g = race.ghost;
    for (let i = g.children.length - 1; i >= 0; i--) g.remove(g.children[i]);
    g.add(kart, gorilla, tag);
    this.dress = { mat, tex, tagMat: tag.material };
  },
  undress() { const d = this.dress; if (d) { d.mat.dispose(); d.tex.dispose(); d.tagMat.dispose(); this.dress = null; } },

  // ---------- Retos: enviar ----------
  // Abre la ventana con el código y, de paso, comparte el enlace (o lo copia si el navegador no sabe compartir)
  send() {
    const { $, t, fmt, sfx, toast } = this.api, L = this.last;
    if (!L || !L.code) { sfx.deny(); toast('Esta carrera no sirve como reto'); return; }
    sfx.ui();
    const c = decode(L.code);
    if (c) { this.remember(c.id); this.api.persist(); } // superar el reto propio no da premio
    const base = window.Capacitor || !/^https?:$/.test(location.protocol) ? WEB_URL : location.origin + location.pathname;
    const place = t(trackById(L.track).name) + (VARIANT_NAMES[L.variant] ? ' (' + t(VARIANT_NAMES[L.variant]) + ')' : '');
    this.out = { code: L.code, link: base + '#reto=' + L.code, text: t('🦍 ¡Te reto en Amazing Gorilla Racing! He hecho {time} en {track}. ¿Puedes superarlo?', { time: fmt(L.time), track: place }) };
    $('retoout-info').textContent = this.label(L);
    $('retoout-code').value = L.code;
    $('retoout-share').textContent = navigator.share ? '📤 Enviar enlace' : '🔗 Copiar enlace';
    this.api.show('retoout');
    this.shareLink();
  },
  shareLink() {
    const o = this.out; if (!o) return;
    const copy = () => this.copy(o.link, '🔗 Enlace copiado: envíaselo a tu amigo');
    if (!navigator.share) { copy(); return; }
    try { navigator.share({ title: 'Amazing Gorilla Racing', text: o.text, url: o.link }).catch(e => { if (!e || e.name !== 'AbortError') copy(); }); } catch (e) { copy(); }
  },
  // Copia un texto al portapapeles (con el método antiguo si el nuevo no está o falla)
  copy(text, msg) {
    const { toast } = this.api;
    const old = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'reto-code'; ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* no permitido */ }
      ta.remove();
      toast(ok ? msg : 'No se pudo copiar: cópialo a mano');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(msg), old); else old();
  },

  // ---------- Vídeo de la repetición ----------
  // Graba el lienzo del juego mientras se ve la repetición. Donde no se puede (o no se podría guardar), no hay botón.
  videoOk() { return !window.Capacitor && typeof MediaRecorder !== 'undefined' && !!this.api.canvas.captureStream; },
  // Estado del botón: grabar · detener (grabando) · guardar (vídeo listo)
  recUi() {
    const { $ } = this.api, b = $('replay-rec'), tag = $('replay-rec-tag'); if (!b) return;
    b.classList.toggle('hidden', !this.videoOk());
    b.classList.toggle('on', !!this.rec);
    b.textContent = this.rec ? '⏹ Detener' : this.video ? '💾 Guardar vídeo' : '⏺ Grabar vídeo';
    tag?.classList.toggle('hidden', !this.rec);
  },
  recButton() {
    this.api.sfx.ui();
    if (this.rec) this.recStop();
    else if (this.video) { const done = () => { this.dropVideo(); this.recUi(); }; if (!this.videoShare(done)) { this.videoSave(); done(); } }
    else this.recStart();
  },
  // Formatos por orden de preferencia. En el móvil, MP4 (lo codifica el propio teléfono y lo abre cualquier app de mensajes);
  // en el ordenador, WebM, que es más ligero de codificar. Un formato que no dio datos no se vuelve a probar.
  videoTypes() {
    const mp4 = ['video/mp4;codecs=avc1.42E01E', 'video/mp4'], webm = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
    return (this.typeOrder || (mobile ? [...mp4, ...webm] : [...webm, ...mp4])).filter(m => !m.startsWith(this.badType || '-') && MediaRecorder.isTypeSupported(m));
  },
  recStart() {
    const { canvas, toast, $ } = this.api;
    if (this.rec || !this.videoOk()) return;
    let rec, stream;
    const types = this.videoTypes(), type = types[0] || '', family = type.split(';')[0], other = !!type && types.some(m => !m.startsWith(family));
    try {
      stream = canvas.captureStream(30);
      rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: Math.round(Math.min(4e6, Math.max(1.2e6, canvas.width * canvas.height * 2.2))) });
    } catch (e) { toast('Este navegador no puede grabar el vídeo'); return; }
    const chunks = []; let frames = 0; // trozos de vídeo recibidos y fotogramas dibujados mientras se graba
    rec.ondataavailable = e => { if (e.data && e.data.size) { chunks.push(e.data); rec.bytes = (rec.bytes || 0) + e.data.size; } };
    rec.onerror = () => { rec.drop = true; if (this.rec === rec) this.recStop(); toast('No se pudo grabar el vídeo'); };
    rec.onstop = () => {
      for (const tr of stream.getTracks()) tr.stop();
      if (this.rec === rec) { this.rec = null; clearInterval(this.recTimer); }
      const mime = (rec.mimeType || type || 'video/webm').split(';')[0], blob = new Blob(chunks, { type: mime });
      if (rec.drop) { this.recUi(); return; }
      if (!blob.size) { if (other && frames > 90) this.badType = family; this.recUi(); toast('No se pudo grabar el vídeo'); return; }
      this.video = { blob, type: mime, secs: ((rec.t1 || performance.now()) - rec.t0) / 1000, name: 'gorilla-racing-' + Date.now() + (mime.includes('mp4') ? '.mp4' : '.webm') };
      this.recUi();
      if (this.inReplay) toast('🎬 Vídeo listo: pulsa «Guardar vídeo»'); else this.videoOffer();
    };
    this.rec = rec; rec.t0 = performance.now();
    rec.start(1000);
    // contador a la vista, tope de duración y vigilancia: debería llegar un trozo de vídeo cada segundo; si tras 6 s y
    // 90 fotogramas dibujados no ha llegado ninguno, ese formato no funciona aquí y se sigue grabando con el otro
    const count = () => { if (this.rec === rec) { frames++; requestAnimationFrame(count); } };
    requestAnimationFrame(count);
    const tick = () => {
      const s = (performance.now() - rec.t0) / 1000, el = $('replay-rec-time');
      if (el) el.textContent = mmss(s);
      if (s >= this.recMax) this.recStop();
      else if (frames > 90 && s > 6 && !chunks.length && other) { this.badType = family; rec.drop = true; this.recStop(); this.recStart(); }
    };
    tick(); this.recTimer = setInterval(tick, 250);
    this.recUi();
  },
  recStop() {
    const rec = this.rec; if (!rec) return;
    this.rec = null; clearInterval(this.recTimer); rec.t1 = performance.now();
    try { if (rec.state !== 'inactive') rec.stop(); else rec.onstop(); } catch (e) { rec.onstop(); }
    this.recUi();
  },
  // Al acabar la repetición: ventana para compartir o guardar el vídeo
  videoOffer() {
    const { $ } = this.api, v = this.video; if (!v) return;
    if (this.api.getScreen() !== 'results') { this.dropVideo(); return; }
    $('video-info').textContent = `Duración: ${Math.max(1, Math.round(v.secs))} s (${v.blob.size < 1048576 ? Math.max(1, Math.round(v.blob.size / 1024)) + ' KB' : (v.blob.size / 1048576).toFixed(1) + ' MB'})`;
    $('video-share').classList.toggle('hidden', !this.canShareFile());
    this.api.show('video');
  },
  videoFile() { const v = this.video; return new File([v.blob], v.name, { type: v.type }); },
  canShareFile() { try { return !!(this.video && navigator.canShare && navigator.share && navigator.canShare({ files: [this.videoFile()] })); } catch (e) { return false; } },
  // Comparte el archivo con las apps del móvil y luego llama a done(). Si el jugador cierra el menú de compartir, el vídeo
  // sigue ahí; si compartir falla, se descarga. Devuelve false si este navegador no puede compartir archivos.
  videoShare(done) {
    if (!this.canShareFile()) return false;
    const v = this.video;
    navigator.share({ files: [this.videoFile()], title: 'Amazing Gorilla Racing' }).then(done, e => { if (!e || e.name !== 'AbortError') { this.videoSave(v); done(); } });
    return true;
  },
  videoSave(v = this.video) {
    if (!v) return;
    const a = document.createElement('a'), url = URL.createObjectURL(v.blob);
    a.href = url; a.download = v.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    this.api.toast('🎬 Vídeo guardado en Descargas');
  },
  videoClose() { this.dropVideo(); this.recUi(); if (this.api.getScreen() === 'video') this.api.show('results'); },
  dropVideo() { this.video = null; },
};
