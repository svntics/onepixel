// Modo "4 Fotos 1 Equipo": valida data/4fotos/<liga>.json y genera public/data/4fotos.json (todos los equipos juntos).
// Uso: npm run build:teams   (incluido en npm run build)
//      node scripts/build-teams.mjs --placeholders   → incluye equipos sin aprobar o sin fotos (solo pruebas locales)
//
// Cada ronda se guarda codificada (codec.js) para que la respuesta y las explicaciones no se lean a simple vista.
// Las ilustraciones de colores (camisetas) se generan aquí como SVG con nombre que no revela el club.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "../public/js/codec.js";
import { normalizeAnswer } from "../public/js/letters.js";
import { CONFIG } from "../public/js/config.js";
import { imageFileName } from "./lib/wikimedia-utils.mjs";
import { kitSvg, KIT_PATTERNS } from "./lib/kit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "4fotos");
const OUT = join(ROOT, "public", "data");
const GEN = join(ROOT, "public", "img", "t");
const PLACEHOLDERS = process.argv.includes("--placeholders");
const TIPOS = ["colores", "origen", "apodo", "cultura"];
const ORDEN_DEFECTO = ["origen", "cultura", "apodo", "colores"];
const HEX = /^#[0-9a-fA-F]{6}$/;

const errors = [];
const warnings = [];
const LEAGUES = new Map(CONFIG.FOUR_PICS.LEAGUES.map((l) => [l.id, l]));

function validate(t, file) {
  const where = `${file} → ${t.id ?? "(sin id)"}`;
  if (!/^[a-z0-9-]+$/.test(t.id ?? "")) errors.push(`${where}: id inválido`);
  if (!t.nombre) errors.push(`${where}: falta "nombre"`);
  if (!/^[A-Z]+( [A-Z]+)*$/.test(t.respuesta ?? "")) errors.push(`${where}: "respuesta" solo admite A-Z y un espacio entre palabras`);
  if (t.respuesta && normalizeAnswer(t.respuesta) !== t.respuesta) errors.push(`${where}: "respuesta" no está normalizada`);
  if (!Array.isArray(t.ligas) || !t.ligas.length || t.ligas.some((l) => !LEAGUES.has(l))) errors.push(`${where}: "ligas" inválidas`);
  if (t.orden && (t.orden.length !== 4 || TIPOS.some((x) => !t.orden.includes(x)))) errors.push(`${where}: "orden" debe tener los 4 tipos`);
  if (!Array.isArray(t.fotos) || t.fotos.length !== 4) return errors.push(`${where}: debe tener exactamente 4 fotos`);
  t.fotos.forEach((f, i) => {
    const w = `${where} foto ${i + 1}`;
    if (!TIPOS.includes(f.tipo)) errors.push(`${w}: tipo inválido`);
    if (!f.explicacion) errors.push(`${w}: falta "explicacion"`);
    if (f.generada) {
      if (!KIT_PATTERNS.includes(f.generada.patron)) errors.push(`${w}: patrón desconocido`);
      if (!f.generada.colores?.every((c) => HEX.test(c)) || f.generada.colores.length !== 2) errors.push(`${w}: colores inválidos`);
    } else if (f.ia) {
      if (!f.ia.archivo_local) errors.push(`${w}: falta ia.archivo_local`);
    } else if (!f.buscar && !f.commons) errors.push(`${w}: necesita "buscar" o "commons"`);
  });
}

// Una foto lista para el juego, o null si falta la imagen
function photo(t, f, i) {
  if (f.generada) {
    const name = imageFileName(`4f:${t.id}:${i}`).replace(/\.webp$/, ".svg");
    mkdirSync(GEN, { recursive: true });
    writeFileSync(join(GEN, name), kitSvg(f.generada));
    return { img: `img/t/${name}`, tipo: f.tipo, exp: f.explicacion, cr: null };
  }
  // Ilustración generada con IA (objetos o animales genéricos; nunca lugares ni personas reales)
  if (f.ia) return { img: f.ia.archivo_local, tipo: f.tipo, exp: f.explicacion, cr: null, ia: true };
  if (f.imagen) {
    const im = f.imagen;
    return {
      img: im.archivo_local,
      tipo: f.tipo,
      exp: f.explicacion,
      cr: { autor: im.autor, licencia: im.licencia, url_licencia: im.url_licencia, url_fuente: im.url_fuente, titulo: im.titulo ?? "", mod: im.modificacion ?? "" },
    };
  }
  return PLACEHOLDERS ? { img: "img/placeholder.svg", tipo: f.tipo, exp: f.explicacion, cr: null, pendiente: true } : null;
}

mkdirSync(OUT, { recursive: true });
const all = []; // todos los equipos juntos (las ligas solo ordenan los datos)
const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith(".json")) : [];
const ids = new Set();
let pending = 0;

for (const file of files) {
  const { equipos } = JSON.parse(readFileSync(join(SRC, file), "utf8"));
  for (const t of equipos) {
    validate(t, file);
    if (ids.has(t.id)) errors.push(`${file} → ${t.id}: id repetido`);
    ids.add(t.id);
    const approved = typeof t.aprobado === "string" || t.aprobado === true;
    const fotos = t.fotos.map((f, i) => photo(t, f, i));
    if ((!approved || fotos.some((f) => !f)) && !PLACEHOLDERS) {
      pending++;
      continue;
    }
    // Orden en que se revelan: de la más difícil a la más fácil (la camiseta al final).
    // Un equipo puede definir su propio "orden" (lista de tipos).
    const orden = t.orden ?? ORDEN_DEFECTO;
    const sorted = [...fotos].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
    all.push({ id: t.id, nombre: t.nombre, respuesta: t.respuesta, fotos: sorted });
  }
}

if (errors.length) {
  console.error("✖ Errores en data/4fotos:\n  " + errors.join("\n  "));
  process.exit(1);
}

writeFileSync(join(OUT, "4fotos.json"), JSON.stringify({ rondas: all.map((t) => encode(t)) }));
if (all.length < 10) warnings.push(`4fotos: solo ${all.length} equipos jugables`);
console.log(`✔ 4 Fotos 1 Equipo: ${all.length} equipos jugables · ${pending} pendientes (sin aprobar o sin fotos)`);
if (warnings.length) console.warn("⚠ " + warnings.join("\n⚠ "));
