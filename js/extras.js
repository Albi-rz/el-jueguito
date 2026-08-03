// ---------- Paletas seleccionables para el modo pareja ----------
const PALETTES = [
  { id: "terracota", label: "Terracota",     colors: ["#C97C5D", "#A85A3E", "#D9A441"] },
  { id: "dorado",    label: "Dorado",        colors: ["#D9A441", "#B5822B", "#C97C5D"] },
  { id: "morado",    label: "Lavanda",       colors: ["#8B6BA8", "#6B4C87", "#D9A441"] },
  { id: "verde",     label: "Verde bosque",  colors: ["#6B8E5A", "#4F6B41", "#D9A441"] }
];

// ---------- Test de lenguajes del amor (Gary Chapman) ----------
// Cada par contrasta dos lenguajes; a lo largo de las 5 rondas cada uno aparece 2 veces.
const LOVE_LANGUAGE_PAIRS = [
  { a: { text: "Que me digas explícitamente lo que valoras de mí", lang: "words" },
    b: { text: "Que pasemos tiempo enfocados solo el uno en el otro", lang: "quality_time" } },
  { a: { text: "Que me ayudes con algo sin que te lo pida", lang: "acts" },
    b: { text: "Que me sorprendas con un detalle pensado para mí", lang: "gifts" } },
  { a: { text: "Un abrazo o que me tomes de la mano", lang: "touch" },
    b: { text: "Que me digas lo orgulloso/a que estás de mí", lang: "words" } },
  { a: { text: "Que apartes tiempo solo para estar conmigo, sin celular", lang: "quality_time" },
    b: { text: "Que hagas algo por mí que sabes que me cuesta hacer", lang: "acts" } },
  { a: { text: "Un regalo pequeño que muestre que pensaste en mí", lang: "gifts" },
    b: { text: "Contacto físico, aunque sea sentarnos cerca", lang: "touch" } }
];

const LOVE_LANG_LABELS = {
  words: "Palabras de afirmación",
  quality_time: "Tiempo de calidad",
  acts: "Actos de servicio",
  gifts: "Regalos con intención",
  touch: "Contacto físico"
};

// ---------- Chequeo mensual: áreas a calificar del 1 al 10 ----------
const CHECKIN_AREAS = [
  { key: "comunicacion", label: "Comunicación" },
  { key: "intimidad", label: "Intimidad" },
  { key: "diversion", label: "Diversión / novedad" },
  { key: "tiempo", label: "Tiempo de calidad" }
];
