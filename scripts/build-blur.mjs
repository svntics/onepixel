// Genera versiones YA difuminadas de cada foto, una por nivel de blur (config.js → BLUR_LEVELS).
// Así, durante la ronda el navegador nunca recibe la foto nítida: copiarla o abrirla en otra
// pestaña muestra la misma imagen borrosa. La nítida solo se pide al terminar la ronda.
//
// El blur se escala al ancho de la foto (igual que antes con CSS: nivel × ancho / 400), y se
// aplica sobre la imagen, por lo que tampoco aparece el borde oscuro del blur de CSS.
// Uso: node scripts/build-blur.mjs   (lo corre "npm run build"; las salidas no van a git)
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { CONFIG } from "../public/js/config.js";
import { blurFileName } from "./lib/blur-names.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "public", "img", "p");
const OUT = join(ROOT, "public", "img", "b");
mkdirSync(OUT, { recursive: true });

const levels = CONFIG.BLUR_LEVELS.filter((l) => l > 0);
const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith(".webp")) : [];
let created = 0;
for (const f of files) {
  const src = join(SRC, f);
  const { width } = await sharp(src).metadata();
  for (const level of levels) {
    const out = join(OUT, blurFileName(f, level));
    if (existsSync(out)) continue;
    const sigma = Math.max(0.3, (level * width) / CONFIG.BLUR_REFERENCE_WIDTH);
    await sharp(src).blur(sigma).webp({ quality: 70 }).toFile(out);
    created++;
  }
}
console.log(`✔ fotos difuminadas: ${files.length} fotos × ${levels.length} niveles (${created} nuevas)`);
