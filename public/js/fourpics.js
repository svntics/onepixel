// Modo "4 Fotos 1 Equipo": elegir liga → 4 fotos + casillas de letras + banco de letras.
// Rutas: 4fotos.html#/ (ligas) · 4fotos.html#/<liga> (juego)
import { CONFIG } from "./config.js";
import { decode } from "./codec.js";
import { load, save } from "./storage.js";
import {
  answerWords, answerLetters, newBoard, placeTile, removeAt, clearBoard, isFull, isCorrect, tileIsUsed,
  hashString, teamScore,
} from "./letters.js";

const $ = (s) => document.querySelector(s);
const LEAGUES = CONFIG.FOUR_PICS.LEAGUES;
const TIPO_LABEL = { colores: "Colores", origen: "Origen", apodo: "Apodo", cultura: "Cultura del club" };

// ---------- Utilidades ----------
let toastTimer = null;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.remove("opacity-0");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("opacity-0"), 2200);
}
const el = (tag, cls = "", text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const link = (href, text) => {
  const a = el("a", "underline", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
};

// ---------- Estadísticas (localStorage) ----------
// jugadas = equipos terminados · aciertos · racha = aciertos seguidos sin rendirse · puntos acumulados
const STATS_KEY = "4fotos:stats";
const getStats = () => ({ jugadas: 0, aciertos: 0, racha: 0, mejorRacha: 0, puntos: 0, ...load(STATS_KEY, {}) });
function recordResult(won, points) {
  const s = getStats();
  s.jugadas++;
  s.puntos += points;
  if (won) {
    s.aciertos++;
    s.racha++;
    s.mejorRacha = Math.max(s.mejorRacha, s.racha);
  } else s.racha = 0;
  save(STATS_KEY, s);
  return s;
}
function renderStats() {
  const s = getStats();
  const text = s.jugadas
    ? `🔥 Racha ${s.racha} (mejor ${s.mejorRacha}) · ✅ ${s.aciertos}/${s.jugadas} · ⭐ ${s.puntos} pts`
    : "Aún no has jugado. ¡Suerte!";
  document.querySelectorAll(".fp-stats").forEach((p) => (p.textContent = text));
}

// ---------- Vista: ligas ----------
function showLeagues() {
  document.documentElement.dataset.fp = "leagues";
  document.title = "4 Fotos 1 Equipo · onepixel";
  const ul = $("#fp-league-list");
  ul.replaceChildren(
    ...LEAGUES.map((l) => {
      const li = el("li");
      const inner = (node) => {
        node.append(el("span", "text-3xl", l.emoji), el("span", "pix flex-1 text-lg font-bold", l.nombre));
        if (!l.activa) node.append(el("span", "rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold", "🔒 Próximamente"));
        return node;
      };
      const cls = "flex min-h-20 w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left";
      if (l.activa) {
        const a = inner(el("a", `${cls} hover:border-accent hover:bg-surface-2`));
        a.href = `#/${l.id}`;
        li.append(a);
      } else {
        const b = inner(el("button", `${cls} sport-locked`));
        b.type = "button";
        b.setAttribute("aria-disabled", "true");
        b.addEventListener("click", () => toast("¡Muy pronto disponible! 🔒"));
        li.append(b);
      }
      return li;
    }),
  );
  renderStats();
}

// ---------- Vista: juego ----------
let teams = []; // equipos decodificados de la liga actual
let league = null;
let round = null; // { team, board, errors, start, over }

async function loadLeague(l) {
  const res = await fetch(`data/4fotos-${l.id}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.rondas.map((r) => decode(r));
}

// Elige un equipo que no se haya jugado en esta liga; al agotarlos, se reinicia el ciclo.
function pickTeam() {
  const key = `4fotos:vistos:${league.id}`;
  let seen = load(key, []);
  let pool = teams.filter((t) => !seen.includes(t.id));
  if (!pool.length) {
    seen = [];
    pool = teams;
    save(key, seen);
    if (teams.length > 1) toast("¡Completaste todos los equipos! Empezamos de nuevo 🔁");
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function showGame(id) {
  const l = LEAGUES.find((x) => x.id === id);
  if (!l || !l.activa) {
    location.hash = "#/";
    return;
  }
  document.documentElement.dataset.fp = "game";
  document.title = `${l.nombre} · 4 Fotos 1 Equipo · onepixel`;
  $("#fp-league-name").textContent = `${l.emoji} ${l.nombre}`;
  renderStats();
  if (league?.id !== l.id) {
    league = l;
    try {
      teams = await loadLeague(l);
    } catch {
      teams = [];
    }
  }
  if (!teams.length) {
    $("#fp-photos").replaceChildren(el("p", "col-span-2 rounded-2xl border border-dashed border-border p-4 text-center text-muted", "⏳ Esta liga está en preparación. ¡Vuelve pronto!"));
    $("#fp-board").hidden = true;
    $("#fp-result").hidden = true;
    return;
  }
  startRound(pickTeam());
}

function startRound(team) {
  round = { team, board: newBoard(team.respuesta, hashString(team.id)), errors: 0, start: Date.now(), over: false };
  $("#fp-board").hidden = false;
  $("#fp-result").hidden = true;
  $("#fp-msg").textContent = "";
  renderPhotos(false);
  renderBoard();
}

// Las fotos: durante la ronda, sin créditos ni textos (anti-spoiler). Tocar una la amplía.
function renderPhotos() {
  const wrap = $("#fp-photos");
  wrap.replaceChildren(
    ...round.team.fotos.map((f, i) => {
      const b = el("button", "photo-tile relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2");
      b.type = "button";
      b.setAttribute("aria-label", `Ampliar foto ${i + 1} de 4`);
      const img = el("img", "h-full w-full object-cover");
      img.src = f.img;
      img.alt = `Pista ${i + 1}`;
      img.width = 400;
      img.height = 400;
      img.draggable = false;
      img.decoding = "async";
      b.append(img, el("span", "absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-xs font-bold text-white", String(i + 1)));
      if (f.pendiente) b.append(el("span", "absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-xs text-white", "Foto pendiente"));
      b.addEventListener("click", () => {
        $("#fp-zoom-img").src = f.img;
        $("#fp-zoom-img").alt = `Pista ${i + 1}`;
        $("#fp-zoom").showModal();
      });
      return b;
    }),
  );
}

const tileCls = "flex min-h-11 items-center justify-center rounded-lg border text-lg font-extrabold uppercase";

function renderBoard() {
  const { team, board } = round;
  // Casillas agrupadas por palabra
  const slots = $("#fp-slots");
  slots.replaceChildren();
  let k = 0;
  for (const word of answerWords(team.respuesta)) {
    const group = el("div", "flex flex-wrap justify-center gap-1");
    for (let j = 0; j < word.length; j++, k++) {
      const idx = k;
      const tile = board.slots[idx];
      const filled = tile !== null;
      const b = el("button", `${tileCls} w-9 sm:w-10 ${filled ? "border-accent bg-surface-2" : "border-border bg-surface"}`, filled ? board.bank[tile] : "");
      b.type = "button";
      b.setAttribute("aria-label", filled ? `Casilla ${idx + 1}: ${board.bank[tile]}. Tocar para devolver` : `Casilla ${idx + 1} vacía`);
      b.disabled = round.over || !filled;
      b.addEventListener("click", () => {
        round.board = removeAt(round.board, idx);
        $("#fp-msg").textContent = "";
        renderBoard();
      });
      group.append(b);
    }
    slots.append(group);
  }
  // Banco de letras: las usadas quedan como hueco (el diseño no salta)
  const bank = $("#fp-bank");
  bank.replaceChildren(
    ...board.bank.map((c, i) => {
      const used = tileIsUsed(board, i);
      const b = el("button", `${tileCls} border-border bg-surface hover:bg-surface-2 ${used ? "invisible" : ""}`, c);
      b.type = "button";
      b.setAttribute("aria-label", `Letra ${c}`);
      b.disabled = round.over || used;
      b.addEventListener("click", () => place(i));
      return b;
    }),
  );
}

function place(tile) {
  if (round.over) return;
  round.board = placeTile(round.board, tile);
  renderBoard();
  if (!isFull(round.board)) return;
  if (isCorrect(round.board, round.team.respuesta)) return finish(true);
  round.errors++;
  const msg = $("#fp-msg");
  msg.textContent = "❌ No es ese equipo. Toca una letra puesta para devolverla y corrige.";
  msg.className = "mt-2 min-h-6 text-center text-sm font-semibold text-danger";
  $("#fp-slots").classList.remove("fp-shake");
  void $("#fp-slots").offsetWidth; // reinicia la animación
  $("#fp-slots").classList.add("fp-shake");
}

function finish(won) {
  round.over = true;
  const seconds = Math.round((Date.now() - round.start) / 1000);
  const points = teamScore({ won, errors: round.errors, seconds });
  recordResult(won, points);
  const key = `4fotos:vistos:${league.id}`;
  save(key, [...new Set([...load(key, []), round.team.id])]);
  if (!won) {
    // Muestra la respuesta en las casillas
    const letters = answerLetters(round.team.respuesta);
    let b = clearBoard(round.board);
    for (const c of letters) {
      const t = b.bank.findIndex((x, i) => x === c && !tileIsUsed(b, i));
      b = placeTile(b, t);
    }
    round.board = b;
  }
  renderBoard();
  renderStats();
  $("#fp-msg").textContent = "";
  $("#fp-board").querySelectorAll("#fp-clear, #fp-giveup").forEach((x) => (x.disabled = true));

  const t = round.team;
  $("#fp-result-title").textContent = won ? `¡Correcto! ${t.nombre} 🎉` : `Era ${t.nombre}`;
  $("#fp-result-detail").textContent = won
    ? `+${points} pts · ${seconds} s · ${round.errors === 0 ? "sin errores" : `${round.errors} ${round.errors === 1 ? "error" : "errores"}`}`
    : "Te rendiste: 0 pts. La racha vuelve a 0.";
  $("#fp-why summary").textContent = `¿Por qué estas fotos representaban al ${t.nombre}?`;
  $("#fp-why-list").replaceChildren(...t.fotos.map(whyItem));
  $("#fp-result").hidden = false;
  $("#fp-result").focus();
}

// Explicación + crédito completo de cada foto (solo al terminar la ronda)
function whyItem(f, i) {
  const li = el("li", "flex gap-3");
  const img = el("img", "h-16 w-16 flex-none rounded-lg object-cover");
  img.src = f.img;
  img.alt = "";
  img.width = 64;
  img.height = 64;
  const body = el("div", "text-sm");
  body.append(el("p", "font-bold", `Foto ${i + 1} · ${TIPO_LABEL[f.tipo] ?? ""}`.replace(/ · $/, "")), el("p", "", f.exp));
  const cr = el("p", "mt-1 text-xs text-muted");
  if (f.cr) {
    if (f.cr.titulo) cr.append(`«${f.cr.titulo}» · `);
    cr.append(`Foto: ${f.cr.autor} · `);
    cr.append(f.cr.url_licencia ? link(f.cr.url_licencia, f.cr.licencia) : f.cr.licencia);
    cr.append(" · ", link(f.cr.url_fuente, "Wikimedia Commons"));
    if (f.cr.mod) cr.append(` · Foto ${f.cr.mod} por onepixel`);
  } else
    cr.textContent = f.pendiente
      ? "Foto pendiente (vista de prueba)"
      : f.ia ? "Ilustración generada con IA" : "Ilustración original de onepixel";
  body.append(cr);
  li.append(img, body);
  return li;
}

// ---------- Controles ----------
$("#fp-clear").addEventListener("click", () => {
  if (round?.over) return;
  round.board = clearBoard(round.board);
  $("#fp-msg").textContent = "";
  renderBoard();
});
$("#fp-giveup").addEventListener("click", () => {
  if (!round || round.over) return;
  if (confirm("¿Rendirte? Verás la respuesta, sumarás 0 puntos y tu racha volverá a 0.")) finish(false);
});
$("#fp-next").addEventListener("click", () => {
  $("#fp-board").querySelectorAll("#fp-clear, #fp-giveup").forEach((x) => (x.disabled = false));
  startRound(pickTeam());
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Teclado físico: letras = colocar, Retroceso = quitar la última, Enter = siguiente
document.addEventListener("keydown", (e) => {
  if (document.documentElement.dataset.fp !== "game" || !round || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($("#fp-zoom").open) return;
  if (round.over) {
    if (e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") $("#fp-next").click();
    return;
  }
  const key = e.key.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/^[A-Z]$/.test(key)) {
    const t = round.board.bank.findIndex((c, i) => c === key && !tileIsUsed(round.board, i));
    if (t >= 0) place(t);
    e.preventDefault();
  } else if (e.key === "Backspace") {
    const last = round.board.slots.findLastIndex((s) => s !== null);
    if (last >= 0) {
      round.board = removeAt(round.board, last);
      $("#fp-msg").textContent = "";
      renderBoard();
    }
    e.preventDefault();
  }
});

// Impide abrir/copiar la foto con clic derecho o arrastrándola (no es infalible)
document.addEventListener("contextmenu", (e) => {
  if (e.target.closest?.("#fp-photos, #fp-zoom")) e.preventDefault();
});

// ---------- Rutas ----------
function route() {
  const m = location.hash.match(/^#\/([a-z]+)$/);
  if (m) showGame(m[1]);
  else showLeagues();
}
window.addEventListener("hashchange", route);
route();
