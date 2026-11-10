// Nombres neutros de las versiones difuminadas de cada foto (uno por nivel de blur).
// Los usan build-data.mjs (para escribir las rutas) y build-blur.mjs (para generar los archivos).
import { createHash } from "node:crypto";

export function blurFileName(sharpFile, level) {
  const base = sharpFile.split("/").pop();
  return createHash("sha256").update(`onepixel-blur:${base}:${level}`).digest("hex").slice(0, 16) + ".webp";
}
