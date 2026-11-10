// Genera archivos que dependen de la configuración y de los datos:
//   - public/assets/ads.css   → altura reservada para los banners (sin saltos de página al cargar)
//   - public/creditos.html    → créditos de todas las imágenes (autor, licencia, fuente)
// Uso: node scripts/build-pages.mjs [--placeholders]

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../public/js/config.js";
import { pixelLogoSvg } from "./lib/logo.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = process.argv.includes("--placeholders");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- ads.css ----------
const { ADS } = CONFIG;
const showSlots = ADS.ENABLED || ADS.SHOW_PLACEHOLDERS || DEV;
let css = "/* Generado por scripts/build-pages.mjs a partir de public/js/config.js. No editar. */\n";
if (showSlots) {
  css += ".ad-slot{display:flex}\n";
  for (const [name, h] of Object.entries(ADS.SLOTS)) {
    css += `.ad-slot[data-slot="${name}"]{min-height:${Number(h.mobile)}px}\n`;
    css += `@media (min-width:768px){.ad-slot[data-slot="${name}"]{min-height:${Number(h.desktop)}px}}\n`;
  }
} else {
  css += ".ad-slot{display:none}\n";
}
mkdirSync(join(ROOT, "public", "assets"), { recursive: true });
writeFileSync(join(ROOT, "public", "assets", "ads.css"), css);
console.log(`✔ ads.css: espacios publicitarios ${showSlots ? "visibles" : "ocultos"}`);

// ---------- Página principal e índices de categorías en index.html (HTML estático: sin saltos) ----------
const indexPath = join(ROOT, "public", "index.html");
const indexHtml = readFileSync(indexPath, "utf8");
const ACTIVE = CONFIG.CATEGORIES.filter((c) => c.activa !== false);
const SPORTS = CONFIG.SPORTS;

// Cuadrícula de categorías generales: activas (enlace) y bloqueadas ("Próximamente")
const sportsHtml = SPORTS.map((d) => {
  const locked = d.estado !== "activo";
  const inner = `<span class="text-4xl" aria-hidden="true">${esc(d.emoji)}</span>
          <span class="pix text-lg font-extrabold leading-tight">${esc(d.nombre)}</span>
          <span class="text-xs text-muted">${esc(d.descripcion)}</span>
          ${locked ? '<span class="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold">🔒 Próximamente</span>' : ""}`;
  const cls = "flex h-full min-h-40 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface p-4 text-center";
  return locked
    ? `        <li><button type="button" data-locked="${esc(d.id)}" aria-disabled="true" class="sport-locked w-full ${cls}">
          ${inner}
        </button></li>`
    : `        <li><a href="${d.enlace ? esc(d.enlace) : `#/${esc(d.id)}`}" data-sport="${esc(d.id)}" class="${cls} hover:border-accent hover:bg-surface-2">
          ${inner}
        </a></li>`;
}).join("\n");

// Listas de subcategorías por categoría general (se muestra la del deporte elegido)
const catItem = (c) => `          <li${typeof c.activa === "string" ? ` hidden data-desde="${esc(c.activa)}"` : ""}><a href="#/${esc(c.id)}" data-cat="${esc(c.id)}"
            class="flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <span class="text-3xl" aria-hidden="true">${esc(c.emoji)}</span>
            <span class="flex flex-1 flex-col"><span class="pix text-lg font-bold">${esc(c.nombre)}</span><span class="text-sm text-muted">${esc(c.descripcion)}</span></span>
            <span class="status text-sm font-semibold text-accent"></span>
          </a></li>`;
const listsHtml = SPORTS.filter((d) => d.estado === "activo")
  .map((d) => {
    const cats = ACTIVE.filter((c) => c.deporte === d.id);
    const prep = CONFIG.CATEGORIES.filter((c) => c.deporte === d.id && c.activa === false);
    const items = cats.map(catItem).join("\n");
    const empty = !cats.length
      ? `          <li class="rounded-2xl border border-dashed border-border p-4 text-center text-muted">⏳ En preparación: ${esc(prep.map((c) => c.nombre).join(", ") || "pronto")}. ¡Vuelve pronto!</li>`
      : "";
    return `        <ul class="category-list mt-6 grid gap-3 sm:grid-cols-2" data-sport="${esc(d.id)}" hidden role="list">
${items}${empty}
        </ul>`;
  })
  .join("\n");

const replaceBetween = (html, name, content) =>
  html.replace(new RegExp(`(<!-- ${name}:inicio[^>]*-->)[\\s\\S]*?(<!-- ${name}:fin -->)`), `$1\n${content}\n$2`);
let newIndex = replaceBetween(indexHtml, "deportes-grid", sportsHtml);
newIndex = replaceBetween(newIndex, "categorias", listsHtml);
newIndex = newIndex.replace(/\/\*deportes:inicio\*\/.*?\/\*deportes:fin\*\//, `/*deportes:inicio*/${JSON.stringify(SPORTS.map((d) => d.id))}/*deportes:fin*/`);
// Logo pixel art en el encabezado de todas las páginas
const LOGO = pixelLogoSvg(CONFIG.SITE_NAME.toLowerCase());
const withLogo = (html) => html.replace(/(<!-- logo:inicio -->)[\s\S]*?(<!-- logo:fin -->)/, `$1${LOGO}$2`);
newIndex = withLogo(newIndex);
for (const f of ["privacidad.html", "aviso-legal.html", "4fotos.html"]) {
  const path = join(ROOT, "public", f);
  const html = readFileSync(path, "utf8");
  if (withLogo(html) !== html) writeFileSync(path, withLogo(html));
}
if (newIndex !== indexHtml) writeFileSync(indexPath, newIndex);
console.log(`✔ index.html: ${SPORTS.length} categorías generales, ${ACTIVE.length} subcategorías activas`);

// ---------- creditos.html ----------
const players = new Map();
for (const f of readdirSync(join(ROOT, "data")).filter((f) => f.endsWith(".json"))) {
  for (const p of JSON.parse(readFileSync(join(ROOT, "data", f), "utf8")).jugadores) if (p.imagen) players.set(p.id, p);
}
const list = [...players.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
const items = list
  .map((p) => {
    const i = p.imagen;
    const lic = i.url_licencia ? `<a href="${esc(i.url_licencia)}" rel="license noopener" target="_blank">${esc(i.licencia)}</a>` : esc(i.licencia);
    return `<li class="rounded-xl border border-border bg-surface p-3"><strong>${esc(p.nombre)}</strong><br>
<span class="text-sm text-muted">Foto: ${esc(i.autor)} · ${lic} · <a href="${esc(i.url_fuente)}" rel="noopener" target="_blank">Wikimedia Commons</a></span></li>`;
  })
  .join("\n");

// Fotos del modo "4 Fotos 1 Equipo" (solo equipos aprobados)
const teamDir = join(ROOT, "data", "4fotos");
const teamPhotos = [];
for (const f of readdirSync(teamDir).filter((f) => f.endsWith(".json"))) {
  for (const t of JSON.parse(readFileSync(join(teamDir, f), "utf8")).equipos) {
    if (t.aprobado === false) continue;
    t.fotos.forEach((ft, i) => ft.imagen && teamPhotos.push({ t, i, im: ft.imagen }));
  }
}
const teamItems = teamPhotos
  .map(({ t, i, im }) => {
    const lic = im.url_licencia ? `<a href="${esc(im.url_licencia)}" rel="license noopener" target="_blank">${esc(im.licencia)}</a>` : esc(im.licencia);
    return `<li class="rounded-xl border border-border bg-surface p-3"><strong>4 Fotos 1 Equipo · ${esc(t.nombre)} (foto ${i + 1})</strong><br>
<span class="text-sm text-muted">«${esc(im.titulo)}» · ${esc(im.autor)} · ${lic} · <a href="${esc(im.url_fuente)}" rel="noopener" target="_blank">Wikimedia Commons</a></span></li>`;
  })
  .join("\n");

const template = readFileSync(join(ROOT, "scripts", "templates", "creditos.html"), "utf8");
const html = withLogo(template)
  .replace("{{CANTIDAD}}", String(list.length + teamPhotos.length))
  .replace("{{LISTA}}", [items, teamItems].filter(Boolean).join("\n") || '<li class="text-muted">Aún no hay imágenes. Ejecuta <code>npm run images</code>.</li>');
writeFileSync(join(ROOT, "public", "creditos.html"), html);
console.log(`✔ creditos.html: ${list.length + teamPhotos.length} imágenes con crédito`);
