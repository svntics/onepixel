// Valida los datos fuente de /data y genera /public/data/<categoria>.json.
// Uso: npm run build:data
//
// Los JSON públicos contienen:
//   - "nombres": lista alfabética de nombres y alias (para el autocompletado)
//   - "rondas": imagen + respuesta y pistas codificadas, en un orden distinto al de "nombres"
// Así, mirar los datos no revela qué nombre corresponde a qué imagen (ofuscación, no seguridad).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { encode } from "../public/js/codec.js";
import { normalize } from "../public/js/normalize.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data");
const OUT = join(ROOT, "public", "data");
const PLACEHOLDER = "img/placeholder.svg";

const ERAS = new Set(["historico", "actual"]);
const REQUIRED = ["id", "nombre", "alias", "categorias", "era", "pais", "posicion", "pistas", "wikipedia_en"];
const MIN_POR_CATEGORIA = 30;

// --placeholders: incluye jugadores SIN imagen libre usando la silueta provisoria.
// Solo para probar en local (npm run dev). En producción (npm run build) se excluyen.
const PLACEHOLDERS = process.argv.includes("--placeholders");
const warnings = [];

const errors = [];
const seen = new Map(); // id -> JSON (para verificar que un jugador repetido sea idéntico)

function validate(p, cat, file) {
  const where = `${file} → ${p.id ?? "(sin id)"}`;
  for (const k of REQUIRED) if (p[k] === undefined || p[k] === "") errors.push(`${where}: falta "${k}"`);
  if (p.id && !/^[a-z0-9-]+$/.test(p.id)) errors.push(`${where}: id solo admite a-z, 0-9 y guiones`);
  if (!Array.isArray(p.alias)) errors.push(`${where}: "alias" debe ser una lista`);
  if (!Array.isArray(p.pistas) || p.pistas.length < 2 || p.pistas.length > 3)
    errors.push(`${where}: debe tener 2 o 3 pistas`);
  if (p.era && !ERAS.has(p.era)) errors.push(`${where}: era debe ser "historico" o "actual"`);
  if (Array.isArray(p.categorias) && !p.categorias.includes(cat))
    errors.push(`${where}: está en ${file} pero "categorias" no incluye "${cat}"`);
  // Las pistas no deben contener el nombre ni los alias
  if (Array.isArray(p.pistas) && p.nombre) {
    const words = [p.nombre, ...(p.alias ?? [])].flatMap((t) => normalize(t).split(" ")).filter((w) => w.length >= 4);
    p.pistas.forEach((h, j) => {
      const hn = ` ${normalize(h)} `;
      const hit = words.find((w) => hn.includes(` ${w} `));
      if (hit) errors.push(`${where}: la pista ${j + 1} contiene "${hit}" (revelaría al jugador)`);
    });
  }
  if (p.imagen) {
    for (const k of ["archivo_local", "autor", "licencia", "url_fuente"])
      if (!p.imagen[k]) errors.push(`${where}: imagen sin "${k}" (necesario para la atribución)`);
    if (p.imagen.archivo_local && !existsSync(join(ROOT, "public", p.imagen.archivo_local)))
      errors.push(`${where}: no existe el archivo ${p.imagen.archivo_local}`);
  }
  const json = JSON.stringify(p);
  if (seen.has(p.id) && seen.get(p.id) !== json)
    errors.push(`${where}: aparece en varios archivos con datos distintos`);
  seen.set(p.id, json);
}

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".json"));

for (const file of files) {
  let { categoria, jugadores } = JSON.parse(readFileSync(join(SRC, file), "utf8"));
  jugadores.forEach((p) => validate(p, categoria, file));
  const ids = jugadores.map((p) => p.id);
  if (new Set(ids).size !== ids.length) errors.push(`${file}: hay ids repetidos`);

  // "aprobado": false = jugador nuevo pendiente de revisión: no entra al juego publicado
  const pendientes = jugadores.filter((p) => p.aprobado === false).length;
  const jugables = (PLACEHOLDERS ? jugadores : jugadores.filter((p) => p.imagen?.archivo_local)).filter((p) => p.aprobado !== false);
  const excluidos = jugadores.length - jugables.length;
  if (jugables.length < MIN_POR_CATEGORIA)
    warnings.push(`${file}: solo ${jugables.length} jugadores jugables (mínimo recomendado ${MIN_POR_CATEGORIA})`);
  if (jugables.length === 0) errors.push(`${file}: ningún jugador tiene imagen. Ejecuta "npm run images" o usa "npm run dev" para probar con siluetas.`);
  jugadores = jugables;

  const ordenados = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const nombres = ordenados.map((p) => ({ nombre: p.nombre, alias: p.alias }));
  const hash = (id) => createHash("sha256").update(`${categoria}:${id}`).digest("hex");
  const rondas = [...jugadores]
    .sort((a, b) => hash(a.id).localeCompare(hash(b.id)))
    .map((p) => ({
      // k: clave neutra del jugador (igual en todas las categorías) para no repetirlo el mismo día
      k: createHash("sha256").update(`onepixel-k:${p.id}`).digest("hex").slice(0, 10),
      img: p.imagen?.archivo_local ?? PLACEHOLDER,
      d: encode({
        i: ordenados.indexOf(p),
        pistas: p.pistas,
        pais: p.pais,
        posicion: p.posicion,
        era: p.era,
        cr: p.imagen
          ? { autor: p.imagen.autor, licencia: p.imagen.licencia, url_licencia: p.imagen.url_licencia, url_fuente: p.imagen.url_fuente }
          : null,
      }),
    }));
  const publico = { categoria, total: jugadores.length, nombres, rondas };
  writeFileSync(join(OUT, file), JSON.stringify(publico));
  console.log(`✔ ${file}: ${jugadores.length} jugadores en el juego${excluidos - pendientes > 0 ? ` (${excluidos - pendientes} sin imagen libre)` : ""}${pendientes ? ` · ${pendientes} pendientes de revisión` : ""}`);
}

if (PLACEHOLDERS) console.warn("\n⚠ Modo prueba: los jugadores sin imagen usan una silueta provisoria. No publiques así.");
if (warnings.length) console.warn("\n⚠ Avisos:\n  " + warnings.join("\n  "));
if (errors.length) {
  console.error("\n✖ Errores en los datos:\n  " + errors.join("\n  "));
  process.exit(1);
}
