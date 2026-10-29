-- =============================================================================
-- Vistas públicas sin SECURITY DEFINER (Security Advisor de Supabase)
-- =============================================================================
-- PROBLEMA: public.public_reports y public.transit_incident_counts eran vistas
-- normales, y en Postgres una vista corre con los permisos de su DUEÑO
-- (postgres), no de quien consulta: se salta RLS. El Advisor lo marca como
-- crítico porque cualquier columna o fila que se agregue a la vista por error
-- queda expuesta a anónimos sin que RLS pueda impedirlo.
--
-- Aquí ese salto de RLS era A PROPÓSITO: la capa pública del mapa necesita ver
-- los reportes de todos, pero SOLO las columnas seguras (sin user_id, sin
-- device_hash, sin description). Cambiar la vista a security_invoker sin más
-- dejaba el mapa sin reportes, porque RLS solo deja ver los propios.
--
-- SOLUCIÓN: el salto de RLS se mueve a UNA función, explícita y auditable:
--   · private.reportes_publicos() es SECURITY DEFINER, con search_path vacío
--     (nadie puede secuestrarla creando tablas con el mismo nombre) y devuelve
--     exactamente las columnas seguras. Vive en el esquema `private`, que la
--     API (PostgREST) no expone: no se puede llamar directo desde internet.
--   · las vistas públicas pasan a security_invoker = true y leen de esa
--     función. El backend sigue consultando las mismas vistas con los mismos
--     filtros: no cambia ni una línea de código.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

drop view if exists public.transit_incident_counts;
drop view if exists public.public_reports;

create or replace function private.reportes_publicos()
returns table (
    id           uuid,
    occurred_at  timestamptz,
    occurred_end timestamptz,
    lat          double precision,
    lng          double precision,
    locality     text,
    locality_id  integer,
    type         text,
    station      text,
    "precision"  text,
    created_at   timestamptz,
    source_token text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        r.id,
        r.occurred_at,
        r.occurred_end,
        r.lat,
        r.lng,
        r.locality,
        r.locality_id,
        r.type,
        r.station,
        r.precision,
        r.created_at,
        -- Igual que en la 0007: distingue orígenes dentro de un mismo día y
        -- localidad, nunca sirve para seguir a una persona.
        md5(
            coalesce(r.user_id::text, r.device_hash, r.id::text)
            || '|' || (r.occurred_at at time zone 'America/Bogota')::date::text
            || '|' || coalesce(r.locality_id::text, 'sin-localidad')
        )
    from public.reports r
    where r.status = 'active'
$$;

comment on function private.reportes_publicos() is
    'Única puerta para leer reportes ajenos: solo columnas seguras (sin user_id, device_hash ni description). SECURITY DEFINER a propósito; la usan las vistas public_reports y transit_incident_counts.';

revoke all on function private.reportes_publicos() from public;
grant execute on function private.reportes_publicos() to anon, authenticated;

create view public.public_reports
with (security_invoker = true) as
select * from private.reportes_publicos();

comment on view public.public_reports is
    'Cara publica de los reportes: sin user_id, sin device_hash y sin description. Corre con los permisos de quien consulta (security_invoker); las filas salen de private.reportes_publicos().';

create view public.transit_incident_counts
with (security_invoker = true) as
select
    locality_id,
    count(*)::integer as count,
    max(occurred_at) as ultimo_reporte
from public.public_reports
where type = 'transmilenio'
  and locality_id is not null
group by locality_id;

comment on view public.transit_incident_counts is
    'Hurtos en TransMilenio/SITP por localidad, a partir de los reportes ciudadanos (CR-001). security_invoker: lee de public_reports.';

revoke all on public.public_reports, public.transit_incident_counts from anon, authenticated;
grant select on public.public_reports, public.transit_incident_counts to anon, authenticated;
