# Contenedores (C4 · nivel 2)

**Para quién:** quien va a escribir código en SafeWay. Cada caja es algo que se despliega y se
puede apagar por separado. Las tres capas del documento
([ADR-001](adr/ADR-001-tres-capas.md)) se reparten así.

```mermaid
flowchart TB
    ciudadano["👤 Ciudadano<br/><i>navegador web, escritorio o celular</i>"]

    subgraph safeway["SafeWay"]
        web["<b>Aplicación web</b><br/><i>React 19 · Vite · react-leaflet</i><br/>Capa de presentación: mapa,<br/>burbujas de riesgo, panel de ruta"]
        api["<b>API</b><br/><i>Node.js · Express 5</i><br/>Capas de datos y análisis:<br/>riesgo por localidad, análisis de ruta,<br/>dataset de respaldo en memoria"]
        db[("<b>Base de datos</b><br/><i>Supabase · PostgreSQL con RLS</i><br/>localidades, reportes, perfiles")]
        auth["<b>Autenticación</b><br/><i>Supabase Auth</i><br/>cuentas opcionales"]
    end

    osrm["🗺️ OSRM<br/><i>servidor público</i>"]
    nominatim["📍 Nominatim<br/><i>OpenStreetMap</i>"]
    tiles["🧭 Teselas CARTO<br/><i>datos de OpenStreetMap</i>"]

    ciudadano -- "usa (HTTPS)" --> web
    web -- "pide zonas y analiza rutas<br/>(JSON / HTTPS)" --> api
    web -- "inicia sesión con" --> auth
    web -- "descarga el mapa base de" --> tiles
    api -- "lee localidades y reportes<br/>(si falla → respaldo)" --> db
    api -- "valida el token de sesión con" --> auth
    api -- "pide el trayecto a" --> osrm
    api -. "geocodifica direcciones con<br/>(en implementación)" .-> nominatim

    classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
    classDef externo fill:#999,stroke:#6b6b6b,color:#fff
    class web,api,db,auth contenedor
    class osrm,nominatim,tiles externo
```

## Reglas que salen de este diagrama

1. **La aplicación web no lee datos de la base directamente.** Todo dato de riesgo pasa por la
   API. A Supabase solo le habla para la sesión. (Regla R3 de `tools/verificar-capas.js`.)
2. **Dentro de la API**, `src/routes/` solo maneja HTTP y `src/services/` tiene la lógica y el
   acceso a datos: las rutas no hablan con Supabase (R1) y los servicios no importan Express (R2).
3. **El dataset de respaldo vive dentro de la API** (`Backend/src/data/localities.js`), no es un
   contenedor aparte: si la base de datos cae, la API sigue respondiendo
   ([ADR-002](adr/ADR-002-supabase-con-respaldo.md)).
4. **Llamadas a servicios externos** (base de datos, OSRM, Nominatim): siempre con timeout y con
   una respuesta de respaldo declarada en la respuesta (`localitySource`, `routeSource`). Hoy el
   respaldo existe pero **falta el timeout** en las tres: si el servicio se cuelga en vez de
   fallar, la API espera.

## Despliegue previsto

Aplicación web en Vercel · API en Render · Supabase en su capa gratuita (documento, sección
VII.D). Hoy solo corre en local.
