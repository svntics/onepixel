// ============================================================
//  CONFIGURACIÓN GENERAL — puedes editar este archivo sin miedo.
//  Cambia los valores entre comillas y vuelve a desplegar.
// ============================================================

export const CONFIG = {
  // Nombre que se muestra en la página y en el texto para compartir
  SITE_NAME: "onepixel",

  // URL pública del sitio (cámbiala cuando tengas la definitiva en Vercel)
  SITE_URL: "https://futblur.vercel.app",

  // Día del reto #1 (formato AAAA-MM-DD, hora de Chile)
  DAILY_EPOCH: "2026-08-01",

  // Zona horaria que define cuándo cambia el reto diario
  TIMEZONE: "America/Santiago",

  // Niveles de blur, uno por intento (en px, medidos sobre BLUR_REFERENCE_WIDTH)
  BLUR_LEVELS: [25, 18, 10, 5, 2, 0],
  BLUR_REFERENCE_WIDTH: 400,

  // Categorías que aparecen en la pantalla inicial (sin logos oficiales)
  CATEGORIES: [
    { id: "mundiales", nombre: "Mundiales", emoji: "🌎", descripcion: "Leyendas y figuras de las Copas del Mundo" },
    { id: "premier", nombre: "Premier League", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", descripcion: "Jugadores de la liga inglesa" },
    { id: "champions", nombre: "Champions League", emoji: "⭐", descripcion: "Protagonistas del torneo europeo de clubes" },
    { id: "libertadores", nombre: "Copa Libertadores", emoji: "🏆", descripcion: "Ídolos del torneo sudamericano de clubes" },
  ],
};
