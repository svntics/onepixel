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

  // ---------- Ranking de mejores puntajes del día ----------
  //   PROVIDER "local"    → modo de prueba: solo se ven los puntajes guardados en este navegador
  //   PROVIDER "supabase" → ranking compartido entre todos (ver README, sección "Ranking")
  // La clave "publishable" de Supabase es pública por diseño: la seguridad la dan las reglas RLS.
  RANKING: {
    PROVIDER: "local",
    SUPABASE_URL: "", // ej. "https://abcdefgh.supabase.co"
    SUPABASE_KEY: "", // clave "publishable" (sb_publishable_...) o la "anon" antigua
    TOP: 10,
  },

  // Correo de contacto para privacidad y solicitudes de retiro de imágenes. Vacío = "pendiente".
  CONTACT_EMAIL: "santijavier64@gmail.com",

  // Cómo se muestra el crédito de la foto MIENTRAS se juega (al terminar cada foto siempre se muestra completo):
  //   "al-final"           → solo un texto neutral sin enlaces ni datos del autor (anti-spoiler)
  //   "durante-sin-enlace" → autor y licencia; el enlace a la fuente aparece al terminar
  //   "durante"            → autor, licencia y enlace a la fuente (el enlace puede revelar al jugador)
  // Elegido: "al-final". Ojo: dar el crédito recién al terminar es lo que más arriesga no cumplir
  // las licencias CC 2.0/3.0 (ver README). No es asesoría legal.
  CREDIT_MODE: "al-final",

  // ---------- Categorías generales (página principal) ----------
  //   estado "activo" = se puede jugar · "pronto" = visible pero bloqueada ("Próximamente")
  //   sujeto = cómo se llama a la persona de la foto en los textos del juego
  SPORTS: [
    { id: "futbol", nombre: "Fútbol", emoji: "⚽", descripcion: "Mundiales, ligas y copas", estado: "activo", sujeto: "futbolista" },
    { id: "basquetbol", nombre: "Básquetbol", emoji: "🏀", descripcion: "Leyendas y estrellas de la NBA", estado: "activo", sujeto: "basquetbolista" },
    { id: "ufc", nombre: "UFC / Artes marciales mixtas", emoji: "🥊", descripcion: "Peleadores de MMA", estado: "pronto", sujeto: "peleador" },
    { id: "series", nombre: "Series y actores", emoji: "🎬", descripcion: "Personajes y actores de series", estado: "pronto", sujeto: "actor" },
  ],

  // ---------- Modo "4 Fotos 1 Equipo" ----------
  //   Aparece dentro de la categoría general DEPORTE y se juega con TODOS los equipos juntos.
  //   LEAGUES solo sirve para ordenar los datos (data/4fotos/<id>.json); "activa" ya no se usa en el juego.
  FOUR_PICS: {
    DEPORTE: "futbol",
    LEAGUES: [
      { id: "premier", nombre: "Premier League", emoji: "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", activa: true },
      { id: "laliga", nombre: "La Liga", emoji: "🇪🇸", activa: false },
      { id: "bundesliga", nombre: "Bundesliga", emoji: "🇩🇪", activa: false },
      { id: "seriea", nombre: "Serie A", emoji: "🇮🇹", activa: false },
      { id: "champions", nombre: "Equipos de Champions League", emoji: "🇪🇺", activa: false },
      { id: "historicos", nombre: "Campeones históricos de Champions y Libertadores", emoji: "🏆", activa: false },
    ],
  },

  // Subcategorías de cada categoría general (sin logos oficiales). El orden importa para el reto
  // diario: agrega las nuevas SIEMPRE al final.
  //   activa: false = en preparación (oculta) · "AAAA-MM-DD" = visible desde esa fecha
  CATEGORIES: [
    { id: "mundiales", deporte: "futbol", nombre: "Mundiales", emoji: "🌎", descripcion: "Leyendas y figuras de las Copas del Mundo" },
    { id: "premier", deporte: "futbol", nombre: "Premier League", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", descripcion: "Jugadores de la liga inglesa" },
    { id: "champions", deporte: "futbol", nombre: "Champions League", emoji: "⭐", descripcion: "Protagonistas del torneo europeo de clubes" },
    { id: "libertadores", deporte: "futbol", nombre: "Copa Libertadores", emoji: "🏆", descripcion: "Ídolos del torneo sudamericano de clubes" },
    { id: "italiana", deporte: "futbol", nombre: "Liga italiana", emoji: "🇮🇹", descripcion: "Figuras del fútbol de Italia", activa: "2026-11-12" },
    { id: "espanola", deporte: "futbol", nombre: "Liga española", emoji: "🇪🇸", descripcion: "Figuras del fútbol de España", activa: false },
    { id: "nba", deporte: "basquetbol", nombre: "NBA", emoji: "🏀", descripcion: "Leyendas y estrellas de la liga de básquetbol de EE. UU.", activa: false },
    { id: "entrenadores", deporte: "futbol", nombre: "Entrenadores", emoji: "📋", descripcion: "Técnicos de Mundiales y actuales", sujeto: "entrenador", activa: false },
  ],
};
