// Modo 1v1 local: dos jugadores en el mismo dispositivo, por turnos.
//
// - Configuración: nombres de J1 y J2 y número de rondas (3 o 5). Una ronda = un turno de cada uno.
// - Cada turno es una foto distinta, al azar, sin repetir fotos dentro del duelo.
// - Entre turnos, una pantalla de transición oculta todo (anti-spoiler) hasta que el siguiente
//   jugador pulsa "¡Listo, empezar mi turno!".
// - "Pasar al Rival" (2 pases por jugador, solo en los intentos 1 y 2):
//     · quien pasa recibe una foto nueva al azar (sin repetir) y sigue su turno desde el intento 1;
//     · la foto pasada se le agrega al rival como FOTO EXTRA, que se juega al final del duelo,
//       con el difuminado en que quedó y UN solo intento (sin pistas). Si acierta, suma esos puntos.
// - El duelo se guarda en el navegador: si se recarga, se retoma en la pantalla de transición.
import { startRound, roundState } from "./game.js";
import { load, save } from "./storage.js";
import { validateApodo } from "./ranking.js";

const $ = (sel) => document.querySelector(sel);
const PASES = 2;
const ULTIMO_INTENTO_PARA_PASAR = 2; // se puede pasar en los intentos 1 y 2
const key = (catId) => `duelo:${catId}`;
const ICON = ["🔵", "🔴"];

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
// Pantallas del duelo (configuración / transición / final) en lugar de la foto
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

// ---------- Estado ----------
const persist = () => save(key(ctx.cat.id), ctx.state);
const totalTurns = (s) => s.rounds * 2;
const inExtras = (s) => s.turn >= totalTurns(s);
const currentExtra = (s) => (inExtras(s) ? s.extraQueue[s.extraIdx] : null);
const currentPlayer = (s) => (inExtras(s) ? currentExtra(s).player : s.turn % 2);
const currentRound = (s) => Math.floor(s.turn / 2) + 1;

// Foto al azar que no haya salido en este duelo (si se agotan, se permite repetir)
function randomRonda() {
  const s = ctx.state;
  const total = ctx.data.rondas.length;
  const all = Array.from({ length: total }, (_, i) => i);
  const free = all.filter((i) => !s.usados.includes(i));
  const pool = free.length ? free : all;
  const i = pool[Math.floor(Math.random() * pool.length)];
  s.usados.push(i);
  return i;
}

// Orden de las fotos extra al final: alternando J1, J2, J1… mientras queden
function buildExtraQueue(s) {
  const q = [];
  const a = [...s.jugadores[0].extras];
  const b = [...s.jugadores[1].extras];
  while (a.length || b.length) {
    if (a.length) q.push({ ...a.shift(), player: 0 });
    if (b.length) q.push({ ...b.shift(), player: 1 });
  }
  return q;
}

// ---------- Punto de entrada ----------
export function playDuel(cat, data) {
  let saved = load(key(cat.id));
  if (saved && !Array.isArray(saved.extraQueue)) saved = null; // duelo guardado con una versión anterior
  ctx = { cat, data, state: saved };
  if (saved?.fase === "final") return showFinal();
  if (saved?.rounds) return showTransition(true);
  showSetup();
}

// ---------- Configuración ----------
function showSetup(prev) {
  const p = prev ?? load("duelo:nombres", { j1: "", j2: "", rounds: 3 });
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
        <label class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 font-bold has-checked:border-accent has-checked:text-accent"><input type="radio" name="rounds" value="3"> 3 rondas</label>
        <label class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 font-bold has-checked:border-accent has-checked:text-accent"><input type="radio" name="rounds" value="5"> 5 rondas</label>
      </div>
    </fieldset>
    <div class="rounded-xl bg-surface-2 p-3 text-xs text-muted">
      <p><strong class="text-text">🔄 Pasar al Rival</strong> (${PASES} por jugador, solo en los intentos 1 y 2): recibes una foto nueva y tu rival se queda con la que pasaste como <strong class="text-text">foto extra</strong>. La juega al final del duelo, tan difuminada como la dejaste y con <strong class="text-text">un solo intento</strong>.</p>
    </div>
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
  const player = (name) => ({ name, score: 0, aciertos: 0, fotos: 0, pases: PASES, extras: [], extrasJugadas: 0, extrasAcertadas: 0 });
  ctx.state = { fase: "transicion", rounds, turn: 0, jugadores: [player(j1), player(j2)], usados: [], actual: null, extraQueue: [], extraIdx: 0, anterior: null };
  persist();
  showTransition(false);
}

// ---------- Marcador ----------
function scoreboard(s, big = false) {
  const wrap = el("div", `grid grid-cols-2 gap-2 text-center ${big ? "mt-4" : ""}`);
  s.jugadores.forEach((j, k) => {
    const on = s.fase !== "final" && currentPlayer(s) === k;
    const c = el("div", `rounded-xl border p-2 ${on ? "border-accent" : "border-border"} bg-surface-2`);
    c.append(el("div", "truncate text-sm font-semibold", `${ICON[k]} ${j.name}`), el("div", `${big ? "text-3xl" : "text-xl"} font-extrabold`, j.score));
    const extras = j.extras.length - (inExtras(s) ? s.extraQueue.filter((x, i) => x.player === k && i < s.extraIdx).length : 0);
    c.append(el("div", "text-xs text-muted", `Pases: ${j.pases}/${PASES}${extras > 0 ? ` · ${extras} extra` : ""}`));
    wrap.append(c);
  });
  return wrap;
}

// ---------- Pantalla de transición (anti-spoiler) ----------
function showTransition(resumed) {
  const s = ctx.state;
  const k = currentPlayer(s);
  const now = s.jugadores[k];
  const rival = s.jugadores[1 - k];
  const extra = currentExtra(s);
  const card = el("div", "rounded-2xl border border-border bg-surface p-5 text-center");
  card.append(el("div", "text-5xl", extra ? "🎁" : "🔁"));
  if (resumed) card.append(el("p", "mt-2 text-sm text-muted", "Duelo en curso recuperado."));
  const mismo = s.anterior === k; // el mismo jugador sigue (p. ej. sus fotos extra)
  if (!resumed && s.anterior !== null) card.append(el("p", "mt-2 text-muted", mismo ? `${now.name} sigue jugando.` : `Fin del turno de ${s.jugadores[s.anterior].name}.`));
  const first = s.turn === 0 && !resumed;
  card.append(el("h2", "mt-2 text-2xl font-extrabold", first ? `Empieza ${now.name}` : mismo && !resumed ? `Sigue ${now.name}` : `Pásale el dispositivo a ${now.name}`));
  if (extra) {
    const total = s.extraQueue.length;
    card.append(
      el("p", "mt-2 font-semibold text-accent", `Foto extra ${s.extraIdx + 1} de ${total}: te la pasó ${rival.name} en el intento ${extra.stage + 1}.`),
      el("p", "text-sm text-muted", "Tienes un solo intento y no hay pistas. 🙈 Que tu rival no mire."),
    );
  } else {
    card.append(el("p", "mt-1 text-sm text-muted", `Ronda ${currentRound(s)} de ${s.rounds} · que ${rival.name} no mire la pantalla 🙈`));
  }
  card.append(scoreboard(s, true));
  card.append(btn("¡Listo, empezar mi turno!", "mt-5 min-h-14 bg-accent text-lg text-accent-ink", startTurn));
  card.append(
    btn("Abandonar duelo", "mt-2 text-sm font-semibold text-muted", () => {
      if (confirm("¿Abandonar el duelo? Se perderá el marcador.")) {
        save(key(ctx.cat.id), null);
        showSetup({ j1: s.jugadores[0].name, j2: s.jugadores[1].name, rounds: s.rounds });
      }
    }),
  );
  showScreen([card]);
}

// ---------- Turno ----------
function renderBar() {
  const s = ctx.state;
  const k = currentPlayer(s);
  const extra = currentExtra(s);
  const title = extra
    ? `🎁 Foto extra ${s.extraIdx + 1} de ${s.extraQueue.length} · ${ICON[k]} ${s.jugadores[k].name}`
    : `Ronda ${currentRound(s)} de ${s.rounds} · Turno de ${ICON[k]} ${s.jugadores[k].name}`;
  $("#duel-bar").replaceChildren(el("p", "mb-2 text-center text-sm font-bold", title), scoreboard(s));
  renderPassBtn();
}

function renderPassBtn() {
  const s = ctx.state;
  const pass = $("#pass-btn");
  const rs = roundState();
  if (inExtras(s) || !rs || rs.over) return (pass.hidden = true);
  const p = s.jugadores[currentPlayer(s)];
  pass.hidden = false;
  const tarde = rs.stage >= ULTIMO_INTENTO_PARA_PASAR;
  pass.disabled = p.pases === 0 || tarde;
  pass.textContent =
    p.pases === 0 ? "Sin pases" : tarde ? "Ya no puedes pasar (solo en los intentos 1 y 2)" : `🔄 Pasar al Rival · Pases restantes: ${p.pases}/${PASES}`;
}

function startTurn() {
  const s = ctx.state;
  s.fase = "jugando";
  if (!s.actual) {
    const extra = currentExtra(s);
    s.actual = extra ? { ronda: extra.ronda, actions: [], extra: true, stage: extra.stage } : { ronda: randomRonda(), actions: [] };
  }
  persist();
  showPlaying();
  playCurrent();
}

function playCurrent() {
  const s = ctx.state;
  $("#challenge-label").textContent = "";
  startRound(ctx.data, ctx.data.rondas[s.actual.ronda], {
    restore: s.actual.actions,
    startStage: s.actual.extra ? s.actual.stage : 0,
    singleAttempt: !!s.actual.extra,
    onChange: ({ actions }) => {
      s.actual.actions = actions;
      persist();
      renderPassBtn();
    },
    onEnd: (res) => endTurn(res),
  });
  renderBar();
  $("#guess-input").focus({ preventScroll: true });
}

// Pasar al Rival: la foto actual va al rival como foto extra; quien pasa recibe una nueva
$("#pass-btn").addEventListener("click", () => {
  if (!ctx || ctx.state?.fase !== "jugando") return;
  const s = ctx.state;
  const rs = roundState();
  if (inExtras(s) || !rs || rs.over || rs.stage >= ULTIMO_INTENTO_PARA_PASAR) return;
  const k = currentPlayer(s);
  const p = s.jugadores[k];
  if (p.pases <= 0) return;
  p.pases--;
  s.jugadores[1 - k].extras.push({ ronda: s.actual.ronda, stage: rs.stage, de: k });
  s.actual = { ronda: randomRonda(), actions: [] };
  persist();
  playCurrent();
  $("#round-msg").textContent = `${p.name} le pasó la foto a ${s.jugadores[1 - k].name} (la jugará al final). Foto nueva para ${p.name}.`;
});

function endTurn(res) {
  const s = ctx.state;
  const k = currentPlayer(s);
  const p = s.jugadores[k];
  if (!s.actual.contado) {
    p.score += res.points;
    if (s.actual.extra) {
      p.extrasJugadas++;
      if (res.won) p.extrasAcertadas++;
    } else {
      p.fotos++;
      if (res.won) p.aciertos++;
    }
    s.actual.contado = true;
    persist();
  }
  renderBar();
  $("#pass-btn").hidden = true;

  // ¿Qué viene después?
  let nextTurn = s.turn;
  let nextExtra = s.extraIdx;
  let queue = s.extraQueue;
  if (s.actual.extra) nextExtra++;
  else {
    nextTurn++;
    if (nextTurn >= totalTurns(s)) queue = buildExtraQueue(s);
  }
  const done = nextTurn >= totalTurns(s) && nextExtra >= queue.length;

  res.el.append(
    el("p", "mt-2 text-sm font-semibold", `${p.name} suma ${res.points} pts · total ${p.score}`),
    btn(done ? "Ver resultado del duelo 🏆" : "Terminar mi turno", "mt-3 bg-accent text-accent-ink", () => {
      s.anterior = k;
      s.turn = nextTurn;
      s.extraIdx = nextExtra;
      s.extraQueue = queue;
      s.actual = null;
      s.fase = done ? "final" : "transicion";
      persist();
      done ? showFinal() : showTransition(false);
    }),
  );
}

// ---------- Resultado final ----------
function showFinal() {
  const s = ctx.state;
  const [a, b] = s.jugadores;
  const empate = a.score === b.score;
  const ganador = a.score > b.score ? a : b;
  const card = el("div", "duel-final relative overflow-hidden rounded-2xl border-2 border-accent bg-surface p-5 text-center");
  card.append(el("div", "duel-trophy text-6xl", empate ? "🤝" : "🏆"));
  card.append(el("h2", "duel-title mt-2 text-3xl font-black uppercase tracking-wide", empate ? "¡Empate!" : `¡Gana ${ganador.name}!`));
  card.append(el("p", "text-sm text-muted", empate ? `${a.score} a ${b.score}. Nadie se lleva la gloria… esta vez.` : `${Math.abs(a.score - b.score)} puntos de diferencia · ${s.rounds} rondas`));

  const t = el("table", "mt-5 w-full text-sm");
  t.innerHTML = `<caption class="sr-only">Resultado del duelo</caption><thead><tr class="text-xs text-muted"><th scope="col" class="py-1 text-left">Jugador</th><th scope="col" class="py-1">Puntos</th><th scope="col" class="py-1">Aciertos</th><th scope="col" class="py-1">Pases usados</th><th scope="col" class="py-1">Fotos extra</th></tr></thead><tbody></tbody>`;
  s.jugadores.forEach((j, k) => {
    const win = !empate && j === ganador;
    const tr = el("tr", `border-t border-border ${win ? "font-bold" : ""}`);
    const th = el("th", "py-2 text-left", `${ICON[k]} ${j.name}${win ? " 👑" : ""}`);
    th.setAttribute("scope", "row");
    tr.append(
      th,
      el("td", "py-2 text-center text-lg font-extrabold", j.score),
      el("td", "py-2 text-center", `${j.aciertos}/${j.fotos}`),
      el("td", "py-2 text-center", `${PASES - j.pases}/${PASES}`),
      el("td", "py-2 text-center", j.extrasJugadas ? `${j.extrasAcertadas}/${j.extrasJugadas}` : "—"),
    );
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
