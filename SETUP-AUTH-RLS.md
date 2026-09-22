# SafeWay — Pasos antes de continuar con Auth + RLS

> Rama de trabajo: `feat/auth-rls`
> Estado: Fase 0 terminada (3 commits). Bloqueado esperando estos 4 pasos.

Cuando termines los 4, corre la verificación del final y avísame. Yo sigo desde ahí.

---

## Antes que nada: dos reglas

1. **Nunca pegues la llave secreta en el chat.** Va únicamente en `Backend/.env`, que git ya ignora.
2. **Nunca subas un `.env` al repo.** Si alguna vez ves `Backend/.env` o `Frontend/.env` en un `git status`, algo se rompió — avísame antes de hacer commit.

---

## Paso 1 — Llave secreta en el backend

En Supabase: tu proyecto → **Project Settings** → **API Keys**.

Ahí hay dos llaves. Necesitas la **secret** (empieza por `sb_secret_`), no la publishable.

Agrega esta línea al final de `Backend/.env`:

```
SUPABASE_SECRET_KEY=sb_secret_loquetecopiaste
```

**Para qué sirve:** es la única llave que puede saltarse RLS. Con ella el backend escribe los datos oficiales (las localidades) y los scripts de prueba crean y borran usuarios de prueba. Si se filtra, quien la tenga es dueño de toda tu base de datos.

---

## Paso 2 — Variables del frontend

El archivo `Frontend/.env` existe pero está vacío. Ponle esto:

```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://legvvbvnvdgwqajydpay.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_lamismaquetienesenelbackend
```

**Sí, la publicable va repetida en backend y frontend, y está bien.** Esa llave es pública por diseño: cualquiera que abra tu web la va a poder leer del código. Lo que protege los datos no es el secreto de esa llave, es RLS — que es exactamente lo que vamos a activar. Por eso este trabajo importa tanto.

La secreta, en cambio, **jamás** va aquí. Todo lo que empieza por `VITE_` queda incrustado en el archivo que se descarga el navegador.

---

## Paso 3 — Enlazar el CLI de Supabase

Desde la raíz del proyecto:

```bash
supabase login
```

Te abre el navegador para autorizar. Luego:

```bash
supabase link --project-ref legvvbvnvdgwqajydpay
```

Te va a pedir **la contraseña de la base de datos** — la que pusiste cuando creaste el proyecto. No es la de tu cuenta de Supabase.

¿No la recuerdas? Se resetea en **Project Settings** → **Database** → **Reset database password**. Resetearla no borra datos ni rompe la app: las llaves de API siguen funcionando igual.

Cuando termine debe aparecer una carpeta `supabase/` con un `config.toml` dentro.

---

## Paso 4 — Decisión sobre la confirmación por correo

En Supabase: **Authentication** → **Sign In / Providers** → **Email**, busca *Confirm email*.

Decide si lo dejas activado o no, y me dices:

|  | Activado | Desactivado |
|---|---|---|
| **Qué pasa** | Al registrarse llega un correo y hay que hacer clic antes de poder entrar | La cuenta queda usable de inmediato |
| **A favor** | Nadie se registra con un correo que no es suyo | Probar en local es mucho más rápido |
| **En contra** | Probar en local es incómodo, y el correo gratuito de Supabase es lento y a veces cae en spam | Cualquiera se registra con un correo que no le pertenece |

**Mi recomendación: déjalo activado.** Es lo correcto y lo que vas a poder defender en la sustentación. Para las pruebas automáticas no estorba: los usuarios A y B los creo con la Admin API ya confirmados, sin pasar por el correo.

---

## Verificación

Cuando tengas los 4, corre esto desde la raíz:

```bash
node Backend/scripts/check-setup.js
```

Te dice qué falta y qué está listo, **sin imprimir ninguna llave**. Si sale todo en verde, ya podemos seguir.

---

## Qué sigue cuando vuelvas

1. Migraciones SQL versionadas en `supabase/migrations/` (yo las escribo mientras tanto)
2. Tabla `localities` en Supabase, con lectura pública y escritura solo desde el backend
3. `profiles` + trigger de creación automática al registrarse
4. **RLS activada en todas las tablas** — el agujero crítico de la auditoría
5. Vista pública sanitizada, para que el mapa siga mostrando los puntos sin exponer datos personales
6. Registro, login, logout y recuperación de contraseña
7. Modelo de datos de historial, rutas habituales y consentimiento (Ley 1581)
8. Pruebas de que el usuario A no puede tocar nada del usuario B

---

## Recordatorio de lo que ya quedó hecho

- `node_modules` (1.562 archivos) fuera del control de versiones
- `.env.example` sin duplicados, con cada llave explicada, y uno nuevo para el frontend
- CORS cerrado por lista blanca (antes aceptaba cualquier origen)
- Cuerpo de las peticiones limitado a 32kb y textos libres recortados
- `/api/test-zones`, que servía datos falsos, eliminado
