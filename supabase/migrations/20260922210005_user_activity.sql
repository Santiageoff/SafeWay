-- =============================================================================
-- 0005 · Datos de usuario: consentimiento, historial, rutas habituales, alertas
-- =============================================================================
-- Modelo de datos para las alertas proactivas y el aprendizaje de patrones.
-- En esta fase NO se implementa el motor de alertas: queda el modelo y el
-- registro del historial.
--
-- Dos principios que atraviesan todo el archivo:
--
--   MINIMIZACIÓN. El historial guarda LOCALIDADES, no coordenadas. Para
--   detectar "sale de Suba hacia Chapinero los martes a las 7am" no hace falta
--   saber la dirección de nadie. No se guarda ubicación en tiempo real.
--
--   CONSENTIMIENTO VERIFICABLE (Ley 1581 de 2012). No basta con un botón en la
--   interfaz: la base de datos RECHAZA guardar historial si no hay
--   consentimiento vigente. La ley se cumple abajo, no solo arriba.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Consentimiento
-- -----------------------------------------------------------------------------
-- Registro de solo-añadir. Si al revocar se sobreescribiera la fila, se
-- perdería la prueba de que alguna vez se consintió, que es justo lo que la
-- ley exige poder demostrar. Revocar no borra: añade una fila con granted=false.
create table if not exists public.data_consents (
    id             bigint generated always as identity primary key,
    user_id        uuid not null references auth.users(id) on delete cascade,

    purpose        text not null check (purpose in ('route_history', 'habitual_routes', 'alerts')),
    granted        boolean not null,

    -- Versión del aviso de privacidad que la persona aceptó. Si cambia la
    -- política, se puede saber quién aceptó cuál.
    policy_version text not null default '1.0',
    created_at     timestamptz not null default now()
);

create index if not exists data_consents_lookup_idx
    on public.data_consents (user_id, purpose, created_at desc);

comment on table public.data_consents is
    'Registro de solo-anadir del consentimiento (Ley 1581). El estado vigente es la ultima fila por usuario y proposito.';

-- Estado vigente de un consentimiento. STABLE y SECURITY DEFINER para poder
-- usarla dentro de las políticas de RLS de las tablas de abajo.
create or replace function public.has_consent(p_user uuid, p_purpose text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
    select coalesce((
        select c.granted
        from public.data_consents c
        where c.user_id = p_user
          and c.purpose = p_purpose
        order by c.created_at desc, c.id desc
        limit 1
    ), false);
$fn$;

comment on function public.has_consent(uuid, text) is
    'true si la ultima decision del usuario sobre ese proposito fue otorgar. Por defecto false: sin decision explicita, no hay consentimiento.';

alter table public.data_consents enable row level security;

drop policy if exists "consents_select_own" on public.data_consents;
create policy "consents_select_own"
    on public.data_consents for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "consents_insert_own" on public.data_consents;
create policy "consents_insert_own"
    on public.data_consents for insert
    to authenticated
    with check (auth.uid() = user_id);

-- Sin políticas de UPDATE ni DELETE: eso es lo que hace la tabla inmodificable.
-- Ni el propio usuario puede reescribir su historial de consentimientos, que es
-- precisamente lo que le da valor probatorio.

revoke all on public.data_consents from anon;
grant select, insert on public.data_consents to authenticated;

-- -----------------------------------------------------------------------------
-- Historial de consultas de ruta
-- -----------------------------------------------------------------------------
create table if not exists public.route_queries (
    id                      bigint generated always as identity primary key,
    user_id                 uuid not null references auth.users(id) on delete cascade,

    -- Localidades, NO coordenadas. Minimización por diseño.
    origin_locality_id      integer references public.localities(id),
    destination_locality_id integer references public.localities(id),

    vehicle_type            text not null check (vehicle_type in ('carro', 'moto', 'bici', 'peatón', 'publico')),

    -- Resultado que se le mostró, para poder medir después si la alerta
    -- habría servido de algo.
    risk_level              text check (risk_level in ('low', 'medium', 'high')),

    queried_at              timestamptz not null default now()
);

create index if not exists route_queries_user_time_idx
    on public.route_queries (user_id, queried_at desc);

-- Índice del detector de patrones: qué rutas repite esta persona.
create index if not exists route_queries_pattern_idx
    on public.route_queries (user_id, origin_locality_id, destination_locality_id, vehicle_type);

comment on table public.route_queries is
    'Historial de consultas. Solo localidades y hora, nunca coordenadas ni ubicacion en tiempo real. Requiere consentimiento vigente para escribir.';

alter table public.route_queries enable row level security;

drop policy if exists "route_queries_select_own" on public.route_queries;
create policy "route_queries_select_own"
    on public.route_queries for select
    to authenticated
    using (auth.uid() = user_id);

-- AQUÍ SE CUMPLE LA LEY 1581 EN LA BASE DE DATOS: sin consentimiento vigente el
-- INSERT se rechaza, aunque el backend tenga un bug y lo intente igual.
drop policy if exists "route_queries_insert_with_consent" on public.route_queries;
create policy "route_queries_insert_with_consent"
    on public.route_queries for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and public.has_consent(auth.uid(), 'route_history')
    );

-- Derecho de supresión: puede borrar su historial cuando quiera.
drop policy if exists "route_queries_delete_own" on public.route_queries;
create policy "route_queries_delete_own"
    on public.route_queries for delete
    to authenticated
    using (auth.uid() = user_id);

-- Sin UPDATE: un historial que se puede editar no es un historial.

revoke all on public.route_queries from anon;
grant select, insert, delete on public.route_queries to authenticated;

-- -----------------------------------------------------------------------------
-- Rutas habituales detectadas
-- -----------------------------------------------------------------------------
create table if not exists public.habitual_routes (
    id                      bigint generated always as identity primary key,
    user_id                 uuid not null references auth.users(id) on delete cascade,

    origin_locality_id      integer not null references public.localities(id),
    destination_locality_id integer not null references public.localities(id),
    vehicle_type            text not null check (vehicle_type in ('carro', 'moto', 'bici', 'peatón', 'publico')),

    -- Franja horaria, no la hora exacta: otra vez, lo mínimo para detectar el
    -- patrón sin saber a qué minuto sale de su casa.
    time_window             text not null check (time_window in ('madrugada', 'mañana', 'tarde', 'noche')),

    -- Días de la semana: 0 = domingo ... 6 = sábado
    days_of_week            smallint[] not null default '{}',

    -- 0 a 1. Cuántas veces se repitió el patrón frente a cuántas pudo repetirse.
    confidence              numeric(3,2) not null default 0 check (confidence between 0 and 1),

    detected_at             timestamptz not null default now(),
    last_seen_at            timestamptz not null default now(),
    active                  boolean not null default true,

    unique (user_id, origin_locality_id, destination_locality_id, vehicle_type, time_window)
);

create index if not exists habitual_routes_user_idx
    on public.habitual_routes (user_id) where active;

comment on table public.habitual_routes is
    'Patrones de movilidad deducidos del historial. Los detecta el backend; el motor de alertas que los consumira es trabajo posterior.';

alter table public.habitual_routes enable row level security;

drop policy if exists "habitual_routes_select_own" on public.habitual_routes;
create policy "habitual_routes_select_own"
    on public.habitual_routes for select
    to authenticated
    using (auth.uid() = user_id);

-- Puede desactivar o borrar una ruta detectada que no le representa.
drop policy if exists "habitual_routes_update_own" on public.habitual_routes;
create policy "habitual_routes_update_own"
    on public.habitual_routes for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "habitual_routes_delete_own" on public.habitual_routes;
create policy "habitual_routes_delete_own"
    on public.habitual_routes for delete
    to authenticated
    using (auth.uid() = user_id);

-- Sin política de INSERT para el usuario: las rutas habituales las DETECTA el
-- backend con service_role a partir del historial. No es algo que se escriba a
-- mano desde el navegador.

revoke all on public.habitual_routes from anon;
grant select, update, delete on public.habitual_routes to authenticated;

-- -----------------------------------------------------------------------------
-- Preferencias de alertas
-- -----------------------------------------------------------------------------
create table if not exists public.alert_preferences (
    user_id           uuid primary key references auth.users(id) on delete cascade,

    -- Desactivadas por defecto. Nadie recibe alertas por haberse registrado:
    -- hay que pedirlas.
    alerts_enabled    boolean not null default false,

    min_risk_level    text not null default 'high' check (min_risk_level in ('medium', 'high')),

    -- Horas de silencio, en hora de Bogotá. Avisar a las 3am de que una zona
    -- está peligrosa no le sirve a nadie que esté durmiendo.
    quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
    quiet_hours_end   smallint check (quiet_hours_end between 0 and 23),

    updated_at        timestamptz not null default now()
);

comment on table public.alert_preferences is
    'Una fila por usuario. Las alertas nacen apagadas: hay que activarlas a proposito.';

alter table public.alert_preferences enable row level security;

drop policy if exists "alert_prefs_select_own" on public.alert_preferences;
create policy "alert_prefs_select_own"
    on public.alert_preferences for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "alert_prefs_insert_own" on public.alert_preferences;
create policy "alert_prefs_insert_own"
    on public.alert_preferences for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "alert_prefs_update_own" on public.alert_preferences;
create policy "alert_prefs_update_own"
    on public.alert_preferences for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "alert_prefs_delete_own" on public.alert_preferences;
create policy "alert_prefs_delete_own"
    on public.alert_preferences for delete
    to authenticated
    using (auth.uid() = user_id);

revoke all on public.alert_preferences from anon;
grant select, insert, update, delete on public.alert_preferences to authenticated;
