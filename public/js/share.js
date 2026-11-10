// Texto para compartir estilo Wordle (sin revelar al jugador).
const EMOJI = { miss: "🟥", hint: "🟨", win: "🟩" };

export function shareText({ siteName, siteUrl, categoria, numero, marks, max, won, points }) {
  const squares = Array.from({ length: max }, (_, k) => EMOJI[marks[k]] ?? "⬛").join("");
  const head = numero ? `${siteName} ⚽ ${categoria} #${numero}` : `${siteName} ⚽ ${categoria} (práctica)`;
  const score = `${won ? marks.length : "X"}/${max} · ${points} pts`;
  return `${head}\n${squares}\n${score}\n${siteUrl}`;
}

// Texto del reto diario de varias fotos: una línea por foto + total.
const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
export function dailyShareText({ siteName, siteUrl, categoria, numero, fotos, max, maxPoints }) {
  const lines = fotos.map((f, k) => {
    const squares = Array.from({ length: max }, (_, j) => EMOJI[f.marks[j]] ?? "⬛").join("");
    return `${NUM[k] ?? `${k + 1}.`} ${squares} ${f.points}`;
  });
  const total = fotos.reduce((a, f) => a + f.points, 0);
  const aciertos = fotos.filter((f) => f.won).length;
  return [
    `${siteName} ⚽ ${categoria} #${numero}`,
    ...lines,
    `Total: ${total}/${maxPoints * fotos.length} pts · ${aciertos}/${fotos.length} aciertos`,
    siteUrl,
  ].join("\n");
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
