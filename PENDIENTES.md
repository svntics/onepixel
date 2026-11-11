# Pendientes de onepixel

Lista de cosas por hacer. Se actualiza cada vez que algo se completa o se agrega.

## Por hacer tú (Ignacio)

- [ ] **Entrenadores (50):** revisar la lista en el documento editable y escribir «apruebo entrenadores».
  - Ojo con los 9 marcados «revisa su pista de cargo actual» (Arteta, Xabi Alonso, Flick, Tuchel, Gallardo, Nagelsmann, Pochettino, Amorim, Kompany): pueden estar desactualizados.
- [ ] **Entrenadores: descargar fotos** desde tu computador (GitHub Desktop: Fetch + Pull antes; Commit + Push después):
  - `set "CONTACTO=https://github.com/svntics/onepixel"`
  - `npm run images`
- [x] 4 Fotos 1 Equipo · Premier aprobada el 2026-11-11.
- [x] 4 Fotos 1 Equipo: fotos de la Premier completas (57 de Commons, 2 recortadas, 3 ilustraciones con IA hechas en Gemini).
- [x] 4 Fotos 1 Equipo: los equipos los elige Ignacio en el documento «4 Fotos 1 Equipo — Lista de equipos».
- [x] 4 Fotos 1 Equipo: pistas de 42 clubes nuevos aprobadas (2026-11-11).
- [ ] **4 Fotos 1 Equipo: volver a correr `npm run team-images`** (Fetch + Pull ANTES; Commit + Push después). Debe decir «Fotos a buscar: 15». Después Claude revisa las fotos. Hoy hay 46 equipos jugables de 62.
- [ ] **4 Fotos 1 Equipo: generar 5 ilustraciones en Gemini** (Juventus 2, Milan 3, River 3, Independiente 2, Al Nassr 2). Los prompts están en `data/4fotos/*.json` (campo `ia_prompt`): pídeselos a Claude. Descargarlas con el botón ⬇ y mandarlas en `.webp` (las `.png` llegan achicadas a 160×160). Ya están: Barcelona, Atlético, Villarreal, Leverkusen y Católica.
- [ ] **Liga española (79):** revisar y escribir «apruebo la Liga española».
- [ ] **NBA (32):** revisar y escribir «apruebo la NBA».
- [ ] **Fotos de jugadores faltantes** (unos 96 sin imagen): el mismo `npm run images` de arriba las descarga todas de una vez.

## Por hacer Claude (después de lo anterior)

- [ ] Entrenadores: activar la categoría con fecha y probar una partida real en el navegador (Reto diario, Práctica y 1v1).
- [ ] Poner fecha de publicación a los jugadores aprobados que reciban foto.
- [ ] Liga italiana: está programada para el 2026-11-12 pero solo 20 de 57 tienen foto; decidir si se posterga.
- [ ] Fotos de época: 24 jugadores históricos tienen una foto que no es de su época; hay candidatas en `reports/fotos-epoca.html` por elegir (ej. Baggio en Italia '90).

- [x] 4 Fotos 1 Equipo: Premier y tarjeta de la portada activadas y probadas con fotos reales (2026-11-11).
- [ ] 4 Fotos 1 Equipo (opcional): las secciones «Equipos de Champions» y «Campeones históricos» del documento siguen vacías.

## Dudas abiertas

- Gabriel Magalhães vs. Gabriel Jesus; Shaqiri; si Hincapié jugó en la Premier.
- Pistas de Shai Gilgeous-Alexander (datos de 2025).
- Pistas de Sidny Lopes Cabral, Vozinha, Yeste, Javi Fuego y Pablo Alfaro.
