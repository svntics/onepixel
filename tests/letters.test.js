import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAnswer, answerWords, answerLetters, buildBank, bankSize, newBoard, placeTile, removeAt,
  clearBoard, isFull, isCorrect, boardWord, tileIsUsed, teamScore,
} from "../public/js/letters.js";

test("normaliza la respuesta: sin tildes, mayúsculas y un espacio entre palabras", () => {
  assert.equal(normalizeAnswer("Atlético de Madrid"), "ATLETICO DE MADRID");
  assert.equal(normalizeAnswer("  Bayern  Múnich "), "BAYERN MUNICH");
  assert.equal(normalizeAnswer("Peñarol"), "PENAROL");
  assert.equal(normalizeAnswer("Schalke 04"), "SCHALKE");
  assert.deepEqual(answerWords("West Ham"), ["WEST", "HAM"]);
  assert.equal(answerLetters("West Ham"), "WESTHAM");
});

test("el banco contiene todas las letras de la respuesta más trampas", () => {
  for (const name of ["Arsenal", "Nottingham Forest", "Brighton", "Atlético de Madrid"]) {
    const bank = buildBank(name);
    const letters = answerLetters(name);
    assert.equal(bank.length, bankSize(letters.length));
    assert.ok(bank.length - letters.length >= 4, "al menos 4 trampas");
    assert.equal(bank.length % 6, 0);
    const pool = [...bank];
    for (const c of letters) {
      const i = pool.indexOf(c);
      assert.ok(i >= 0, `falta la letra ${c} en el banco de ${name}`);
      pool.splice(i, 1);
    }
  }
  assert.deepEqual(buildBank("Arsenal"), buildBank("Arsenal"), "determinista");
});

test("colocar, quitar y validar letras", () => {
  let b = newBoard("Arsenal");
  const order = [];
  const used = new Set();
  for (const c of "ARSENAL") {
    const t = b.bank.findIndex((x, i) => x === c && !used.has(i));
    used.add(t);
    order.push(t);
  }
  for (const t of order.slice(0, 3)) b = placeTile(b, t);
  assert.equal(boardWord(b), "ARS");
  assert.equal(placeTile(b, order[0]), b, "una ficha usada no se coloca dos veces");
  assert.ok(tileIsUsed(b, order[1]));
  b = removeAt(b, 1);
  assert.equal(boardWord(b), "AS");
  b = placeTile(b, order[1]); // vuelve a la primera casilla libre (la 1)
  assert.equal(boardWord(b), "ARS");
  for (const t of order.slice(3)) b = placeTile(b, t);
  assert.ok(isFull(b));
  assert.ok(isCorrect(b, "Arsenal"));
  b = clearBoard(b);
  assert.equal(boardWord(b), "");
  assert.ok(!isFull(b));
});

test("puntaje: errores, rapidez y rendirse", () => {
  assert.equal(teamScore({ won: true, errors: 0, seconds: 20 }), 150);
  assert.equal(teamScore({ won: true, errors: 2, seconds: 50 }), 95);
  assert.equal(teamScore({ won: true, errors: 9, seconds: 500 }), 20);
  assert.equal(teamScore({ won: false, errors: 0, seconds: 5 }), 0);
});
