// Lógica pura del modo "4 Fotos 1 Equipo": casillas de letras y banco de letras.
// Sin DOM, para poder probarla con node:test.

// "Atlético de Madrid" → "ATLETICO DE MADRID": sin tildes (Ñ → N), solo A-Z y un espacio entre palabras.
export function normalizeAnswer(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras de la respuesta (cada una es un grupo de casillas).
export const answerWords = (answer) => normalizeAnswer(answer).split(" ").filter(Boolean);

// Letras de la respuesta sin espacios.
export const answerLetters = (answer) => answerWords(answer).join("");

// Teclado completo en orden QWERTY (todas las letras; cada una se puede usar las veces que haga falta).
export const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

// ---------- Estado del tablero ----------
// slots[i] = letra puesta en la casilla i, o null.
export const newBoard = (answer) => ({ slots: Array(answerLetters(answer).length).fill(null) });

// Pone la letra en la primera casilla vacía. Devuelve un tablero nuevo (o el mismo si no se puede).
export function placeLetter(board, letter) {
  const c = String(letter).toUpperCase();
  const free = board.slots.indexOf(null);
  if (free < 0 || !/^[A-Z]$/.test(c)) return board;
  const slots = [...board.slots];
  slots[free] = c;
  return { slots };
}

// Borra la letra de la casilla indicada.
export function removeAt(board, slot) {
  if (board.slots[slot] == null) return board;
  const slots = [...board.slots];
  slots[slot] = null;
  return { slots };
}

// Borra la última letra puesta (tecla ⌫).
export function removeLast(board) {
  const last = board.slots.findLastIndex((s) => s !== null);
  return last < 0 ? board : removeAt(board, last);
}

export const clearBoard = (board) => ({ slots: board.slots.map(() => null) });
export const fillAnswer = (answer) => ({ slots: answerLetters(answer).split("") });
export const isFull = (board) => board.slots.every((s) => s !== null);
export const boardWord = (board) => board.slots.map((s) => s ?? "").join("");
export const isCorrect = (board, answer) => isFull(board) && boardWord(board) === answerLetters(answer);

// ---------- Puntaje ----------
// Según cuántas fotos se necesitaron: 1 → 200, 2 → 150, 3 → 100, 4 → 60.
// Con las 4 a la vista, cada intento fallido resta 10 (mínimo 20). Bono por rapidez: +30 (≤30 s) o +15 (≤60 s).
// Rendirse = 0.
export const PHOTO_POINTS = [200, 150, 100, 60];
export function teamScore({ won, shown = 1, errors = 0, seconds = Infinity }) {
  if (!won) return 0;
  const base = Math.max(20, PHOTO_POINTS[Math.min(Math.max(shown, 1), 4) - 1] - 10 * errors);
  const bonus = seconds <= 30 ? 30 : seconds <= 60 ? 15 : 0;
  return base + bonus;
}
