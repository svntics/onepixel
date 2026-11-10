// Lógica de una ronda: intentos, pistas, autocompletado, blur y puntos.
import { CONFIG } from "./config.js";
import { buildIndex, matchExact, suggest } from "./normalize.js";
import { scoreRound } from "./scoring.js";
import { attachBlur } from "./blur.js";
import { decode } from "./codec.js";

const $ = (sel) => document.querySelector(sel);
const LEVELS = CONFIG.BLUR_LEVELS;
const MAX = LEVELS.length; // 6 intentos

const el = {
  photo: $("#player-photo"),
  credit: $("#photo-credit"),
  boxes: $("#attempt-boxes"),
  status: $("#attempts"),
  form: $("#guess-form"),
  input: $("#guess-input"),
  submit: $("#guess-submit"),
  list: $("#suggestions"),
  hintBtn: $("#hint-btn"),
  log: $("#round-log"),
  msg: $("#round-msg"),
  result: $("#round-result"),
};

const blur = attachBlur(el.photo, CONFIG.BLUR_REFERENCE_WIDTH);

// Cómo se llama a la persona de la foto (futbolista, basquetbolista…), según la categoría
let subject = "futbolista";
export function setSubject(s) {
  subject = s;
  const label = document.querySelector('label[for="guess-input"]');
  if (label) label.textContent = `Nombre del ${s}`;
}

let state = null; // { index, answer, data, stage, tried:Set, marks:[], hintsUsed, over, won, onEnd }
let active = -1; // opción resaltada del autocompletado
let options = [];

// ---------- Inicio de ronda ----------
// Opciones extra (modo 1v1): startStage = intento en que empieza (con su difuminado);
// singleAttempt = un solo intento, sin pistas (foto pasada por el rival).
export function startRound(category, ronda, { onEnd, onChange, restore, startStage = 0, singleAttempt = false } = {}) {
  const data = decode(ronda.d);
  state = {
    index: buildIndex(category.nombres),
    nombres: category.nombres,
    answer: data.i,
    data,
    stage: startStage,
    singleAttempt,
    tried: new Set(),
    marks: [], // "miss" | "hint" | "win" por cada intento consumido
    hintsUsed: 0,
    over: false,
    won: false,
    onEnd,
    onChange,
    actions: [], // historial para guardar/restaurar la ronda: { t: "g", i } | { t: "h" }
    restoring: false,
  };
  el.photo.alt = `Foto del ${subject} misterioso`;
  el.photo.src = ronda.img;
  renderCredit(data.cr, false);
  el.log.replaceChildren();
  el.msg.textContent = "";
  el.result.hidden = true;
  el.result.replaceChildren();
  el.form.hidden = false;
  el.hintBtn.hidden = false;
  el.input.value = "";
  el.input.disabled = false;
  el.submit.disabled = false;
  closeList();
  render();
  // Restaurar una ronda guardada (p. ej. al recargar la página en el reto diario)
  if (restore?.length) {
    state.restoring = true;
    for (const a of restore) a.t === "h" ? useHint() : guess(a.i);
    state.restoring = false;
  }
}

function changed() {
  if (!state.restoring) state.onChange?.({ actions: [...state.actions], over: state.over, stage: state.stage });
}

// ---------- Acciones ----------
function guess(i) {
  if (state.over) return;
  if (state.tried.has(i)) {
    el.msg.textContent = "Ya intentaste con ese jugador. Prueba otro.";
    return;
  }
  state.tried.add(i);
  state.actions.push({ t: "g", i });
  el.input.value = "";
  closeList();
  if (i === state.answer) {
    state.marks.push("win");
    return finish(true);
  }
  state.marks.push("miss");
  addLog("✗", state.nombres[i].nombre, "miss");
  advance(`No es ${state.nombres[i].nombre}.`);
}

function useHint() {
  if (!canHint()) return;
  const text = state.data.pistas[state.hintsUsed++];
  state.marks.push("hint");
  state.actions.push({ t: "h" });
  addLog("💡", text, "hint");
  advance("Pista revelada. La foto se aclara un poco.");
}

function advance(message) {
  state.stage++;
  if (state.stage >= MAX || state.singleAttempt) return finish(false);
  el.msg.textContent = `${message} ${MAX - state.stage === 1 ? "Último intento: foto nítida." : ""}`.trim();
  render();
  changed();
  if (!state.restoring) el.input.focus();
}

function finish(won) {
  state.over = true;
  state.won = won;
  const points = scoreRound({ won, stage: state.stage, levels: LEVELS });
  const name = state.nombres[state.answer].nombre;
  blur.set(0);
  el.photo.alt = `Foto de ${name}`;
  renderCredit(state.data.cr, true);
  el.input.disabled = true;
  el.submit.disabled = true;
  el.hintBtn.disabled = true;
  el.hintBtn.textContent = "Ronda terminada";
  el.form.hidden = true;
  el.hintBtn.hidden = true;
  el.msg.textContent = "";
  renderBoxes();

  const h = document.createElement("h2");
  h.className = "text-xl font-extrabold";
  h.textContent = won ? `¡Correcto! Era ${name}` : `Era ${name}`;
  const p = document.createElement("p");
  p.className = "mt-1 text-muted";
  p.textContent = state.singleAttempt
    ? won
      ? `Acertaste la foto extra · ${points} puntos`
      : "Fallaste la foto extra · 0 puntos"
    : won
      ? `Acertaste en el intento ${state.stage + 1} de ${MAX} · ${points} puntos`
      : "Se acabaron los intentos · 0 puntos";
  el.result.append(h, p);
  el.result.hidden = false;
  el.status.textContent = won ? "Ronda ganada" : "Ronda perdida";
  changed();
  state.onEnd?.({ won, points, stage: state.stage, marks: [...state.marks], name, el: el.result, restored: state.restoring });
  if (!state.restoring) el.result.focus();
}

const canHint = () =>
  !state.over && !state.singleAttempt && state.hintsUsed < state.data.pistas.length && state.stage < MAX - 1; // no en el último intento

// ---------- Crédito de la foto (licencias Creative Commons) ----------
function link(href, text, title) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  a.className = "underline";
  a.target = "_blank";
  a.rel = "noopener";
  if (title) a.title = title;
  return a;
}

function renderCredit(cr, final) {
  const c = el.credit;
  c.replaceChildren();
  if (!cr) {
    c.textContent = "Imagen provisional (todavía sin foto real)";
    return;
  }
  const mode = CONFIG.CREDIT_MODE;
  if (!final && mode === "al-final") {
    c.append("El crédito de la foto se muestra al terminar · ", link("creditos.html", "Créditos"));
    return;
  }
  const lic = cr.url_licencia ? link(cr.url_licencia, cr.licencia) : cr.licencia;
  c.append(`Foto: ${cr.autor} · `, lic, " · ");
  if (final || mode === "durante") {
    c.append(link(cr.url_fuente, "Wikimedia Commons", "Ver la foto original (puede revelar al jugador)"));
  } else {
    c.append("Wikimedia Commons (enlace al terminar)");
  }
  c.append(" · Redimensionada y difuminada");
}

// ---------- Pintar ----------
function render() {
  blur.set(LEVELS[state.stage]);
  renderBoxes();
  el.status.textContent = state.singleAttempt ? "Foto extra · 1 solo intento" : `Intento ${state.stage + 1} de ${MAX}`;
  const left = state.data.pistas.length - state.hintsUsed;
  el.hintBtn.disabled = !canHint();
  el.hintBtn.textContent =
    state.singleAttempt ? "Sin pistas en la foto extra" : left === 0 ? "No quedan pistas" : state.stage >= MAX - 1 ? "Sin pistas en el último intento" : `Pedir pista (${left} disponible${left > 1 ? "s" : ""}, cuesta 1 intento)`;
}

function renderBoxes() {
  const colors = { miss: "bg-danger", hint: "bg-amber-400", win: "bg-accent" };
  el.boxes.replaceChildren(
    ...Array.from({ length: MAX }, (_, k) => {
      const s = document.createElement("span");
      const m = state.marks[k];
      s.className = `h-2.5 flex-1 rounded-full ${m ? colors[m] : k === state.stage && !state.over ? "bg-muted" : "bg-surface-2"}`;
      return s;
    }),
  );
}

function addLog(icon, text, kind) {
  const li = document.createElement("li");
  li.className = `flex gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm ${kind === "miss" ? "text-muted" : ""}`;
  const i = document.createElement("span");
  i.setAttribute("aria-hidden", "true");
  i.textContent = icon;
  const t = document.createElement("span");
  t.textContent = (kind === "miss" ? "Fallo: " : "Pista: ") + text;
  li.append(i, t);
  el.log.append(li);
}

// ---------- Autocompletado (patrón combobox accesible) ----------
function openList(items) {
  options = items;
  active = items.length ? 0 : -1;
  el.list.replaceChildren(
    ...items.map((o, k) => {
      const li = document.createElement("li");
      li.id = `opt-${k}`;
      li.setAttribute("role", "option");
      li.className = "min-h-11 cursor-pointer px-4 py-2.5 aria-selected:bg-surface-2";
      li.textContent = o.nombre;
      if (o.via) {
        const small = document.createElement("span");
        small.className = "ml-2 text-sm text-muted";
        small.textContent = `(${o.via})`;
        li.append(small);
      }
      li.addEventListener("mousedown", (e) => e.preventDefault()); // no perder el foco del input
      li.addEventListener("click", () => pick(k));
      return li;
    }),
  );
  if (!items.length && el.input.value.trim()) {
    const li = document.createElement("li");
    li.className = "px-4 py-2.5 text-sm text-muted";
    li.textContent = "No hay jugadores con ese nombre en esta categoría.";
    el.list.append(li);
  }
  el.list.hidden = !el.list.children.length;
  el.input.setAttribute("aria-expanded", String(!el.list.hidden));
  highlight();
}

function closeList() {
  options = [];
  active = -1;
  el.list.hidden = true;
  el.list.replaceChildren();
  el.input.setAttribute("aria-expanded", "false");
  el.input.removeAttribute("aria-activedescendant");
}

function highlight() {
  [...el.list.querySelectorAll('[role="option"]')].forEach((li, k) => li.setAttribute("aria-selected", String(k === active)));
  if (active >= 0) {
    el.input.setAttribute("aria-activedescendant", `opt-${active}`);
    document.getElementById(`opt-${active}`)?.scrollIntoView({ block: "nearest" });
  } else el.input.removeAttribute("aria-activedescendant");
}

function pick(k) {
  const o = options[k];
  if (!o) return;
  el.input.value = o.nombre;
  closeList();
  el.input.focus();
}

el.input.addEventListener("input", () => {
  if (!state || state.over) return;
  el.msg.textContent = "";
  openList(suggest(state.index, el.input.value, state.tried));
});

el.input.addEventListener("keydown", (e) => {
  if (el.list.hidden || !options.length) return;
  if (e.key === "ArrowDown") active = (active + 1) % options.length;
  else if (e.key === "ArrowUp") active = (active - 1 + options.length) % options.length;
  else if (e.key === "Escape") return closeList();
  else if (e.key === "Enter" && active >= 0 && el.input.value !== options[active].nombre) {
    e.preventDefault();
    return pick(active);
  } else return;
  e.preventDefault();
  highlight();
});

el.input.addEventListener("blur", () => setTimeout(closeList, 100));

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!state || state.over) return;
  const value = el.input.value.trim();
  if (!value) return;
  const hits = matchExact(state.index, value);
  if (hits.length === 1) return guess(hits[0]);
  // Si no es exacto pero hay una única sugerencia, se usa esa
  const sug = suggest(state.index, value, new Set());
  if (hits.length === 0 && sug.length === 1) return guess(sug[0].i);
  el.msg.textContent =
    hits.length > 1 ? "Ese nombre coincide con varios jugadores; elige uno de la lista." : "Elige un jugador de la lista de sugerencias.";
});

el.hintBtn.addEventListener("click", useHint);

// Estado actual de la ronda (lo usa el modo 1v1 para saber en qué intento va el jugador)
export function roundState() {
  return state ? { stage: state.stage, over: state.over } : null;
}
