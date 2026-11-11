// Modo "4 Fotos 1 Equipo": todos los equipos juntos; modos Práctica y 1v1.
// Rutas: 4fotos.html#/ (menú) · #/practica · #/1v1
// Mecánica: se empieza con 1 foto (la más difícil) y cada intento fallido desbloquea otra.
// Se escribe con un teclado completo A-Z.
import { decode } from "./codec.js";
import { load, save } from "./storage.js";
import {
  answerWords, newBoard, placeLetter, removeAt, removeLast, clearBoard, fillAnswer, isFull, isCorrect,
  teamScore, KEYBOARD_ROWS,
} from "./letters.js";

const $ = (s) => document.querySelector(s);
const TIPO_LABEL = { colores: "Colores", origen: "Origen", apodo: "Apodo", cultura: "Cultura del club" };
const setView = (v) => (document.documentElement.dataset.fp = v);

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
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------- Datos ----------
let teams = null;
async function loadTeams() {
  if (teams) return teams;
  try {
    const res = await fetch("data/4fotos.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    teams = (await res.json()).rondas.map((r) => decode(r));
  } catch {
    teams = [];
  }
  return teams;
}

// ---------- Estadísticas de práctica (localStorage) ----------
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
}
const statsText = () => {
  const s = getStats();
  return s.jugadas ? `🔥 Racha ${s.racha} (mejor ${s.mejorRacha}) · ✅ ${s.aciertos}/${s.jugadas} · ⭐ ${s.puntos} pts` : "Aún no has jugado. ¡Suerte!";
};

// En práctica, los equipos no se repiten hasta haberlos visto todos.
const SEEN_KEY = "4fotos:vistos";
function pickPracticeTeam() {
  let seen = load(SEEN_KEY, []);
  let pool = teams.filter((t) => !seen.includes(t.id));
  if (!pool.length) {
    seen = [];
    pool = teams;
    save(SEEN_KEY, seen);
    if (teams.length > 1) toast("¡Completaste todos los equipos! Empezamos de nuevo 🔁");
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
//  Ronda (común a práctica y 1v1)
// ============================================================
// round = { team, board, shown, errors, start, over, onEnd, nextLabel }
let round = null;

function startRound(team, { title, info, nextLabel, onEnd }) {
  round = { team, board: newBoard(team.respuesta), shown: 1, errors: 0, mapHint: false, start: Date.now(), over: false, onEnd };
  setView("game");
  $("#fp-game-title").textContent = title;
  $("#fp-game-info").textContent = info;
  $("#fp-next").textContent = nextLabel;
  $("#fp-board").hidden = false;
  $("#fp-result").hidden = true;
  $("#fp-msg").textContent = "";
  ["#fp-clear", "#fp-giveup", "#fp-hint-map"].forEach((s) => ($(s).disabled = false));
  $("#fp-map").hidden = true;
  renderPhotos();
  renderBoard();
  updateMore();
  window.scrollTo({ top: 0 });
}

// Las fotos: se ven solo las desbloqueadas (las demás ni se descargan). Sin créditos ni textos
// durante la ronda (anti-spoiler). Tocar una la amplía. Al terminar se muestran las 4.
function renderPhotos() {
  const visible = round.over ? 4 : round.shown;
  $("#fp-photos").replaceChildren(
    ...round.team.fotos.map((f, i) => {
      if (i >= visible) {
        const d = el("div", "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface text-muted");
        d.append(el("span", "text-3xl", "🔒"), el("span", "text-xs font-semibold", `Foto ${i + 1}`));
        d.setAttribute("aria-label", `Foto ${i + 1} bloqueada`);
        return d;
      }
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
      if (!round.over && i === round.shown - 1 && i > 0) b.classList.add("fp-new");
      b.addEventListener("click", () => {
        $("#fp-zoom-img").src = f.img;
        $("#fp-zoom-img").alt = `Pista ${i + 1}`;
        $("#fp-zoom").showModal();
      });
      return b;
    }),
  );
}

function revealNext() {
  if (round.shown >= 4) return false;
  round.shown++;
  renderPhotos();
  updateMore();
  return true;
}

function updateMore() {
  const btn = $("#fp-more");
  btn.disabled = round.over || round.shown >= 4;
  btn.textContent = round.shown >= 4 ? "🔓 Todas las fotos a la vista" : `🔓 Ver otra foto (${round.shown + 1} de 4)`;
}

function showMsg(text, danger = true) {
  const msg = $("#fp-msg");
  msg.textContent = text;
  msg.className = `mt-2 min-h-6 text-center text-sm font-semibold ${danger ? "text-danger" : "text-muted"}`;
}

const keyCls = "flex min-h-12 items-center justify-center rounded-lg border border-border bg-surface font-extrabold hover:bg-surface-2 disabled:opacity-40";

function renderBoard() {
  const { team, board } = round;
  // Casillas agrupadas por palabra (más angostas en palabras largas, para que quepan en el celular)
  const slots = $("#fp-slots");
  slots.replaceChildren();
  const words = answerWords(team.respuesta);
  const longest = Math.max(...words.map((w) => w.length));
  const size = longest <= 8 ? "w-9 sm:w-10" : longest <= 10 ? "w-7 sm:w-9" : "w-6 text-base sm:w-8";
  let k = 0;
  for (const word of words) {
    const group = el("div", `flex justify-center ${longest > 10 ? "gap-0.5" : "gap-1"}`);
    for (let j = 0; j < word.length; j++, k++) {
      const idx = k;
      const c = board.slots[idx];
      const b = el("button", `flex min-h-11 items-center justify-center rounded-lg border text-lg font-extrabold ${size} ${c ? "border-accent bg-surface-2" : "border-border bg-surface"}`, c ?? "");
      b.type = "button";
      b.setAttribute("aria-label", c ? `Casilla ${idx + 1}: ${c}. Tocar para borrar` : `Casilla ${idx + 1} vacía`);
      b.disabled = round.over || !c;
      b.addEventListener("click", () => {
        round.board = removeAt(round.board, idx);
        $("#fp-msg").textContent = "";
        renderBoard();
      });
      group.append(b);
    }
    slots.append(group);
  }
  // Teclado completo (QWERTY). Cada letra se puede usar las veces que haga falta.
  const kb = $("#fp-keyboard");
  kb.replaceChildren(
    ...KEYBOARD_ROWS.map((row, r) => {
      const line = el("div", "flex justify-center gap-1");
      for (const c of row) {
        const b = el("button", `${keyCls} w-[9%] text-base`, c);
        b.type = "button";
        b.setAttribute("aria-label", `Letra ${c}`);
        b.disabled = round.over;
        b.addEventListener("click", () => type(c));
        line.append(b);
      }
      if (r === KEYBOARD_ROWS.length - 1) {
        const del = el("button", `${keyCls} w-[18%] text-lg`, "⌫");
        del.type = "button";
        del.setAttribute("aria-label", "Borrar la última letra");
        del.disabled = round.over;
        del.addEventListener("click", backspace);
        line.append(del);
      }
      return line;
    }),
  );
}

function backspace() {
  if (round?.over) return;
  round.board = removeLast(round.board);
  $("#fp-msg").textContent = "";
  renderBoard();
}

function type(letter) {
  if (!round || round.over) return;
  round.board = placeLetter(round.board, letter);
  renderBoard();
  if (!isFull(round.board)) return;
  if (isCorrect(round.board, round.team.respuesta)) return finish(true);
  // Intento fallido: desbloquea otra foto; con las 4 a la vista, cuenta como error
  if (revealNext()) showMsg(`❌ No es ese equipo. Se desbloqueó la foto ${round.shown}. Toca una letra puesta o ⌫ para corregir.`);
  else {
    round.errors++;
    showMsg("❌ No es ese equipo. Toca una letra puesta o ⌫ para corregir.");
  }
  $("#fp-slots").classList.remove("fp-shake");
  void $("#fp-slots").offsetWidth; // reinicia la animación
  $("#fp-slots").classList.add("fp-shake");
}

function finish(won) {
  round.over = true;
  const seconds = Math.round((Date.now() - round.start) / 1000);
  const points = teamScore({ won, shown: round.shown, errors: round.errors, seconds, mapHint: round.mapHint });
  if (!won) round.board = fillAnswer(round.team.respuesta); // muestra la respuesta
  renderBoard();
  renderPhotos();
  updateMore();
  $("#fp-msg").textContent = "";
  ["#fp-clear", "#fp-giveup", "#fp-hint-map"].forEach((s) => ($(s).disabled = true));

  const t = round.team;
  $("#fp-result-title").textContent = won ? `¡Correcto! ${t.nombre} 🎉` : `Era ${t.nombre}`;
  $("#fp-result-detail").textContent = won
    ? `+${points} pts · con ${round.shown} ${round.shown === 1 ? "foto" : "fotos"} · ${seconds} s${round.mapHint ? " · con mapa" : ""}${round.errors ? ` · ${round.errors} ${round.errors === 1 ? "error" : "errores"} extra` : ""}`
    : "Te rendiste: 0 pts.";
  $("#fp-why summary").textContent = `¿Por qué estas fotos representaban al ${t.nombre}?`;
  $("#fp-why-list").replaceChildren(...t.fotos.map(whyItem));
  $("#fp-result").hidden = false;
  $("#fp-result").focus();
  round.onEnd?.({ won, points, shown: round.shown, team: t });
}

// ---------- Pista del mapa: país del club en rojo ----------
// El mapa (≈120 KB) se descarga solo la primera vez que alguien pide la pista.
let mapSvg = null;
async function showMapHint() {
  if (!round || round.over || round.mapHint) return;
  round.mapHint = true;
  $("#fp-hint-map").disabled = true;
  const box = $("#fp-map-svg");
  $("#fp-map").hidden = false;
  try {
    if (!mapSvg) {
      box.textContent = "Cargando mapa…";
      const res = await fetch("img/mapa-mundo.svg");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      mapSvg = await res.text();
    }
    box.innerHTML = mapSvg;
    const svg = box.querySelector("svg");
    const path = svg.querySelector(`path[data-iso="${round.team.iso}"]`);
    if (!path) throw new Error("país no encontrado");
    path.classList.add("fp-country");
    svg.append(path); // encima de los vecinos
    const [cx, cy] = path.dataset.c.split(",").map(Number);
    const ns = "http://www.w3.org/2000/svg";
    const ring = document.createElementNS(ns, "circle");
    Object.entries({ cx, cy, r: 14, class: "fp-marker" }).forEach(([k, v]) => ring.setAttribute(k, v));
    svg.append(ring);
    svg.setAttribute("aria-label", "Mapa mundial con el país del club marcado en rojo");
  } catch {
    box.textContent = "No se pudo cargar el mapa.";
  }
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
    cr.textContent = f.pendiente ? "Foto pendiente (vista de prueba)" : f.ia ? "Ilustración generada con IA" : "Ilustración original de onepixel";
  body.append(cr);
  li.append(img, body);
  return li;
}

// ============================================================
//  Práctica
// ============================================================
function practiceRound() {
  if (!teams.length) return showEmpty();
  startRound(pickPracticeTeam(), {
    title: "🎯 Práctica",
    info: statsText(),
    nextLabel: "Siguiente equipo →",
    onEnd: ({ won, points, team }) => {
      recordResult(won, points);
      save(SEEN_KEY, [...new Set([...load(SEEN_KEY, []), team.id])]);
      $("#fp-game-info").textContent = statsText();
    },
  });
  nextAction = practiceRound;
}

function showEmpty() {
  setView("game");
  $("#fp-game-title").textContent = "🧩 4 Fotos 1 Equipo";
  $("#fp-photos").replaceChildren(el("p", "col-span-2 rounded-2xl border border-dashed border-border p-4 text-center text-muted", "⏳ Los equipos están en preparación. ¡Vuelve pronto!"));
  $("#fp-board").hidden = true;
  $("#fp-result").hidden = true;
}

// ============================================================
//  1v1 local: turnos alternados, cada jugador con equipos distintos
// ============================================================
// duel = { names:[a,b], rounds, queue:[team...], turn, results:[[{won,points,shown,nombre}], [...]] }
let duel = null;
const DUEL_KEY = "4fotos:duelo";

function duelSetup() {
  setView("duel-setup");
  const last = load(DUEL_KEY, null);
  const f = $("#fp-duel-form");
  if (last) {
    f.p1.value = last.names[0];
    f.p2.value = last.names[1];
    f.querySelector(`input[name="rounds"][value="${last.rounds}"]`).checked = true;
  }
}

function startDuel(names, rounds) {
  if (!teams.length) return showEmpty();
  const need = rounds * 2;
  // Equipos distintos para todo el duelo (si hubiera menos equipos que turnos, se repiten al final)
  let queue = shuffle(teams);
  while (queue.length < need) queue = queue.concat(shuffle(teams));
  duel = { names, rounds, queue: queue.slice(0, need), turn: 0, results: [[], []] };
  save(DUEL_KEY, { names, rounds });
  showTurnScreen();
}

const duelTotal = (p) => duel.results[p].reduce((a, r) => a + r.points, 0);
const scoreLine = () => `${duel.names[0]} ${duelTotal(0)} · ${duel.names[1]} ${duelTotal(1)}`;

function showTurnScreen() {
  const p = duel.turn % 2;
  const r = Math.floor(duel.turn / 2) + 1;
  setView("duel-turn");
  $("#fp-turn-title").textContent = `Turno de ${duel.names[p]}`;
  $("#fp-turn-detail").textContent = `Equipo ${r} de ${duel.rounds}. Pásale el dispositivo y que el otro no mire 👀`;
  $("#fp-turn-score").textContent = duel.turn ? scoreLine() : "";
  $("#fp-turn-go").focus();
}

function playDuelTurn() {
  const p = duel.turn % 2;
  const r = Math.floor(duel.turn / 2) + 1;
  const last = duel.turn === duel.rounds * 2 - 1;
  startRound(duel.queue[duel.turn], {
    title: `⚔️ ${duel.names[p]} · equipo ${r} de ${duel.rounds}`,
    info: scoreLine(),
    nextLabel: last ? "Ver resultado 🏆" : `Turno de ${duel.names[1 - p]} →`,
    onEnd: ({ won, points, shown, team }) => {
      duel.results[p].push({ won, points, shown, nombre: team.nombre });
      $("#fp-game-info").textContent = scoreLine();
    },
  });
  nextAction = () => {
    duel.turn++;
    if (duel.turn >= duel.rounds * 2) showDuelFinal();
    else showTurnScreen();
  };
}

function showDuelFinal() {
  setView("duel-final");
  const [a, b] = [duelTotal(0), duelTotal(1)];
  $("#fp-final-title").textContent = a === b ? "¡Empate!" : `¡Gana ${duel.names[a > b ? 0 : 1]}!`;
  $("#fp-final-detail").textContent = a === b ? `Ambos con ${a} pts` : `${Math.max(a, b)} a ${Math.min(a, b)} pts`;
  $("#fp-th-p1").textContent = duel.names[0];
  $("#fp-th-p2").textContent = duel.names[1];
  $("#fp-tot-p1").textContent = a;
  $("#fp-tot-p2").textContent = b;
  const cell = (r) => (r.won ? `${r.points} (${r.shown}📷)` : "0 🏳️");
  $("#fp-final-rows").replaceChildren(
    ...Array.from({ length: duel.rounds }, (_, i) => {
      const tr = el("tr", "border-t border-border");
      tr.append(el("td", "py-1 text-left", String(i + 1)), el("td", "py-1", cell(duel.results[0][i])), el("td", "py-1", cell(duel.results[1][i])));
      return tr;
    }),
  );
}

// ============================================================
//  Controles
// ============================================================
let nextAction = null;

$("#fp-clear").addEventListener("click", () => {
  if (!round || round.over) return;
  round.board = clearBoard(round.board);
  $("#fp-msg").textContent = "";
  renderBoard();
});
$("#fp-more").addEventListener("click", () => {
  if (!round || round.over) return;
  if (revealNext()) showMsg(`🔓 Foto ${round.shown} desbloqueada.`, false);
});
$("#fp-hint-map").addEventListener("click", showMapHint);
$("#fp-giveup").addEventListener("click", () => {
  if (!round || round.over) return;
  if (confirm("¿Rendirte? Verás la respuesta y sumarás 0 puntos.")) finish(false);
});
$("#fp-next").addEventListener("click", () => nextAction?.());
$("#fp-turn-go").addEventListener("click", playDuelTurn);
$("#fp-rematch").addEventListener("click", () => startDuel(duel.names, duel.rounds));
$("#fp-duel-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const clean = (v, d) => v.trim().slice(0, 16) || d;
  const n1 = clean(f.p1.value, "Jugador 1");
  let n2 = clean(f.p2.value, "Jugador 2");
  if (n1 === n2) n2 += " (2)";
  startDuel([n1, n2], Number(f.querySelector('input[name="rounds"]:checked').value));
});
$("#fp-back").addEventListener("click", (e) => {
  if (duel && document.documentElement.dataset.fp === "game" && !confirm("¿Salir del duelo? Se perderá el marcador.")) e.preventDefault();
});

// Teclado físico: letras = escribir, Retroceso = borrar, Enter = siguiente
document.addEventListener("keydown", (e) => {
  if (document.documentElement.dataset.fp !== "game" || !round || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($("#fp-zoom").open || e.target.closest?.("input")) return;
  if (round.over) {
    if (e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") $("#fp-next").click();
    return;
  }
  const key = e.key.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/^[A-Z]$/.test(key)) {
    type(key);
    e.preventDefault();
  } else if (e.key === "Backspace") {
    backspace();
    e.preventDefault();
  }
});

// Impide abrir/copiar la foto con clic derecho o arrastrándola (no es infalible)
document.addEventListener("contextmenu", (e) => {
  if (e.target.closest?.("#fp-photos, #fp-zoom")) e.preventDefault();
});

// ---------- Rutas ----------
async function route() {
  await loadTeams();
  const h = location.hash;
  if (h === "#/practica") {
    duel = null;
    document.title = "Práctica · 4 Fotos 1 Equipo · onepixel";
    practiceRound();
  } else if (h === "#/1v1") {
    document.title = "1v1 · 4 Fotos 1 Equipo · onepixel";
    duelSetup();
  } else {
    duel = null;
    document.title = "4 Fotos 1 Equipo · onepixel";
    setView("menu");
    document.querySelectorAll(".fp-stats").forEach((p) => (p.textContent = statsText()));
  }
}
window.addEventListener("hashchange", route);
route();
