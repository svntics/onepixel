import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyLicense, stripHtml, pickP18, imageFileName, looksLikeFootballer } from "../scripts/lib/wikimedia-utils.mjs";

const lic = (licencia, autor = "Alguien") => classifyLicense({ licencia, autor, attributionRequired: true, copyrighted: "true" }).ok;

test("acepta licencias libres", () => {
  for (const l of ["CC BY 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "CC0", "Public domain"]) assert.equal(lic(l), true, l);
});
test("excluye NC, ND, GFDL, desconocidas y vacías", () => {
  for (const l of ["CC BY-NC 2.0", "CC BY-NC-SA 4.0", "CC BY-ND 2.0", "GFDL", "Copyrighted free use?", "", undefined]) assert.equal(lic(l), false, String(l));
});
test("CC BY sin autor se excluye", () => assert.equal(lic("CC BY 4.0", ""), false));
test("limpia HTML del autor", () => assert.equal(stripHtml('<a href="x">Juan &amp; Ana</a>\n'), "Juan & Ana"));
test("P18: preferida > normal, ignora deprecated", () => {
  const c = (rank, v) => ({ rank, mainsnak: { datavalue: { value: v } } });
  assert.equal(pickP18({ P18: [c("deprecated", "a"), c("normal", "b"), c("preferred", "c")] }), "c");
  assert.equal(pickP18({ P18: [c("deprecated", "a"), c("normal", "b")] }), "b");
  assert.equal(pickP18({}), null);
});
test("nombre de archivo neutro y estable", () => {
  assert.match(imageFileName("lionel-messi"), /^[0-9a-f]{16}\.webp$/);
  assert.equal(imageFileName("x"), imageFileName("x"));
  assert.ok(!imageFileName("lionel-messi").includes("messi"));
});
test("detecta descripción futbolística", () => {
  assert.ok(looksLikeFootballer("Argentine association football player"));
  assert.ok(!looksLikeFootballer("American basketball player"));
});

import { pickSearchCandidate } from "../scripts/lib/wikimedia-utils.mjs";
test("búsqueda: elige al futbolista y desempata por nacionalidad", () => {
  const r = [
    { term: "Luis Suárez", items: [
      { id: "Q1", description: "Spanish footballer (1935–2023)" },
      { id: "Q2", description: "Uruguayan footballer (born 1987)" },
      { id: "Q3", description: "Wikimedia human name disambiguation page" },
    ] },
    { term: "El Pistolero", items: [{ id: "Q2", description: "Uruguayan footballer (born 1987)" }] },
  ];
  assert.equal(pickSearchCandidate(r, "Uruguay").id, "Q2");
  assert.equal(pickSearchCandidate([{ term: "x", items: [{ id: "Q9", description: "American actor" }] }], "Chile"), null);
});

test("búsqueda: el año de nacimiento distingue homónimos", () => {
  const r = [{ term: "Ederson Moraes", items: [
    { id: "Q1", description: "Brazilian footballer (born 1999)" },
    { id: "Q2", description: "Brazilian association football goalkeeper (born 1993)" },
  ] }];
  assert.equal(pickSearchCandidate(r, "Brasil").id, "Q1");
  assert.equal(pickSearchCandidate(r, "Brasil", 1993).id, "Q2");
});
