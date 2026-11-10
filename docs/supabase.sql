-- Ranking diario de onepixel en Supabase.
-- Pégalo en Supabase → SQL Editor → New query → Run.
--
-- Seguridad: la clave "publishable" va en el navegador y es pública. Lo que protege la tabla
-- son estas reglas (RLS): cualquiera puede LEER el ranking y AGREGAR un puntaje con valores
-- válidos para hoy o ayer, pero nadie puede modificar ni borrar filas desde el sitio.
-- Limitación: sin cuentas de usuario no se puede impedir del todo un puntaje falso (alguien con
-- conocimientos técnicos podría enviar 1800 sin jugar). Para un juego casual suele bastar.

create table if not exists public.puntajes_diarios (
  id          bigint generated always as identity primary key,
  fecha       date        not null,
  categoria   text        not null check (categoria ~ '^[a-z]{3,20}$'),
  apodo       text        not null check (char_length(apodo) between 2 and 16),
  puntaje     integer     not null check (puntaje between 0 and 1800),
  aciertos    integer     not null check (aciertos between 0 and 3),
  intentos    integer     not null check (intentos between 1 and 18),
  dispositivo text        not null check (char_length(dispositivo) between 8 and 64),
  creado      timestamptz not null default now(),
  unique (fecha, categoria, dispositivo)           -- un envío por navegador, día y categoría
);

create index if not exists puntajes_diarios_top on public.puntajes_diarios (fecha, categoria, puntaje desc);

alter table public.puntajes_diarios enable row level security;

-- Leer: todos
create policy "leer ranking" on public.puntajes_diarios
  for select to anon, authenticated
  using (true);

-- Agregar: solo puntajes del día actual (o el anterior, por el cambio de hora) en Chile
create policy "agregar puntaje del dia" on public.puntajes_diarios
  for insert to anon, authenticated
  with check (
    fecha between (now() at time zone 'America/Santiago')::date - 1
              and (now() at time zone 'America/Santiago')::date
  );

-- No se crean reglas de UPDATE ni DELETE: desde el sitio no se puede modificar ni borrar.
-- Tú sí puedes borrar apodos ofensivos desde el panel de Supabase (Table Editor).
