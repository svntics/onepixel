import { test } from "node:test";
import assert from "node:assert/strict";
import { dateInTimeZone, challengeNumber, cycleOrder, dailyPicks, msUntilNextDay } from "../public/js/daily.js";

const TZ = "America/Santiago";

test("numeración: el día de inicio es el #1", () => {
  assert.equal(challengeNumber("2026-08-01", "2026-08-01"), 1);
  assert.equal(challengeNumber("2026-08-02", "2026-08-01"), 2);
  assert.equal(challengeNumber("2026-11-09", "2026-08-01"), 101);
  assert.equal(challengeNumber("2027-01-01", "2026-08-01"), 154);
  assert.equal(challengeNumber("2026-07-31", "2026-08-01"), 0);
});

test("la fecha cambia a medianoche de Chile, no a la del dispositivo ni UTC", () => {
  // noviembre: Chile en horario de verano (UTC-3)
  assert.equal(dateInTimeZone(new Date("2026-11-10T02:59:59Z"), TZ), "2026-11-09");
  assert.equal(dateInTimeZone(new Date("2026-11-10T03:00:00Z"), TZ), "2026-11-10");
  // julio: horario de invierno (UTC-4)
  assert.equal(dateInTimeZone(new Date("2026-07-15T03:59:59Z"), TZ), "2026-07-14");
  assert.equal(dateInTimeZone(new Date("2026-07-15T04:00:00Z"), TZ), "2026-07-15");
});

test("cada ciclo es una permutación completa y determinística", () => {
  const o = cycleOrder("mundiales", 0, 37);
  assert.equal(new Set(o).size, 37);
  assert.deepEqual(o, cycleOrder("mundiales", 0, 37));
  assert.notDeepEqual(o, cycleOrder("mundiales", 1, 37));
  assert.notDeepEqual(o, cycleOrder("premier", 0, 37));
});

const cats = (n) => ["mundiales", "premier", "champions", "libertadores"].map((id) => ({ id, keys: Array.from({ length: n }, (_, i) => `k${i}`) }));

test("mismo día → mismo jugador para todos", () => {
  assert.deepEqual(dailyPicks(101, cats(30)), dailyPicks(101, cats(30)));
});

test("no repite jugador en una categoría hasta recorrerlos todos", () => {
  const seen = new Set();
  for (let n = 1; n <= 30; n++) seen.add(dailyPicks(n, cats(30)).mundiales);
  assert.equal(seen.size, 30);
});

test("nunca el mismo jugador el mismo día en dos categorías", () => {
  for (let n = 1; n <= 400; n++) {
    const p = dailyPicks(n, cats(30));
    assert.equal(new Set(Object.values(p)).size, 4, `día ${n}`);
  }
});

test("cuenta regresiva: entre 0 y 24 h", () => {
  const ms = msUntilNextDay(new Date("2026-11-10T02:00:00Z"), TZ); // 23:00 en Chile
  assert.equal(ms, 3600000);
});

import { dailyPicksMulti } from "../public/js/daily.js";

test("reto de 3 fotos: 3 jugadores distintos, iguales para todos ese día", () => {
  const a = dailyPicksMulti(103, cats(30));
  assert.deepEqual(a, dailyPicksMulti(103, cats(30)));
  for (const ids of Object.values(a)) assert.equal(new Set(ids).size, 3);
});

test("reto de 3 fotos: nunca el mismo jugador el mismo día en dos categorías", () => {
  for (let n = 1; n <= 300; n++) {
    const all = Object.values(dailyPicksMulti(n, cats(30))).flat();
    assert.equal(new Set(all).size, all.length, `día ${n}`);
  }
});

test("reto de 3 fotos: no repite hasta recorrer la lista (30 jugadores = 10 días)", () => {
  const seen = [];
  for (let n = 1; n <= 10; n++) seen.push(...dailyPicksMulti(n, [cats(30)[0]]).mundiales);
  assert.equal(new Set(seen).size, 30);
});

test("reto de 3 fotos: categoría con menos de 3 jugadores", () => {
  assert.equal(dailyPicksMulti(5, [{ id: "x", keys: ["a", "b"] }]).x.length, 2);
});
