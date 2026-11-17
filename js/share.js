// Compartir: retos entre amigos (código o enlace con tu tiempo y tu fantasma) y vídeo de la repetición.
// main.js llama a estos ganchos; aquí vive toda la lógica y su interfaz.
export const share = {
  api: null,

  // Se llama una vez al arrancar. api = utilidades de main.js:
  //  $, show(name, overlay), toast, sfx, save (siempre la partida actual), persist, earn(n), fmt(seg), t(texto, vars), lang(), canvas,
  //  getRace(), getTrack(), getScreen(), getMode(), getVariant(), startTimeTrial(trackId, variant), toMenu()
  init(api) { this.api = api; },

  // Tras pulsar «¡A CORRER!» en la pantalla de título (para avisar de un reto que llegó por enlace)
  afterStart() {},

  // Fantasma que debe usar la contrarreloj en este circuito, o null para usar el mejor tiempo propio
  ghost(trackId, variant) { return null; },

  // Al terminar una contrarreloj. ctx = { time, record, list (elemento <ol>), extras (textos del desglose del premio),
  //  track, variant, rec (fantasma recién grabado), char, kart }. Devuelve los plátanos extra que haya que sumar.
  timeResult(ctx) { return 0; },

  // Empieza y termina la repetición de la carrera
  replayStart() {},
  replayEnd() {},

  // Al volver al menú
  reset() {},
};
