-- =============================================================================
-- 0001 · BASE: la tabla `reports` tal como ya existe en producción
-- =============================================================================
-- Esta migración NO crea nada nuevo. Declara el estado actual de la base, que
-- hasta ahora se había creado a mano en el dashboard y no estaba versionado.
--
-- Es idempotente a propósito (IF NOT EXISTS en todo): al aplicarla sobre la
-- base real no toca las filas que ya hay, y sobre una base vacía la reconstruye
-- igual. Desde aquí en adelante, todo cambio pasa por una migración.
--
-- RLS se activa en la migración 0004, no aquí: `reports` todavía no tiene
-- columna de dueño, así que cerrarla ahora dejaría el mapa sin datos.
-- =============================================================================

create table if not exists public.reports (
    id           uuid primary key,
    created_at   timestamptz not null default now(),

    -- Cuándo pasó el robo. Puede diferir de created_at: a la víctima del
    -- cosquilleo en TransMilenio le robaron el celular y reporta desde la casa.
    occurred_at  timestamptz not null,

    -- Hora final, solo cuando no se sabe el momento exacto (la moto parqueada
    -- entre las 6am y las 2pm). Su peso se reparte entre las franjas horarias.
    occurred_end timestamptz,

    lat          double precision not null,
    lng          double precision not null,

    -- Derivadas del GPS en el servidor. Nunca se aceptan del cliente.
    locality     text,
    locality_id  integer,

    -- celular | moto | carro | bici | vivienda | transmilenio | otro
    -- NULL = reporte incompleto: tocó el botón y cerró la app. Cuenta a media
    -- fuerza hasta que lo complete con calma.
    type         text,

    station      text,
    description  text,

    -- 'exact' | 'approx'. Los robos a vivienda se guardan difuminados a una
    -- rejilla de ~330 m: nadie debe poder leer en el mapa dónde vive una víctima.
    precision    text not null default 'exact',

    -- uuid de localStorage. NO es autenticación. Queda por compatibilidad con
    -- las filas anteriores al login; deja de ser credencial en la 0004.
    device_hash  text not null,

    status       text not null default 'active'
);

-- Consulta principal: reportes activos recientes de una localidad.
create index if not exists reports_locality_time_idx
    on public.reports (locality_id, occurred_at desc)
    where status = 'active';

-- Límite diario por dispositivo (mientras exista el flujo anónimo).
create index if not exists reports_device_idx
    on public.reports (device_hash, created_at desc);

-- Capa del mapa: todo lo activo de los últimos días.
create index if not exists reports_active_time_idx
    on public.reports (occurred_at desc)
    where status = 'active';

comment on table public.reports is
    'Reportes ciudadanos de robo. Datos personales: se cierra con RLS en la migración 0004 y se expone al público solo a través de la vista public_reports.';
