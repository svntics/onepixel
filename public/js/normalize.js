// Normalización de nombres: sin tildes, sin mayúsculas, sin signos. "Agüero" → "aguero".

export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes y diéresis (ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // signos → espacio ("O'Neil" → "o neil")
    .replace(/\s+/g, " ")
    .trim();
}

// Prepara la lista de jugadores para buscar: [{ i, nombre, keys: [nombre y alias normalizados] }]
export function buildIndex(nombres) {
  return nombres.map((p, i) => ({
    i,
    nombre: p.nombre,
    alias: p.alias ?? [],
    keys: [p.nombre, ...(p.alias ?? [])].map(normalize).filter(Boolean),
  }));
}

// Coincidencia exacta con el nombre o un alias. Devuelve los índices que coinciden.
export function matchExact(index, input) {
  const q = normalize(input);
  if (!q) return [];
  return index.filter((e) => e.keys.includes(q)).map((e) => e.i);
}

// Sugerencias para el autocompletado. `exclude` = índices ya intentados.
export function suggest(index, input, exclude = new Set(), limit = 8) {
  const q = normalize(input);
  if (!q) return [];
  const results = [];
  for (const e of index) {
    if (exclude.has(e.i)) continue;
    let best = Infinity;
    let via = null; // alias que coincidió (para mostrarlo)
    e.keys.forEach((k, j) => {
      let rank = Infinity;
      if (k.startsWith(q)) rank = 0;
      else if (k.split(" ").some((w) => w.startsWith(q))) rank = 1;
      else if (q.length >= 3 && k.includes(q)) rank = 2;
      if (rank < best || (rank === best && j === 0)) {
        best = rank;
        via = j === 0 ? null : e.alias[j - 1];
      }
    });
    // No mostrar el alias si ya está dentro del nombre ("Sergio Agüero (Agüero)")
    if (via && ` ${e.keys[0]} `.includes(` ${normalize(via)} `)) via = null;
    if (best < Infinity) results.push({ i: e.i, nombre: e.nombre, via, rank: best });
  }
  results.sort((a, b) => a.rank - b.rank || a.nombre.localeCompare(b.nombre, "es"));
  return results.slice(0, limit);
}
