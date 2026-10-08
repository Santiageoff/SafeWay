# Desplegar el backend en Render

Guía para publicar la API de SafeWay en Render (plan gratis), como pide el issue #13. El
frontend va en Vercel y lo publica Juan Camilo; esta guía cubre solo la API.

## Qué hace `render.yaml`

El archivo `render.yaml` de la raíz describe el servicio completo, así que no hay que llenar
formularios a mano:

| Campo | Valor | Por qué |
|---|---|---|
| `rootDir` | `Backend` | La API vive en esa carpeta del repositorio |
| `buildCommand` | `npm ci --omit=dev` | Instala exactamente lo del `package-lock.json`, sin dependencias de desarrollo |
| `startCommand` | `node src/app.js` | El mismo punto de entrada que el `Dockerfile` |
| `healthCheckPath` | `/health` | Render sabe si la API arrancó; `/health` también dice si Supabase responde |
| `autoDeploy` | `true` | Cada fusión a `main` se publica sola |
| `NODE_VERSION` | `22` | La misma versión que el CI |

Render asigna el puerto en la variable `PORT`, y la API ya la lee (`app.js`).

## Crear el servicio (una sola vez)

1. En Render: **New → Blueprint** y conectar el repositorio `Santiageoff/SafeWay`.
2. Render encuentra `render.yaml` y pide las cuatro variables marcadas con `sync: false`:

| Variable | Valor | Quién la pone |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Cualquiera del equipo |
| `SUPABASE_KEY` | Llave publishable (`sb_publishable_…`) | Cualquiera del equipo |
| `SUPABASE_SECRET_KEY` | Llave secreta (`sb_secret_…`) | **Solo Julián**, directamente en Render |
| `CORS_ORIGINS` | El dominio de Vercel, p. ej. `https://safeway.vercel.app` | Quien publique el frontend |

3. **Apply**. La primera construcción tarda unos minutos.

La llave secreta se escribe directamente en el formulario de Render. No se manda por chat, ni
se pone en el repo, ni en Vercel: todo lo que empieza por `VITE_` queda visible en el navegador.

## Comprobar que quedó bien

```bash
curl https://safeway-api.onrender.com/health
```

Debe responder `"supabaseReachable": true`. Si dice `false`, revisa `SUPABASE_URL` y
`SUPABASE_KEY`. Después:

```bash
curl "https://safeway-api.onrender.com/api/risk/zones" | head -c 300
```

`meta.localitySource` debe ser `"supabase"`. Si dice `"respaldo-local"`, la API no está
leyendo la base.

## CORS

Sin `CORS_ORIGINS`, la API solo acepta llamadas desde `localhost`, así que el frontend de
Vercel recibiría `403`. Si se usan varios dominios (el de producción y los de vista previa de
Vercel), van separados por coma, sin espacios ni `/` al final:

```
https://safeway.vercel.app,https://safeway-git-main-equipo.vercel.app
```

## Limitaciones del plan gratis

- **Se duerme** a los 15 minutos sin tráfico. La primera consulta después tarda cerca de un minuto
  en responder. Para medir el tiempo de respuesta (indicadores, issue #7), hay que despertar el
  servicio antes con una llamada a `/health`.
- 750 horas gratis al mes por workspace: alcanza para un servicio encendido todo el mes.

## Migraciones

Render no toca la base de datos. Las migraciones nuevas de `supabase/migrations/` se aplican
aparte, desde un equipo con el CLI de Supabase enlazado:

```bash
supabase db push
```

Hay que correrlo cada vez que se fusione un PR que agregue una migración, antes o junto con el
despliegue que la usa.
