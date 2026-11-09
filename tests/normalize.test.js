import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, buildIndex, matchExact, suggest } from "../public/js/normalize.js";

const idx = buildIndex([
  { nombre: "Sergio Agüero", alias: ["Kun", "Kun Agüero", "Agüero"] },
  { nombre: "Alexis Sánchez", alias: ["Alexis", "Niño Maravilla"] },
  { nombre: "Leonel Sánchez", alias: ["Leonel"] },
  { nombre: "Pelé", alias: ["O Rei"] },
  { nombre: "N'Golo Kanté", alias: ["Kanté"] },
]);

test("quita tildes, diéresis, eñes y mayúsculas", () => {
  assert.equal(normalize("  SERGIO   Agüero "), "sergio aguero");
  assert.equal(normalize("Pelé"), "pele");
  assert.equal(normalize("Niño Maravilla"), "nino maravilla");
  assert.equal(normalize("N'Golo Kanté"), "n golo kante");
  assert.equal(normalize(""), "");
  assert.equal(normalize(null), "");
});

test("acepta nombre y alias sin importar tildes ni mayúsculas", () => {
  assert.deepEqual(matchExact(idx, "kun aguero"), [0]);
  assert.deepEqual(matchExact(idx, "KUN"), [0]);
  assert.deepEqual(matchExact(idx, "nino maravilla"), [1]);
  assert.deepEqual(matchExact(idx, "pele"), [3]);
  assert.deepEqual(matchExact(idx, "ngolo kante"), []); // sin apóstrofo cambia la separación; se resuelve por sugerencia
  assert.deepEqual(matchExact(idx, "Messi"), []);
});

test("sugerencias: prefijo de palabra, alias y exclusión de intentos previos", () => {
  assert.deepEqual(suggest(idx, "sanchez").map((s) => s.nombre), ["Alexis Sánchez", "Leonel Sánchez"]);
  assert.equal(suggest(idx, "kun")[0].via, "Kun");
  assert.equal(suggest(idx, "ague")[0].via, null); // alias contenido en el nombre: no se repite
  assert.deepEqual(suggest(idx, "sanchez", new Set([1])).map((s) => s.nombre), ["Leonel Sánchez"]);
  assert.deepEqual(suggest(idx, "kante").map((s) => s.nombre), ["N'Golo Kanté"]);
  assert.deepEqual(suggest(idx, ""), []);
});
