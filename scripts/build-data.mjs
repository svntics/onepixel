// Valida los datos fuente de /data y genera /public/data/<categoria>.json.
// Uso: npm run build:data
//
// Fase 1: los JSON públicos NO incluyen nombres; solo lo necesario para mostrar la UI.
// En la Fase 2 se agregan los datos de juego (respuesta codificada, pistas, alias).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data");
const OUT = join(ROOT, "public", "data");
const PLACEHOLDER = "img/placeholder.svg";

const ERAS = new Set(["historico", "actual"]);
const REQUIRED = ["id", "nombre", "alias", "categorias", "era", "pais", "posicion", "pistas"];

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
  const json = JSON.stringify(p);
  if (seen.has(p.id) && seen.get(p.id) !== json)
    errors.push(`${where}: aparece en varios archivos con datos distintos`);
  seen.set(p.id, json);
}

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const { categoria, jugadores } = JSON.parse(readFileSync(join(SRC, file), "utf8"));
  jugadores.forEach((p) => validate(p, categoria, file));
  const ids = jugadores.map((p) => p.id);
  if (new Set(ids).size !== ids.length) errors.push(`${file}: hay ids repetidos`);

  const publico = {
    categoria,
    total: jugadores.length,
    jugadores: jugadores.map((p, i) => ({
      n: i,
      img: p.imagen?.archivo_local ?? PLACEHOLDER,
      provisional: !p.imagen,
    })),
  };
  writeFileSync(join(OUT, file), JSON.stringify(publico));
  console.log(`✔ ${file}: ${jugadores.length} jugadores`);
}

if (errors.length) {
  console.error("\n✖ Errores en los datos:\n  " + errors.join("\n  "));
  process.exit(1);
}
