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

import { dailyShareText } from "../public/js/share.js";
test("texto para compartir del reto de 3 fotos (sin nombres)", () => {
  const t = dailyShareText({
    siteName: "onepixel", siteUrl: "https://x.app", categoria: "Mundiales", numero: 103, max: 6, maxPoints: 600,
    fotos: [
      { marks: ["miss", "hint", "win"], won: true, points: 300 },
      { marks: ["win"], won: true, points: 600 },
      { marks: ["miss", "miss", "miss", "miss", "miss", "miss"], won: false, points: 0 },
    ],
  });
  assert.equal(t, "onepixel ⚽ Mundiales #103\n1️⃣ 🟥🟨🟩⬛⬛⬛ 300\n2️⃣ 🟩⬛⬛⬛⬛⬛ 600\n3️⃣ 🟥🟥🟥🟥🟥🟥 0\nTotal: 900/1800 pts · 2/3 aciertos\nhttps://x.app");
});
