# SafeWay — Frontend

React 19 + Vite + Tailwind + react-leaflet. Pide los datos de riesgo y rutas a la
API del Backend; a Supabase solo le habla para la sesión (inicio de sesión,
registro, recuperar contraseña).

Ver la [guía de arranque completa](../README.md#correrlo-en-local) en la raíz del
repo (variables de entorno, cómo correr Backend + Frontend juntos).

## Comandos

```bash
npm ci
cp .env.example .env   # opcional: sin .env el login queda deshabilitado, el mapa funciona igual
npm run dev             # http://localhost:5173
npm run lint
npm run build
npm run preview         # sirve el build de dist/
```

## Estructura

```
src/
  components/   Map, Search, RiskPanel, Alert (reportar), Auth (sesión)
  context/      sesión de Supabase (AuthContext)
  lib/          cliente de Supabase
  services/     llamadas a la API del Backend
  utils/        fuente/fecha de corte de los datos, geolocalización
  App.jsx       layout (barra superior, columna de ruta, mapa) y estado global
```

## Diseño

Opción D ("brutalista vivo"): tokens de color, tipografía, bordes y sombras en
[tailwind.config.js](tailwind.config.js). Reglas completas en
[docs/diseno/README.md](../docs/diseno/README.md) de la raíz del repo.
