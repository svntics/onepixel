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
const emptyStats = () => ({ jugados: 0, ganados: 0, racha: 0, mejorRacha: 0, ultimoGanado: null, puntos: 0, distribucion: [0, 0, 0, 0, 0, 0] });

export function getStats(cat) {
  return { ...emptyStats(), ...load(`stats:${cat}`, {}) };
}

// Registra el resultado del reto n. Racha = retos diarios ganados en días consecutivos.
export function recordDaily(cat, n, { won, points, stage }) {
  const s = getStats(cat);
  s.jugados++;
  s.puntos += points;
  if (won) {
    s.ganados++;
    s.distribucion[stage]++;
    s.racha = s.ultimoGanado === n - 1 ? s.racha + 1 : 1;
    s.ultimoGanado = n;
    s.mejorRacha = Math.max(s.mejorRacha, s.racha);
  } else {
    s.racha = 0;
  }
  save(`stats:${cat}`, s);
  return s;
}

// Si pasó un día sin ganar, la racha visible es 0.
export function currentStreak(stats, today) {
  return stats.ultimoGanado !== null && today - stats.ultimoGanado <= 1 ? stats.racha : 0;
}
