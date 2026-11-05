-- =============================================================================
-- Las reglas de negocio de `reports` pasan a la base de datos (auditoría 2026-11)
-- =============================================================================
-- PROBLEMA: RLS solo comprobaba el DUEÑO (auth.uid() = user_id). Con la llave
-- publicable (pública) y su propio JWT, cualquier usuario podía escribir directo
-- en PostgREST y saltarse TODO lo que valida Express: 5 reportes al día, GPS
-- dentro de Bogotá, localidad derivada del GPS, difuminado de vivienda, textos
-- cortos, fechas coherentes y la ventana de 30 s para deshacer.
--
-- SOLUCIÓN: las mismas reglas, aplicadas por Postgres a cualquier escritura que
-- venga del rol `authenticated` (app o llamada directa). service_role y el dueño
-- de la tabla (migraciones, anonimizar al borrar una cuenta) no pasan por aquí.
-- Las restricciones van NOT VALID: se exigen a lo nuevo sin romper filas viejas.
-- =============================================================================

alter table public.reports
    add constraint reports_dentro_de_bogota
        check (lat between 3.65 and 4.85 and lng between -74.55 and -73.95) not valid,
    add constraint reports_tipo_valido
        check (type is null or type in ('celular','moto','carro','bici','vivienda','transmilenio','otro')) not valid,
    add constraint reports_precision_valida check (precision in ('exact','approx')) not valid,
    add constraint reports_estado_valido check (status in ('active','cancelled')) not valid,
    add constraint reports_textos_cortos
        check (coalesce(char_length(description), 0) <= 500 and coalesce(char_length(station), 0) <= 120) not valid,
    add constraint reports_rango_horario_corto
        check (occurred_end is null or (occurred_end >= occurred_at
               and occurred_end <= occurred_at + interval '24 hours')) not valid;

create or replace function private.reglas_de_reportes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    loc record;
    usados integer;
begin
    -- Solo las escrituras de personas. El backend con service_role y las acciones
    -- del dueño de la tabla (p. ej. ON DELETE SET NULL al borrar una cuenta) siguen.
    if current_user <> 'authenticated' then
        return new;
    end if;

    if tg_op = 'UPDATE' then
        if old.status = 'cancelled' then
            raise exception 'Este reporte fue cancelado' using errcode = 'SW409';
        end if;
        -- Lo que no se toca nunca.
        new.id := old.id;
        new.user_id := old.user_id;
        new.created_at := old.created_at;
        new.device_hash := old.device_hash;
        if new.status is distinct from old.status then
            if new.status <> 'cancelled' or now() - old.created_at > interval '30 seconds' then
                raise exception 'La ventana para deshacer (30 s) ya pasó' using errcode = 'SW409';
            end if;
        end if;
    else
        -- Hora del servidor, no del cliente: el límite diario cuenta con esto.
        new.created_at := now();
        new.status := 'active';
        -- 5 al día por persona, contando cancelados. El candado serializa los
        -- inserts simultáneos de la misma persona (antes 15 a la vez pasaban).
        perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
        select count(*) into usados from public.reports r
         where r.user_id = new.user_id and r.created_at >= now() - interval '24 hours';
        if usados >= 5 then
            raise exception 'Alcanzaste el máximo de 5 reportes en 24 horas' using errcode = 'SW429';
        end if;
    end if;

    if new.occurred_at > now() + interval '1 minute' then
        raise exception 'No se puede reportar un robo en el futuro' using errcode = 'SW400';
    end if;
    if new.occurred_at < now() - interval '365 days' then
        raise exception 'La fecha del hecho es demasiado antigua' using errcode = 'SW400';
    end if;

    -- La localidad sale SIEMPRE del punto (el centroide más cercano, igual que
    -- localityForPoint en el backend), nunca de lo que mande el cliente.
    select l.id, l.name into loc from public.localities l
     order by power(l.lat - new.lat, 2) + power((l.lng - new.lng) * cos(radians(new.lat)), 2)
     limit 1;
    new.locality_id := loc.id;
    new.locality := loc.name;

    -- Vivienda: siempre difuminada a la rejilla de ~330 m.
    if new.type = 'vivienda' then
        new.lat := (round((new.lat / 0.003)::numeric) * 0.003)::double precision;
        new.lng := (round((new.lng / 0.003)::numeric) * 0.003)::double precision;
        new.precision := 'approx';
    else
        new.precision := 'exact';
    end if;

    return new;
end;
$$;

revoke all on function private.reglas_de_reportes() from public, anon, authenticated;

drop trigger if exists reglas_de_reportes on public.reports;
create trigger reglas_de_reportes
    before insert or update on public.reports
    for each row execute function private.reglas_de_reportes();

-- La vista pública: solo lo que el mapa necesita, y con menos precisión.
--   · últimos 30 días y nada "del futuro" (antes se podía bajar todo el historial)
--   · coordenadas a 3 decimales (~110 m): el mapa agrupa a 150 m, no necesita cm
--   · horas en bloques de 15 min (lo que usa la agrupación) y fecha de creación sin hora
create or replace function private.reportes_publicos()
returns table (
    id uuid, occurred_at timestamptz, occurred_end timestamptz,
    lat double precision, lng double precision, locality text, locality_id integer,
    type text, station text, "precision" text, created_at timestamptz, source_token text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        r.id,
        date_bin('15 minutes', r.occurred_at, timestamptz '2000-01-01'),
        date_bin('15 minutes', r.occurred_end, timestamptz '2000-01-01'),
        round(r.lat::numeric, 3)::double precision,
        round(r.lng::numeric, 3)::double precision,
        r.locality, r.locality_id, r.type, r.station, r.precision,
        date_trunc('day', r.created_at),
        md5(
            coalesce(r.user_id::text, r.device_hash, r.id::text)
            || '|' || (r.occurred_at at time zone 'America/Bogota')::date::text
            || '|' || coalesce(r.locality_id::text, 'sin-localidad')
        )
    from public.reports r
    where r.status = 'active'
      and r.occurred_at >= now() - interval '30 days'
      and r.occurred_at <= now() + interval '1 minute'
$$;

-- Defensa en profundidad: privilegios de fábrica que nadie usa por la API.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
