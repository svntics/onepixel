// Puntuación: más blur al acertar = más puntos.
//   Puntos = BASE + POR_PX × b      (b = nivel de blur con el que se acertó)
//   Derrota = 0 puntos. Pedir una pista avanza un nivel, igual que fallar.

export const BASE = 100;
export const POR_PX = 20;

export function pointsForBlur(blurLevel) {
  return BASE + POR_PX * blurLevel;
}

// stage = intentos ya consumidos (fallos + pistas) antes del acierto, de 0 a 5
export function scoreRound({ won, stage, levels }) {
  if (!won) return 0;
  return pointsForBlur(levels[stage]);
}
