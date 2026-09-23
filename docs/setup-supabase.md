# Configurar Supabase

Guía para conectar una copia local de SafeWay al proyecto de Supabase: la base de datos, el inicio
de sesión y RLS. Sin esta configuración el backend funciona igual con el dataset de respaldo de 20
localidades, pero sin cuentas ni reportes ciudadanos.

## Dos reglas

1. **La llave secreta (`sb_secret_…`) solo va en `Backend/.env`.** No se pega en chats, issues ni
   PR, y nunca en el frontend.
2. **Ningún `.env` se sube al repositorio.** Si `Backend/.env` o `Frontend/.env` aparecen en
   `git status`, algo está mal en el `.gitignore`: no hagas commit.

## 1. Variables del backend

En Supabase: **Project Settings → API Keys**. Copia `Backend/.env.example` a `Backend/.env` y
llena:

| Variable | Valor | ¿Quién la necesita? |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) | Todo el equipo |
| `SUPABASE_KEY` | Llave **publishable** (`sb_publishable_…`) | Todo el equipo |
| `SUPABASE_SECRET_KEY` | Llave **secret** (`sb_secret_…`) | Solo quien administra la base y el despliegue |

La llave secreta se salta RLS: con ella el backend escribe datos oficiales y los scripts de
verificación crean y borran usuarios de prueba. Si se filtra, hay que rotarla de inmediato en la
misma pantalla de Supabase.

## 2. Variables del frontend

Copia `Frontend/.env.example` a `Frontend/.env`:

```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```

La llave publishable va repetida en el backend y el frontend a propósito: es pública por diseño y
cualquiera puede leerla del código que descarga el navegador. Lo que protege los datos es RLS, no
esa llave. Por la misma razón, la llave secreta **nunca** va en una variable `VITE_`, porque todo
lo que empieza por `VITE_` queda incrustado en el sitio publicado.

## 3. Enlazar el CLI de Supabase (solo para migraciones)

Necesario únicamente si vas a crear o aplicar migraciones en `supabase/migrations/`.

```bash
supabase login
supabase link --project-ref <ref>
supabase db push        # aplica las migraciones pendientes
```

`link` pide la **contraseña de la base de datos** (no la de la cuenta de Supabase). Se puede
restablecer en **Project Settings → Database → Reset database password** sin afectar los datos ni
las llaves de API.

Las migraciones son la única fuente del esquema: toda tabla nueva entra como un archivo nuevo en
`supabase/migrations/` y con RLS activada desde el primer commit.

## 4. Confirmación por correo

En **Authentication → Sign In / Providers → Email**, la opción *Confirm email* debe quedar
**activada**, para que nadie se registre con un correo que no es suyo. Las pruebas automáticas no dependen del
correo, porque crean sus usuarios ya confirmados con la Admin API.

## Verificación

Desde `Backend/`:

```bash
npm run check:setup   # qué falta y qué está listo, sin imprimir ninguna llave
npm run verify:rls    # el usuario A no puede leer ni modificar lo del usuario B
npm run audit:rls     # RLS activada en todas las tablas
npm run verify:api    # la API respeta RLS por HTTP (con el backend corriendo en :3001)
```

`verify:rls`, `audit:rls` y `verify:api` necesitan `SUPABASE_SECRET_KEY`: crean y borran usuarios
de prueba o leen la vista de auditoría.

## Qué protege esta configuración

- RLS activada en todas las tablas; cada usuario solo ve y modifica lo suyo.
- El mapa lee los reportes desde una vista pública sanitizada, sin datos personales.
- `localities` es de lectura pública y solo el backend (con la llave secreta) escribe en ella.
- CORS cerrado por lista blanca (`CORS_ORIGINS`) y cuerpo de las peticiones limitado a 32 kB.
