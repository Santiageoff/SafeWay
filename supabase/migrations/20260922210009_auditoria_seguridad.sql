-- =============================================================================
-- 0009 · Vista de auditoría: el estado de RLS, consultable en cualquier momento
-- =============================================================================
-- "Ninguna tabla queda con RLS desactivado" no debería ser algo que haya que
-- creerse: debería poder comprobarse. Esta vista lo dice, y sirve para siempre,
-- no solo el día que se revisó.
--
-- Solo la puede leer service_role (el backend). Un anónimo no tiene por qué
-- saber cómo está configurada la seguridad de la base.
-- =============================================================================

create or replace view public.security_audit as
select
    c.relname                                        as tabla,
    case c.relkind when 'r' then 'tabla' when 'v' then 'vista' else c.relkind::text end as tipo,
    c.relrowsecurity                                 as rls_activada,
    c.relforcerowsecurity                            as rls_forzada,
    coalesce(p.politicas, 0)                         as politicas,
    coalesce(p.detalle, '(ninguna)')                 as detalle,

    -- El veredicto en una sola columna, para poder leerlo de un vistazo.
    case
        when c.relkind = 'v' then 'vista: hereda del origen'
        when not c.relrowsecurity then 'PELIGRO: RLS desactivada'
        when coalesce(p.politicas, 0) = 0 then 'cerrada del todo (RLS sin politicas)'
        else 'protegida'
    end                                              as veredicto

from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
    select
        pol.polrelid,
        count(*)                            as politicas,
        string_agg(pol.polname, ', ' order by pol.polname) as detalle
    from pg_policy pol
    group by pol.polrelid
) p on p.polrelid = c.oid

where n.nspname = 'public'
  and c.relkind in ('r', 'v')
order by c.relkind desc, c.relname;

comment on view public.security_audit is
    'Estado de RLS y politicas de cada tabla de public. Solo la lee service_role.';

-- Nadie mas que el backend.
revoke all on public.security_audit from anon, authenticated;
