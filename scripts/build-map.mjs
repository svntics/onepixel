// Genera public/img/mapa-mundo.svg: mapa mundial simple para la pista "país" de 4 Fotos 1 Equipo.
// Datos: Natural Earth 1:110m (dominio público), vía el paquete world-atlas (licencia ISC).
// Uso: npm run build:map   (solo hace falta volver a correrlo si se cambia este script)
//
// Cada país es un <path data-iso="826" data-c="x,y"> (código ISO 3166-1 numérico; data-c = centro
// de su polígono más grande, para dibujar un marcador visible incluso en países pequeños).

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { feature } from "topojson-client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"));

// Proyección equirectangular recortada (sin la Antártida)
const K = 2.5, LAT_TOP = 84, LAT_BOTTOM = -58;
const W = 360 * K, H = (LAT_TOP - LAT_BOTTOM) * K;
const px = ([lon, lat]) => [(lon + 180) * K, (LAT_TOP - lat) * K];
const r = (n) => Math.round(n * 10) / 10;

// Países que cruzan el borde del mapa (Rusia, Fiyi): si un contorno salta más de 180° de longitud,
// se dibuja continuo sumando 360° a sus longitudes negativas (lo que sale del mapa queda recortado).
function unwrap(ring) {
  const crosses = ring.some((p, i) => i > 0 && Math.abs(p[0] - ring[i - 1][0]) > 180);
  return crosses ? ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]) : ring;
}
const ringPath = (ring) => "M" + unwrap(ring).map((p) => px(p).map(r).join(",")).join("L") + "Z";
function bbox(ring) {
  const pts = unwrap(ring).map(px);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

const countries = feature(topo, topo.objects.countries).features.filter((f) => f.id !== "010"); // sin Antártida
const paths = countries.map((f) => {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const d = polys.map((poly) => poly.map(ringPath).join("")).join("");
  // Centro del polígono más grande (por área de su caja)
  const boxes = polys.map((poly) => bbox(poly[0]));
  const big = boxes.reduce((a, b) => ((b.x1 - b.x0) * (b.y1 - b.y0) > (a.x1 - a.x0) * (a.y1 - a.y0) ? b : a));
  const c = [r((big.x0 + big.x1) / 2), r((big.y0 + big.y1) / 2)];
  return `<path data-iso="${f.id}" data-c="${c.join(",")}" d="${d}"/>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${r(H)}" role="img" aria-label="Mapa mundial">` +
  `<!-- Natural Earth 1:110m (dominio público) vía world-atlas (ISC). Generado por scripts/build-map.mjs. -->` +
  paths.join("") + `</svg>\n`;
writeFileSync(join(ROOT, "public", "img", "mapa-mundo.svg"), svg);
console.log(`✔ mapa-mundo.svg: ${countries.length} países · ${Math.round(svg.length / 1024)} KB`);
