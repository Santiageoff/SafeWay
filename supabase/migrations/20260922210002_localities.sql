-- =============================================================================
-- 0002 · Datos oficiales de riesgo: tabla `localities`
-- =============================================================================
-- Las 20 localidades de Bogotá vivían en Backend/src/data/localities.js, un
-- archivo JavaScript. El acta las prometía en una base de datos consultable
-- (objetivo #1) desde la semana 6.
--
-- Esta tabla NACE con RLS activada:
--   · cualquiera puede LEERLA (el mapa es público y debe seguir siéndolo)
--   · nadie puede ESCRIBIRLA salvo el backend con la llave service_role
--
-- No hay política de INSERT/UPDATE/DELETE. Eso no es un olvido: con RLS
-- activada, la ausencia de política ES la denegación. service_role se salta
-- RLS por diseño, así que el backend sigue pudiendo actualizar las cifras.
-- =============================================================================

create table if not exists public.localities (
    id                    integer primary key,
    name                  text not null unique,
    lat                   double precision not null,
    lng                   double precision not null,

    risk_level            text not null check (risk_level in ('low', 'medium', 'high')),
    description           text,

    -- Nivel de riesgo por medio de transporte: {"carro":"low", "moto":"high", ...}
    -- Es el filtro que define la app: el mismo sitio puede ser verde para un
    -- carro y rojo para un pasajero de bus.
    vehicle_risks         jsonb not null default '{}'::jsonb,

    accidents             integer not null default 0 check (accidents >= 0),
    thefts                integer not null default 0 check (thefts >= 0),

    -- Línea base histórica (cifras oficiales). Los reportes ciudadanos NO la
    -- modifican: se suman aparte, en tiempo de consulta.
    insecurity_percentage integer not null check (insecurity_percentage between 0 and 100),
    safety_score          integer not null check (safety_score between 0 and 100),

    recommendation        text,

    -- Fecha de corte del dato, para poder mostrársela al usuario. Es la
    -- respuesta del acta al riesgo de "cifras oficiales desactualizadas".
    source                text not null default 'SIEDCO / Secretaría Distrital de Seguridad',
    updated_at            timestamptz not null default now()
);

comment on table public.localities is
    'Datos oficiales de riesgo por localidad. Lectura pública; escritura solo con service_role desde el backend.';

-- -----------------------------------------------------------------------------
-- Carga inicial: las 20 localidades, generadas desde Backend/src/data/localities.js
-- ON CONFLICT DO UPDATE para que volver a aplicar la migración refresque las
-- cifras en vez de fallar.
-- -----------------------------------------------------------------------------
insert into public.localities
    (id, name, lat, lng, risk_level, description, vehicle_risks, accidents, thefts, insecurity_percentage, safety_score, recommendation)
values
    (1, 'Usaquén', 4.7015, -74.0307, 'low', 'Zona residencial al norte de Bogotá con buena infraestructura vial', '{"carro":"low","moto":"low","bici":"low","peatón":"low"}'::jsonb, 120, 45, 18, 82, 'Zona segura. En carro, moto, bici y peatón el riesgo es bajo. Adecuado para circular a cualquier hora con precauciones normales.'),
    (2, 'Chapinero', 4.6473, -74.0662, 'medium', 'Zona comercial y residencial con tráfico moderado', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 280, 120, 42, 58, 'Zona de riesgo medio. En carro moderada precaución. Moto alto riesgo, evitar de noche. Bici y peatón precaución moderada, evitando zonas aisladas.'),
    (3, 'Santa Fe', 4.5769, -74.075, 'high', 'Centro histórico con alta concentración de peatones y tráfico vehicular', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 520, 380, 88, 12, 'Zona de alto riesgo. Evitar transitar a pie de noche. En carro moderada precaución. Moto y bici alto riesgo, evitar horarios nocturnos.'),
    (4, 'San Cristóbal', 4.549, -74.0833, 'high', 'Zona popular al sur con infraestructura vial limitada', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 480, 290, 76, 24, 'Zona de alto riesgo. Evitar transitar a pie especialmente de noche. En carro y moto precaución extrema. Bici no recomendada.'),
    (5, 'Usme', 4.4787, -74.1282, 'high', 'Zona periférica con altas tasas de accidentalidad', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 410, 250, 81, 19, 'Zona de alto riesgo. Alto riesgo para todos los medios de transporte. Evitar zona de noche. En carro mantener puertas bloqueadas.'),
    (6, 'Tunjuelito', 4.5731, -74.1331, 'medium', 'Zona residencial con tráfico moderado', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 220, 130, 63, 37, 'Zona de riesgo medio. En carro precaución moderada. Moto alto riesgo. Bici y peatón precaución, evitar calles oscuras.'),
    (7, 'Bosa', 4.5984, -74.2019, 'medium', 'Zona industrial y residencial en expansión', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 310, 180, 58, 42, 'Zona de riesgo medio. En carro circulación segura. Moto alto riesgo, usar equipo de protección. Bici y peatón precaución moderada.'),
    (8, 'Kennedy', 4.628, -74.1663, 'high', 'Una de las localidades más pobladas con alto flujo vehicular', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 650, 420, 79, 21, 'Zona de alto riesgo. Alto riesgo para todos los vehículos. Evitar circulación nocturna. Puertas bloqueadas en carro, moto evitar zonas aisladas.'),
    (9, 'Fontibón', 4.6727, -74.1469, 'medium', 'Zona industrial y comercial con buen mantenimiento vial', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 240, 110, 45, 55, 'Zona de riesgo medio. En carro riesgo bajo. Moto alto riesgo por tráfico pesado. Bici y peatón precaución por vehículos industriales.'),
    (10, 'Engativá', 4.7044, -74.1139, 'low', 'Zona residencial con buena infraestructura y señalización', '{"carro":"low","moto":"low","bici":"low","peatón":"low"}'::jsonb, 180, 80, 38, 62, 'Zona segura. Todos los medios de transporte tienen riesgo bajo. Adecuada para circular con precauciones habituales.'),
    (11, 'Suba', 4.7558, -74.0833, 'low', 'Zona residencial al noroccidente con vías amplias', '{"carro":"low","moto":"low","bici":"low","peatón":"low"}'::jsonb, 150, 70, 22, 78, 'Zona segura. Circulación comfortable para carro, moto, bici y peatón. Buen mantenimiento vial.'),
    (12, 'Barrios Unidos', 4.6697, -74.0836, 'medium', 'Zona comercial con tráfico moderado', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 260, 140, 47, 53, 'Zona de riesgo medio. En carro precaución moderada. Moto alto riesgo por congestionamiento. Bici y peatón cautela en horas pico.'),
    (13, 'Teusaquillo', 4.6445, -74.0934, 'low', 'Zona residencial y universitaria con buena infraestructura', '{"carro":"low","moto":"low","bici":"low","peatón":"low"}'::jsonb, 130, 55, 21, 79, 'Zona muy segura. Ideal para todos los medios de transporte. Universidad y zonas residenciales con bajo índice de criminalidad.'),
    (14, 'Los Mártires', 4.6028, -74.0892, 'high', 'Centro de la ciudad con alta concentración de delitos y accidentes', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 580, 450, 84, 16, 'Zona de muy alto riesgo. Evitar transitar a pie o en bicicleta. En carro y moto extrema precaución, mantener puertas bloqueadas.'),
    (15, 'Antonio Nariño', 4.5847, -74.1014, 'medium', 'Zona central con tráfico mixto', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 290, 160, 55, 45, 'Zona de riesgo medio. En carro precaución. Moto alto riesgo. Bici y peatón circulando con cautela, evitar zonas industriales.'),
    (16, 'Puente Aranda', 4.623, -74.113, 'medium', 'Zona industrial con alto flujo de camiones', '{"carro":"medium","moto":"high","bici":"medium","peatón":"medium"}'::jsonb, 320, 190, 51, 49, 'Zona de riesgo medio-alto. Alto flujo de camiones. En carro atención a maniobras de carga. Moto y bici evitar horas de carga.'),
    (17, 'La Candelaria', 4.5962, -74.0748, 'high', 'Centro histórico con alto flujo de peatones y turistas', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 490, 520, 86, 14, 'Zona de muy alto riesgo. Alto riesgo para todos los medios. Evitar zona de noche. Turismo solo en grupo y horarios diurnos.'),
    (18, 'Rafael Uribe', 4.548, -74.1082, 'high', 'Zona popular al sur con infraestructura limitada', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 440, 270, 72, 28, 'Zona de alto riesgo. Alto riesgo para peatones y ciclistas. En carro y moto precaución extrema, evitar paradas.'),
    (19, 'Ciudad Bolívar', 4.4934, -74.1719, 'high', 'Zona periférica al sur con altas tasas de criminalidad', '{"carro":"high","moto":"high","bici":"high","peatón":"high"}'::jsonb, 470, 310, 83, 17, 'Zona de alto riesgo. Evitar transitar a pie o en bicicleta. En carro y moto usar vías principales, no detenerse.'),
    (20, 'Sumapaz', 4.0269, -74.3594, 'low', 'Zona rural al sur de Bogotá con poco tráfico vehicular', '{"carro":"low","moto":"low","bici":"low","peatón":"low"}'::jsonb, 25, 10, 12, 88, 'Zona muy segura y rural. Ideal para todos los medios de transporte. Poco tráfico y baja criminalidad.')
on conflict (id) do update set
    name                  = excluded.name,
    lat                   = excluded.lat,
    lng                   = excluded.lng,
    risk_level            = excluded.risk_level,
    description           = excluded.description,
    vehicle_risks         = excluded.vehicle_risks,
    accidents             = excluded.accidents,
    thefts                = excluded.thefts,
    insecurity_percentage = excluded.insecurity_percentage,
    safety_score          = excluded.safety_score,
    recommendation        = excluded.recommendation,
    updated_at            = now();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.localities enable row level security;

-- Lectura para todo el mundo, con o sin sesión: el mapa de riesgo es público.
drop policy if exists "localities_public_read" on public.localities;
create policy "localities_public_read"
    on public.localities
    for select
    to anon, authenticated
    using (true);

-- Defensa en profundidad: aunque RLS ya bloquea la escritura sin política,
-- se retiran también los permisos de tabla.
revoke insert, update, delete on public.localities from anon, authenticated;
grant select on public.localities to anon, authenticated;
