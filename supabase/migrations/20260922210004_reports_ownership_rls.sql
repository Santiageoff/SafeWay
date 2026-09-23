-- =============================================================================
-- 0004 · `reports` pasa a tener dueño y se cierra con RLS
-- =============================================================================
-- AQUÍ SE CIERRA EL AGUJERO CRÍTICO DE LA AUDITORÍA.
--
-- Antes de esta migración, cualquiera con la llave publicable (que es pública
-- por diseño) podía leer, insertar, modificar y BORRAR toda la tabla. Un solo
-- DELETE vaciaba los reportes. Además, todas las defensas del backend —límite
-- de 5 al día, validación de GPS, difuminado de robos a vivienda, ventana de
-- 30s para deshacer— se saltaban escribiendo directo contra PostgREST.
--
-- Las tres cosas van juntas en una sola migración, a propósito: si se aplicaran
-- por separado y una fallara, el mapa quedaría vacío o la tabla abierta.
--   1. columna de dueño
--   2. vista pública sanitizada (para que el mapa siga funcionando)
--   3. RLS + políticas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dueño
-- -----------------------------------------------------------------------------
alter table public.reports
    add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists reports_user_idx
    on public.reports (user_id, created_at desc);

comment on column public.reports.user_id is
    'Dueño del reporte. NULL en las filas anteriores al login: se conservan y siguen viéndose en el mapa, pero nadie puede editarlas desde la app.';

-- ON DELETE SET NULL, no CASCADE: si alguien borra su cuenta, sus reportes se
-- anonimizan en vez de desaparecer. Se elimina el vínculo con la persona (que
-- es el dato personal) y se conserva el hecho de que hubo un robo ahí, que es
-- información de interés público y de la que dependen otras personas para
-- decidir su ruta.

-- -----------------------------------------------------------------------------
-- 2. Vista pública sanitizada
-- -----------------------------------------------------------------------------
-- El mapa debe seguir mostrando los puntos SIEMPRE, con o sin sesión: la gente
-- toma decisiones de ruta con lo que ve ahí. Pero la tabla cruda contiene datos
-- personales, así que esta vista expone solo lo que el mapa necesita.
--
-- Deliberadamente NO se exponen:
--   · user_id      -> a quién le pasó
--   · device_hash  -> identificador estable; cruzado con coordenadas y hora,
--                     reidentifica a la persona
--   · description  -> texto libre, puede contener datos de terceros
--
-- NOTA para el Security Advisor de Supabase: esta vista es SECURITY DEFINER
-- (el comportamiento por defecto) de forma intencionada. Es justo lo que
-- permite que un anónimo vea el mapa sin darle acceso a la tabla protegida.
-- El advisor la va a marcar; es un falso positivo asumido y documentado.

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
    r.created_at
from public.reports r
where r.status = 'active';

comment on view public.public_reports is
    'Cara pública de los reportes: sin user_id, sin device_hash y sin descripción. Es lo único que un anónimo puede leer.';

grant select on public.public_reports to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. RLS y políticas
-- -----------------------------------------------------------------------------
alter table public.reports enable row level security;

-- IMPORTANTE: no se usa FORCE ROW LEVEL SECURITY. Si se forzara, la vista de
-- arriba dejaría de poder leer la tabla y el mapa se quedaría vacío.

-- Leer: solo los propios. Lo demás se ve por la vista pública.
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
    on public.reports for select
    to authenticated
    using (auth.uid() = user_id);

-- Crear: solo con sesión, y solo a nombre propio. `with check` impide que
-- alguien inserte un reporte poniendo el user_id de otra persona.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
    on public.reports for insert
    to authenticated
    with check (auth.uid() = user_id);

-- Editar: solo los propios, y sin poder regalárselos a otro (el with check
-- vuelve a validar el user_id DESPUÉS del cambio).
drop policy if exists "reports_update_own" on public.reports;
create policy "reports_update_own"
    on public.reports for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Borrar: solo los propios. Es también el derecho de supresión de la Ley 1581.
drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own"
    on public.reports for delete
    to authenticated
    using (auth.uid() = user_id);

-- Un anónimo pierde TODO acceso directo a la tabla. Solo le queda la vista.
revoke all on public.reports from anon;
grant select, insert, update, delete on public.reports to authenticated;

-- El device_hash deja de ser credencial: ya no autoriza nada, porque quien
-- autoriza ahora es el JWT. Se conserva la columna para no perder el dato de
-- las filas antiguas.
comment on column public.reports.device_hash is
    'Histórico. Antes del login era la unica credencial, y era suplantable. Ya no autoriza nada.';
