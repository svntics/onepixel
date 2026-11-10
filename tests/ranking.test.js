import { test } from "node:test";
import assert from "node:assert/strict";

// ranking.js usa localStorage a través de storage.js (protegido con try/catch), así que se puede importar en Node.
const { validateApodo } = await import("../public/js/ranking.js");

test("apodo: válido, recortado y con espacios normalizados", () => {
  assert.deepEqual(validateApodo("  Max10  "), { ok: true, value: "Max10" });
  assert.deepEqual(validateApodo("El   Pelusa"), { ok: true, value: "El Pelusa" });
  assert.equal(validateApodo("Ñandú_7").ok, true);
});
test("apodo: vacío, muy corto, muy largo o con símbolos raros", () => {
  assert.equal(validateApodo("").ok, false);
  assert.equal(validateApodo("   ").ok, false);
  assert.equal(validateApodo("a").ok, false);
  assert.equal(validateApodo("x".repeat(17)).ok, false);
  assert.equal(validateApodo("<script>").ok, false);
});
test("apodo: filtra algunas palabras ofensivas", () => {
  assert.equal(validateApodo("Mierda10").ok, false);
  assert.equal(validateApodo("Wéon").ok, false);
});
