// Conexión a Wikimedia respetando sus reglas: User-Agent con contacto, una solicitud a la vez,
// pausa entre solicitudes y espera "Retry-After" ante 429/503.
// https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits

const PAUSE_MS = 1000; // ~60 solicitudes/minuto, bien bajo el límite publicado
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
let UA = "onepixel/1.0";

export function setUserAgent(ua) {
  UA = ua;
}

export async function request(url, { binary = false } = {}) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const wait = lastRequest + PAUSE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: binary ? "image/*" : "application/json" } });
    } catch (e) {
      console.warn(`  ⚠ error de red (${e.message}); reintento ${attempt}/6`);
      await sleep(5000 * attempt);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const retry = Number(res.headers.get("retry-after"));
      const ms = Number.isFinite(retry) && retry > 0 ? retry * 1000 : 5000 * 2 ** (attempt - 1);
      console.warn(`  ⏳ Wikimedia pide esperar (${res.status}); espero ${Math.round(ms / 1000)} s… (${attempt}/6)`);
      await sleep(ms);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    if (binary) return Buffer.from(await res.arrayBuffer());
    const json = await res.json();
    if (json.error?.code === "maxlag") {
      await sleep(5000 * attempt);
      continue;
    }
    if (json.error) throw new Error(`API: ${json.error.code} – ${json.error.info}`);
    return json;
  }
  throw new Error(`Demasiados reintentos: ${url}`);
}

