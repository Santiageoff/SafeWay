# ADR-002 — Supabase como fuente principal, con dataset de respaldo y caché de 5 minutos

- **Estado:** Aceptada · **Fecha:** 2026-09-23 · **Responsable:** Julián Hernández (implementación), Sergio Aza (registro)

## Contexto
Los datos de riesgo son cifras oficiales que cambian de un boletín a otro (semanas), pero se leen
en cada consulta del mapa. El documento exige continuidad del servicio ante fallas de la fuente
principal (IV.C) y define un indicador: la proporción de consultas que usan datos reales frente
al respaldo (III.F).

## Drivers
1. El mapa nunca queda vacío (criterio 3.3: "opera sin interrupción al simular falla de Supabase").
2. Capa gratuita de Supabase: pocas lecturas y sin garantía de disponibilidad.
3. El usuario debe saber si está viendo el dato real o el de respaldo.

## Decisión
- Las 20 localidades viven en la tabla `localities` de Supabase (migración `…0002`).
- `Backend/src/services/localityStore.js` las lee y las guarda **5 minutos en memoria**.
- Si Supabase no está configurado, falla o devuelve la tabla vacía, usa
  `Backend/src/data/localities.js` y lo declara en cada respuesta:
  `meta.localitySource = "supabase" | "respaldo-local"`.

**¿Cuánto puede estar desactualizado el dato?** Hasta 5 minutos respecto a la tabla: aceptable,
porque la cifra oficial cambia en semanas. El dataset de respaldo puede estar semanas atrasado;
por eso se avisa.

## Alternativas descartadas
- **Sin caché**: una lectura a Supabase por cada consulta del mapa; gasta la capa gratuita.
- **Solo el archivo local**: siempre disponible, pero actualizar una cifra exigiría un despliegue
  y no habría forma de medir el indicador de madurez del pipeline.

## Consecuencias
- **Ganamos:** el mapa funciona sin base de datos (útil también para desarrollar sin `.env`).
- **Pagamos:** dos copias del dato que hay que mantener parecidas; y una vez en respaldo, la
  caché lo retiene 5 minutos aunque Supabase ya haya vuelto.
- **Pendiente:** si Supabase **se cuelga** sin responder, hoy no conmuta: falta un timeout en la
  lectura. El frontend tiene además su propio respaldo de 15 localidades, distinto del de la API:
  debe quedar una sola fuente.

## Cómo se verifica
`Backend/test/respaldo.test.js`: arranca la API con Supabase apuntando a un puerto cerrado y
comprueba que `/api/risk/zones` responde 20 localidades con `localitySource: "respaldo-local"`.
El caso "Supabase colgado" se agrega con el timeout.
