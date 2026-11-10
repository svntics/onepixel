// Ranking de mejores puntajes del día (por categoría y fecha).
// Dos modos (config.js → RANKING.PROVIDER):
//   "local"    → prueba: se guarda en este navegador (no se comparte con nadie)
//   "supabase" → compartido, vía la API REST de Supabase (tabla puntajes_diarios; ver docs/supabase.sql)
import { CONFIG } from "./config.js";
import { load, save } from "./storage.js";

const R = CONFIG.RANKING ?? { PROVIDER: "local", TOP: 10 };
export const RANKING_COMPARTIDO = R.PROVIDER === "supabase" && !!R.SUPABASE_URL && !!R.SUPABASE_KEY;

// ---------- Apodo ----------
const BLOQUEADAS = ["puta", "puto", "mierda", "weon", "huevon", "conchetumare", "ctm", "maricon", "pendejo", "nazi", "hitler"];

export function validateApodo(raw) {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, error: "Escribe un apodo." };
  if (value.length < 2 || value.length > 16) return { ok: false, error: "El apodo debe tener entre 2 y 16 caracteres." };
  if (!/^[\p{L}\p{N} ._-]+$/u.test(value)) return { ok: false, error: "Usa solo letras, números, espacios, punto, guion o guion bajo." };
  const plano = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BLOQUEADAS.some((w) => plano.includes(w))) return { ok: false, error: "Elige otro apodo, por favor." };
  return { ok: true, value };
}

export const getApodo = () => load("apodo", "");
export const setApodo = (a) => save("apodo", a);

// Identificador anónimo de este navegador: evita que el mismo navegador envíe dos veces el mismo día.
function deviceId() {
  let id = load("dispositivo");
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    save("dispositivo", id);
  }
  return id;
}

// ---------- Supabase (API REST) ----------
function headers() {
  const h = { apikey: R.SUPABASE_KEY, "Content-Type": "application/json" };
  // La clave "anon" antigua es un JWT y también va como Bearer; la nueva "publishable" no.
  if (R.SUPABASE_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${R.SUPABASE_KEY}`;
  return h;
}
const api = (path) => `${R.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;

// ---------- API pública ----------
// entry = { fecha, categoria, apodo, puntaje, aciertos, intentos } → { ok } | { ok:false, error }
export async function submitScore(entry) {
  const row = { ...entry, dispositivo: deviceId() };
  if (!RANKING_COMPARTIDO) {
    const all = load("ranking-local", []);
    if (all.some((r) => r.fecha === row.fecha && r.categoria === row.categoria && r.dispositivo === row.dispositivo))
      return { ok: false, error: "Ya guardaste tu puntaje de hoy en esta categoría." };
    all.push(row);
    save("ranking-local", all.slice(-500));
    return { ok: true };
  }
  try {
    const res = await fetch(api("puntajes_diarios"), { method: "POST", headers: { ...headers(), Prefer: "return=minimal" }, body: JSON.stringify(row) });
    if (res.ok) return { ok: true };
    if (res.status === 409) return { ok: false, error: "Ya guardaste tu puntaje de hoy en esta categoría." };
    return { ok: false, error: "No se pudo guardar el puntaje. Inténtalo de nuevo más tarde." };
  } catch {
    return { ok: false, error: "Sin conexión. Inténtalo de nuevo más tarde." };
  }
}

// → { ok, rows: [{ apodo, puntaje, aciertos }] } ordenadas de mayor a menor
export async function getTop({ fecha, categoria, limit = R.TOP ?? 10 }) {
  if (!RANKING_COMPARTIDO) {
    const rows = load("ranking-local", [])
      .filter((r) => r.fecha === fecha && r.categoria === categoria)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, limit);
    return { ok: true, rows };
  }
  try {
    const q = `puntajes_diarios?select=apodo,puntaje,aciertos&fecha=eq.${encodeURIComponent(fecha)}&categoria=eq.${encodeURIComponent(categoria)}&order=puntaje.desc,creado.asc&limit=${limit}`;
    const res = await fetch(api(q), { headers: headers() });
    if (!res.ok) return { ok: false, rows: [] };
    return { ok: true, rows: await res.json() };
  } catch {
    return { ok: false, rows: [] };
  }
}
