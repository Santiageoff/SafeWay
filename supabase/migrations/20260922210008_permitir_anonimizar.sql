-- =============================================================================
-- 0008 · Quitar la restricción que impedía borrar una cuenta
-- =============================================================================
-- BUG introducido en la migración 0006. Allí se añadió:
--
--     check (user_id is not null or device_hash is not null)
--
-- con la idea de que todo reporte tuviera un origen. El efecto real fue otro:
-- al borrar una cuenta, el `on delete set null` del user_id intenta anonimizar
-- los reportes de esa persona, se queda con user_id nulo y device_hash nulo
-- (los reportes nuevos ya no lo llevan), y la restricción lo rechaza. Resultado:
-- "Database error deleting user". Nadie podía darse de baja.
--
-- Eso no es un detalle: el derecho de supresión es una obligación de la Ley
-- 1581 de 2012, y estaba roto.
--
-- La restricción además sobraba. Que un reporte nuevo tenga dueño ya lo
-- garantiza la política de RLS de inserción:
--
--     with check (auth.uid() = user_id)
--
-- Nadie puede insertar sin sesión, y quien inserta solo puede hacerlo a su
-- propio nombre. La única vía para crear un reporte sin dueño es service_role,
-- que es el propio backend y lo hace a propósito (las filas anteriores al login).
--
-- Un user_id nulo pasa así a significar exactamente una cosa: reporte
-- anonimizado, sea porque es anterior al login o porque su autor se dio de baja.
-- =============================================================================

alter table public.reports drop constraint if exists reports_tiene_origen;

comment on column public.reports.user_id is
    'Dueno del reporte. NULL = anonimizado: o es anterior al login, o su autor borro la cuenta. El hecho se conserva porque otras personas deciden su ruta con el; el vinculo con la persona, que es el dato personal, desaparece.';
