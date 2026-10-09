# Desplegar el frontend en Vercel

Guía para publicar la interfaz de SafeWay en Vercel (plan gratis), como pide el issue #13. El
backend va en Render y lo cubre [docs/despliegue-backend.md](despliegue-backend.md); esta guía
es solo la interfaz.

**Orden importante: el backend va primero.** Vercel necesita la URL de Render para
`VITE_API_URL`; Render, a su vez, va a necesitar la URL de Vercel para `CORS_ORIGINS`
una vez que exista. Es una dependencia de ida y vuelta, así que:

1. Desplegar el backend en Render (guía aparte) y confirmar que `/health` responde.
2. Desplegar el frontend aquí, con la URL de Render.
3. Volver a Render y poner `CORS_ORIGINS` con la URL de Vercel que te dé este paso.
4. Ajustar `site_url` y las redirect URLs en el Dashboard de Supabase (más abajo).

## Crear el proyecto (una sola vez)

1. En [vercel.com](https://vercel.com), **Add New → Project** y conectar el repositorio
   `Santiageoff/SafeWay` (inicia sesión con GitHub si no lo has hecho).
2. Vercel detecta varios proyectos en el repo porque hay más de una carpeta con código. En
   **Configure Project**:
   - **Root Directory**: `Frontend` (botón "Edit" junto al campo, y seleccionar la carpeta).
   - **Framework Preset**: Vercel detecta "Vite" solo al ver `Frontend/vite.config.js` una vez
     puesto el Root Directory. Si no, elígelo a mano.
   - Build Command y Output Directory se quedan en los valores por defecto de Vite
     (`npm run build`, `dist`).
3. **Environment Variables**, las tres de `Frontend/.env.example`:

| Variable | Valor | Nota |
|---|---|---|
| `VITE_API_URL` | `https://safeway-api.onrender.com` (la URL real de Render) | Sin `/` al final |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | La misma que usa el backend |
| `VITE_SUPABASE_ANON_KEY` | Llave publishable (`sb_publishable_…`) | Es pública por diseño: lo que protege los datos es RLS, no el secreto de esta llave |

   Nada de esto es secreto (todo lo que empieza por `VITE_` queda visible en el navegador de
   todas formas), así que no hace falta cuidado especial al escribirlas.

4. **Deploy**. Termina en 1-2 minutos y te da la URL pública
   (`https://safeway-xxxx.vercel.app` o el dominio que elijas).

## Después del primer deploy

1. **Backend**: en Render, actualiza `CORS_ORIGINS` con la URL que te dio Vercel (si usas más
   de un dominio —el de producción y los de vista previa de Vercel por cada PR— sepáralos por
   coma, ver `docs/despliegue-backend.md`).
2. **Supabase**: en el Dashboard del proyecto → **Authentication → URL Configuration**:
   - **Site URL**: la URL de Vercel.
   - **Redirect URLs**: agrega la misma URL (y `http://localhost:5173` si quieres poder seguir
     usando el enlace de "olvidé mi contraseña" en local). Sin esto, el enlace de recuperar
     contraseña que manda Supabase por correo no vuelve a la app.
3. Verifica también en **Authentication → Providers → Email** que:
   - "Confirm email" esté activado (ya debería estarlo; está así desde antes del #13).
   - La contraseña mínima sea de 8 caracteres (**Authentication → Policies**, o el campo
     correspondiente en Providers → Email, según la versión del Dashboard).

   `supabase/config.toml` ya tiene estos dos valores para el entorno local, pero ese archivo
   **no** cambia el proyecto real: hay que confirmarlos a mano en el Dashboard (o con
   `supabase config push`, si en algún momento se enlaza el CLI al proyecto).

## Auto-deploy

Por defecto Vercel publica automáticamente cada push a `main` (producción) y crea una vista
previa por cada Pull Request, con su propia URL temporal. No hay que hacer nada para que esto
funcione.

## Comprobar que quedó bien

Desde el celular, **con datos móviles (no el wifi de la universidad)**, abre la URL de Vercel y:

1. Que cargue el mapa con las 20 localidades.
2. Analiza una ruta (p. ej. Suba a Kennedy).
3. Crea una cuenta nueva: debe pedir confirmar el correo y una contraseña de al menos 8
   caracteres.

Si el mapa no carga datos reales (`meta.localitySource: "respaldo-local"` en vez de
`"supabase"`), revisa `VITE_API_URL` y que `CORS_ORIGINS` en Render ya tenga el dominio de
Vercel correcto.

## Límite del plan gratis

Vercel no tiene el problema de "se duerme" que tiene Render: el frontend es estático (HTML/JS/CSS
servidos directo), no un servidor que arrancar. El límite real es la primera carga del backend
tras 15 minutos sin uso (ver `docs/despliegue-backend.md`), no el frontend.
