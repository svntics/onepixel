// Punto de entrada: navegación (#/ y #/categoria), modos de juego, estadísticas y tema.
import { CONFIG } from "./config.js";
import { startRound } from "./game.js";
import { dateInTimeZone, challengeNumber, dailyPicks, msUntilNextDay } from "./daily.js";
import { load, save, getStats, recordDaily, currentStreak } from "./storage.js";
import { shareText, shareResult } from "./share.js";
import { initAds, initConsent, initSupport } from "./ads.js";

const $ = (sel) => document.querySelector(sel);
const views = { home: $("#view-home"), game: $("#view-game") };
const MAX = CONFIG.BLUR_LEVELS.length;
const dataCache = new Map();
let current = { cat: null, mode: load("mode", "daily") };
let countdownTimer = null;

// ---------- Tema (oscuro por defecto) ----------
function applyThemeButton() {
  const light = document.documentElement.dataset.theme === "light";
  const btn = $("#theme-toggle");
  btn.textContent = light ? "🌙" : "☀️";
  btn.setAttribute("aria-label", light ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
}
$("#theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  const light = root.dataset.theme !== "light";
  if (light) root.dataset.theme = "light";
  else delete root.dataset.theme;
  try {
    localStorage.setItem("op-theme", light ? "light" : "dark");
  } catch {}
  applyThemeButton();
});

// ---------- Fecha del reto ----------
function today() {
  const date = dateInTimeZone(new Date(), CONFIG.TIMEZONE);
  return { date, n: challengeNumber(date, CONFIG.DAILY_EPOCH) };
}

// ---------- Inicio ----------
// La lista de categorías viene escrita en index.html (la genera scripts/build-pages.mjs);
// aquí solo se marca cuáles ya se jugaron hoy.
function renderHome() {
  const { n } = today();
  document.querySelectorAll("#category-list [data-cat]").forEach((a) => {
    const saved = load(`daily:${a.dataset.cat}`);
    a.querySelector(".status").textContent = saved?.n === n && saved?.over ? "✓ Hoy" : "";
  });
}

// ---------- Datos ----------
async function loadCategory(id) {
  if (!dataCache.has(id)) {
    const res = await fetch(`data/${id}.json`);
    if (!res.ok) throw new Error(`No se pudo cargar ${id}`);
    dataCache.set(id, await res.json());
  }
  return dataCache.get(id);
}

// El reto de cada categoría depende de las otras (para no repetir jugador el mismo día),
// así que se cargan las 4 (son archivos pequeños).
async function dailyRoundIndex(catId, n) {
  const all = await Promise.all(CONFIG.CATEGORIES.map((c) => loadCategory(c.id)));
  const cats = CONFIG.CATEGORIES.map((c, k) => ({ id: c.id, keys: all[k].rondas.map((r) => r.k) }));
  return dailyPicks(n, cats)[catId];
}

// Práctica: "bolsa" mezclada por categoría guardada en el navegador; no repite hasta agotar la lista.
function nextPracticeRound(catId, total) {
  let bag = load(`bag:${catId}`);
  if (!Array.isArray(bag) || !bag.length || bag.some((i) => i >= total)) {
    bag = Array.from({ length: total }, (_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  const r = bag.pop();
  save(`bag:${catId}`, bag);
  return r;
}

// ---------- Pantalla final (victoria / derrota) ----------
function button(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `min-h-12 w-full rounded-xl px-4 font-bold ${cls}`;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function endScreen(cat, data, { won, points, marks, el }, numero) {
  const text = shareText({
    siteName: CONFIG.SITE_NAME,
    siteUrl: CONFIG.SITE_URL,
    categoria: cat.nombre,
    numero,
    marks,
    max: MAX,
    won,
    points,
  });
  const preview = document.createElement("pre");
  preview.className = "mt-3 rounded-xl bg-surface-2 p-3 font-sans text-sm whitespace-pre-wrap";
  preview.textContent = text;
  const status = document.createElement("p");
  status.className = "mt-2 min-h-6 text-sm text-muted";
  status.setAttribute("role", "status");

  const actions = document.createElement("div");
  actions.className = "mt-3 grid gap-2";
  actions.append(
    button("Compartir resultado", "bg-accent text-accent-ink", async () => {
      const r = await shareResult(text);
      status.textContent =
        r === "copied"
          ? "¡Copiado! Pégalo en WhatsApp, X o Instagram."
          : r === "failed"
            ? "No se pudo copiar. Selecciona el texto de arriba y cópialo."
            : "";
    }),
  );

  if (numero) {
    const next = document.createElement("p");
    next.className = "mt-3 text-center text-sm text-muted";
    const tick = () => {
      const ms = msUntilNextDay(new Date(), CONFIG.TIMEZONE);
      if (ms <= 1000) {
        clearInterval(countdownTimer);
        if (location.hash === `#/${cat.id}`) setTimeout(() => showGame(cat), 1500);
        return;
      }
      const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
      const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
      const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
      next.textContent = `Próximo reto en ${h}:${m}:${sec}`;
    };
    tick();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
    actions.append(button("Jugar en modo práctica", "border border-border bg-surface", () => setMode("practice")));
    el.append(preview, actions, status, next);
  } else {
    actions.append(button("Otro jugador", "border border-border bg-surface", () => playPractice(cat, data)));
    el.append(preview, actions, status);
  }
}

// ---------- Modos ----------
function playPractice(cat, data) {
  $("#challenge-label").textContent = "Modo práctica · sin límite";
  const r = nextPracticeRound(cat.id, data.rondas.length);
  startRound(data, data.rondas[r], {
    onEnd: (res) => {
      const p = load(`practice:${cat.id}`, { jugados: 0, ganados: 0 });
      p.jugados++;
      if (res.won) p.ganados++;
      save(`practice:${cat.id}`, p);
      endScreen(cat, data, res, null);
    },
  });
}

async function playDaily(cat, data) {
  const { n, date } = today();
  if (n < 1) {
    current.mode = "practice";
    playPractice(cat, data);
    $("#challenge-label").textContent = `El reto #1 empieza el ${CONFIG.DAILY_EPOCH}. Mientras, juega en modo práctica.`;
    return;
  }
  $("#challenge-label").textContent = `Reto #${n} · ${date.split("-").reverse().join("-")}`;
  const idx = await dailyRoundIndex(cat.id, n);
  const saved = load(`daily:${cat.id}`);
  const restore = saved?.n === n ? saved.actions : null;
  startRound(data, data.rondas[idx], {
    restore,
    onChange: ({ actions, over }) => save(`daily:${cat.id}`, { n, actions, over }),
    onEnd: (res) => {
      if (!res.restored) recordDaily(cat.id, n, res);
      endScreen(cat, data, res, n);
    },
  });
}

function setMode(mode) {
  current.mode = mode;
  save("mode", mode);
  if (current.cat) showGame(current.cat);
}
document.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

async function showGame(cat) {
  current.cat = cat;
  clearInterval(countdownTimer);
  $("#game-title").textContent = `${cat.emoji} ${cat.nombre}`;
  document.title = `${cat.nombre} · ${CONFIG.SITE_NAME}`;
  document.querySelectorAll(".mode-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === current.mode)));
  try {
    const data = await loadCategory(cat.id);
    if (!data.rondas.length) throw new Error("sin rondas");
    if (current.mode === "daily") await playDaily(cat, data);
    else playPractice(cat, data);
  } catch (e) {
    console.error(e);
    $("#attempts").textContent = "No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.";
  }
}

// ---------- Estadísticas ----------
function renderStats() {
  const { n } = today();
  $("#stats-body").replaceChildren(
    ...CONFIG.CATEGORIES.map((c) => {
      const s = getStats(c.id);
      const sec = document.createElement("section");
      const h = document.createElement("h3");
      h.className = "font-bold";
      h.textContent = `${c.emoji} ${c.nombre}`;
      const grid = document.createElement("dl");
      grid.className = "mt-2 grid grid-cols-4 gap-2 text-center";
      const pct = s.jugados ? Math.round((100 * s.ganados) / s.jugados) : 0;
      for (const [label, value] of [
        ["Jugados", s.jugados],
        ["% victorias", pct],
        ["Racha", currentStreak(s, n)],
        ["Mejor racha", s.mejorRacha],
      ]) {
        const d = document.createElement("div");
        d.className = "flex flex-col-reverse";
        d.innerHTML = `<dt class="text-xs text-muted"></dt><dd class="text-xl font-extrabold"></dd>`;
        d.querySelector("dt").textContent = label;
        d.querySelector("dd").textContent = value;
        grid.append(d);
      }
      const dist = document.createElement("ol");
      dist.className = "mt-2 grid gap-1";
      dist.setAttribute("aria-label", "Victorias por intento");
      const maxD = Math.max(1, ...s.distribucion);
      s.distribucion.forEach((v, k) => {
        const li = document.createElement("li");
        li.className = "flex items-center gap-2 text-xs";
        li.innerHTML = `<span class="w-3 text-muted" aria-hidden="true"></span><span class="bar rounded bg-accent px-1.5 text-right font-bold text-accent-ink" aria-hidden="true"></span><span class="sr-only"></span>`;
        li.querySelector("span").textContent = k + 1;
        const bar = li.querySelector(".bar");
        bar.style.width = `${Math.max(8, (100 * v) / maxD)}%`;
        bar.textContent = v;
        li.querySelector(".sr-only").textContent = `Intento ${k + 1}: ${v} victorias`;
        dist.append(li);
      });
      sec.append(h, grid, dist);
      return sec;
    }),
  );
}
const dialog = $("#stats-dialog");
$("#stats-btn").addEventListener("click", () => {
  renderStats();
  dialog.showModal();
});
dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());

// ---------- Router por hash ----------
function route(e) {
  const id = location.hash.replace(/^#\/?/, "");
  const cat = CONFIG.CATEGORIES.find((c) => c.id === id);
  document.documentElement.dataset.view = cat ? "game" : "home";
  views.home.hidden = !!cat;
  views.game.hidden = !cat;
  clearInterval(countdownTimer);
  if (cat) showGame(cat);
  else {
    current.cat = null;
    document.title = `${CONFIG.SITE_NAME} · Adivina el futbolista`;
    renderHome();
  }
  if (e) $("#contenido").focus({ preventScroll: true });
}

document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = CONFIG.SITE_NAME));
applyThemeButton();
initAds();
initConsent();
initSupport();
window.addEventListener("hashchange", route);
route();
