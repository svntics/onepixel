// Reto diario: misma ronda para todos según la fecha en Chile (America/Santiago).
// Funciones puras para poder probarlas (se pasan la fecha y los datos como argumentos).

// Fecha "AAAA-MM-DD" vista en la zona horaria indicada.
export function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Número de reto: el día EPOCH es el #1.
export function challengeNumber(dateStr, epochStr) {
  const toUTC = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(dateStr) - toUTC(epochStr)) / 86400000) + 1;
}

// Generador pseudoaleatorio con semilla (mulberry32) + hash de texto (FNV-1a).
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Orden mezclado (determinístico) de las rondas de una categoría para un "ciclo".
// Cada ciclo recorre a todos los jugadores una vez, sin repetir.
export function cycleOrder(categoryId, cycle, total) {
  const rand = mulberry32(hashString(`${categoryId}#${cycle}`));
  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Rondas del día n para todas las categorías, evitando que el mismo jugador salga
// el mismo día en dos categorías. `categories`: [{ id, keys: [clave de cada ronda] }] en orden fijo.
export function dailyPicks(n, categories) {
  const used = new Set();
  const picks = {};
  for (const { id, keys } of categories) {
    const total = keys.length;
    if (!total) continue;
    const cycle = Math.floor((n - 1) / total);
    let pos = (((n - 1) % total) + total) % total;
    const order = cycleOrder(id, cycle, total);
    let tries = 0;
    while (used.has(keys[order[pos]]) && tries < total) {
      pos = (pos + 1) % total;
      tries++;
    }
    picks[id] = order[pos];
    used.add(keys[order[pos]]);
  }
  return picks;
}

// Milisegundos hasta la próxima medianoche en la zona horaria (aprox.: ±1 h el día de cambio de horario).
export function msUntilNextDay(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 + date.getMilliseconds();
  return 86400000 - elapsed;
}
