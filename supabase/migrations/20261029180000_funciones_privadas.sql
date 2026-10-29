-- =============================================================================
-- Funciones SECURITY DEFINER fuera del alcance de la API (Security Advisor)
-- =============================================================================
-- El Advisor avisa que public.handle_new_user() y public.has_consent() se
-- pueden llamar por la API (POST /rest/v1/rpc/...), con sesión y sin ella.
--
--   · handle_new_user() solo la dispara el trigger al registrarse alguien.
--     Nadie tiene por qué ejecutarla a mano: se le quita EXECUTE a todos. El
--     trigger sigue funcionando (Postgres revisa ese permiso al crear el
--     trigger, no cada vez que se dispara).
--
--   · has_consent(usuario, propósito) la usan las políticas de RLS. Expuesta,
--     cualquiera con sesión podía preguntar por el consentimiento de OTRA
--     persona (un dato de la Ley 1581). Se mueve al esquema `private`, que la
--     API no expone; las políticas la siguen pudiendo usar.
-- =============================================================================

-- 1. handle_new_user: nadie la ejecuta a mano.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. has_consent: al esquema privado (creado en 20261029120000).
create or replace function private.has_consent(p_user uuid, p_purpose text)
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

comment on function private.has_consent(uuid, text) is
    'true si la ultima decision del usuario sobre ese proposito fue otorgar. Por defecto false. Privada: solo la usan las politicas de RLS.';

revoke all on function private.has_consent(uuid, text) from public, anon;
-- `authenticated` necesita EXECUTE porque las políticas se evalúan con su rol.
grant execute on function private.has_consent(uuid, text) to authenticated;

-- La política que la usaba pasa a la versión privada.
drop policy if exists "route_queries_insert_with_consent" on public.route_queries;
create policy "route_queries_insert_with_consent"
    on public.route_queries for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and private.has_consent(auth.uid(), 'route_history')
    );

drop function if exists public.has_consent(uuid, text);
