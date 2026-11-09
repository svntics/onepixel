// Funciones puras para las fotos de época (sin red), para poder probarlas.

// Años de carrera desde Wikidata: clubes (P54) con fecha de inicio (P580) y fin (P582).
// Si el último club no tiene fin, se considera en actividad (fin: null).
export function careerYears(claims) {
  const years = [];
  let open = false;
  for (const s of claims?.P54 ?? []) {
    if (s.rank === "deprecated") continue;
    const start = s.qualifiers?.P580?.[0]?.datavalue?.value?.time;
    const end = s.qualifiers?.P582?.[0]?.datavalue?.value?.time;
    if (start) years.push(Number(start.slice(1, 5)));
    if (end) years.push(Number(end.slice(1, 5)));
    if (start && !end) open = true;
  }
  const valid = years.filter((y) => y > 1850 && y < 2100);
  if (!valid.length) return null;
  return { inicio: Math.min(...valid), fin: open ? null : Math.max(...valid), fuente: "wikidata" };
}

// Primer año plausible (1880–2099) dentro de un texto.
export function yearOf(text) {
  const m = String(text ?? "").match(/\b(18[89]\d|19\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

const EXCLUDE = /signature|firma|autograph|statue|estatua|mural|grave|tumba|stamp|sello|logo|wax|museum|museo|plaque|placa|monument|poster|tattoo|painting|drawing|graffiti|caricat|coat of arms|escudo|banknote|coin|shirt|camiseta|jersey|boot|ticket|cover/i;
const GROUP = /\b(team|squad|equipo|seleccion|selección|and|with|con|y|vs|versus|&|players|jugadores|line-?up|formation)\b/i;

// Puntaje de una foto candidata (null = descartada).
// c: { titulo, año, licOk, ancho, alto, mime }  carrera: { inicio, fin }  tokens: partes del nombre normalizadas
export function scoreEraCandidate(c, carrera, tokens) {
  if (!c.licOk || !/image\/(jpeg|png)/.test(c.mime ?? "")) return null;
  if (!c.ancho || !c.alto || c.ancho < 300 || c.alto < 300) return null;
  if (!c.año || !carrera?.inicio) return null;
  const fin = carrera.fin ?? new Date().getFullYear();
  if (c.año < carrera.inicio || c.año > fin) return null;
  const title = c.titulo.replace(/^File:/, "").replace(/\.[a-z]+$/i, "");
  if (EXCLUDE.test(title)) return null;
  const t = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!tokens.some((w) => t.includes(w))) return null; // el archivo debe nombrar al jugador

  let score = 10;
  const ratio = c.alto / c.ancho;
  if (ratio >= 0.9 && ratio <= 1.6) score += 3; // vertical o cuadrada: suele ser foto individual
  else if (ratio < 0.7) score -= 3; // muy apaisada: suele ser grupal o de lejos
  if (GROUP.test(title)) score -= 4;
  // Preferir la etapa central/alta de la carrera (cuando era más conocido)
  const mid = carrera.inicio + (fin - carrera.inicio) * 0.6;
  score -= Math.abs(c.año - mid) / Math.max(4, fin - carrera.inicio);
  score += Math.min(2, Math.min(c.ancho, c.alto) / 1000);
  return Math.round(score * 100) / 100;
}
