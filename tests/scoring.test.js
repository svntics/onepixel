import { test } from "node:test";
import assert from "node:assert/strict";
import { pointsForBlur, scoreRound } from "../public/js/scoring.js";
import { CONFIG } from "../public/js/config.js";

const levels = CONFIG.BLUR_LEVELS;

test("tabla de puntos: 100 + 20 × blur", () => {
  assert.deepEqual(levels, [25, 18, 10, 5, 2, 0]);
  assert.deepEqual(levels.map(pointsForBlur), [600, 460, 300, 200, 140, 100]);
});

test("acertar en el intento k usa el blur de ese intento; perder = 0", () => {
  assert.equal(scoreRound({ won: true, stage: 0, levels }), 600);
  assert.equal(scoreRound({ won: true, stage: 5, levels }), 100);
  assert.equal(scoreRound({ won: false, stage: 5, levels }), 0);
});

test("los puntos nunca suben al avanzar (pista = fallo)", () => {
  const pts = levels.map(pointsForBlur);
  for (let k = 1; k < pts.length; k++) assert.ok(pts[k] < pts[k - 1]);
});
