-- =============================================================================
-- 0007 · La vista pública gana un identificador de origen no enlazable
-- =============================================================================
-- PROBLEMA: agrupar reportes del mismo hecho ("tres testigos del mismo atraco
-- son un robo confirmado, no tres robos") necesita distinguir si dos reportes
-- vienen de personas distintas. Eso se hacía con device_hash, que la vista
-- pública ya no expone — y con razón: era un identificador estable que,
-- cruzado con coordenadas y hora, reidentificaba a la persona.
--
-- SOLUCIÓN: un token con ALCANCE LIMITADO. Se calcula sobre el origen más el
-- día y la localidad, así que:
--
--   · dentro de un mismo hecho (mismo sitio, mismos minutos), dos personas
--     distintas dan tokens distintos -> se pueden contar como confirmaciones
--   · la MISMA persona en otro día u otra localidad da un token distinto ->
--     es imposible reconstruir por dónde se mueve alguien
--
-- Es justo la información que hace falta para agrupar, y ni una pizca más.
-- =============================================================================

drop view if exists public.public_reports;
create view public.public_reports as
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

    -- Ni user_id ni device_hash salen de aquí: solo este resumen, que no
    -- sirve para nada fuera del día y la localidad en que se generó.
    md5(
        coalesce(r.user_id::text, r.device_hash, r.id::text)
        || '|' || (r.occurred_at at time zone 'America/Bogota')::date::text
        || '|' || coalesce(r.locality_id::text, 'sin-localidad')
    ) as source_token

from public.reports r
where r.status = 'active';

comment on view public.public_reports is
    'Cara publica de los reportes: sin user_id, sin device_hash y sin description. source_token solo permite distinguir origenes dentro de un mismo dia y localidad, nunca seguir a una persona.';

grant select on public.public_reports to anon, authenticated;
