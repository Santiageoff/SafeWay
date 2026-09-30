-- =============================================================================
-- Alertas proactivas (issue #8 · IV.A y Anexo A 4.4 del documento)
-- =============================================================================
-- "El sistema aprende su patrón de movilidad y le anticipa una alerta cuando
-- cambia el nivel de riesgo de una zona que frecuenta."
--
-- La 0005 dejó el historial (route_queries), las rutas habituales y las
-- preferencias. Aquí se agrega lo que faltaba para el motor:
--   1. El último nivel conocido de cada ruta habitual, para saber si CAMBIÓ.
--   2. La tabla de alertas generadas.
--
-- Mismos principios que la 0005: solo localidades (nunca coordenadas), y el
-- consentimiento se verifica en la base, no solo en la interfaz.
-- =============================================================================

alter table public.habitual_routes
    add column if not exists last_risk_level text
        check (last_risk_level in ('low', 'medium', 'high')),
    add column if not exists last_evaluated_at timestamptz;

comment on column public.habitual_routes.last_risk_level is
    'Nivel de la ruta en la ultima evaluacion del motor. Una alerta nace cuando el nivel actual sube respecto a este.';

create table if not exists public.risk_alerts (
    id                 bigint generated always as identity primary key,
    user_id            uuid not null references auth.users(id) on delete cascade,
    habitual_route_id  bigint not null references public.habitual_routes(id) on delete cascade,

    previous_level     text not null check (previous_level in ('low', 'medium', 'high')),
    new_level          text not null check (new_level in ('low', 'medium', 'high')),

    -- Nombres de las localidades del trayecto que están en el nivel nuevo:
    -- es lo que se le explica a la persona ("subió por Kennedy").
    zones              text[] not null default '{}',

    created_at         timestamptz not null default now(),
    -- null = no la ha visto. La interfaz la marca al mostrarla.
    seen_at            timestamptz
);

create index if not exists risk_alerts_user_idx
    on public.risk_alerts (user_id, created_at desc);

comment on table public.risk_alerts is
    'Alertas proactivas: el nivel de una ruta habitual subio. Las crea el backend (service_role) solo con consentimiento de alertas vigente y alertas activadas.';

alter table public.risk_alerts enable row level security;

drop policy if exists "risk_alerts_select_own" on public.risk_alerts;
create policy "risk_alerts_select_own"
    on public.risk_alerts for select
    to authenticated
    using (auth.uid() = user_id);

-- Solo puede marcarla como vista: el permiso de UPDATE se da únicamente
-- sobre la columna seen_at (grant de abajo).
drop policy if exists "risk_alerts_update_own" on public.risk_alerts;
create policy "risk_alerts_update_own"
    on public.risk_alerts for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "risk_alerts_delete_own" on public.risk_alerts;
create policy "risk_alerts_delete_own"
    on public.risk_alerts for delete
    to authenticated
    using (auth.uid() = user_id);

-- Sin política de INSERT: las alertas las crea el motor en el backend.
revoke all on public.risk_alerts from anon, authenticated;
grant select, delete on public.risk_alerts to authenticated;
grant update (seen_at) on public.risk_alerts to authenticated;
