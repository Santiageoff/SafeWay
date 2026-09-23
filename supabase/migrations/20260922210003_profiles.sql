-- =============================================================================
-- 0003 · Perfiles de usuario, ligados a auth.users
-- =============================================================================
-- `auth.users` es una tabla del sistema de Supabase: no se puede tocar ni
-- extender. El patrón estándar es una tabla espejo en `public` con el mismo id,
-- creada automáticamente por un trigger al registrarse.
-- =============================================================================

create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

comment on table public.profiles is
    'Perfil publico-interno de cada usuario. id = auth.uid(). Se crea solo, por trigger.';

-- -----------------------------------------------------------------------------
-- Trigger de creación automática
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER porque corre en el contexto del registro, cuando todavía no
-- hay sesión que pueda pasar las políticas de RLS.
--
-- `set search_path = ''` es obligatorio en funciones SECURITY DEFINER: sin eso,
-- alguien que pueda crear objetos podría anteponer un esquema propio y hacer
-- que la función ejecute SU tabla en vez de la nuestra. Por eso todo va
-- calificado con `public.` y `auth.` de forma explícita.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        -- Si no mandó nombre en el registro, se usa la parte del correo antes
        -- de la arroba. Nunca se guarda el correo completo aquí: ya vive en
        -- auth.users y duplicarlo es multiplicar el dato personal sin razón.
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
            split_part(new.email, '@', 1)
        )
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS: cada quien ve y edita solo su propio perfil
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    to authenticated
    using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- INSERT lo hace el trigger (SECURITY DEFINER, se salta RLS). Esta política
-- existe solo para que el usuario pueda recrear su perfil si algo fallara.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles for insert
    to authenticated
    with check (auth.uid() = id);

-- Sin política de DELETE a propósito: el perfil se borra solo, en cascada,
-- cuando se elimina la cuenta en auth.users. Así no quedan perfiles huérfanos
-- ni cuentas sin perfil.

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
