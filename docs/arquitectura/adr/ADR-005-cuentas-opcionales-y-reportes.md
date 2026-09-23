# ADR-005 — Cuentas opcionales, reportes ciudadanos y perfil proactivo con consentimiento

- **Estado:** **Aceptada por el director** (2026-09-23) como solicitud de cambio **CR-001**
  (control integrado de cambios, sección V.E del documento). **Pendiente del aval del docente**,
  porque cambia una exclusión del alcance aprobado.
- **Fecha:** 2026-09-23 · **Responsable:** Sergio Aza (decisión) · Julián Hernández (implementación existente)

## Contexto
El documento aprobado **excluye** de esta versión el registro de usuarios con cuentas
persistentes y el reporte de incidentes por parte de los usuarios (VII.B), y pide que el
historial del perfil proactivo sea **anónimo**, sin asociarlo a una cuenta (IV.E, Ley 1581 de
2012). Sin embargo, el repositorio ya implementa cuentas con Supabase Auth, reportes ciudadanos
con RLS y el esquema del perfil proactivo asociado a `user_id`.

## Drivers
1. El criterio del perfil proactivo (4.4: "≥ 50 % de usuarios de prueba reciben una alerta")
   necesita reconocer al mismo usuario entre consultas.
2. El paquete 3.4 pide datos de incidentes en transporte público, que no tienen fuente oficial
   abierta.
3. Cumplir la Ley 1581: dato personal solo con consentimiento previo, expreso e informado.
4. No perder trabajo ya hecho y probado.

## Decisión
- **Cuentas opcionales.** Ninguna función del documento original exige sesión: el mapa y el
  análisis de ruta siguen abiertos.
- **Reportes ciudadanos** como fuente complementaria, mostrados como información **no
  verificada** y separados de la cifra oficial. Con los límites actuales: sesión obligatoria para
  reportar, 5 al día, 30 s para deshacer, vista pública sin datos personales.
- **Perfil proactivo con consentimiento explícito** (tabla `data_consents`) en lugar de
  anonimato; el usuario puede borrar su historial.

## Alternativas descartadas
- **Quitar cuentas y reportes** para cumplir el documento al pie de la letra: se pierde ~40 % del
  código ya probado y el 4.4 queda sin forma de medirse.
- **Historial anónimo solo en el navegador**: cumple la redacción original, pero el servidor no
  puede anticipar alertas ni contar el 50 %.

## Consecuencias
- **Ganamos:** el 4.4 se vuelve medible; el 3.4 de transporte público tiene fuente.
- **Pagamos:** tratamos datos personales (ubicación y rutas habituales): política de privacidad,
  consentimiento y borrado. Hay que moderar reportes falsos. Se corrige la configuración de Auth
  (confirmación de correo, contraseña ≥ 8).
- **Si se rechaza:** se apagan cuentas y reportes, y el perfil proactivo se rehace en el navegador.

## Cómo se verifica
- `npm run audit:rls`: toda tabla con RLS (vista `security_audit`).
- `npm run verify:rls`: un usuario no ve ni modifica datos de otro (5 tablas).
- Prueba de API: `POST /api/route/analyze` responde **sin** encabezado de sesión.
