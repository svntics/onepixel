// Ilustración original de una camiseta genérica con los colores de un club (sin escudo, marcas ni texto).
// Los colores por sí solos no son una obra protegida; el dibujo es propio del sitio.
//   patron: "liso" | "rayas" | "aros" | "mangas" | "mitades" | "banda" | "franja" (franja horizontal al medio)
//   colores: [principal, secundario] en hexadecimal

export const KIT_PATTERNS = ["liso", "rayas", "aros", "mangas", "mitades", "banda", "franja"];

const SHIRT = "M70,34 L88,26 Q100,40 112,26 L130,34 L170,62 L152,92 L136,82 L136,176 L64,176 L64,82 L48,92 L30,62 Z";

export function kitSvg({ patron, colores }) {
  const [a, b] = colores;
  let fill = "";
  switch (patron) {
    case "rayas":
      fill = `<rect width="200" height="200" fill="${b}"/>` +
        Array.from({ length: 8 }, (_, i) => `<rect x="${22 + i * 22}" y="0" width="11" height="200" fill="${a}"/>`).join("");
      break;
    case "aros":
      fill = `<rect width="200" height="200" fill="${b}"/>` +
        Array.from({ length: 7 }, (_, i) => `<rect x="0" y="${30 + i * 22}" width="200" height="11" fill="${a}"/>`).join("");
      break;
    case "mangas":
      fill = `<rect width="200" height="200" fill="${a}"/><rect x="0" y="0" width="66" height="200" fill="${b}"/><rect x="134" y="0" width="66" height="200" fill="${b}"/>`;
      break;
    case "mitades":
      fill = `<rect width="100" height="200" fill="${a}"/><rect x="100" width="100" height="200" fill="${b}"/>`;
      break;
    case "franja":
      fill = `<rect width="200" height="200" fill="${a}"/><rect x="0" y="92" width="200" height="30" fill="${b}"/>`;
      break;
    case "banda":
      fill = `<rect width="200" height="200" fill="${a}"/><polygon points="60,20 95,20 160,200 125,200" fill="${b}"/>`;
      break;
    default: // liso: cuerpo del color principal; cuello y puños del secundario
      fill = `<rect width="200" height="200" fill="${a}"/>`;
  }
  const trim = patron === "liso"
    ? `<path d="M88,26 Q100,40 112,26" fill="none" stroke="${b}" stroke-width="7"/>` +
      `<path d="M48,92 L30,62" stroke="${b}" stroke-width="9"/><path d="M152,92 L170,62" stroke="${b}" stroke-width="9"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">` +
    `<rect width="200" height="200" fill="#5b6475"/>` +
    `<defs><clipPath id="s"><path d="${SHIRT}"/></clipPath></defs>` +
    `<g clip-path="url(#s)">${fill}${trim}</g>` +
    `<path d="${SHIRT}" fill="none" stroke="#1a1d24" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
