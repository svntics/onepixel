// Páginas legales: completa datos de la configuración (nombre, correo, estado de anuncios).
import { CONFIG } from "./config.js";

document.querySelectorAll('[data-cfg="SITE_NAME"]').forEach((el) => (el.textContent = CONFIG.SITE_NAME));
document.querySelectorAll('[data-cfg="CONTACT_EMAIL"]').forEach((el) => {
  if (CONFIG.CONTACT_EMAIL) {
    const a = document.createElement("a");
    a.href = `mailto:${CONFIG.CONTACT_EMAIL}`;
    a.textContent = CONFIG.CONTACT_EMAIL;
    el.replaceChildren(a);
  } else el.textContent = "(correo de contacto pendiente)";
});
const status = document.querySelector("[data-ads-status]");
if (status)
  status.textContent = CONFIG.ADS.ENABLED
    ? "Estado actual: este sitio muestra publicidad de terceros."
    : "Estado actual: este sitio todavía no muestra publicidad ni usa cookies de terceros.";
