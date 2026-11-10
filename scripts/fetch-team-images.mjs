// ============================================================
//  Imágenes del modo "4 Fotos 1 Equipo" (se ejecuta en TU computador, no en el navegador).
//
//  Uso:   npm run team-images                  → fotos que aún no tienen imagen
//         npm run team-images -- --solo=arsenal → solo un equipo (por su "id")
//         npm run team-images -- --force        → vuelve a elegir todas
//
//  Por cada foto de data/4fotos/<liga>.json que no sea una ilustración generada:
//    1. Si tiene "commons" (un archivo elegido a mano), usa ese archivo.
//       Si no, busca en Wikimedia Commons con el texto de "buscar".
//    2. Pide a Commons autor y licencia de cada candidata y descarta las no libres
//       (mismas reglas que las fotos de jugadores: sin NC, sin ND, sin GFDL sola).
//    3. Prefiere las que NO mencionan al club en el nombre del archivo.
//    4. Descarga la elegida como public/img/t/<hash>.webp (el nombre no revela el club).
//    5. Anota la elegida y hasta 5 alternativas en reports/4fotos.html, para revisarlas.
//
//  Respeta las reglas de Wikimedia (User-Agent con contacto, una solicitud por segundo, Retry-After).
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../public/js/config.js";
import { answerWords } from "../public/js/letters.js";
import { request, setUserAgent } from "./lib/http.mjs";
import { classifyLicense, stripHtml, imageFileName } from "./lib/wikimedia-utils.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "4fotos");
const IMG_DIR = join(ROOT, "public", "img", "t");
const REPORT_JSON = join(ROOT, "reports", "4fotos.json");
const REPORT_HTML = join(ROOT, "reports", "4fotos.html");
const CONTACT = process.env.CONTACTO || CONFIG.SITE_URL;
const UA = `${CONFIG.SITE_NAME}-team-images/1.0 (${CONTACT}) node/${process.versions.node}`;
const API = "https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&maxlag=5";
const THUMB_WIDTH = 640;
const OUT_SIZE = 480;
const OK_MIME = /^image\/(jpeg|png|webp|tiff)$/;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--solo="))?.slice(7);

const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function search(text) {
  const json = await request(`${API}&action=query&list=search&srnamespace=6&srlimit=15&srsearch=${encodeURIComponent(text)}`);
  return (json.query?.search ?? []).map((r) => r.title.replace(/^File:/, ""));
}

async function imageInfos(files) {
  if (!files.length) return [];
  const json = await request(
    `${API}&action=query&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=${THUMB_WIDTH}` +
      "&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|AttributionRequired|Copyrighted|Restrictions|Attribution|ObjectName" +
      `&iiextmetadatalanguage=es&titles=${encodeURIComponent(files.map((f) => "File:" + f).join("|"))}`,
  );
  return (json.query?.pages ?? [])
    .filter((p) => p.imageinfo?.[0])
    .map((p) => {
      const info = p.imageinfo[0];
      const meta = info.extmetadata ?? {};
      const licencia = stripHtml(meta.LicenseShortName?.value);
      const autor = stripHtml(meta.Attribution?.value) || stripHtml(meta.Artist?.value);
      const verdict = classifyLicense({
        licencia,
        autor,
        attributionRequired: String(meta.AttributionRequired?.value ?? "").toLowerCase() === "true",
        copyrighted: String(meta.Copyrighted?.value ?? "").toLowerCase(),
      });
      const restrictions = String(meta.Restrictions?.value ?? "");
      const notes = [...verdict.notes];
      if (restrictions.includes("trademark")) notes.push("Commons advierte marcas registradas en la imagen");
      if (restrictions.includes("personality")) notes.push("Commons advierte derechos de imagen de personas");
      return {
        file: p.title.replace(/^File:/, ""),
        ok: verdict.ok && OK_MIME.test(info.mime ?? "") && (info.width ?? 0) >= 400,
        licencia: licencia || "(sin dato)",
        url_licencia: meta.LicenseUrl?.value ?? "",
        autor: autor || "(sin dato)",
        url_fuente: info.descriptionurl,
        thumb: info.thumburl || info.url,
        titulo: stripHtml(meta.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
        notes,
      };
    });
}

// Actualiza solo esa foto en el archivo (lo vuelve a leer para no pisar cambios hechos mientras corría)
function saveFoto(file, teamId, index, patch) {
  const path = join(SRC, file);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const t = doc.equipos.find((x) => x.id === teamId);
  Object.assign(t.fotos[index], patch);
  writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
}

const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function writeReport(rows) {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(rows, null, 2) + "\n");
  const blocks = Object.values(rows).map((r) => {
    const cands = r.candidatas.map((c, i) => `
      <figure class="${c.file === r.elegida ? "sel" : ""}">
        <img src="${escHtml(c.thumb)}" loading="lazy" alt="">
        <figcaption><b>Opción ${i + 1}${c.file === r.elegida ? " ✔ elegida" : ""}</b><br>${escHtml(c.file)}<br>${escHtml(c.licencia)} · ${escHtml(c.autor)}${c.notes.length ? `<br><i>${escHtml(c.notes.join("; "))}</i>` : ""}</figcaption>
      </figure>`).join("");
    return `<section><h2>${escHtml(r.equipo)} · foto ${r.foto} (${escHtml(r.tipo)})</h2>
      <p>${escHtml(r.explicacion)}<br><small>Búsqueda: «${escHtml(r.buscar ?? r.elegida)}»${r.obs ? ` · <b>${escHtml(r.obs)}</b>` : ""}</small></p>
      <div class="grid">${cands || "<p><b>Sin candidatas libres.</b></p>"}</div></section>`;
  });
  writeFileSync(REPORT_HTML, `<!doctype html><meta charset="utf-8"><title>4 Fotos 1 Equipo · fotos</title>
<style>body{font-family:system-ui;margin:1rem;background:#111;color:#eee}section{border-bottom:1px solid #444;padding:1rem 0}
.grid{display:flex;flex-wrap:wrap;gap:.75rem}figure{margin:0;width:200px;font-size:12px;border:2px solid #333;padding:4px;border-radius:8px}
figure.sel{border-color:#34d399}figure img{width:100%;height:160px;object-fit:cover;border-radius:4px}</style>
<h1>4 Fotos 1 Equipo · fotos elegidas y alternativas</h1>
<p>Para cambiar una foto, dile a Claude: «<b>Arsenal foto 2 → opción 3</b>». Si ninguna sirve, dile qué buscar.</p>
${blocks.join("\n")}`);
}

async function main() {
  setUserAgent(UA);
  console.log(`User-Agent: ${UA}\n`);
  const rows = existsSync(REPORT_JSON) ? JSON.parse(readFileSync(REPORT_JSON, "utf8")) : {};
  const used = new Set(); // un mismo archivo no se repite entre equipos
  const todo = [];
  for (const file of readdirSync(SRC).filter((f) => f.endsWith(".json"))) {
    for (const t of JSON.parse(readFileSync(join(SRC, file), "utf8")).equipos) {
      t.fotos.forEach((f, i) => {
        if (f.imagen?.archivo_commons) used.add(f.imagen.archivo_commons);
        if (f.generada) return;
        if (ONLY ? t.id === ONLY : FORCE || !f.imagen) todo.push({ file, t, f, i });
      });
    }
  }
  console.log(`Fotos a buscar: ${todo.length}\n`);

  let n = 0;
  for (const { file, t, f, i } of todo) {
    n++;
    process.stdout.write(`[${n}/${todo.length}] ${t.nombre} · foto ${i + 1}… `);
    const key = `${t.id}:${i + 1}`;
    try {
      const names = f.commons ? [f.commons] : await search(f.buscar);
      const infos = await imageInfos(names);
      // mismo orden que la búsqueda (relevancia)
      infos.sort((a, b) => names.indexOf(a.file) - names.indexOf(b.file));
      const clubWords = answerWords(t.respuesta).map(fold).filter((w) => w.length >= 4);
      const mentionsClub = (c) => clubWords.some((w) => fold(c.file).includes(w));
      const libres = infos.filter((c) => c.ok && (!used.has(c.file) || c.file === f.imagen?.archivo_commons));
      const ranked = [...libres.filter((c) => !mentionsClub(c)), ...libres.filter(mentionsClub)];
      const pick = ranked[0];
      const row = {
        equipo: t.nombre, foto: i + 1, tipo: f.tipo, explicacion: f.explicacion, buscar: f.commons ? null : f.buscar,
        elegida: pick?.file ?? null, candidatas: ranked.slice(0, 6), obs: "",
      };
      if (!pick) {
        row.obs = f.commons ? "El archivo indicado no existe o no tiene licencia libre" : "Sin resultados con licencia libre: hay que cambiar la búsqueda";
        rows[key] = row;
        writeReport(rows);
        console.log(`✖ ${row.obs}`);
        continue;
      }
      if (mentionsClub(pick)) row.obs = "El nombre del archivo menciona al club (solo se ve al final, pero revisa que la imagen no lo muestre)";
      const buffer = await request(pick.thumb, { binary: true });
      const sharp = (await import("sharp")).default;
      const name = imageFileName(`4f:${t.id}:${i}:${pick.file}`);
      mkdirSync(IMG_DIR, { recursive: true });
      await sharp(buffer).rotate().resize({ width: OUT_SIZE, height: OUT_SIZE, fit: "cover", position: "attention" }).webp({ quality: 78 }).toFile(join(IMG_DIR, name));
      used.add(pick.file);
      saveFoto(file, t.id, i, {
        imagen: {
          archivo_local: `img/t/${name}`,
          archivo_commons: pick.file,
          titulo: pick.titulo,
          autor: pick.autor,
          licencia: pick.licencia,
          url_licencia: pick.url_licencia,
          url_fuente: pick.url_fuente,
        },
      });
      rows[key] = row;
      writeReport(rows);
      console.log(`✔ ${pick.licencia}`);
    } catch (e) {
      console.log(`✖ error: ${e.message}`);
    }
  }
  console.log("\nListo. Revisa reports/4fotos.html (ábrelo con doble clic).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
