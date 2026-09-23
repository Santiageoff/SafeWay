-- =============================================================================
-- 0006 · `device_hash` deja de ser obligatorio
-- =============================================================================
-- Con el login, quien autoriza es el JWT. El device_hash ya no es credencial
-- de nada: era un uuid que mandaba el propio cliente y que nadie comprobaba,
-- y se podía leer de la base porque RLS estaba apagada, así que bastaba
-- conocerlo para suplantar a alguien.
--
-- No se borra la columna: las filas anteriores al login lo tienen y es su
-- único rastro de origen. Pero deja de exigirse, y el frontend deja de
-- mandarlo. Guardar un identificador estable de dispositivo cuando ya no
-- sirve para nada es acumular un dato personal sin motivo.
-- =============================================================================

alter table public.reports alter column device_hash drop not null;

-- A partir de ahora, un reporte necesita dueño. Las filas viejas se quedan
-- como están (user_id nulo, device_hash con valor); las nuevas van al revés.
-- No se pone NOT NULL en user_id para no romper esas filas históricas, así que
-- la regla se expresa como restricción: o tiene dueño, o tiene device_hash.
alter table public.reports drop constraint if exists reports_tiene_origen;
alter table public.reports add constraint reports_tiene_origen
    check (user_id is not null or device_hash is not null);

comment on constraint reports_tiene_origen on public.reports is
    'Todo reporte tiene origen: user_id en los nuevos, device_hash en los anteriores al login.';
