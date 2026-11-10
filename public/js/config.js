// ============================================================
//  CONFIGURACIÓN GENERAL — puedes editar este archivo sin miedo.
//  Cambia los valores entre comillas y vuelve a desplegar.
// ============================================================

export const CONFIG = {
  // Nombre que se muestra en la página y en el texto para compartir
  SITE_NAME: "onepixel",

  // URL pública del sitio (cámbiala cuando tengas la definitiva en Vercel)
  SITE_URL: "https://onepixel-phi.vercel.app",

  // Día del reto #1 (formato AAAA-MM-DD, hora de Chile). Decidido: 1 de agosto de 2026.
  // Cambiarlo cambia el número y el jugador de todos los retos.
  DAILY_EPOCH: "2026-08-01",

  // Zona horaria que define cuándo cambia el reto diario
  TIMEZONE: "America/Santiago",

  // Niveles de blur, uno por intento (en px, medidos sobre BLUR_REFERENCE_WIDTH)
  BLUR_LEVELS: [25, 18, 10, 5, 2, 0],
  BLUR_REFERENCE_WIDTH: 400,

  // ---------- Publicidad ----------
  // Sin código real de anuncios. Cuando tengas un proveedor aprobado, pon ENABLED en true
  // y pega su código donde lo indica public/js/ads.js.
  ADS: {
    ENABLED: false,
    // Mostrar recuadros "Publicidad" de prueba en producción (en "npm run dev" siempre se muestran)
    SHOW_PLACEHOLDERS: false,
    // Altura reservada en px (evita que la página "salte" al cargar el anuncio).
    // Celular: 320×50 arriba y 320×100 abajo. Computador (≥768 px de ancho): 728×90.
    SLOTS: {
      top: { mobile: 50, desktop: 90 },
      bottom: { mobile: 100, desktop: 90 },
    },
  },

  // Aviso de cookies propio (simple, NO es una plataforma certificada por Google). Desactivado.
  CONSENT_BANNER: false,

  // Enlace de apoyo voluntario (Mercado Pago u otro). Vacío = el botón no aparece.
  SUPPORT_URL: "https://link.mercadopago.cl/apoyoonepixel",
  SUPPORT_LABEL: "☕ Apoya el proyecto",

  // Correo de contacto para privacidad y solicitudes de retiro de imágenes. Vacío = "pendiente".
  CONTACT_EMAIL: "santijavier64@gmail.com",

  // Cómo se muestra el crédito de la foto MIENTRAS se juega (al terminar siempre se muestra completo):
  //   "durante"            → autor, licencia y enlace a la fuente (el enlace puede revelar al jugador)
  //   "durante-sin-enlace" → autor y licencia; el enlace a la fuente aparece al terminar
  //   "al-final"           → solo un aviso; el crédito completo aparece al terminar
  CREDIT_MODE: "durante",

  // Categorías de la pantalla inicial (sin logos oficiales). El orden importa para el reto diario:
  // agrega las nuevas siempre al final.
  CATEGORIES: [
    { id: "mundiales", nombre: "Mundiales", emoji: "🌎", descripcion: "Leyendas y figuras de las Copas del Mundo" },
    { id: "premier", nombre: "Premier League", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", descripcion: "Jugadores de la liga inglesa" },
    { id: "champions", nombre: "Champions League", emoji: "⭐", descripcion: "Protagonistas del torneo europeo de clubes" },
    { id: "libertadores", nombre: "Copa Libertadores", emoji: "🏆", descripcion: "Ídolos del torneo sudamericano de clubes" },
    // "activa: false" = categoría en preparación: no aparece en el sitio hasta aprobarla
    { id: "italiana", nombre: "Liga italiana", emoji: "🇮🇹", descripcion: "Figuras del fútbol de Italia", activa: false },
  ],
};
