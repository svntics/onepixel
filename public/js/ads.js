// Espacios publicitarios, aviso de cookies y enlace de apoyo. Todo se controla desde config.js.
// NO contiene código real de ningún proveedor de anuncios.
import { CONFIG } from "./config.js";
import { load, save } from "./storage.js";

export function initAds() {
  const slots = document.querySelectorAll(".ad-slot");
  if (!CONFIG.ADS.ENABLED) {
    // Marcador de posición (solo visible si ads.css reserva el espacio: modo dev o SHOW_PLACEHOLDERS)
    slots.forEach((slot) => {
      const box = document.createElement("div");
      box.className = "flex w-full max-w-[728px] items-center justify-center self-stretch rounded-lg border border-dashed border-border text-xs text-muted";
      box.textContent = `Publicidad (espacio reservado: ${slot.dataset.slot === "top" ? "arriba" : "abajo"})`;
      slot.replaceChildren(box);
    });
    return;
  }
  const consent = CONFIG.CONSENT_BANNER ? load("consent") : "yes";
  if (consent !== "yes") return; // sin consentimiento, no se cargan anuncios
  // ==========================================================
  //  AQUÍ va el código del proveedor de anuncios una vez aprobado
  //  (por ejemplo, el script y las unidades que te entregue la plataforma).
  //  Cada <aside class="ad-slot" data-slot="top|bottom"> ya tiene su altura reservada.
  // ==========================================================
}

export function initConsent() {
  const banner = document.getElementById("consent-banner");
  if (!CONFIG.CONSENT_BANNER || !banner || load("consent")) return;
  banner.hidden = false;
  banner.querySelectorAll("[data-consent]").forEach((b) =>
    b.addEventListener("click", () => {
      save("consent", b.dataset.consent);
      banner.hidden = true;
      initAds();
    }),
  );
}

export function initSupport() {
  const a = document.getElementById("support-link");
  if (!a || !CONFIG.SUPPORT_URL) return;
  a.href = CONFIG.SUPPORT_URL;
  a.textContent = CONFIG.SUPPORT_LABEL;
  a.hidden = false;
}
