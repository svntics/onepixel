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
import { request, setUserAgent } from "./lib/http.mjs";
import { classifyLicense, stripHtml, imageFileName, pickP18, looksLikeFootballer, pickSearchCandidate } from "./lib/wikimedia-utils.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const IMG_DIR = join(ROOT, "public", "img", "p");
const REPORT_JSON = join(ROOT, "reports", "imagenes.json");
const REPORT_MD = join(ROOT, "reports", "imagenes.md");

// Contacto para el User-Agent (lo exige Wikimedia). Puedes cambiarlo con la variable CONTACTO.
const CONTACT = process.env.CONTACTO || CONFIG.SITE_URL;
const UA = `${CONFIG.SITE_NAME}-image-fetch/1.0 (${CONTACT}) node/${process.versions.node}`;
const THUMB_WIDTH = 500; // ancho estándar de miniatura en Wikimedia
const OUT_WIDTH = 480;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--solo="))?.slice(7);


// ---------- Wikidata ----------
const ENTITY_API = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&maxlag=5&props=claims|descriptions&languages=en|es";

async function getEntityBy(query) {
  const json = await request(`${ENTITY_API}&${query}`);
  const entities = Object.values(json.entities ?? {}).filter((e) => !("missing" in e));
  return entities.length === 1 ? entities[0] : null;
}

// Plan B: buscar por nombre y alias en Wikidata y elegir al futbolista (desempata por nacionalidad).
async function searchEntity(p) {
  const terms = [p.nombre, ...(p.alias ?? []).filter((a) => a.includes(" "))].slice(0, 3);
  const results = [];
  for (const term of terms) {
    try {
      const json = await request(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&maxlag=5&type=item&limit=10&language=en&uselang=en&search=${encodeURIComponent(term)}`,
      );
      results.push({ term, items: (json.search ?? []).map((r) => ({ id: r.id, description: r.description ?? "" })) });
    } catch (e) {
      console.warn(`  ⚠ búsqueda "${term}" falló: ${e.message}`);
    }
  }
  const best = pickSearchCandidate(results, p.pais);
  return best ? getEntityBy(`ids=${encodeURIComponent(best.id)}`) : null;
}

async function getEntity(p) {
  const entity = p.wikidata_id
    ? await getEntityBy(`ids=${encodeURIComponent(p.wikidata_id)}`)
    : await getEntityBy(`sites=enwiki&titles=${encodeURIComponent(p.wikipedia_en)}`);
  const desc = entity?.descriptions?.en?.value ?? entity?.descriptions?.es?.value ?? "";
  // Si el elemento no es un futbolista (p. ej. una página de desambiguación guardada antes), buscar por nombre
  if (!entity || !looksLikeFootballer(desc)) {
    const found = await searchEntity(p);
    if (found) return { entity: found, viaSearch: true };
  }
  return { entity, viaSearch: false };
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

  const { entity, viaSearch } = await getEntity(p);
  if (!entity) {
    row.obs.push(`No se encontró en Wikidata (wikipedia_en="${p.wikipedia_en}", wikidata_id=${p.wikidata_id ?? "—"})`);
    return { row, imagen: null };
  }
  const desc = entity.descriptions?.en?.value ?? entity.descriptions?.es?.value ?? "";
  row.wikidata_id = entity.id;
  const okId = looksLikeFootballer(desc) ? entity.id : null; // no se guarda un elemento equivocado
  row.descripcion = desc;
  if (!looksLikeFootballer(desc)) row.obs.push(`Revisar: la descripción de Wikidata no menciona fútbol ("${desc}")`);
  if (viaSearch) row.obs.push(`Identificado por búsqueda en Wikidata: ${entity.id} ("${desc}"). Verifica que sea la persona correcta`);

  // Foto elegida a mano (p. ej. de la época en que jugaba) tiene prioridad sobre la principal de Wikidata
  const file = p.imagen_commons || pickP18(entity.claims);
  if (p.imagen_commons) row.obs.push(`Foto elegida: ${p.imagen_commons}`);
  if (!file) {
    row.obs.push("Wikidata no tiene imagen (P18)");
    return { row, imagen: null, wikidata_id: okId };
  }

  const info = await getImageInfo(file);
  if (!info) {
    row.obs.push(`Commons no devolvió información para "${file}"`);
    return { row, imagen: null, wikidata_id: okId };
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

  if (!verdict.ok) return { row, imagen: null, wikidata_id: okId };

  const thumb = info.thumburl || info.url;
  const buffer = await request(thumb, { binary: true });
  const sharp = (await import("sharp")).default;
  const name = imageFileName(p.id);
  mkdirSync(IMG_DIR, { recursive: true });
  await sharp(buffer).rotate().resize({ width: OUT_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(IMG_DIR, name));

  return {
    row,
    wikidata_id: okId,
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
  setUserAgent(UA);
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
      players.set(p.id, { ...p, wikidata_id: r.wikidata_id ?? null, imagen: r.imagen });
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
