// Punto de entrada: navegación, modos de juego, reto diario de 3 fotos, estadísticas y tema.
//
// Rutas:  #/                      → inicio (categorías)
//         #/<categoria>           → elegir modo (Reto diario / Modo práctica)
//         #/<categoria>/diario    → reto diario (3 fotos) y, al terminar, sus resultados
//         #/<categoria>/practica  → modo práctica (ilimitado, de a una foto)
import { CONFIG } from "./config.js";
import { startRound } from "./game.js";
import { dateInTimeZone, challengeNumber, dailyPicksMulti, msUntilNextDay } from "./daily.js";
import { load, save, getStats, recordDailyDay, currentStreak } from "./storage.js";
import { shareText, dailyShareText, shareResult } from "./share.js";
import { pointsForBlur } from "./scoring.js";
import { initAds, initConsent, initSupport } from "./ads.js";

const $ = (sel) => document.querySelector(sel);
const views = { home: $("#view-home"), mode: $("#view-mode"), game: $("#view-game") };
const MAX = CONFIG.BLUR_LEVELS.length;
const FOTOS_DIARIAS = 3;
const MAX_PUNTOS = pointsForBlur(CONFIG.BLUR_LEVELS[0]); // puntos máximos por foto

// ---------- Fecha del reto ----------
function today() {
  const date = dateInTimeZone(new Date(), CONFIG.TIMEZONE);
  return { date, n: challengeNumber(date, CONFIG.DAILY_EPOCH) };
}
const fechaCorta = (date) => date.split("-").reverse().join("-");

// Solo las categorías activas: "activa: false" = en preparación; "activa: AAAA-MM-DD" = desde ese día
const CATEGORIES = CONFIG.CATEGORIES.filter(
  (c) => c.activa !== false && !(typeof c.activa === "string" && c.activa > today().date),
);

// Rondas disponibles hoy (un jugador aprobado con fecha entra desde ese día)
function available(data) {
  const d = today().date;
  return { ...data, rondas: data.rondas.filter((r) => !r.desde || r.desde <= d) };
}
const dataCache = new Map();
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

// ---------- Reto diario guardado ----------
// daily3:<categoria> = { n, fotos: [{ actions, over, won, points, stage, marks, name }], registrado }
function loadDaily(catId, n) {
  const saved = load(`daily3:${catId}`);
  return saved?.n === n ? saved : { n, fotos: [], registrado: false };
}
const saveDaily = (catId, d) => save(`daily3:${catId}`, d);
const doneFotos = (d) => d.fotos.filter((f) => f?.over).length;
const totalPuntos = (d) => d.fotos.reduce((a, f) => a + (f?.over ? f.points : 0), 0);

// ---------- Inicio ----------
// La lista de categorías viene escrita en index.html (la genera scripts/build-pages.mjs);
// aquí se muestran las que tienen fecha de inicio y se marca el avance de hoy.
function renderHome() {
  const { n, date } = today();
  document.querySelectorAll("#category-list li[data-desde]").forEach((li) => (li.hidden = li.dataset.desde > date));
  document.querySelectorAll("#category-list [data-cat]").forEach((a) => {
    const d = loadDaily(a.dataset.cat, n);
    const k = doneFotos(d);
    a.querySelector(".status").textContent = k >= FOTOS_DIARIAS ? `✓ ${totalPuntos(d)} pts` : k ? `${k}/${FOTOS_DIARIAS}` : "";
  });
}

// ---------- Elegir modo ----------
function showMode(cat) {
  const { n } = today();
  $("#mode-title").textContent = `${cat.emoji} ${cat.nombre}`;
  document.title = `${cat.nombre} · ${CONFIG.SITE_NAME}`;
  $("#mode-daily").href = `#/${cat.id}/diario`;
  $("#mode-practice").href = `#/${cat.id}/practica`;
  const d = loadDaily(cat.id, n);
  const k = doneFotos(d);
  $("#mode-daily-status").textContent =
    n < 1
      ? `Empieza el ${fechaCorta(CONFIG.DAILY_EPOCH)}`
      : k >= FOTOS_DIARIAS
        ? `✓ Completado hoy: ${totalPuntos(d)} pts · ver resultados`
        : k
          ? `Reto #${n} · vas en la foto ${k + 1} de ${FOTOS_DIARIAS}`
          : `Reto #${n} de hoy`;
}

// ---------- Datos ----------
async function loadCategory(id) {
  if (!dataCache.has(id)) {
    const res = await fetch(`data/${id}.json`);
    if (!res.ok) throw new Error(`No se pudo cargar ${id}`);
    dataCache.set(id, available(await res.json()));
  }
  return dataCache.get(id);
}

// Las 3 fotos del día dependen de todas las categorías activas (para no repetir jugador
// el mismo día en dos categorías), así que se cargan todas (son archivos pequeños).
async function dailyRounds(catId, n) {
  const all = await Promise.all(CATEGORIES.map((c) => loadCategory(c.id)));
  const cats = CATEGORIES.map((c, k) => ({ id: c.id, keys: all[k].rondas.map((r) => r.k) }));
  const data = all[CATEGORIES.findIndex((c) => c.id === catId)];
  return dailyPicksMulti(n, cats, FOTOS_DIARIAS)[catId].map((i) => data.rondas[i]);
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

// ---------- Piezas de interfaz ----------
function button(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `min-h-12 w-full rounded-xl px-4 font-bold ${cls}`;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
function linkButton(text, href, cls) {
  const a = document.createElement("a");
  a.href = href;
  a.className = `flex min-h-12 w-full items-center justify-center rounded-xl px-4 font-bold ${cls}`;
  a.textContent = text;
  return a;
}

// Vista previa del texto + botón Compartir
function shareBlock(text) {
  const wrap = document.createElement("div");
  const preview = document.createElement("pre");
  preview.className = "mt-3 rounded-xl bg-surface-2 p-3 font-sans text-sm whitespace-pre-wrap";
  preview.textContent = text;
  const status = document.createElement("p");
  status.className = "mt-2 min-h-6 text-sm text-muted";
  status.setAttribute("role", "status");
  const btn = button("Compartir resultado", "mt-3 bg-accent text-accent-ink", async () => {
    const r = await shareResult(text);
    status.textContent =
      r === "copied" ? "¡Copiado! Pégalo en WhatsApp, X o Instagram." : r === "failed" ? "No se pudo copiar. Selecciona el texto de arriba y cópialo." : "";
  });
  wrap.append(preview, btn, status);
  return wrap;
}

// Cuenta regresiva al próximo reto (recarga la vista al cambiar el día)
function countdown(el, onNewDay) {
  const tick = () => {
    const ms = msUntilNextDay(new Date(), CONFIG.TIMEZONE);
    if (ms <= 1000) {
      clearInterval(countdownTimer);
      setTimeout(onNewDay, 1500);
      return;
    }
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    el.textContent = `Próximo reto en ${h}:${m}:${s}`;
  };
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

function setGameMode(summary) {
  $("#game-ui").hidden = summary;
  $("#daily-summary").hidden = !summary;
}

// ---------- Modo práctica (una foto por ronda, ilimitado) ----------
function playPractice(cat, data) {
  setGameMode(false);
  $("#challenge-label").textContent = "Modo práctica · sin límite";
  const r = nextPracticeRound(cat.id, data.rondas.length);
  startRound(data, data.rondas[r], {
    onEnd: (res) => {
      const p = load(`practice:${cat.id}`, { jugados: 0, ganados: 0 });
      p.jugados++;
      if (res.won) p.ganados++;
      save(`practice:${cat.id}`, p);
      const text = shareText({ siteName: CONFIG.SITE_NAME, siteUrl: CONFIG.SITE_URL, categoria: cat.nombre, numero: null, marks: res.marks, max: MAX, won: res.won, points: res.points });
      res.el.append(shareBlock(text), button("Otro jugador", "mt-2 border border-border bg-surface", () => playPractice(cat, data)));
    },
  });
}

// ---------- Reto diario (3 fotos, puntos acumulados) ----------
async function playDaily(cat, data) {
  const { n, date } = today();
  if (n < 1) {
    $("#challenge-label").textContent = `El reto #1 empieza el ${fechaCorta(CONFIG.DAILY_EPOCH)}.`;
    return playPractice(cat, data);
  }
  const rounds = await dailyRounds(cat.id, n);
  const d = loadDaily(cat.id, n);
  const k = d.fotos.findIndex((f) => !f?.over);
  const idx = k === -1 ? d.fotos.length : k;
  if (idx >= rounds.length) return showSummary(cat, rounds.length);

  setGameMode(false);
  const acumulado = totalPuntos(d);
  $("#challenge-label").textContent = `Reto #${n} · ${fechaCorta(date)} · Foto ${idx + 1} de ${rounds.length}${acumulado ? ` · ${acumulado} pts acumulados` : ""}`;

  startRound(data, rounds[idx], {
    restore: d.fotos[idx]?.actions,
    onChange: ({ actions, over }) => {
      const cur = loadDaily(cat.id, n);
      cur.fotos[idx] = { ...(cur.fotos[idx] ?? {}), actions, over };
      saveDaily(cat.id, cur);
    },
    onEnd: (res) => {
      const cur = loadDaily(cat.id, n);
      cur.fotos[idx] = { ...(cur.fotos[idx] ?? {}), over: true, won: res.won, points: res.points, stage: res.stage, marks: res.marks, name: res.name };
      const last = idx === rounds.length - 1;
      // Estadísticas: se registran una sola vez, al completar las 3 fotos
      if (last && !cur.registrado) {
        recordDailyDay(cat.id, n, cur.fotos);
        cur.registrado = true;
      }
      saveDaily(cat.id, cur);

      const p = document.createElement("p");
      p.className = "mt-2 text-sm font-semibold";
      p.textContent = `Llevas ${totalPuntos(cur)} pts en el reto de hoy.`;
      res.el.append(
        p,
        last
          ? button("Ver resultados del día", "mt-3 bg-accent text-accent-ink", () => showSummary(cat, rounds.length))
          : button(`Siguiente foto (${idx + 2} de ${rounds.length}) →`, "mt-3 bg-accent text-accent-ink", () => {
              playDaily(cat, data);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }),
      );
    },
  });
}

// ---------- Resultados del día ----------
function showSummary(cat, count) {
  const { n, date } = today();
  const d = loadDaily(cat.id, n);
  const fotos = d.fotos.slice(0, count);
  const total = totalPuntos(d);
  const aciertos = fotos.filter((f) => f.won).length;
  setGameMode(true);
  const box = $("#daily-summary");
  box.replaceChildren();

  const card = document.createElement("div");
  card.className = "rounded-2xl border border-border bg-surface p-4";
  const h = document.createElement("h2");
  h.className = "text-xl font-extrabold";
  h.textContent = `Resultados del reto #${n}`;
  const sub = document.createElement("p");
  sub.className = "text-sm text-muted";
  sub.textContent = `${cat.nombre} · ${fechaCorta(date)}`;

  const big = document.createElement("p");
  big.className = "mt-4 text-center";
  big.innerHTML = `<span class="block text-5xl font-extrabold"></span><span class="text-sm text-muted"></span>`;
  big.children[0].textContent = total;
  big.children[1].textContent = `de ${MAX_PUNTOS * count} puntos posibles · ${aciertos} de ${count} aciertos`;

  // Desglose por foto
  const list = document.createElement("ol");
  list.className = "mt-4 grid gap-2";
  const EMO = { miss: "🟥", hint: "🟨", win: "🟩" };
  fotos.forEach((f, k) => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3";
    li.innerHTML = `<span class="text-lg font-extrabold text-muted"></span><span class="flex flex-1 flex-col"><span class="font-bold"></span><span class="text-sm text-muted"></span></span><span class="text-right font-extrabold"></span>`;
    const [num, mid, pts] = li.children;
    num.textContent = k + 1;
    mid.children[0].textContent = f.name ?? "—";
    mid.children[1].textContent = `${Array.from({ length: MAX }, (_, j) => EMO[f.marks?.[j]] ?? "⬛").join("")} ${f.won ? `acierto en el intento ${f.stage + 1}` : "no acertada"}`;
    pts.textContent = `${f.points} pts`;
    list.append(li);
  });

  const text = dailyShareText({ siteName: CONFIG.SITE_NAME, siteUrl: CONFIG.SITE_URL, categoria: cat.nombre, numero: n, fotos, max: MAX, maxPoints: MAX_PUNTOS });
  const next = document.createElement("p");
  next.className = "mt-3 text-center text-sm text-muted";
  countdown(next, () => route());

  const actions = document.createElement("div");
  actions.className = "mt-3 grid gap-2";
  actions.append(
    linkButton("Jugar en modo práctica", `#/${cat.id}/practica`, "border border-border bg-surface"),
    linkButton("Otras categorías", "#/", "border border-border bg-surface"),
  );
  card.append(h, sub, big, list, shareBlock(text), next);
  box.append(card, actions);
  box.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

async function showGame(cat, mode) {
  clearInterval(countdownTimer);
  $("#game-title").textContent = `${cat.emoji} ${cat.nombre} · ${mode === "diario" ? "Reto diario" : "Práctica"}`;
  $("#back-to-mode").href = `#/${cat.id}`;
  document.title = `${cat.nombre} · ${CONFIG.SITE_NAME}`;
  try {
    const data = await loadCategory(cat.id);
    if (!data.rondas.length) throw new Error("sin rondas");
    if (mode === "diario") await playDaily(cat, data);
    else playPractice(cat, data);
  } catch (e) {
    console.error(e);
    setGameMode(false);
    $("#attempts").textContent = "No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.";
  }
}

// ---------- Estadísticas ----------
function renderStats() {
  const { n } = today();
  $("#stats-body").replaceChildren(
    ...CATEGORIES.map((c) => {
      const s = getStats(c.id);
      const sec = document.createElement("section");
      const h = document.createElement("h3");
      h.className = "font-bold";
      h.textContent = `${c.emoji} ${c.nombre}`;
      const grid = document.createElement("dl");
      grid.className = "mt-2 grid grid-cols-4 gap-2 text-center";
      const pct = s.fotos ? Math.round((100 * s.aciertos) / s.fotos) : 0;
      const prom = s.jugados ? Math.round(s.puntos / s.jugados) : 0;
      for (const [label, value] of [
        ["Retos", s.jugados],
        ["% aciertos", pct],
        ["Racha", currentStreak(s, n)],
        ["Mejor racha", s.mejorRacha],
        ["Mejor puntaje", s.mejorPuntaje],
        ["Promedio", prom],
        ["Fotos", s.fotos],
        ["Aciertos", s.aciertos],
      ]) {
        const d = document.createElement("div");
        d.className = "flex flex-col-reverse";
        d.innerHTML = `<dt class="text-xs text-muted"></dt><dd class="text-xl font-extrabold"></dd>`;
        d.querySelector("dt").textContent = label;
        d.querySelector("dd").textContent = value;
        grid.append(d);
      }
      const cap = document.createElement("p");
      cap.className = "mt-2 text-xs text-muted";
      cap.textContent = "Fotos acertadas en cada intento:";
      const dist = document.createElement("ol");
      dist.className = "mt-1 grid gap-1";
      dist.setAttribute("aria-label", "Fotos acertadas por intento");
      const maxD = Math.max(1, ...s.distribucion);
      s.distribucion.forEach((v, k) => {
        const li = document.createElement("li");
        li.className = "flex items-center gap-2 text-xs";
        li.innerHTML = `<span class="w-3 text-muted" aria-hidden="true"></span><span class="bar rounded bg-accent px-1.5 text-right font-bold text-accent-ink" aria-hidden="true"></span><span class="sr-only"></span>`;
        li.querySelector("span").textContent = k + 1;
        const bar = li.querySelector(".bar");
        bar.style.width = `${Math.max(8, (100 * v) / maxD)}%`;
        bar.textContent = v;
        li.querySelector(".sr-only").textContent = `Intento ${k + 1}: ${v} fotos`;
        dist.append(li);
      });
      sec.append(h, grid, cap, dist);
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
  const [, id, mode] = location.hash.match(/^#\/([a-z]+)(?:\/(diario|practica))?$/) ?? [];
  const cat = CATEGORIES.find((c) => c.id === id);
  const view = cat ? (mode ? "game" : "mode") : "home";
  document.documentElement.dataset.view = view;
  for (const [k, el] of Object.entries(views)) el.hidden = k !== view;
  clearInterval(countdownTimer);
  if (view === "game") showGame(cat, mode);
  else if (view === "mode") showMode(cat);
  else {
    if (location.hash && location.hash !== "#/") history.replaceState(null, "", "#/");
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
