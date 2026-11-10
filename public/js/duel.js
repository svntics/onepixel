// Modo 1v1 local: dos jugadores en el mismo dispositivo, por turnos.
//
// - Configuración: nombres de J1 y J2 y número de rondas (3 o 5). Una ronda = un turno de cada uno.
// - Cada turno es una foto distinta, al azar, sin repetir jugadores dentro del duelo.
// - Entre turnos, una pantalla de transición oculta todo (anti-spoiler) hasta que el siguiente
//   jugador pulsa "¡Listo, empezar mi turno!".
// - Pases: 2 por jugador en todo el duelo. Pasar descarta la foto actual y da al MISMO jugador
//   una foto nueva al azar (puede ser más fácil o más difícil).
// - El duelo se guarda en el navegador: si se recarga, se retoma en la pantalla de transición.
import { startRound } from "./game.js";
import { load, save } from "./storage.js";
import { validateApodo } from "./ranking.js";

const $ = (sel) => document.querySelector(sel);
const PASES = 2;
const key = (catId) => `duelo:${catId}`;

let ctx = null; // { cat, data, state }

// ---------- Utilidades de interfaz ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(text, cls, onClick) {
  const b = el("button", `min-h-12 w-full rounded-xl px-4 font-bold ${cls}`, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
// Pantallas del duelo (configuración / transición / final) vs. la foto en juego
function showScreen(nodes) {
  $("#game-ui").hidden = true;
  $("#daily-summary").hidden = true;
  $("#duel-bar").hidden = true;
  const box = $("#duel-screen");
  box.replaceChildren(...nodes);
  box.hidden = false;
  box.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
function showPlaying() {
  $("#duel-screen").hidden = true;
  $("#daily-summary").hidden = true;
  $("#game-ui").hidden = false;
  $("#duel-bar").hidden = false;
}

const persist = () => save(key(ctx.cat.id), ctx.state);
const turnPlayer = (s) => s.turn % 2;
const turnRound = (s) => Math.floor(s.turn / 2) + 1;
const totalTurns = (s) => s.rounds * 2;

// Foto al azar que no haya salido en este duelo (si se agotan, se permite repetir)
function randomRonda() {
  const s = ctx.state;
  const total = ctx.data.rondas.length;
  const free = Array.from({ length: total }, (_, i) => i).filter((i) => !s.usados.includes(i));
  const pool = free.length ? free : Array.from({ length: total }, (_, i) => i);
  const i = pool[Math.floor(Math.random() * pool.length)];
  s.usados.push(i);
  return i;
}

// ---------- Punto de entrada ----------
export function playDuel(cat, data) {
  const saved = load(key(cat.id));
  ctx = { cat, data, state: saved };
  if (saved && saved.fase !== "final" && saved.rounds) return showTransition(true);
  if (saved?.fase === "final") return showFinal();
  showSetup();
}

// ---------- 2. Configuración ----------
function showSetup(prev) {
  const last = load("duelo:nombres", { j1: "", j2: "", rounds: 3 });
  const p = prev ?? last;
  const card = el("div", "rounded-2xl border border-border bg-surface p-4");
  card.append(el("h2", "text-xl font-extrabold", "⚔️ Nuevo duelo 1v1"), el("p", "text-sm text-muted", `${ctx.cat.emoji} ${ctx.cat.nombre} · se juega por turnos en este dispositivo`));
  const form = el("form", "mt-4 grid gap-3");
  form.noValidate = true;
  form.innerHTML = `
    <label class="grid gap-1 text-sm font-semibold">Jugador 1
      <input name="j1" type="text" maxlength="16" autocomplete="off" placeholder="Ej. Max10" class="min-h-12 rounded-xl border border-border bg-surface-2 px-4 text-base font-normal placeholder:text-muted"></label>
    <label class="grid gap-1 text-sm font-semibold">Jugador 2
      <input name="j2" type="text" maxlength="16" autocomplete="off" placeholder="Ej. Pelusa" class="min-h-12 rounded-xl border border-border bg-surface-2 px-4 text-base font-normal placeholder:text-muted"></label>
    <fieldset class="grid gap-1"><legend class="text-sm font-semibold">Rondas por jugador</legend>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 font-bold has-checked:border-accent has-checked:text-accent"><input type="radio" name="rounds" value="3" class="accent-current"> 3 rondas</label>
        <label class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 font-bold has-checked:border-accent has-checked:text-accent"><input type="radio" name="rounds" value="5" class="accent-current"> 5 rondas</label>
      </div>
    </fieldset>
    <p class="text-xs text-muted">Cada jugador tiene ${PASES} pases para cambiar una foto difícil.</p>
    <p id="duel-msg" class="min-h-5 text-sm text-danger" role="status" aria-live="polite"></p>
    <button type="submit" class="min-h-14 rounded-xl bg-accent px-4 text-lg font-extrabold text-accent-ink">¡Comenzar Duelo!</button>`;
  form.j1.value = p.j1 ?? "";
  form.j2.value = p.j2 ?? "";
  form.querySelector(`input[name=rounds][value="${p.rounds === 5 ? 5 : 3}"]`).checked = true;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = form.querySelector("#duel-msg");
    const a = validateApodo(form.j1.value);
    const b = validateApodo(form.j2.value);
    if (!a.ok) return ((msg.textContent = `Jugador 1: ${a.error}`), form.j1.focus());
    if (!b.ok) return ((msg.textContent = `Jugador 2: ${b.error}`), form.j2.focus());
    if (a.value.toLowerCase() === b.value.toLowerCase()) return ((msg.textContent = "Usen nombres distintos."), form.j2.focus());
    const rounds = Number(form.querySelector("input[name=rounds]:checked").value);
    save("duelo:nombres", { j1: a.value, j2: b.value, rounds });
    startDuel(a.value, b.value, rounds);
  });
  card.append(form);
  showScreen([card]);
  form.j1.focus();
}

function startDuel(j1, j2, rounds) {
  const player = (name) => ({ name, score: 0, aciertos: 0, pases: PASES, fotos: 0 });
  ctx.state = { fase: "transicion", rounds, turn: 0, jugadores: [player(j1), player(j2)], usados: [], actual: null };
  persist();
  showTransition(false);
}

// ---------- 3. Pantalla de transición (anti-spoiler) ----------
function scoreboard(s, big = false) {
  const wrap = el("div", `grid grid-cols-2 gap-2 text-center ${big ? "mt-4" : ""}`);
  s.jugadores.forEach((j, k) => {
    const on = s.fase !== "final" && turnPlayer(s) === k;
    const c = el("div", `rounded-xl border p-2 ${on ? "border-accent" : "border-border"} bg-surface-2`);
    c.append(el("div", "truncate text-sm font-semibold", `${k === 0 ? "🔵" : "🔴"} ${j.name}`), el("div", `${big ? "text-3xl" : "text-xl"} font-extrabold`, j.score));
    c.append(el("div", "text-xs text-muted", `Pases: ${j.pases}/${PASES}`));
    wrap.append(c);
  });
  return wrap;
}

function showTransition(resumed) {
  const s = ctx.state;
  const now = s.jugadores[turnPlayer(s)];
  const prev = s.turn > 0 ? s.jugadores[(s.turn - 1) % 2] : null;
  const card = el("div", "rounded-2xl border border-border bg-surface p-5 text-center");
  card.append(el("div", "text-5xl", "🔁"));
  if (resumed) card.append(el("p", "mt-2 text-sm text-muted", "Duelo en curso recuperado."));
  if (prev && !resumed) card.append(el("p", "mt-2 text-muted", `Fin del turno de ${prev.name}.`));
  const h = el("h2", "mt-2 text-2xl font-extrabold");
  h.textContent = s.turn === 0 && !resumed ? `Empieza ${now.name}` : `Pásale el dispositivo a ${now.name}`;
  card.append(h, el("p", "mt-1 text-sm text-muted", `Ronda ${turnRound(s)} de ${s.rounds} · que ${s.jugadores[1 - turnPlayer(s)].name} no mire la pantalla 🙈`));
  card.append(scoreboard(s, true));
  card.append(btn("¡Listo, empezar mi turno!", "mt-5 min-h-14 bg-accent text-lg text-accent-ink", startTurn));
  const quit = btn("Abandonar duelo", "mt-2 text-sm font-semibold text-muted", () => {
    if (confirm("¿Abandonar el duelo? Se perderá el marcador.")) {
      save(key(ctx.cat.id), null);
      showSetup({ j1: s.jugadores[0].name, j2: s.jugadores[1].name, rounds: s.rounds });
    }
  });
  card.append(quit);
  showScreen([card]);
}

// ---------- 4. Turno ----------
function renderBar() {
  const s = ctx.state;
  const p = s.jugadores[turnPlayer(s)];
  const bar = $("#duel-bar");
  bar.replaceChildren(el("p", "mb-2 text-center text-sm font-bold", `Ronda ${turnRound(s)} de ${s.rounds} · Turno de ${turnPlayer(s) === 0 ? "🔵" : "🔴"} ${p.name}`), scoreboard(s));
  const pass = $("#pass-btn");
  pass.hidden = false;
  pass.disabled = p.pases === 0;
  pass.textContent = p.pases === 0 ? "Sin pases" : `🔄 Pasar al Rival · Pases restantes: ${p.pases}/${PASES}`;
}

function startTurn() {
  const s = ctx.state;
  s.fase = "jugando";
  if (!s.actual) s.actual = { ronda: randomRonda(), actions: [] };
  persist();
  showPlaying();
  playCurrent();
}

function playCurrent() {
  const s = ctx.state;
  $("#challenge-label").textContent = "";
  renderBar();
  startRound(ctx.data, ctx.data.rondas[s.actual.ronda], {
    restore: s.actual.actions,
    onChange: ({ actions }) => {
      s.actual.actions = actions;
      persist();
    },
    onEnd: (res) => endTurn(res),
  });
  $("#guess-input").focus({ preventScroll: true });
}

// 5. Pase: foto nueva al azar para el mismo jugador
$("#pass-btn").addEventListener("click", () => {
  if (!ctx || ctx.state?.fase !== "jugando") return;
  const s = ctx.state;
  const p = s.jugadores[turnPlayer(s)];
  if (p.pases <= 0) return;
  p.pases--;
  s.actual = { ronda: randomRonda(), actions: [] };
  persist();
  playCurrent();
  const m = $("#round-msg");
  m.textContent = `${p.name} usó un pase: foto nueva. Le quedan ${p.pases}.`;
});

function endTurn(res) {
  const s = ctx.state;
  const p = s.jugadores[turnPlayer(s)];
  $("#pass-btn").hidden = true;
  if (!s.actual.contado) {
    p.score += res.points;
    p.fotos++;
    if (res.won) p.aciertos++;
    s.actual.contado = true;
    persist();
  }
  renderBar();
  $("#pass-btn").hidden = true;
  const last = s.turn + 1 >= totalTurns(s);
  res.el.append(
    el("p", "mt-2 text-sm font-semibold", `${p.name} suma ${res.points} pts · total ${p.score}`),
    btn(last ? "Ver resultado del duelo 🏆" : "Terminar mi turno", "mt-3 bg-accent text-accent-ink", () => {
      s.turn++;
      s.actual = null;
      s.fase = last ? "final" : "transicion";
      persist();
      last ? showFinal() : showTransition(false);
    }),
  );
}

// ---------- 6. Resultado final ----------
function showFinal() {
  const s = ctx.state;
  const [a, b] = s.jugadores;
  const empate = a.score === b.score;
  const ganador = a.score > b.score ? a : b;
  const card = el("div", "duel-final relative overflow-hidden rounded-2xl border-2 border-accent bg-surface p-5 text-center");
  card.append(el("div", "duel-trophy text-6xl", empate ? "🤝" : "🏆"));
  const h = el("h2", "duel-title mt-2 text-3xl font-black uppercase tracking-wide");
  h.textContent = empate ? "¡Empate!" : `¡Gana ${ganador.name}!`;
  card.append(h, el("p", "text-sm text-muted", empate ? `${a.score} a ${b.score}. Nadie se lleva la gloria… esta vez.` : `${Math.abs(a.score - b.score)} puntos de diferencia · ${s.rounds} rondas`));

  const t = el("table", "mt-5 w-full text-sm");
  t.innerHTML = `<caption class="sr-only">Resultado del duelo</caption><thead><tr class="text-xs text-muted"><th scope="col" class="py-1 text-left">Jugador</th><th scope="col" class="py-1">Puntos</th><th scope="col" class="py-1">Aciertos</th><th scope="col" class="py-1">Pases usados</th></tr></thead><tbody></tbody>`;
  s.jugadores.forEach((j, k) => {
    const tr = el("tr", `border-t border-border ${!empate && j === ganador ? "font-bold" : ""}`);
    tr.append(
      el("th", "py-2 text-left", `${k === 0 ? "🔵" : "🔴"} ${j.name}${!empate && j === ganador ? " 👑" : ""}`),
      el("td", "py-2 text-center text-lg font-extrabold", j.score),
      el("td", "py-2 text-center", `${j.aciertos}/${j.fotos}`),
      el("td", "py-2 text-center", `${PASES - j.pases}/${PASES}`),
    );
    tr.firstChild.setAttribute("scope", "row");
    t.tBodies[0].append(tr);
  });
  card.append(t);

  const actions = el("div", "mt-4 grid gap-2");
  actions.append(
    btn("🔁 Revancha", "bg-accent text-accent-ink", () => startDuel(a.name, b.name, s.rounds)),
    btn("Cambiar jugadores", "border border-border bg-surface", () => {
      save(key(ctx.cat.id), null);
      showSetup({ j1: a.name, j2: b.name, rounds: s.rounds });
    }),
  );
  const home = el("a", "flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-surface px-4 font-bold", "Volver al Menú Principal");
  home.href = "#/";
  home.addEventListener("click", () => save(key(ctx.cat.id), null));
  actions.append(home);
  showScreen([card, actions]);
}
