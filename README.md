# onepixel ⚽

Juego web: adivina qué futbolista aparece en una foto que empieza **muy difuminada** y se aclara con cada fallo o pista. Tiene un reto diario por categoría (el mismo para todos) y un modo práctica ilimitado.

Sitio estático (HTML + Tailwind CSS + JavaScript), sin servidor ni base de datos. Se publica gratis en Vercel.

> Esta guía está pensada para alguien que **no programa**. Copia y pega los comandos tal cual.
> Las pantallas de GitHub, Vercel y otras herramientas cambian con el tiempo: si algo no coincide exactamente, busca el botón con un nombre parecido.

---

## Índice

1. [Qué necesitas instalar (una sola vez)](#1-qué-necesitas-instalar-una-sola-vez)
2. [Descargar el proyecto a tu computador](#2-descargar-el-proyecto-a-tu-computador)
3. [Descargar las fotos (script de imágenes)](#3-descargar-las-fotos-script-de-imágenes)
4. [Probar el juego en tu computador](#4-probar-el-juego-en-tu-computador)
5. [Guardar y subir los cambios a GitHub](#5-guardar-y-subir-los-cambios-a-github)
6. [Publicar en Vercel](#6-publicar-en-vercel)
7. [Configuración (un solo archivo)](#7-configuración-un-solo-archivo)
8. [Agregar o corregir jugadores](#8-agregar-o-corregir-jugadores)
9. [Comandos disponibles](#9-comandos-disponibles)
10. [Problemas frecuentes](#10-problemas-frecuentes)
11. [Antes de lanzar: lista de control](#11-antes-de-lanzar-lista-de-control)

---

## 1. Qué necesitas instalar (una sola vez)

| Programa | Para qué | Dónde |
|---|---|---|
| **Node.js** (versión "LTS") | Ejecutar los scripts del proyecto | https://nodejs.org |
| **GitHub Desktop** | Descargar y subir el proyecto sin usar comandos de git | https://desktop.github.com |

Instálalos con las opciones por defecto. Para comprobar Node, abre una terminal (en Windows: busca **"Terminal"** o **"PowerShell"**; en Mac: **"Terminal"**) y escribe:

```bash
node --version
```

Debe responder algo como `v22.x.x` (sirve la 20 o superior).

## 2. Descargar el proyecto a tu computador

1. Abre **GitHub Desktop** e inicia sesión con tu cuenta de GitHub.
2. Menú **File → Clone repository…** → pestaña **GitHub.com** → elige `svntics/onepixel` → **Clone**.
3. Cuando termine: menú **Repository → Open in Terminal** (o "Open in Command Prompt"). Se abre una terminal **dentro de la carpeta del proyecto**. Todos los comandos de esta guía se escriben ahí.
4. Instala las dependencias (solo la primera vez, tarda 1–2 minutos):

```bash
npm install
```

## 3. Descargar las fotos (script de imágenes)

Las fotos salen de **Wikimedia Commons** (licencias libres). El script se ejecuta **una vez** (y de nuevo solo si agregas jugadores). Por cada jugador:

- busca su foto principal en Wikidata y revisa autor y licencia en Commons;
- si la licencia es libre (dominio público, CC0, CC BY o CC BY-SA) y hay autor, descarga una miniatura con un **nombre neutro** (ej. `a1b2c3d4e5f6a7b8.webp`) para no revelar al jugador;
- si no, **excluye** al jugador del juego y lo anota en el reporte.

### Opción A — En tu computador (recomendada)

Wikimedia pide identificarse con un contacto. Usa la dirección de tu repositorio:

En **Mac / Linux**:

```bash
CONTACTO=https://github.com/svntics/onepixel npm run images
```

En **Windows (PowerShell)**:

```powershell
$env:CONTACTO="https://github.com/svntics/onepixel"; npm run images
```

Tarda unos 5 minutos (va lento a propósito, para respetar los límites de Wikimedia). Si Wikimedia pide esperar, el script espera solo. Si se corta, vuelve a ejecutarlo: continúa donde quedó.

### Opción B — En GitHub, sin instalar nada

En GitHub: pestaña **Actions** → **Imágenes** → **Run workflow**. Al terminar, las fotos y el reporte quedan guardados en el repositorio. *Puede fallar si Wikimedia limita las conexiones desde GitHub; en ese caso usa la opción A.*

### Revisa el reporte

Abre `reports/imagenes.md`. Tiene una tabla: **Jugador | Categoría | ¿Imagen libre? | Licencia | Autor | Observación**.

- Los que dicen **No** no aparecerán en el juego.
- Revisa la columna *Observación*: si dice "la descripción de Wikidata no menciona fútbol", el jugador puede estar mal identificado (ver [sección 8](#8-agregar-o-corregir-jugadores)).
- **Mira las fotos** en `public/img/p/`: confirma que sea la persona correcta y que la foto sirva para el juego (por ejemplo, que no sea una foto grupal).

## 4. Probar el juego en tu computador

```bash
npm run dev
```

Abre **http://localhost:5173** en el navegador. Para detenerlo: `Ctrl + C` en la terminal.

En este modo los jugadores **sin foto** aparecen con una silueta gris y se ven los recuadros "Publicidad (espacio reservado)". Eso es solo para pruebas; en el sitio publicado no aparecen.

## 5. Guardar y subir los cambios a GitHub

En **GitHub Desktop**:

1. A la izquierda verás los archivos cambiados (por ejemplo, las fotos nuevas).
2. Abajo a la izquierda, escribe un resumen (ej. "Fotos de Wikimedia") y pulsa **Commit to main**.
3. Arriba, pulsa **Push origin**.

Si Vercel ya está conectado (paso 6), publicará la nueva versión automáticamente en 1–2 minutos.

## 6. Publicar en Vercel

> ⚠️ **Antes de publicar debes haber completado el paso 3** (fotos). Sin fotos la publicación falla a propósito con el mensaje *"ningún jugador tiene imagen"*, para no subir un sitio vacío.

1. Entra a https://vercel.com y elige **Sign Up / Continue with GitHub**.
2. **Add New… → Project** → busca `onepixel` → **Import**. (Si no aparece, Vercel te pedirá permiso para ver tus repositorios de GitHub.)
3. En *Framework Preset* deja **Other**. No cambies *Build Command* ni *Output Directory*: el archivo `vercel.json` ya los define (`npm run build` y la carpeta `public`).
4. Pulsa **Deploy** y espera 1–2 minutos.
5. Vercel te dará una dirección como `https://onepixel-xxxx.vercel.app`. En **Settings → Domains** puedes cambiarla por otra libre (ej. `futblur.vercel.app`) o conectar un dominio propio.
6. **Actualiza la URL en la configuración** (`SITE_URL`, ver sección 7), haz commit y push. Esa URL es la que aparece en el texto para compartir.

## 7. Configuración (un solo archivo)

Todo se ajusta en **`public/js/config.js`**. Puedes editarlo directamente en GitHub (abre el archivo → ícono del lápiz → cambia → **Commit changes**) y Vercel publicará el cambio solo.

| Opción | Qué hace | Valor actual |
|---|---|---|
| `SITE_NAME` | Nombre del juego | `"onepixel"` |
| `SITE_URL` | URL pública (va en el texto para compartir) | `"https://futblur.vercel.app"` (provisoria) |
| `DAILY_EPOCH` | Día del reto **#1** (formato AAAA-MM-DD) | `"2026-08-01"` |
| `TIMEZONE` | Zona horaria del cambio de reto | `"America/Santiago"` |
| `BLUR_LEVELS` | Blur de cada intento (px sobre 400 px de ancho) | `[25, 18, 10, 5, 2, 0]` |
| `ADS.ENABLED` | Activar publicidad (cuando tengas proveedor aprobado) | `false` |
| `ADS.SHOW_PLACEHOLDERS` | Mostrar recuadros de prueba en el sitio publicado | `false` |
| `ADS.SLOTS` | Altura reservada de los banners | 50/100 px celular, 90 px computador |
| `CONSENT_BANNER` | Aviso de cookies simple (**no** es una plataforma certificada) | `false` |
| `SUPPORT_URL` / `SUPPORT_LABEL` | Enlace de apoyo (Mercado Pago u otro). Vacío = no aparece | `""` |
| `CONTACT_EMAIL` | Correo para privacidad y retiro de fotos | `""` (pendiente) |
| `CREDIT_MODE` | Crédito de la foto durante la ronda: `"durante"`, `"durante-sin-enlace"` o `"al-final"` | `"durante"` (provisorio) |
| `CATEGORIES` | Nombre, emoji y descripción de las 4 categorías | — |

> Cambiar jugadores o `DAILY_EPOCH` **cambia el reto del día**. Hazlo de madrugada (hora de Chile) para no afectar a quien ya jugó.

### Activar publicidad (cuando te aprueben)

1. `ADS.ENABLED: true` en `config.js`.
2. Pega el código del proveedor donde lo indica `public/js/ads.js` (los espacios `top` y `bottom` ya tienen su altura reservada).
3. Si tienes visitas de Europa, Reino Unido o Suiza, usa una plataforma de consentimiento **certificada por Google** (ver página de privacidad).
4. Actualiza `public/privacidad.html` si cambia algo.

## 8. Agregar o corregir jugadores

Los datos están en `data/` (un archivo por categoría). Cada jugador:

```json
{
  "id": "marcelo-salas",
  "nombre": "Marcelo Salas",
  "alias": ["El Matador", "Matador Salas", "Salas"],
  "categorias": ["mundiales"],
  "era": "historico",
  "pais": "Chile",
  "posicion": "Delantero",
  "pistas": ["Pista más difícil", "Pista media", "Pista más fácil"],
  "wikipedia_en": "Marcelo Salas",
  "wikidata_id": null,
  "imagen": null
}
```

- `id`: minúsculas, números y guiones; único.
- `alias`: otras formas aceptadas de escribir el nombre (no importan tildes ni mayúsculas).
- `era`: `"historico"` o `"actual"`.
- `pistas`: 2 o 3, de más difícil a más fácil. **No pueden contener el nombre ni los alias** (la compilación lo revisa).
- `wikipedia_en`: título **exacto** del artículo en la Wikipedia en inglés (lo que aparece en la URL `en.wikipedia.org/wiki/...`, con espacios en vez de `_`). Si un jugador quedó mal identificado, corrige este título o escribe directamente su `wikidata_id` (ej. `"Q12345"`, visible en la página de Wikidata del jugador).
- `wikidata_id` e `imagen`: los completa el script. No los escribas a mano (salvo `wikidata_id` para corregir).
- Si el jugador está en varias categorías, debe estar **igual** en cada archivo, con todas sus categorías en `categorias`.

Después de agregar o corregir, descarga solo su foto:

```bash
npm run images -- --solo=marcelo-salas
```

## 9. Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (primera vez) |
| `npm run images` | Descarga fotos y genera `reports/imagenes.md` (agrega `-- --force` para reprocesar todo) |
| `npm run dev` | Prueba local en http://localhost:5173 (con siluetas y recuadros de prueba) |
| `npm run build` | Compila como en Vercel (falla si no hay fotos) |
| `npm test` | Ejecuta los tests (normalización de nombres, puntuación, reto diario, licencias) |

## 10. Problemas frecuentes

| Problema | Solución |
|---|---|
| `npm: command not found` / "no se reconoce" | Node.js no está instalado o falta reiniciar la terminal. |
| La publicación en Vercel falla con *"ningún jugador tiene imagen"* | Falta el paso 3 (fotos) o no se hizo push de `public/img/p`, `data` y `reports`. |
| El script dice "Wikimedia pide esperar (429)" muchas veces | Es un límite de Wikimedia. Espera unos minutos y vuelve a ejecutarlo; continúa donde quedó. |
| Abrí `index.html` con doble clic y no funciona | Debe abrirse con `npm run dev` (los navegadores bloquean los módulos JavaScript sin servidor). |
| Quiero empezar de cero mis estadísticas | En el navegador: configuración del sitio → borrar datos. |

## 11. Antes de lanzar: lista de control

- [ ] Fotos descargadas y `reports/imagenes.md` revisado (≥ 30 jugadores con foto por categoría).
- [ ] Pistas revisadas (pueden tener errores; las marcadas en las notas de desarrollo son prioritarias).
- [ ] `SITE_URL` con la URL real de Vercel.
- [ ] `DAILY_EPOCH` decidido (¿reto #1 = 1 de agosto de 2026 o el día de lanzamiento?).
- [ ] `CREDIT_MODE` elegido.
- [ ] `CONTACT_EMAIL` completado (lo exigen las páginas de privacidad y aviso legal).
- [ ] Nombre "onepixel" buscado en el registro de marcas (INAPI) y en Google.
- [ ] Revisión legal de privacidad y aviso legal **(los textos incluidos son plantillas, no asesoría legal)**.

---

**Aviso:** juego de aficionados sin afiliación con FIFA, UEFA, CONMEBOL ni la Premier League. Fotos de Wikimedia Commons bajo licencias libres (ver `creditos.html` en el sitio).
