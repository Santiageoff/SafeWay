-- =============================================================================
-- Fuentes de datos complementarias (issue #4 / Anexo A y IV del documento)
-- =============================================================================
-- Tres fuentes que hoy no estaban en la base de datos:
--   1. Hurto a vehículos (automotores y motocicletas), por localidad
--   2. Hurtos en transporte público (TransMilenio/SITP)
--   3. Hurto a residencias, por localidad
--
-- La 1 y la 3 vienen de la Secretaría Distrital de Seguridad, Convivencia y
-- Justicia (capa "Delitos Alto Impacto Localidad", servicio ArcGIS público en
-- oaiee.scj.gov.co/agc/rest/services/Tematicos_Pub/CifrasSCJ/MapServer/0),
-- que SÍ desglosa por las 20 localidades — a diferencia de los datasets de
-- datos.gov.co (HURTO-A-VEH-CULOS, HURTO-A-RESIDENCIAS), que solo llegan a
-- nivel de municipio (Bogotá entera cuenta como un solo "municipio").
--
-- La 2 (transporte público) NO tiene un dataset oficial con ese desglose:
-- ni la capa de la SDSCJ ni datos.gov.co separan "hurto en TransMilenio" como
-- categoría propia. El criterio de aceptación del issue permite usar los
-- reportes ciudadanos (CR-001) para esta fuente, así que se resuelve con una
-- vista sobre `public_reports` en vez de inventar cifras que no existen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Hurto a vehículos y a residencias (fuente oficial, snapshot cargado a mano)
-- -----------------------------------------------------------------------------
-- No es un respaldo como el de `localities`: esta tabla completa datos que la
-- app no tenía, no reemplaza a Supabase si falla. Por eso no necesita lógica
-- de conmutación, solo lectura pública normal.
create table if not exists public.locality_crime_sources (
    id           bigint generated always as identity primary key,
    locality_id  integer not null references public.localities(id),

    -- Las tres categorías que pide el issue #4 (transporte público es la vista
    -- transit_incident_counts, más abajo, no vive en esta tabla).
    source_type  text not null check (source_type in (
        'hurto_automotores', 'hurto_motocicletas', 'hurto_residencias'
    )),

    -- Periodo del corte, tal como lo reporta la SDSCJ (p. ej. "2026-ene-ago"
    -- = acumulado enero-agosto 2026). No es una fecha exacta porque la fuente
    -- reporta acumulados de varios meses, no eventos individuales.
    period       text not null,
    count        integer not null check (count >= 0),

    source       text not null default 'SDSCJ - Delito de Alto Impacto (oaiee.scj.gov.co)',
    updated_at   timestamptz not null default now(),

    unique (locality_id, source_type, period)
);

comment on table public.locality_crime_sources is
    'Hurto a vehiculos (automotores/motocicletas) y a residencias por localidad. Fuente: SDSCJ, capa "Delitos Alto Impacto Localidad". Lectura publica; escritura solo con service_role.';

create index if not exists locality_crime_sources_locality_idx
    on public.locality_crime_sources (locality_id);

-- Snapshot cargado el 2026-09-27 desde la capa pública de la SDSCJ
-- (acumulado enero-agosto, comparativo 2025 vs. 2026; se usa la columna 2026).
-- data-processing/generate_risk_zones.py reproduce este archivo desde cero.
insert into public.locality_crime_sources (locality_id, source_type, period, count)
values
    (1, 'hurto_automotores', '2026-ene-ago', 71),
    (1, 'hurto_motocicletas', '2026-ene-ago', 644),
    (1, 'hurto_residencias', '2026-ene-ago', 382),
    (2, 'hurto_automotores', '2026-ene-ago', 37),
    (2, 'hurto_motocicletas', '2026-ene-ago', 624),
    (2, 'hurto_residencias', '2026-ene-ago', 260),
    (3, 'hurto_automotores', '2026-ene-ago', 27),
    (3, 'hurto_motocicletas', '2026-ene-ago', 184),
    (3, 'hurto_residencias', '2026-ene-ago', 147),
    (4, 'hurto_automotores', '2026-ene-ago', 89),
    (4, 'hurto_motocicletas', '2026-ene-ago', 169),
    (4, 'hurto_residencias', '2026-ene-ago', 182),
    (5, 'hurto_automotores', '2026-ene-ago', 59),
    (5, 'hurto_motocicletas', '2026-ene-ago', 119),
    (5, 'hurto_residencias', '2026-ene-ago', 131),
    (6, 'hurto_automotores', '2026-ene-ago', 70),
    (6, 'hurto_motocicletas', '2026-ene-ago', 97),
    (6, 'hurto_residencias', '2026-ene-ago', 74),
    (7, 'hurto_automotores', '2026-ene-ago', 135),
    (7, 'hurto_motocicletas', '2026-ene-ago', 211),
    (7, 'hurto_residencias', '2026-ene-ago', 237),
    (8, 'hurto_automotores', '2026-ene-ago', 352),
    (8, 'hurto_motocicletas', '2026-ene-ago', 360),
    (8, 'hurto_residencias', '2026-ene-ago', 469),
    (9, 'hurto_automotores', '2026-ene-ago', 99),
    (9, 'hurto_motocicletas', '2026-ene-ago', 320),
    (9, 'hurto_residencias', '2026-ene-ago', 187),
    (10, 'hurto_automotores', '2026-ene-ago', 231),
    (10, 'hurto_motocicletas', '2026-ene-ago', 510),
    (10, 'hurto_residencias', '2026-ene-ago', 507),
    (11, 'hurto_automotores', '2026-ene-ago', 174),
    (11, 'hurto_motocicletas', '2026-ene-ago', 672),
    (11, 'hurto_residencias', '2026-ene-ago', 653),
    (12, 'hurto_automotores', '2026-ene-ago', 82),
    (12, 'hurto_motocicletas', '2026-ene-ago', 319),
    (12, 'hurto_residencias', '2026-ene-ago', 166),
    (13, 'hurto_automotores', '2026-ene-ago', 81),
    (13, 'hurto_motocicletas', '2026-ene-ago', 342),
    (13, 'hurto_residencias', '2026-ene-ago', 193),
    (14, 'hurto_automotores', '2026-ene-ago', 59),
    (14, 'hurto_motocicletas', '2026-ene-ago', 215),
    (14, 'hurto_residencias', '2026-ene-ago', 80),
    (15, 'hurto_automotores', '2026-ene-ago', 49),
    (15, 'hurto_motocicletas', '2026-ene-ago', 207),
    (15, 'hurto_residencias', '2026-ene-ago', 55),
    (16, 'hurto_automotores', '2026-ene-ago', 152),
    (16, 'hurto_motocicletas', '2026-ene-ago', 386),
    (16, 'hurto_residencias', '2026-ene-ago', 177),
    (17, 'hurto_automotores', '2026-ene-ago', 3),
    (17, 'hurto_motocicletas', '2026-ene-ago', 112),
    (17, 'hurto_residencias', '2026-ene-ago', 26),
    (18, 'hurto_automotores', '2026-ene-ago', 106),
    (18, 'hurto_motocicletas', '2026-ene-ago', 147),
    (18, 'hurto_residencias', '2026-ene-ago', 155),
    (19, 'hurto_automotores', '2026-ene-ago', 153),
    (19, 'hurto_motocicletas', '2026-ene-ago', 167),
    (19, 'hurto_residencias', '2026-ene-ago', 208),
    (20, 'hurto_automotores', '2026-ene-ago', 0),
    (20, 'hurto_motocicletas', '2026-ene-ago', 0),
    (20, 'hurto_residencias', '2026-ene-ago', 0)
on conflict (locality_id, source_type, period) do update set
    count      = excluded.count,
    updated_at = now();

alter table public.locality_crime_sources enable row level security;

drop policy if exists "locality_crime_sources_public_read" on public.locality_crime_sources;
create policy "locality_crime_sources_public_read"
    on public.locality_crime_sources
    for select
    to anon, authenticated
    using (true);

revoke insert, update, delete on public.locality_crime_sources from anon, authenticated;
grant select on public.locality_crime_sources to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Hurtos en transporte público (fuente ciudadana, CR-001)
-- -----------------------------------------------------------------------------
-- No hay dataset oficial de la SDSCJ ni de datos.gov.co que aísle "hurto en
-- TransMilenio/SITP" por localidad; el propio criterio de aceptación del
-- issue permite resolver esta fuente con los reportes ciudadanos. Es una
-- vista, no una tabla: crece sola con el uso real de la app, sin snapshot
-- que mantener a mano.
create or replace view public.transit_incident_counts as
select
    locality_id,
    count(*)::integer as count,
    max(occurred_at) as ultimo_reporte
from public.public_reports
where type = 'transmilenio'
  and locality_id is not null
group by locality_id;

comment on view public.transit_incident_counts is
    'Hurtos en TransMilenio/SITP por localidad, a partir de los reportes ciudadanos (CR-001). Fuente #2 de las 3 complementarias del issue #4: a diferencia de locality_crime_sources (snapshot de la SDSCJ), esto crece con el uso real de la app y puede devolver 0 localidades mientras no haya reportes de ese tipo.';

grant select on public.transit_incident_counts to anon, authenticated;
