# SafeWay

Aplicación web que muestra el **nivel de riesgo por localidad de Bogotá** sobre un mapa y analiza
**qué tan riesgosa es una ruta** entre dos puntos según el medio de transporte (carro, moto,
bicicleta, a pie o transporte público).

Proyecto de aula de **Transformación Digital** — Universidad de Bogotá Jorge Tadeo Lozano, 2026-2.
Toma cifras oficiales de seguridad que hoy circulan en boletines y tablas y las convierte en una
decisión concreta: *¿por dónde voy?*

> SafeWay es una herramienta de apoyo informativo. **No es un canal de emergencia ni reemplaza
> la Línea 123.**

## Cómo está hecho

Tres capas desacopladas ([ADR-001](docs/arquitectura/adr/ADR-001-tres-capas.md)):

| Capa | Qué hace | Dónde |
|---|---|---|
| **Datos** | API con el riesgo de las 20 localidades desde Supabase, con un dataset de respaldo si Supabase falla | `Backend/src/services/`, `supabase/migrations/` |
| **Análisis** | Calcula la ruta, mide qué zonas de riesgo toca y da un nivel global bajo/medio/alto | `Backend/src/routes/`, `Backend/src/services/` |
| **Presentación** | Mapa interactivo (React + Leaflet) con burbujas de riesgo y panel de ruta | `Frontend/src/` |

Diagramas: [contexto](docs/arquitectura/contexto.md) · [contenedores](docs/arquitectura/contenedores.md) ·
Decisiones: [docs/arquitectura/adr/](docs/arquitectura/adr/) · Requisitos: [docs/requisitos.md](docs/requisitos.md) ·
API: [docs/api.md](docs/api.md) · Diseño y logo: [docs/diseno/](docs/diseno/README.md)

## Correrlo en local

Requisitos: **Node.js 20 o superior** y npm.

```bash
# 1. Backend (API en http://localhost:3001)
cd Backend
npm ci
cp .env.example .env      # opcional: sin .env funciona con el dataset de respaldo
npm run dev

# 2. Frontend (en otra terminal; web en http://localhost:5173)
cd Frontend
npm ci
cp .env.example .env
npm run dev
```

**Sin `.env` el backend arranca igual**: usa el dataset de respaldo de 20 localidades y lo indica
en cada respuesta (`meta.localitySource: "respaldo-local"`). Para usar la base de datos real y el
inicio de sesión, pide los valores al dueño del proyecto de Supabase (guía completa en
[docs/setup-supabase.md](docs/setup-supabase.md)):

| Archivo | Variable | Qué es | ¿Secreta? |
|---|---|---|---|
| `Backend/.env` | `SUPABASE_URL` | URL del proyecto de Supabase | No |
| `Backend/.env` | `SUPABASE_KEY` | Llave **publishable** (anon) | No |
| `Backend/.env` | `SUPABASE_SECRET_KEY` | Llave **secret**: se salta RLS. Solo para scripts de carga y verificación | **Sí** |
| `Backend/.env` | `CORS_ORIGINS` | Orígenes permitidos, separados por coma (por defecto `localhost:5173` y `4173`) | No |
| `Frontend/.env` | `VITE_API_URL` | URL del backend (por defecto `http://localhost:3001`) | No |
| `Frontend/.env` | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Los mismos URL y llave publishable (para el inicio de sesión) | No |

Los `.env` **nunca** se suben (están en `.gitignore`). La llave secreta no se comparte por chat.

## Pruebas y verificación

```bash
cd Backend && npm test            # criterios de aceptación de la capa de datos y análisis
cd Frontend && npm run lint && npm run build
node tools/verificar-capas.js     # que las tres capas sigan desacopladas
```

El CI (`.github/workflows/ci.yml`) corre todo esto en cada PR. Si está en rojo, no se fusiona.

## Estructura

```
Backend/            API Node.js + Express 5
  src/routes/       endpoints HTTP (validan y responden)
  src/services/     lógica y acceso a datos (Supabase, respaldo, riesgo)
  src/data/         dataset de respaldo de las 20 localidades
  scripts/          verificación de la configuración y de RLS
  test/             pruebas (node:test)
Frontend/           React 19 + Vite + react-leaflet
supabase/           configuración y migraciones versionadas de la base de datos
data-processing/    scripts de limpieza y carga de fuentes de datos
docs/               arquitectura, ADR, requisitos, contrato de la API, diseño y logo
tools/              verificaciones de arquitectura
```

## Cómo contribuir

Todo entra por pull request con el CI en verde y una revisión. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Equipo

| Integrante | Rol |
|---|---|
| Sergio Daniel Aza Ocampo | Director del proyecto |
| Santiago Martínez Beltrán | Subdirector y QA |
| Julián Santiago Hernández Gonzales | Desarrollador web |
| Juan Camilo Pulido Vargas | Diseñador UX/UI |

## Fuentes y licencias

- Cifras de criminalidad: **Secretaría Distrital de Seguridad, Convivencia y Justicia** y
  **Policía Metropolitana de Bogotá (SIEDCO)**, como fuente oficial.
- Datos cartográficos: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
  (ODbL) · teselas © CARTO.
- Rutas: OSRM (servidor público de demostración) · geocodificación: Nominatim (OpenStreetMap), en
  implementación.
- Código: [MIT](LICENSE), para fines académicos. React y Express (MIT), Leaflet (BSD-2-Clause).
