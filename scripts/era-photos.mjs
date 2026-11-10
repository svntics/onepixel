// ============================================================
//  Fotos de la época: busca, para jugadores HISTÓRICOS, fotos de Commons tomadas
//  mientras jugaban (la foto principal de Wikidata suele ser reciente).
//
//  Uso:   npm run era-photos                  → históricos aún no revisados (retoma donde quedó)
//         npm run era-photos -- --force       → todos los históricos de nuevo
//         npm run era-photos -- --solo=id     → un jugador
//
//  1. Años de carrera: desde Wikidata (clubes P54 con fechas P580/P582). Se guardan en
//     "carrera" del jugador, salvo que tenga { "fuente": "manual" }.
//  2. Candidatas: archivos de la categoría de Commons del jugador (P373) y de sus
//     subcategorías, con licencia libre, fecha dentro de la carrera y el apellido en el nombre.
//  3. Reporte para elegir: reports/fotos-epoca.html (+ .json).
//  La elegida se escribe a mano en "imagen_commons" y luego: npm run images -- --solo=id --force
// ============================================================

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../public/js/config.js";
import { request, setUserAgent } from "./lib/http.mjs";
import { updatePlayerOnDisk } from "./lib/data.mjs";
import { classifyLicense, stripHtml } from "./lib/wikimedia-utils.mjs";
import { careerYears, yearOf, scoreEraCandidate } from "./lib/era-utils.mjs";
import { normalize } from "../public/js/normalize.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const CONTACT = process.env.CONTACTO || CONFIG.SITE_URL;
setUserAgent(`${CONFIG.SITE_NAME}-image-fetch/1.0 (${CONTACT}) node/${process.versions.node}`);
const ONLY = process.argv.find((a) => a.startsWith("--solo="))?.slice(7);
const MAX_FILES = 300;
const API = "https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&maxlag=5";
const IIPROPS =
  "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=330&iiextmetadatalanguage=en" +
  "&iiextmetadatafilter=DateTimeOriginal|DateTime|LicenseShortName|Artist|Attribution|AttributionRequired|Copyrighted|ObjectName";

// ---------- Datos ----------
const docs = readdirSync(DATA)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, doc: JSON.parse(readFileSync(join(DATA, f), "utf8")) }));
const players = new Map();
for (const { doc } of docs) for (const p of doc.jugadores) if (!players.has(p.id)) players.set(p.id, p);
function saveData() {
  for (const { file, doc } of docs) {
    doc.jugadores = doc.jugadores.map((p) => players.get(p.id));
    writeFileSync(join(DATA, file), JSON.stringify(doc, null, 2) + "\n");
  }
}

// ---------- Commons ----------
async function filesInCategory(category, subYear = null) {
  const out = [];
  let cont = "";
  while (out.length < MAX_FILES) {
    const json = await request(
      `${API}&action=query&generator=categorymembers&gcmtype=file&gcmlimit=50&gcmtitle=${encodeURIComponent("Category:" + category)}${IIPROPS}${cont}`,
    );
    for (const pg of json.query?.pages ?? []) if (pg.imageinfo?.[0]) out.push({ title: pg.title, info: pg.imageinfo[0], subYear });
    if (!json.continue) break;
    cont = Object.entries(json.continue)
      .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
      .join("");
  }
  return out;
}

async function subcategories(category) {
  const json = await request(
    `${API}&action=query&list=categorymembers&cmtype=subcat&cmlimit=50&cmtitle=${encodeURIComponent("Category:" + category)}`,
  );
  return (json.query?.categorymembers ?? []).map((c) => c.title.replace(/^Category:/, ""));
}

// ---------- Por jugador ----------
async function processPlayer(p) {
  const res = { id: p.id, jugador: p.nombre, carrera: null, categoria: null, actual: null, candidatas: [], obs: [] };
  if (!p.wikidata_id) {
    res.obs.push("Sin wikidata_id: ejecuta antes npm run images");
    return res;
  }
  const json = await request(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&maxlag=5&props=claims&ids=${encodeURIComponent(p.wikidata_id)}`,
  );
  const claims = json.entities?.[p.wikidata_id]?.claims ?? {};

  // Años de carrera
  let carrera = p.carrera?.fuente === "manual" ? p.carrera : careerYears(claims);
  if (carrera && p.carrera?.fuente !== "manual") {
    players.set(p.id, { ...players.get(p.id), carrera });
    updatePlayerOnDisk(DATA, p.id, { carrera });
  }
  res.carrera = carrera;
  if (!carrera) res.obs.push("Wikidata no tiene fechas de clubes: escribe \"carrera\" a mano");

  // Categoría de Commons
  const category = claims.P373?.[0]?.mainsnak?.datavalue?.value;
  res.categoria = category ?? null;
  if (!category) {
    res.obs.push("Sin categoría de Commons (P373)");
    return res;
  }

  let files = await filesInCategory(category);
  for (const sub of (await subcategories(category)).slice(0, 12)) {
    const y = yearOf(sub);
    if (files.length >= MAX_FILES) break;
    files = files.concat(await filesInCategory(sub, y));
  }

  // Foto actual (para saber si está fuera de época)
  const currentFile = p.imagen?.url_fuente ? decodeURIComponent(p.imagen.url_fuente.split("/wiki/").pop()).replace(/_/g, " ") : null;
  const tokens = [p.nombre, ...(p.alias ?? [])].flatMap((t) => normalize(t).split(" ")).filter((w) => w.length >= 4);
  const seen = new Set();
  for (const f of files) {
    if (seen.has(f.title)) continue;
    seen.add(f.title);
    const m = f.info.extmetadata ?? {};
    const year = yearOf(stripHtml(m.DateTimeOriginal?.value)) ?? yearOf(f.title) ?? f.subYear ?? yearOf(stripHtml(m.DateTime?.value));
    if (currentFile && f.title.replace(/_/g, " ") === currentFile) res.actual = { titulo: f.title, año: year };
    const licencia = stripHtml(m.LicenseShortName?.value);
    const autor = stripHtml(m.Attribution?.value) || stripHtml(m.Artist?.value);
    const lic = classifyLicense({ licencia, autor, attributionRequired: false, copyrighted: String(m.Copyrighted?.value ?? "").toLowerCase() });
    const c = {
      titulo: f.title,
      año: year,
      licencia,
      autor,
      ancho: f.info.width,
      alto: f.info.height,
      mime: f.info.mime,
      thumb: f.info.thumburl,
      url: f.info.descriptionurl,
      licOk: lic.ok,
    };
    const score = scoreEraCandidate(c, carrera, tokens);
    if (score !== null) res.candidatas.push({ ...c, score });
  }
  res.candidatas.sort((a, b) => b.score - a.score);
  res.candidatas = res.candidatas.slice(0, 8);
  if (!res.candidatas.length) res.obs.push("No hay fotos libres fechadas dentro de su carrera");
  return res;
}

// ---------- Reporte ----------
function writeReport(rows) {
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(join(ROOT, "reports", "fotos-epoca.json"), JSON.stringify(rows, null, 2) + "\n");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const body = Object.values(rows)
    .map((r) => {
      const p = players.get(r.id);
      const cur = p?.imagen?.archivo_local ? `<figure class="cur"><img src="../public/${esc(p.imagen.archivo_local)}" loading="lazy"><figcaption>ACTUAL · ${esc(r.actual?.año ?? "año ?")}</figcaption></figure>` : "";
      const cands = r.candidatas
        .map(
          (c, k) =>
            `<figure><a href="${esc(c.url)}" target="_blank"><img src="${esc(c.thumb)}" loading="lazy"></a><figcaption><b>#${k + 1}</b> ${esc(c.año)} · ${esc(c.licencia)}<br><code>${esc(c.titulo.replace(/^File:/, ""))}</code></figcaption></figure>`,
        )
        .join("");
      return `<section id="${esc(r.id)}"><h2>${esc(r.jugador)} <small>carrera ${esc(r.carrera?.inicio ?? "?")}–${esc(r.carrera?.fin ?? "hoy")} · ${esc(r.obs.join("; "))}</small></h2><div class="row">${cur}${cands}</div></section>`;
    })
    .join("\n");
  writeFileSync(
    join(ROOT, "reports", "fotos-epoca.html"),
    `<!doctype html><meta charset="utf-8"><title>Fotos de época</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:16px}h2{font-size:16px;margin:24px 0 8px}small{color:#aaa;font-weight:400}.row{display:flex;gap:8px;overflow-x:auto}figure{margin:0;width:170px;flex:none}img{width:170px;height:170px;object-fit:cover;object-position:50% 25%;background:#222}figcaption{font-size:11px;color:#bbb;word-break:break-all}.cur img{outline:3px solid #f59e0b}a{color:#9cf}</style><h1>Fotos de época (candidatas)</h1><p>Recuadro naranjo = foto actual. Para elegir, copia el nombre del archivo en "imagen_commons" del jugador.</p>${body}`,
  );
}

// ---------- Principal ----------
const rowsPath = join(ROOT, "reports", "fotos-epoca.json");
let rows = {};
try {
  rows = JSON.parse(readFileSync(rowsPath, "utf8"));
} catch {}
const FORCE = process.argv.includes("--force");
// Retoma donde quedó: salta a los ya revisados (salvo --force o --solo)
const todo = [...players.values()].filter((p) => (ONLY ? p.id === ONLY : p.era === "historico" && (FORCE || !rows[p.id] || rows[p.id].obs?.some((o) => o.startsWith("Error")))));
console.log(`Jugadores a revisar: ${todo.length}\n`);
let n = 0;
for (const p of todo) {
  n++;
  process.stdout.write(`[${n}/${todo.length}] ${p.nombre}… `);
  try {
    const r = await processPlayer(p);
    rows[p.id] = r;
    const fuera = r.actual?.año && r.carrera?.fin && r.actual.año > r.carrera.fin + 1;
    console.log(`carrera ${r.carrera?.inicio ?? "?"}–${r.carrera?.fin ?? "hoy"} · foto actual ${r.actual?.año ?? "año ?"}${fuera ? " (FUERA DE ÉPOCA)" : ""} · ${r.candidatas.length} candidatas`);
  } catch (e) {
    rows[p.id] = { id: p.id, jugador: p.nombre, candidatas: [], obs: [`Error: ${e.message}`] };
    console.log(`✖ ${e.message}`);
  }
  writeReport(rows);
}
console.log("\nReporte: reports/fotos-epoca.html");
