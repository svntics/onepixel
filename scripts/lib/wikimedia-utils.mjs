// Funciones puras del script de imágenes (sin red), para poder probarlas.
import { createHash } from "node:crypto";

// Sal fija: cambia los nombres de archivo respecto de un hash "obvio" del id.
// (Ofuscación: si el repositorio es público, alguien podría recalcularlos.)
const SALT = "onepixel-2026";

export function imageFileName(id) {
  return createHash("sha256").update(`${SALT}:${id}`).digest("hex").slice(0, 16) + ".webp";
}

export function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Imagen principal (P18): preferida si existe; si no, la primera "normal". Nunca una "deprecated".
export function pickP18(claims) {
  const list = (claims?.P18 ?? []).filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue?.value);
  const chosen = list.find((c) => c.rank === "preferred") ?? list[0];
  return chosen?.mainsnak.datavalue.value ?? null;
}

export function looksLikeFootballer(description) {
  return /football|soccer|futbol|fútbol/i.test(String(description ?? ""));
}

// Decide si la licencia es aceptable para un sitio con publicidad.
// Aceptadas: dominio público, CC0, CC BY y CC BY-SA. Excluidas: NC (no comercial), ND (sin derivados),
// GFDL sola (exige incluir el texto completo de la licencia) y cualquier licencia no reconocida.
export function classifyLicense({ licencia, autor, attributionRequired, copyrighted }) {
  const l = String(licencia ?? "").trim();
  const notes = [];
  if (!l) return { ok: false, notes: ["Sin licencia indicada en Commons"] };
  if (/\bNC\b|non-?commercial/i.test(l)) return { ok: false, notes: [`Licencia no comercial (${l}): incompatible con publicidad`] };
  if (/\bND\b|no-?deriv/i.test(l)) return { ok: false, notes: [`Licencia sin obras derivadas (${l}): el difuminado podría considerarse una modificación`] };
  if (/^GFDL/i.test(l)) return { ok: false, notes: [`Licencia dudosa para este uso (${l}): exige reproducir el texto completo`] };

  const isPD = /^(public domain|pd\b|pd-)/i.test(l) || copyrighted === "false";
  const isCC0 = /^cc0/i.test(l);
  const isBy = /^cc[\s-]by(-sa)?[\s-]\d(\.\d)?/i.test(l);
  if (!isPD && !isCC0 && !isBy) return { ok: false, notes: [`Licencia no reconocida automáticamente (${l}): revisar a mano`] };

  if (isBy && !autor) return { ok: false, notes: ["La licencia exige atribución pero Commons no indica autor"] };
  if (isBy && /-sa/i.test(l)) notes.push("CC BY-SA: si se considera obra derivada, debe compartirse con la misma licencia");
  if (isPD) notes.push("Dominio público: verificar que lo sea también en Chile");
  if (!isBy && attributionRequired) notes.push("Commons indica que requiere atribución");
  return { ok: true, notes };
}

// Pistas de nacionalidad (en inglés, como las descripciones de Wikidata) para desempatar homónimos.
const NATIONALITY = {
  Argentina: "argentin", Brasil: "brazil", Chile: "chile", Uruguay: "urugua", Colombia: "colombia",
  "Perú": "peru", Ecuador: "ecuador", "España": "spain|spanish", Francia: "france|french", Alemania: "german",
  Italia: "ital", Portugal: "portug", Inglaterra: "english|england", Gales: "welsh|wales",
  "Países Bajos": "dutch|netherlands", "Bélgica": "belgi", Croacia: "croat", Polonia: "polish|poland",
  Noruega: "norweg", Egipto: "egypt", "Corea del Sur": "south korea|korean", "Costa de Marfil": "ivor",
  "Camerún": "cameroon", Ucrania: "ukrain", Dinamarca: "danish|denmark", "República Checa": "czech",
};

// Elige el mejor candidato de búsquedas en Wikidata.
// results: [{ term, items: [{ id, description }] }]. Devuelve { id, description, score } o null.
// nacimiento (opcional): año de nacimiento conocido, para distinguir homónimos ("born 1993").
export function pickSearchCandidate(results, pais, nacimiento = null) {
  const nat = NATIONALITY[pais] ? new RegExp(NATIONALITY[pais], "i") : null;
  const scores = new Map();
  for (const { items } of results) {
    items.forEach((it, rank) => {
      if (!looksLikeFootballer(it.description)) return;
      const prev = scores.get(it.id) ?? { id: it.id, description: it.description, score: 0 };
      const born = it.description.match(/born (\d{4})|\((\d{4})[–-]/);
      const year = born ? Number(born[1] ?? born[2]) : null;
      const birthScore = nacimiento && year ? (year === nacimiento ? 5 : -10) : 0;
      prev.score += 1 + (rank === 0 ? 0.5 : 0) + (nat?.test(it.description) ? 2 : 0) + birthScore;
      scores.set(it.id, prev);
    });
  }
  const best = [...scores.values()].sort((a, b) => b.score - a.score)[0];
  return best ?? null;
}
