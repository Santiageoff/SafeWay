-- =============================================================================
-- Indicadores del análisis de rutas (issue #7 · III.F del documento · 5.3)
-- =============================================================================
-- Una fila por cada análisis de ruta, para medir:
--   (i)   % de rutas que evitan zonas de riesgo alto
--   (ii)  tiempo de respuesta del análisis (p50 / p90)
--   (iii) % de consultas que cargan datos reales de Supabase frente al respaldo
--
-- SIN DATOS PERSONALES (Ley 1581): se guarda la LOCALIDAD de origen y destino,
-- nunca coordenadas, IP ni user_id. Con esto no se puede reconstruir el
-- recorrido de nadie; solo se pueden contar cosas.
-- =============================================================================

create table if not exists public.route_metrics (
    id                   bigint generated always as identity primary key,
    created_at           timestamptz not null default now(),

    mode                 text not null
        check (mode in ('carro', 'moto', 'bici', 'peatón', 'publico')),
    origin_locality      text,
    destination_locality text,

    duration_ms          integer not null check (duration_ms >= 0),
    locality_source      text not null
        check (locality_source in ('supabase', 'respaldo-local')),
    route_source         text not null
        check (route_source in ('osrm', 'straight-line')),
    overall_risk         text not null
        check (overall_risk in ('low', 'medium', 'high')),

    -- true = la ruta no pasa por ninguna zona de riesgo alto para ese medio.
    evita_alto           boolean not null
);

create index if not exists route_metrics_created_at_idx
    on public.route_metrics (created_at desc);

comment on table public.route_metrics is
    'Indicadores del analisis de rutas, sin datos personales. Escribe y lee solo el backend (service_role); el publico ve el resumen agregado de GET /api/metrics/resumen.';

-- RLS activada y SIN políticas: anon y authenticated no pueden leer ni
-- escribir nada. Solo service_role (el backend), que se salta RLS.
alter table public.route_metrics enable row level security;

revoke all on public.route_metrics from anon, authenticated;
