// localStorage protegido: si el navegador lo bloquea (modo privado, etc.) el juego sigue funcionando.
const PREFIX = "op:";

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}

// ---------- Estadísticas del reto diario (por categoría) ----------
// jugados = retos (días) completados · fotos/aciertos = fotos jugadas/acertadas
// distribucion = fotos acertadas en el intento 1..6 · racha = días seguidos con al menos 1 acierto
const emptyStats = () => ({
  jugados: 0, fotos: 0, aciertos: 0, puntos: 0, mejorPuntaje: 0,
  racha: 0, mejorRacha: 0, ultimoGanado: null, distribucion: [0, 0, 0, 0, 0, 0],
});

export function getStats(cat) {
  const s = { ...emptyStats(), ...load(`stats:${cat}`, {}) };
  // Estadísticas guardadas con el reto de 1 foto: cada día era 1 foto
  if (s.fotos === 0 && s.jugados > 0) {
    s.fotos = s.jugados;
    s.aciertos = s.ganados ?? 0;
  }
  return s;
}

// Registra el reto del día n: fotos = [{ won, points, stage }]
export function recordDailyDay(cat, n, fotos) {
  const s = getStats(cat);
  const total = fotos.reduce((a, f) => a + f.points, 0);
  const wins = fotos.filter((f) => f.won);
  s.jugados++;
  s.fotos += fotos.length;
  s.aciertos += wins.length;
  s.puntos += total;
  s.mejorPuntaje = Math.max(s.mejorPuntaje, total);
  wins.forEach((f) => s.distribucion[f.stage]++);
  if (wins.length) {
    s.racha = s.ultimoGanado === n - 1 ? s.racha + 1 : 1;
    s.ultimoGanado = n;
    s.mejorRacha = Math.max(s.mejorRacha, s.racha);
  } else s.racha = 0;
  delete s.ganados;
  save(`stats:${cat}`, s);
  return s;
}

// Si pasó un día sin ganar, la racha visible es 0.
export function currentStreak(stats, today) {
  return stats.ultimoGanado !== null && today - stats.ultimoGanado <= 1 ? stats.racha : 0;
}
