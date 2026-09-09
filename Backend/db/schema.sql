-- SafeWay — tabla de reportes ciudadanos (botón de alerta de robo)
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run.
--
-- Mientras esta tabla no exista, el backend guarda los reportes en
-- Backend/data/reports.json y la app funciona igual.

create table if not exists reports (
    id           uuid primary key,
    created_at   timestamptz not null default now(),

    -- Cuándo pasó el robo. Puede ser distinto de created_at: a la víctima del
    -- cosquilleo en TransMilenio le robaron el celular y reporta desde la casa.
    occurred_at  timestamptz not null,

    -- Hora final, solo cuando no se sabe el momento exacto (la moto que estaba
    -- parqueada entre las 6am y las 2pm). Su peso se reparte entre las franjas.
    occurred_end timestamptz,

    lat          double precision not null,
    lng          double precision not null,

    -- Derivada del GPS en el servidor, nunca aceptada del cliente.
    locality     text,
    locality_id  integer,

    -- celular | moto | carro | bici | vivienda | transmilenio | otro
    -- NULL = reporte incompleto: la persona tocó el botón y cerró la app.
    -- Cuenta a media fuerza hasta que lo complete con calma.
    type         text,

    station      text,          -- estación de TransMilenio
    description  text,

    -- 'exact' | 'approx'. Los robos a vivienda se guardan difuminados a una
    -- rejilla de ~330 m: nadie debería poder leer en el mapa dónde vive una víctima.
    precision    text not null default 'exact',

    -- uuid de localStorage. NO es autenticación: sirve para el límite de 5
    -- reportes al día y para devolverle a la persona sus propios reportes.
    device_hash  text not null,

    -- 'active' | 'cancelled' (deshacer dentro de los 30 s)
    status       text not null default 'active'
);

-- Consulta principal: reportes activos recientes de una localidad.
create index if not exists reports_locality_time_idx
    on reports (locality_id, occurred_at desc)
    where status = 'active';

-- Límite diario por dispositivo.
create index if not exists reports_device_idx
    on reports (device_hash, created_at desc);

-- Capa del mapa: todo lo activo de los últimos días.
create index if not exists reports_active_time_idx
    on reports (occurred_at desc)
    where status = 'active';

-- NOTA DE SEGURIDAD
-- Sin login, cualquiera con la anon key puede escribir en esta tabla saltándose
-- el backend (y por tanto el límite de 5/día y la validación de GPS). Para la
-- entrega académica se asume ese riesgo, documentado en el acta.
-- Cuando se implemente autenticación (trabajo futuro), activar RLS:
--
--   alter table reports enable row level security;
--   create policy "lectura pública" on reports for select using (status = 'active');
--   create policy "escritura autenticada" on reports for insert
--       with check (auth.uid() is not null);
