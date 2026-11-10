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
import { validateApodo, getApodo, setApodo, submitScore, getTop, RANKING_COMPARTIDO } from "./ranking.js";

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
// Flujo: ver mis puntos → escribir mi apodo → enviar puntaje → ver el ranking del día.
function showSummary(cat, count) {
  const { n, date } = today();
  const d = loadDaily(cat.id, n);
  const fotos = d.fotos.slice(0, count);
  const total = totalPuntos(d);
  const aciertos = fotos.filter((f) => f.won).length;
  const intentos = fotos.reduce((a, f) => a + (f.marks?.length ?? 0), 0);
  setGameMode(true);
  const box = $("#daily-summary");
  box.replaceChildren();

  // 1) Mis puntos
  const card = document.createElement("div");
  card.className = "rounded-2xl border border-border bg-surface p-4";
  card.innerHTML = `
    <h2 class="text-xl font-extrabold"></h2>
    <p class="text-sm text-muted"></p>
    <p class="mt-4 text-center"><span class="block text-5xl font-extrabold"></span><span class="text-sm text-muted">puntos</span></p>
    <dl class="mt-3 grid grid-cols-2 gap-2 text-center">
      <div class="flex flex-col-reverse rounded-xl bg-surface-2 p-2"><dt class="text-xs text-muted">Aciertos</dt><dd class="text-xl font-extrabold"></dd></div>
      <div class="flex flex-col-reverse rounded-xl bg-surface-2 p-2"><dt class="text-xs text-muted">Intentos usados</dt><dd class="text-xl font-extrabold"></dd></div>
    </dl>
    <ol class="mt-3 grid gap-1 text-sm"></ol>`;
  card.querySelector("h2").textContent = `Reto #${n} · ${cat.nombre}`;
  card.querySelector("p").textContent = fechaCorta(date);
  card.querySelector("p span").textContent = total;
  const dds = card.querySelectorAll("dd");
  dds[0].textContent = `${aciertos}/${count}`;
  dds[1].textContent = `${intentos}/${count * MAX}`;
  const list = card.querySelector("ol");
  fotos.forEach((f, k) => {
    const li = document.createElement("li");
    li.className = "flex justify-between gap-2 border-t border-border pt-1";
    li.innerHTML = `<span></span><span class="font-semibold"></span>`;
    li.children[0].textContent = `${k + 1}. ${f.won ? "✓" : "✗"} ${f.name ?? "—"}`;
    li.children[1].textContent = `${f.points} pts`;
    list.append(li);
  });
  const text = dailyShareText({ siteName: CONFIG.SITE_NAME, siteUrl: CONFIG.SITE_URL, categoria: cat.nombre, numero: n, fotos, max: MAX, maxPoints: MAX_PUNTOS });
  const shareStatus = document.createElement("p");
  shareStatus.className = "mt-2 min-h-5 text-sm text-muted";
  shareStatus.setAttribute("role", "status");
  card.append(
    button("Compartir resultado", "mt-3 bg-accent text-accent-ink", async () => {
      const r = await shareResult(text);
      shareStatus.textContent = r === "copied" ? "¡Copiado! Pégalo en WhatsApp, X o Instagram." : r === "failed" ? "No se pudo copiar." : "";
    }),
    shareStatus,
  );

  // 2) y 3) Apodo + enviar
  const rank = document.createElement("section");
  rank.className = "mt-4 rounded-2xl border border-border bg-surface p-4";
  rank.setAttribute("aria-labelledby", "rank-title");
  rank.innerHTML = `<h2 id="rank-title" class="text-lg font-extrabold">Mejores puntajes de hoy</h2>`;
  if (!RANKING_COMPARTIDO) {
    const note = document.createElement("p");
    note.className = "mt-1 text-xs text-muted";
    note.textContent = "Modo de prueba: por ahora el ranking solo muestra los puntajes guardados en este navegador.";
    rank.append(note);
  }
  const form = document.createElement("form");
  form.className = "mt-3 grid gap-2";
  form.noValidate = true;
  form.innerHTML = `
    <label for="apodo-input" class="text-sm font-semibold">Tu apodo</label>
    <input id="apodo-input" type="text" maxlength="16" autocomplete="nickname" placeholder="Ej. Max10, Pelusa…"
      class="min-h-12 rounded-xl border border-border bg-surface-2 px-4 text-base placeholder:text-muted" aria-describedby="apodo-msg">
    <button type="submit" class="min-h-12 rounded-xl bg-accent px-4 font-bold text-accent-ink disabled:opacity-60">Guardar mi puntaje en el ranking</button>
    <p id="apodo-msg" class="min-h-5 text-sm" role="status" aria-live="polite"></p>`;
  const input = form.querySelector("input");
  const msg = form.querySelector("#apodo-msg");
  input.value = getApodo();
  const sent = document.createElement("p");
  sent.className = "mt-3 text-sm font-semibold text-accent";

  // 4) Tabla del día
  const table = document.createElement("div");
  table.className = "mt-3";

  async function renderTable() {
    table.innerHTML = `<p class="text-sm text-muted">Cargando ranking…</p>`;
    const { ok, rows } = await getTop({ fecha: date, categoria: cat.id });
    if (!ok) return (table.innerHTML = `<p class="text-sm text-muted">No se pudo cargar el ranking. Inténtalo más tarde.</p>`);
    if (!rows.length) return (table.innerHTML = `<p class="text-sm text-muted">Todavía no hay puntajes hoy. ¡Sé el primero!</p>`);
    const mine = loadDaily(cat.id, n).enviado;
    const t = document.createElement("table");
    t.className = "w-full text-sm";
    t.innerHTML = `<caption class="sr-only">Top ${rows.length} de hoy en ${cat.nombre}</caption>
      <thead><tr class="text-left text-xs text-muted"><th scope="col" class="py-1 pr-2 w-10">#</th><th scope="col" class="py-1">Apodo</th><th scope="col" class="py-1 text-right">Puntos</th></tr></thead><tbody></tbody>`;
    let marked = false;
    rows.forEach((r, k) => {
      const tr = document.createElement("tr");
      const isMe = !marked && mine && r.apodo === mine.apodo && r.puntaje === mine.puntaje;
      if (isMe) marked = true;
      tr.className = `border-t border-border ${isMe ? "bg-surface-2 font-bold" : ""}`;
      tr.innerHTML = `<td class="py-2 pr-2"></td><td class="py-2"></td><td class="py-2 text-right font-semibold"></td>`;
      tr.children[0].textContent = `${k + 1}°`;
      tr.children[1].textContent = isMe ? `${r.apodo} (tú)` : r.apodo; // textContent: el apodo nunca se interpreta como HTML
      tr.children[2].textContent = r.puntaje;
      t.tBodies[0].append(tr);
    });
    table.replaceChildren(t);
  }

  function showSent(e) {
    form.hidden = true;
    sent.textContent = `✓ Tu puntaje (${e.puntaje} pts) está en el ranking como «${e.apodo}».`;
  }
  if (d.enviado) showSent(d.enviado);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = validateApodo(input.value);
    if (!v.ok) {
      msg.textContent = v.error;
      msg.className = "min-h-5 text-sm text-danger";
      input.focus();
      return;
    }
    const btn = form.querySelector("button");
    btn.disabled = true;
    msg.className = "min-h-5 text-sm text-muted";
    msg.textContent = "Guardando…";
    const entry = { fecha: date, categoria: cat.id, apodo: v.value, puntaje: total, aciertos, intentos };
    const r = await submitScore(entry);
    btn.disabled = false;
    if (!r.ok) {
      msg.className = "min-h-5 text-sm text-danger";
      msg.textContent = r.error;
      return;
    }
    setApodo(v.value);
    const cur = loadDaily(cat.id, n);
    cur.enviado = { apodo: v.value, puntaje: total };
    saveDaily(cat.id, cur);
    showSent(cur.enviado);
    await renderTable();
    table.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  rank.append(form, sent, table);
  renderTable();

  const next = document.createElement("p");
  next.className = "mt-3 text-center text-sm text-muted";
  countdown(next, () => route());
  const actions = document.createElement("div");
  actions.className = "mt-3 grid gap-2";
  actions.append(
    linkButton("Jugar en modo práctica", `#/${cat.id}/practica`, "border border-border bg-surface"),
    linkButton("Otras categorías", "#/", "border border-border bg-surface"),
  );
  box.append(card, rank, next, actions);
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
