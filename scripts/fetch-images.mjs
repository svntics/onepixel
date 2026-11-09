// ============================================================
//  Script de imágenes (se ejecuta UNA vez, en tu computador o en GitHub Actions;
//  nunca en el navegador de los visitantes).
//
//  Uso:   npm run images                 → procesa jugadores sin imagen
//         npm run images -- --force      → vuelve a procesar todos
//         npm run images -- --solo=id    → procesa un solo jugador (por su "id")
//
//  Qué hace, por cada jugador:
//    1. Busca su elemento en Wikidata (por "wikidata_id" o por el título de Wikipedia en inglés)
//    2. Toma la imagen principal (propiedad P18)
//    3. Pide a Wikimedia Commons el autor y la licencia de esa imagen
//    4. Si la licencia es libre y hay autor, descarga una miniatura y la guarda como
//       public/img/p/<hash>.webp (el nombre NO revela al jugador; sin metadatos)
//    5. Si no, deja al jugador sin imagen (queda EXCLUIDO del juego) y lo anota en el reporte
//
//  Respeta las reglas de Wikimedia: User-Agent con contacto, una solicitud a la vez,
//  pausa entre solicitudes y espera "Retry-After" cuando responde 429/503.
//  Documentación: https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
//                 https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../public/js/config.js";
import { classifyLicense, stripHtml, imageFileName, pickP18, looksLikeFootballer } from "./lib/wikimedia-utils.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const IMG_DIR = join(ROOT, "public", "img", "p");
const REPORT_JSON = join(ROOT, "reports", "imagenes.json");
const REPORT_MD = join(ROOT, "reports", "imagenes.md");

// Contacto para el User-Agent (lo exige Wikimedia). Puedes cambiarlo con la variable CONTACTO.
const CONTACT = process.env.CONTACTO || CONFIG.SITE_URL;
const UA = `${CONFIG.SITE_NAME}-image-fetch/1.0 (${CONTACT}) node/${process.versions.node}`;
const PAUSE_MS = 1000; // ~60 solicitudes/minuto, bien bajo el límite publicado
const THUMB_WIDTH = 500; // ancho estándar de miniatura en Wikimedia
const OUT_WIDTH = 480;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--solo="))?.slice(7);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

// ---------- HTTP con pausas, User-Agent y reintentos ----------
async function request(url, { binary = false } = {}) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const wait = lastRequest + PAUSE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: binary ? "image/*" : "application/json" } });
    } catch (e) {
      console.warn(`  ⚠ error de red (${e.message}); reintento ${attempt}/6`);
      await sleep(5000 * attempt);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const retry = Number(res.headers.get("retry-after"));
      const ms = Number.isFinite(retry) && retry > 0 ? retry * 1000 : 5000 * 2 ** (attempt - 1);
      console.warn(`  ⏳ Wikimedia pide esperar (${res.status}); espero ${Math.round(ms / 1000)} s… (${attempt}/6)`);
      await sleep(ms);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    if (binary) return Buffer.from(await res.arrayBuffer());
    const json = await res.json();
    if (json.error?.code === "maxlag") {
      await sleep(5000 * attempt);
      continue;
    }
    if (json.error) throw new Error(`API: ${json.error.code} – ${json.error.info}`);
    return json;
  }
  throw new Error(`Demasiados reintentos: ${url}`);
}

// ---------- Wikidata ----------
async function getEntity(p) {
  const base = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&maxlag=5&props=claims|descriptions&languages=en|es";
  const url = p.wikidata_id
    ? `${base}&ids=${encodeURIComponent(p.wikidata_id)}`
    : `${base}&sites=enwiki&titles=${encodeURIComponent(p.wikipedia_en)}`;
  const json = await request(url);
  const entities = Object.values(json.entities ?? {}).filter((e) => !("missing" in e));
  if (entities.length !== 1) return null;
  return entities[0];
}

// ---------- Commons ----------
async function getImageInfo(fileName) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&maxlag=5" +
    `&titles=${encodeURIComponent("File:" + fileName)}` +
    "&prop=imageinfo&iiprop=url|extmetadata|mime" +
    `&iiurlwidth=${THUMB_WIDTH}` +
    "&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|AttributionRequired|Copyrighted|Restrictions|UsageTerms|Attribution" +
    "&iiextmetadatalanguage=es";
  const json = await request(url);
  return json.query?.pages?.[0]?.imageinfo?.[0] ?? null;
}

// ---------- Datos ----------
function loadData() {
  const files = readdirSync(DATA).filter((f) => f.endsWith(".json"));
  const docs = files.map((f) => ({ file: f, doc: JSON.parse(readFileSync(join(DATA, f), "utf8")) }));
  const players = new Map();
  for (const { doc } of docs) for (const p of doc.jugadores) if (!players.has(p.id)) players.set(p.id, p);
  return { docs, players };
}

function saveData(docs, players) {
  for (const { file, doc } of docs) {
    doc.jugadores = doc.jugadores.map((p) => players.get(p.id));
    writeFileSync(join(DATA, file), JSON.stringify(doc, null, 2) + "\n");
  }
}

// ---------- Proceso de un jugador ----------
async function processPlayer(p) {
  const row = { id: p.id, jugador: p.nombre, categorias: p.categorias, libre: false, licencia: "", autor: "", obs: [] };

  const entity = await getEntity(p);
  if (!entity) {
    row.obs.push(`No se encontró en Wikidata (wikipedia_en="${p.wikipedia_en}", wikidata_id=${p.wikidata_id ?? "—"})`);
    return { row, imagen: null };
  }
  const desc = entity.descriptions?.en?.value ?? entity.descriptions?.es?.value ?? "";
  row.wikidata_id = entity.id;
  row.descripcion = desc;
  if (!looksLikeFootballer(desc)) row.obs.push(`Revisar: la descripción de Wikidata no menciona fútbol ("${desc}")`);

  const file = pickP18(entity.claims);
  if (!file) {
    row.obs.push("Wikidata no tiene imagen (P18)");
    return { row, imagen: null, wikidata_id: entity.id };
  }

  const info = await getImageInfo(file);
  if (!info) {
    row.obs.push(`Commons no devolvió información para "${file}"`);
    return { row, imagen: null, wikidata_id: entity.id };
  }
  const meta = info.extmetadata ?? {};
  const licencia = stripHtml(meta.LicenseShortName?.value);
  const autor = stripHtml(meta.Attribution?.value) || stripHtml(meta.Artist?.value);
  const verdict = classifyLicense({
    licencia,
    autor,
    attributionRequired: String(meta.AttributionRequired?.value ?? "").toLowerCase() === "true",
    copyrighted: String(meta.Copyrighted?.value ?? "").toLowerCase(),
  });
  row.licencia = licencia || "(sin dato)";
  row.autor = autor || "(sin dato)";
  row.libre = verdict.ok;
  row.obs.push(...verdict.notes);

  const restrictions = String(meta.Restrictions?.value ?? "");
  if (restrictions.includes("personality")) row.obs.push("Commons advierte derechos de imagen de la persona (personality rights)");
  if (restrictions.includes("trademark")) row.obs.push("Commons advierte que aparecen marcas registradas");
  if (restrictions && !/personality|trademark/.test(restrictions)) row.obs.push(`Otras restricciones en Commons: ${restrictions}`);

  if (!verdict.ok) return { row, imagen: null, wikidata_id: entity.id };

  const thumb = info.thumburl || info.url;
  const buffer = await request(thumb, { binary: true });
  const sharp = (await import("sharp")).default;
  const name = imageFileName(p.id);
  mkdirSync(IMG_DIR, { recursive: true });
  await sharp(buffer).rotate().resize({ width: OUT_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(IMG_DIR, name));

  return {
    row,
    wikidata_id: entity.id,
    imagen: {
      archivo_local: `img/p/${name}`,
      autor,
      licencia,
      url_licencia: meta.LicenseUrl?.value ?? "",
      url_fuente: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
    },
  };
}

// ---------- Reporte ----------
function writeReport(rows) {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(rows, null, 2) + "\n");
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const list = Object.values(rows).sort((a, b) => Number(a.libre) - Number(b.libre) || a.jugador.localeCompare(b.jugador, "es"));
  const ok = list.filter((r) => r.libre).length;
  const md = [
    "# Reporte de imágenes",
    "",
    `Generado: ${new Date().toISOString()} · ${ok} con imagen libre · ${list.length - ok} excluidos`,
    "",
    "Los jugadores con **¿Imagen libre? = No** quedan fuera del juego hasta que se resuelva su caso.",
    "",
    "| Jugador | Categoría | ¿Imagen libre? | Licencia | Autor | Observación |",
    "|---|---|---|---|---|---|",
    ...list.map((r) =>
      `| ${esc(r.jugador)} | ${esc(r.categorias.join(", "))} | ${r.libre ? "Sí" : "**No**"} | ${esc(r.licencia)} | ${esc(r.autor)} | ${esc(r.obs.join("; ") || "—")} |`,
    ),
    "",
  ].join("\n");
  writeFileSync(REPORT_MD, md);
}

// ---------- Principal ----------
async function main() {
  console.log(`User-Agent: ${UA}\n`);
  if (/futblur\.vercel\.app/.test(CONTACT) && !process.env.CONTACTO)
    console.warn("⚠ El contacto del User-Agent es la URL provisoria. Si ya tienes otra (p. ej. tu repositorio de GitHub), usa: CONTACTO=https://... npm run images\n");

  const { docs, players } = loadData();
  const rows = existsSync(REPORT_JSON) ? JSON.parse(readFileSync(REPORT_JSON, "utf8")) : {};
  const todo = [...players.values()].filter((p) => (ONLY ? p.id === ONLY : FORCE || !p.imagen));
  console.log(`Jugadores a procesar: ${todo.length} de ${players.size}\n`);

  let n = 0;
  for (const p of todo) {
    n++;
    process.stdout.write(`[${n}/${todo.length}] ${p.nombre}… `);
    try {
      const r = await processPlayer(p);
      players.set(p.id, { ...p, wikidata_id: r.wikidata_id ?? p.wikidata_id ?? null, imagen: r.imagen });
      rows[p.id] = r.row;
      console.log(r.imagen ? `✔ ${r.row.licencia}` : `✖ excluido (${r.row.obs[0] ?? "sin imagen libre"})`);
    } catch (e) {
      rows[p.id] = { id: p.id, jugador: p.nombre, categorias: p.categorias, libre: false, licencia: "", autor: "", obs: [`Error: ${e.message}`] };
      players.set(p.id, { ...p, imagen: null });
      console.log(`✖ error: ${e.message}`);
    }
    // Guardar tras cada jugador: si se corta, no se pierde lo avanzado
    saveData(docs, players);
    writeReport(rows);
  }

  const total = [...players.values()];
  console.log(`\nListo. Con imagen: ${total.filter((p) => p.imagen).length} · Sin imagen (excluidos): ${total.filter((p) => !p.imagen).length}`);
  console.log("Reporte: reports/imagenes.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
