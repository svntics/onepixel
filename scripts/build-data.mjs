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
import { CONFIG } from "../public/js/config.js";
import { blurFileName } from "./lib/blur-names.mjs";
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
  if (typeof p.aprobado === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(p.aprobado)) errors.push(`${where}: "aprobado" debe ser true, false o "AAAA-MM-DD"`);
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

  // "aprobado": false = jugador nuevo pendiente de revisión: no entra al juego publicado.
  // "aprobado": "AAAA-MM-DD" = aprobado; el juego lo incluye desde ese día (hora de Chile),
  // para no cambiar el reto de un día ya empezado.
  const pendientes = jugadores.filter((p) => p.aprobado === false).length;
  const jugables = (PLACEHOLDERS ? jugadores : jugadores.filter((p) => p.imagen?.archivo_local)).filter((p) => p.aprobado !== false);
  const excluidos = jugadores.length - jugables.length;
  const activa = CONFIG.CATEGORIES.find((c) => c.id === categoria)?.activa !== false; // true o "AAAA-MM-DD"
  if (!CONFIG.CATEGORIES.some((c) => c.id === categoria)) warnings.push(`${file}: la categoría "${categoria}" no está en config.js`);
  if (!activa) console.log(`  (${categoria}: categoría en preparación, oculta en el sitio)`);
  else if (jugables.length < MIN_POR_CATEGORIA)
    warnings.push(`${file}: solo ${jugables.length} jugadores jugables (mínimo recomendado ${MIN_POR_CATEGORIA})`);
  if (activa && jugables.length === 0) errors.push(`${file}: ningún jugador tiene imagen. Ejecuta "npm run images" o usa "npm run dev" para probar con siluetas.`);
  jugadores = jugables;

  const ordenados = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const nombres = ordenados.map((p) => ({ nombre: p.nombre, alias: p.alias }));
  const hash = (id) => createHash("sha256").update(`${categoria}:${id}`).digest("hex");
  const rondas = [...jugadores]
    .sort((a, b) => hash(a.id).localeCompare(hash(b.id)))
    .map((p) => ({
      // k: clave neutra del jugador (igual en todas las categorías) para no repetirlo el mismo día
      k: createHash("sha256").update(`onepixel-k:${p.id}`).digest("hex").slice(0, 10),
      ...(typeof p.aprobado === "string" ? { desde: p.aprobado } : {}),
      // Foto real: solo las versiones difuminadas van a la vista (b[nivel]); la nítida va codificada en "d".
      // Sin foto (modo prueba): la silueta provisoria, difuminada con CSS.
      ...(p.imagen?.archivo_local
        ? { b: CONFIG.BLUR_LEVELS.map((lvl) => (lvl > 0 ? `img/b/${blurFileName(p.imagen.archivo_local, lvl)}` : null)) }
        : { img: PLACEHOLDER }),
      d: encode({
        i: ordenados.indexOf(p),
        pistas: p.pistas,
        pais: p.pais,
        posicion: p.posicion,
        era: p.era,
        img: p.imagen?.archivo_local ?? null,
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
