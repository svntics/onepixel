// Logo pixel art: cada letra se dibuja con píxeles cuadrados de distintos tonos.
// Los tonos son clases (px-t0 … px-t3) cuyos colores define src/input.css según el tema.
// Se genera como SVG en línea (nítido en cualquier pantalla, sin descargar imágenes).

// Letras en una grilla de 9 filas (0–8): x-height en filas 2–6, ascendentes desde 0, descendentes hasta 8
const GLYPHS = {
  o: ["", "", ".###.", "#...#", "#...#", "#...#", ".###."],
  n: ["", "", "####.", "#...#", "#...#", "#...#", "#...#"],
  e: ["", "", ".###.", "#...#", "#####", "#....", ".####"],
  p: ["", "", "####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  i: [".#.", "", "##.", ".#.", ".#.", ".#.", "###"],
  x: ["", "", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  l: ["##.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
};

// Tono fijo por píxel (no cambia entre cargas): pseudoaleatorio a partir de su posición
const tone = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4;

export function pixelLogoSvg(text = "onepixel", px = 3, gap = 1) {
  const rects = [];
  let col = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    const w = Math.max(...g.map((r) => r.length));
    g.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === "#") rects.push(`<rect x="${(col + x) * px}" y="${y * px}" width="${px}" height="${px}" class="px-t${tone(col + x, y)}"/>`);
      }),
    );
    col += w + gap;
  }
  const W = (col - gap) * px;
  const H = 9 * px;
  return `<svg class="pixel-logo" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${text}" shape-rendering="crispEdges"><title>${text}</title>${rects.join("")}</svg>`;
}
