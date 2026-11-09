import { test } from "node:test";
import assert from "node:assert/strict";
import { careerYears, yearOf, scoreEraCandidate } from "../scripts/lib/era-utils.mjs";

const club = (start, end, rank = "normal") => ({
  rank,
  qualifiers: {
    ...(start ? { P580: [{ datavalue: { value: { time: `+${start}-00-00T00:00:00Z` } } }] } : {}),
    ...(end ? { P582: [{ datavalue: { value: { time: `+${end}-00-00T00:00:00Z` } } }] } : {}),
  },
});

test("años de carrera desde los clubes de Wikidata", () => {
  assert.deepEqual(careerYears({ P54: [club(1982, 1985), club(1990, 1995), club(2002, 2004)] }), { inicio: 1982, fin: 2004, fuente: "wikidata" });
  assert.equal(careerYears({ P54: [club(2015, 2020), club(2020, null)] }).fin, null); // en actividad
  assert.equal(careerYears({}), null);
  assert.deepEqual(careerYears({ P54: [club(1900, 1910, "deprecated"), club(1990, 1999)] }), { inicio: 1990, fin: 1999, fuente: "wikidata" });
});

test("extrae el año de fechas y nombres de archivo", () => {
  assert.equal(yearOf("1994-07-17 15:00:00"), 1994);
  assert.equal(yearOf("File:Roberto Baggio 1994.jpg"), 1994);
  assert.equal(yearOf("IMG_4521.jpg"), null);
});

const carrera = { inicio: 1982, fin: 2004 };
const tokens = ["roberto", "baggio"];
const base = { titulo: "File:Roberto Baggio 1994.jpg", año: 1994, licOk: true, ancho: 800, alto: 1000, mime: "image/jpeg" };

test("acepta fotos de la época con el nombre del jugador", () => assert.ok(scoreEraCandidate(base, carrera, tokens) > 0));
test("descarta fotos fuera de la carrera, sin licencia o de otra cosa", () => {
  assert.equal(scoreEraCandidate({ ...base, año: 2019 }, carrera, tokens), null);
  assert.equal(scoreEraCandidate({ ...base, licOk: false }, carrera, tokens), null);
  assert.equal(scoreEraCandidate({ ...base, titulo: "File:Baggio signature.png" }, carrera, tokens), null);
  assert.equal(scoreEraCandidate({ ...base, titulo: "File:Stadio 1994.jpg" }, carrera, tokens), null);
  assert.equal(scoreEraCandidate({ ...base, año: null }, carrera, tokens), null);
});
test("prefiere fotos individuales a grupales", () => {
  const solo = scoreEraCandidate(base, carrera, tokens);
  const grupo = scoreEraCandidate({ ...base, titulo: "File:Italy team with Baggio 1994.jpg", ancho: 1600, alto: 900 }, carrera, tokens);
  assert.ok(solo > grupo);
});
