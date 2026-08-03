// Nivel 1 — preguntas para "modo conocerse" (primeras semanas/meses)
// Livianas, sin presión, pensadas para generar conversación natural.
const QUESTIONS = [
  "¿Cuál es tu comida favorita y por qué?",
  "¿Cuál es tu primer recuerdo feliz de la infancia?",
  "¿Qué es algo que siempre quisiste aprender pero nunca hiciste?",
  "¿Cómo te imaginas un fin de semana perfecto?",
  "¿Qué película o canción te marcó y por qué?",
  "¿Prefieres planear todo o improvisar? ¿Por qué?",
  "¿Cuál es un lugar al que sueñas con viajar?",
  "¿Qué es algo que te hace reír solo/a de recordarlo?"
];

// Nivel 2 — profundización (relación reciente, hasta ~2 años)
const LEVEL2_QUESTIONS = [
  "¿Cuál es tu mayor miedo dentro de una relación?",
  "¿Qué necesitas de mí cuando estás pasando un mal momento?",
  "¿Cómo era la dinámica en tu familia cuando eras chico/a?",
  "¿Cuál ha sido un momento en que te sentiste muy vulnerable con alguien?",
  "¿Qué es algo que nunca le has dicho a nadie pero te gustaría compartir conmigo?",
  "¿Qué gesto pequeño te hace sentir amado/a?",
  "¿Qué es algo de ti que te costó aceptar?",
  "¿Cómo prefieres que resolvamos un desacuerdo?"
];

// Nivel 3 — consolidación (2 a 5 años)
const LEVEL3_QUESTIONS = [
  "¿Qué habilidad te gustaría que aprendiéramos juntos este año?",
  "¿Cuál ha sido el momento del que más orgulloso/a te sientes de nosotros?",
  "¿Qué agradeces de mí que quizás no digo lo suficiente?",
  "¿Qué rutina nuestra te gustaría cambiar o refrescar?",
  "¿Cuál es un chiste interno nuestro que nunca deja de darte risa?",
  "¿Qué meta como pareja te gustaría que persiguiéramos?",
  "¿Qué es algo que hemos superado juntos de lo que te sientes orgulloso/a?",
  "¿Cómo te gustaría que celebráramos nuestro próximo aniversario?"
];

// Nivel 4 — mantenimiento a largo plazo (5+ años)
const LEVEL4_QUESTIONS = [
  "¿Qué experiencia nueva quieres que vivamos juntos este año?",
  "¿Qué extrañas de cómo éramos al principio que te gustaría recuperar?",
  "¿Qué es algo de mí que sigue sorprendiéndote después de tanto tiempo?",
  "¿Cómo te imaginas a nosotros en diez años?",
  "¿Qué tradición nuestra no cambiarías por nada?",
  "¿Qué te gustaría que hiciéramos más seguido, aunque sea pequeño?",
  "¿Qué has aprendido de ti mismo/a gracias a esta relación?",
  "¿Qué le dirías a la versión de nosotros que recién empezaba?"
];

const LEVEL_QUESTIONS = {
  level2: LEVEL2_QUESTIONS,
  level3: LEVEL3_QUESTIONS,
  level4: LEVEL4_QUESTIONS
};

// Calcula el nivel según hace cuánto empezó la relación
function computeLevel(startDateStr) {
  const start = new Date(startDateStr);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

  if (months < 24) return 'level2';
  if (months < 60) return 'level3';
  return 'level4';
}
