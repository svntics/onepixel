// Guarda cambios de UN jugador releyendo los archivos del disco justo antes de escribir.
// Así, si mientras corre un script se agregan jugadores o categorías, no se pierden.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function updatePlayerOnDisk(dataDir, id, fields) {
  for (const f of readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
    const path = join(dataDir, f);
    const doc = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;
    doc.jugadores = doc.jugadores.map((p) => {
      if (p.id !== id) return p;
      changed = true;
      return { ...p, ...fields };
    });
    if (changed) writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
  }
}
