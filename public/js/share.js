// Texto para compartir estilo Wordle (sin revelar al jugador).
const EMOJI = { miss: "🟥", hint: "🟨", win: "🟩" };

export function shareText({ siteName, siteUrl, categoria, numero, marks, max, won, points }) {
  const squares = Array.from({ length: max }, (_, k) => EMOJI[marks[k]] ?? "⬛").join("");
  const head = numero ? `${siteName} ⚽ ${categoria} #${numero}` : `${siteName} ⚽ ${categoria} (práctica)`;
  const score = `${won ? marks.length : "X"}/${max} · ${points} pts`;
  return `${head}\n${squares}\n${score}\n${siteUrl}`;
}

// Web Share API en celulares; portapapeles como respaldo. Devuelve "shared" | "copied" | "failed".
export async function shareResult(text) {
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
