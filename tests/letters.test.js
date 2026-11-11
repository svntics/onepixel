import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAnswer, answerWords, answerLetters, newBoard, placeLetter, removeAt, removeLast,
  clearBoard, fillAnswer, isFull, isCorrect, boardWord, teamScore, KEYBOARD_ROWS,
} from "../public/js/letters.js";

test("normaliza la respuesta: sin tildes, mayúsculas y un espacio entre palabras", () => {
  assert.equal(normalizeAnswer("Atlético de Madrid"), "ATLETICO DE MADRID");
  assert.equal(normalizeAnswer("  Bayern  Múnich "), "BAYERN MUNICH");
  assert.equal(normalizeAnswer("Peñarol"), "PENAROL");
  assert.equal(normalizeAnswer("Schalke 04"), "SCHALKE");
  assert.deepEqual(answerWords("West Ham"), ["WEST", "HAM"]);
  assert.equal(answerLetters("West Ham"), "WESTHAM");
});

test("el teclado tiene las 26 letras, sin repetir", () => {
  const all = KEYBOARD_ROWS.join("");
  assert.equal(all.length, 26);
  assert.equal(new Set(all).size, 26);
  assert.deepEqual([...all].sort().join(""), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
});

test("poner, borrar y validar letras (se pueden repetir)", () => {
  let b = newBoard("Arsenal");
  for (const c of "ars") b = placeLetter(b, c);
  assert.equal(boardWord(b), "ARS");
  b = removeAt(b, 1);
  assert.equal(boardWord(b), "AS");
  b = placeLetter(b, "R"); // vuelve a la primera casilla libre (la 1)
  assert.equal(boardWord(b), "ARS");
  for (const c of "ENAL") b = placeLetter(b, c);
  assert.ok(isFull(b));
  assert.ok(isCorrect(b, "Arsenal"));
  assert.equal(placeLetter(b, "X"), b, "con todo lleno no se agrega nada");
  b = removeLast(b);
  assert.equal(boardWord(b), "ARSENA");
  assert.ok(!isCorrect(b, "Arsenal"));
  b = clearBoard(b);
  assert.equal(boardWord(b), "");
  assert.equal(placeLetter(newBoard("Leeds"), "ñ").slots[0], null, "solo A-Z");
  assert.ok(isCorrect(fillAnswer("West Ham"), "West Ham"));
});

test("puntaje: menos fotos = más puntos; errores con las 4 fotos, rapidez y rendirse", () => {
  assert.equal(teamScore({ won: true, shown: 1, seconds: 20 }), 230);
  assert.equal(teamScore({ won: true, shown: 2, seconds: 50 }), 165);
  assert.equal(teamScore({ won: true, shown: 3, seconds: 500 }), 100);
  assert.equal(teamScore({ won: true, shown: 4, seconds: 500 }), 60);
  assert.equal(teamScore({ won: true, shown: 4, errors: 3, seconds: 500 }), 30);
  assert.equal(teamScore({ won: true, shown: 4, errors: 9, seconds: 500 }), 20);
  assert.equal(teamScore({ won: false, shown: 1, seconds: 5 }), 0);
  assert.equal(teamScore({ won: true, shown: 1, seconds: 500, mapHint: true }), 180);
  assert.equal(teamScore({ won: true, shown: 4, errors: 9, seconds: 500, mapHint: true }), 20);
});
