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

// Generador pseudoaleatorio con semilla (mulberry32): el mismo equipo produce siempre el mismo banco.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Letras trampa: las más comunes en nombres de clubes, para que no sean fáciles de descartar.
const DECOYS = "AEIORNLSTCDMUBGPHFVKYWZJX";

// Tamaño del banco: al menos 12 fichas, al menos 4 trampas, y múltiplo de 6 (filas parejas).
export function bankSize(n) {
  return Math.ceil(Math.max(12, n + 4) / 6) * 6;
}

// Banco de letras: las de la respuesta + trampas, mezcladas de forma determinista.
export function buildBank(answer, seed = hashString(answer)) {
  const letters = answerLetters(answer).split("");
  const rand = rng(seed);
  const total = bankSize(letters.length);
  const bank = [...letters];
  while (bank.length < total) {
    // Sesgo hacia las primeras letras de DECOYS (más comunes)
    const i = Math.floor(rand() ** 1.6 * DECOYS.length);
    bank.push(DECOYS[i]);
  }
  for (let i = bank.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bank[i], bank[j]] = [bank[j], bank[i]];
  }
  return bank;
}

// ---------- Estado del tablero ----------
// slots[i] = índice de la ficha del banco colocada en la casilla i, o null.
export function newBoard(answer, seed) {
  const bank = buildBank(answer, seed);
  return { bank, slots: Array(answerLetters(answer).length).fill(null) };
}

const usedTiles = (board) => new Set(board.slots.filter((s) => s !== null));

// Coloca la ficha en la primera casilla vacía. Devuelve un tablero nuevo (o el mismo si no se puede).
export function placeTile(board, tile) {
  if (usedTiles(board).has(tile) || tile < 0 || tile >= board.bank.length) return board;
  const free = board.slots.indexOf(null);
  if (free < 0) return board;
  const slots = [...board.slots];
  slots[free] = tile;
  return { ...board, slots };
}

// Devuelve al banco la letra de la casilla indicada.
export function removeAt(board, slot) {
  if (board.slots[slot] == null) return board;
  const slots = [...board.slots];
  slots[slot] = null;
  return { ...board, slots };
}

export const clearBoard = (board) => ({ ...board, slots: board.slots.map(() => null) });
export const isFull = (board) => board.slots.every((s) => s !== null);
export const tileIsUsed = (board, tile) => usedTiles(board).has(tile);
export const boardWord = (board) => board.slots.map((s) => (s === null ? "" : board.bank[s])).join("");
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
