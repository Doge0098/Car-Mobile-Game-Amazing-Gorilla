// Traducciones al inglés de los retos entre amigos y del vídeo de la repetición (js/share.js).
// Mismo formato que lang_en.js: clave = texto en español tal como aparece en el juego.
export const EN_SHARE = {
  // ---------- Retos: recibir ----------
  '🤝 Introducir reto': '🤝 Enter a challenge',
  '🤝 Reto': '🤝 Challenge',
  'Este reto ya no da premio, pero puedes correrlo otra vez.': 'This challenge no longer pays a prize, but you can race it again.',
  '🏁 Aceptar el reto': '🏁 Accept the challenge',
  'Pega aquí el código o el enlace que te ha enviado tu amigo.': 'Paste the code or the link your friend sent you here.',
  '📋 Pegar': '📋 Paste',
  'Ver reto ▶': 'See challenge ▶',
  'Cancelar': 'Cancel',
  'Ese código no es válido. Cópialo entero y pégalo otra vez.': 'That code is not valid. Copy all of it and paste it again.',
  'Ese enlace de reto no es válido': 'That challenge link is not valid',
  'No se pudo leer el portapapeles. Mantén pulsado el cuadro y elige «Pegar».': 'Could not read the clipboard. Press and hold the box and choose “Paste”.',
  'AMIGO': 'FRIEND',
  'Tu amigo': 'Your friend',
  '¡Superado!': 'Beaten!',
  '🤝 ¡Reto superado!': '🤝 Challenge beaten!',
  'reto +{n}': 'challenge +{n}',

  // ---------- Retos: enviar ----------
  '📤 Retar a un amigo': '📤 Challenge a friend',
  'Envía el enlace a un amigo: correrá contra tu fantasma. También puede pegar este código en Contrarreloj.': 'Send the link to a friend: they will race against your ghost. They can also paste this code in Time trial.',
  '📤 Enviar enlace': '📤 Send link',
  '🔗 Copiar enlace': '🔗 Copy link',
  '📋 Copiar código': '📋 Copy code',
  'Cerrar': 'Close',
  '🔗 Enlace copiado: envíaselo a tu amigo': '🔗 Link copied: send it to your friend',
  '📋 Código copiado': '📋 Code copied',
  'No se pudo copiar: cópialo a mano': 'Could not copy: copy it by hand',
  'Esta carrera no sirve como reto': 'This race cannot be used as a challenge',
  '🦍 ¡Te reto en Amazing Gorilla Racing! He hecho {time} en {track}. ¿Puedes superarlo?': '🦍 I challenge you in Amazing Gorilla Racing! I did {time} on {track}. Can you beat it?',

  // ---------- Vídeo de la repetición ----------
  '⏺ Grabar vídeo': '⏺ Record video',
  '⏹ Detener': '⏹ Stop',
  '💾 Guardar vídeo': '💾 Save video',
  'GRABANDO': 'RECORDING',
  '🎬 Vídeo listo': '🎬 Video ready',
  '📤 Compartir vídeo': '📤 Share video',
  '⬇️ Guardar vídeo': '⬇️ Save video',
  '🎬 Vídeo listo: pulsa «Guardar vídeo»': '🎬 Video ready: tap “Save video”',
  '🎬 Vídeo guardado en Descargas': '🎬 Video saved to Downloads',
  'No se pudo grabar el vídeo': 'Could not record the video',
  'Este navegador no puede grabar el vídeo': 'This browser cannot record the video',
};

// Plantillas con huecos (como EN_PATTERNS). No chocan con las genéricas de lang_en.js: da igual el orden en que se unan.
export const EN_SHARE_PATTERNS = [
  ['Un amigo te reta a superar su tiempo. Si lo consigues, ganas {n} 🍌.', 'A friend challenges you to beat their time. Do it and you win {n} 🍌.'],
  ['Su gorila: {char}. Su coche: {kart}.', 'Their gorilla: {char}. Their kart: {kart}.'],
  ['Te faltaron {d} s', '{d} s short'],
  ['Duración: {s} s ({size})', 'Length: {s} s ({size})'],
];
