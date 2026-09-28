# data-processing

Scripts de carga de las fuentes de datos complementarias (issue #4): hurto a
vehículos y a residencias por localidad, desde la capa pública de la
Secretaría Distrital de Seguridad, Convivencia y Justicia (SDSCJ).

No usan librerías externas — solo la librería estándar de Python 3 — para no
depender de un `pip install` en la máquina de quien los corra.

## Uso

```bash
cd data-processing
python clean_data.py           # descarga la capa de la SDSCJ y limpia -> output/hurto_por_localidad.csv
python generate_risk_zones.py  # csv -> output/upsert_locality_crime_sources.sql
```

Revisa el `.sql` generado y córrelo contra Supabase (SQL editor del proyecto,
o `psql` con la cadena de conexión) para refrescar los conteos con datos más
recientes. La carga inicial (snapshot del 2026-09-27) ya vive versionada en
`supabase/migrations/20260927230000_fuentes_complementarias.sql`; estos
scripts son para repetirla más adelante, no hace falta correrlos para tener
los datos la primera vez.

`output/` no se sube al repo (está en `.gitignore`): es contenido generado,
reproducible desde cero con estos dos scripts.

## Por qué esta fuente y no otra

Los datasets de hurto en datos.gov.co (`HURTO-A-VEH-CULOS`, `HURTO-A-RESIDENCIAS`)
son nacionales y solo llegan a nivel de **municipio**: Bogotá entera cuenta
ahí como un solo municipio, sin desglose por localidad. La capa de la SDSCJ
(`Delitos Alto Impacto Localidad`) sí trae una fila por cada una de las 20
localidades, con los mismos códigos 1-20 que ya usa la app.

No existe una fuente oficial que aísle "hurto en TransMilenio/SITP" por
localidad (ni en la SDSCJ ni en datos.gov.co). Esa tercera fuente del issue
#4 se resuelve con los reportes ciudadanos (CR-001) en vez de inventar cifras
que no existen: ver la vista `transit_incident_counts` en la migración.
