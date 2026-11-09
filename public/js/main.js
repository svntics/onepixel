// Punto de entrada: navegación entre vistas (#/ y #/categoria) y tema.
import { CONFIG } from "./config.js";
import { startRound } from "./game.js";

const $ = (sel) => document.querySelector(sel);
const views = { home: $("#view-home"), game: $("#view-game") };
const dataCache = new Map();

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
  try { localStorage.setItem("op-theme", light ? "light" : "dark"); } catch {}
  applyThemeButton();
});

// ---------- Inicio: lista de categorías ----------
function renderHome() {
  const list = $("#category-list");
  list.replaceChildren(
    ...CONFIG.CATEGORIES.map((c) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#/${c.id}"
           class="flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
          <span class="text-3xl" aria-hidden="true"></span>
          <span class="flex flex-col">
            <span class="text-lg font-bold"></span>
            <span class="text-sm text-muted"></span>
          </span>
        </a>`;
      // textContent (no innerHTML) para los textos configurables
      li.querySelector("[aria-hidden]").textContent = c.emoji;
      li.querySelector(".text-lg").textContent = c.nombre;
      li.querySelector(".text-sm").textContent = c.descripcion;
      return li;
    }),
  );
}

// ---------- Juego ----------
async function loadCategory(id) {
  if (!dataCache.has(id)) {
    const res = await fetch(`data/${id}.json`);
    if (!res.ok) throw new Error(`No se pudo cargar ${id}`);
    dataCache.set(id, await res.json());
  }
  return dataCache.get(id);
}

// Práctica: "bolsa" mezclada por categoría; no repite hasta agotar la lista.
// (En la Fase 4 se guardará en localStorage; por ahora dura mientras la pestaña esté abierta.)
const bags = new Map();
function nextPracticeRound(catId, total) {
  let bag = bags.get(catId);
  if (!bag || !bag.length) {
    bag = Array.from({ length: total }, (_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    bags.set(catId, bag);
  }
  return bag.pop();
}

function playPractice(cat, data) {
  const r = nextPracticeRound(cat.id, data.rondas.length);
  startRound(data, data.rondas[r], {
    onEnd: ({ el }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mt-4 min-h-12 w-full rounded-xl bg-accent px-4 font-bold text-accent-ink";
      btn.textContent = "Otro jugador";
      btn.addEventListener("click", () => {
        playPractice(cat, data);
        $("#guess-input").focus();
      });
      el.append(btn);
    },
  });
}

async function showGame(cat) {
  $("#game-title").textContent = `${cat.emoji} ${cat.nombre}`;
  document.title = `${cat.nombre} · ${CONFIG.SITE_NAME}`;
  try {
    playPractice(cat, await loadCategory(cat.id));
  } catch (e) {
    $("#attempts").textContent = "No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.";
  }
}

// ---------- Router por hash ----------
function route(e) {
  const id = location.hash.replace(/^#\/?/, "");
  const cat = CONFIG.CATEGORIES.find((c) => c.id === id);
  views.home.hidden = !!cat;
  views.game.hidden = !cat;
  if (cat) showGame(cat);
  else document.title = `${CONFIG.SITE_NAME} · Adivina el futbolista`;
  if (e) $("#contenido").focus({ preventScroll: true }); // solo al navegar, no en la carga inicial
}

document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = CONFIG.SITE_NAME));
applyThemeButton();
renderHome();
window.addEventListener("hashchange", route);
route();
