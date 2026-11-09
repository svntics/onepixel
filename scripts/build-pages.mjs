// Genera archivos que dependen de la configuración y de los datos:
//   - public/assets/ads.css   → altura reservada para los banners (sin saltos de página al cargar)
//   - public/creditos.html    → créditos de todas las imágenes (autor, licencia, fuente)
// Uso: node scripts/build-pages.mjs [--placeholders]

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../public/js/config.js";

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

const template = readFileSync(join(ROOT, "scripts", "templates", "creditos.html"), "utf8");
const html = template
  .replace("{{CANTIDAD}}", String(list.length))
  .replace("{{LISTA}}", items || '<li class="text-muted">Aún no hay imágenes. Ejecuta <code>npm run images</code>.</li>');
writeFileSync(join(ROOT, "public", "creditos.html"), html);
console.log(`✔ creditos.html: ${list.length} imágenes con crédito`);
