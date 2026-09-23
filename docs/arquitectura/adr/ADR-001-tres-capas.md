# ADR-001 — Tres capas desacopladas: datos, análisis y presentación

- **Estado:** Aceptada · **Fecha:** 2026-09-23 (formaliza lo decidido en el Acta del 2026-09-01)
- **Responsable:** Sergio Aza (director)

## Contexto
SafeWay arranca con cifras cargadas a mano y un dataset de respaldo, pero el documento pide que
pueda escalar a fuentes oficiales vivas y a otras ciudades **sin cambiar la experiencia del
usuario** (requisitos no funcionales, sección IV.C). Además, dos personas escriben código en
paralelo: una el backend y otra el frontend.

## Drivers
1. Cambiar la fuente de datos sin tocar el análisis ni la interfaz.
2. Que backend y frontend avancen en paralelo con un contrato claro entre ellos.
3. Continuidad: si la base de datos cae, el mapa no puede quedar en blanco.

## Decisión
Tres capas, cada una con una sola responsabilidad y una interfaz explícita:
- **Datos**: los servicios de `Backend/src/services/` son los únicos que hablan con Supabase o con
  el dataset de respaldo.
- **Análisis**: el cálculo de ruta y de riesgo vive en el backend y se expone por la API
  (`docs/api.md`). Las rutas HTTP (`Backend/src/routes/`) solo validan, llaman y responden.
- **Presentación**: el frontend pide todo dato de riesgo a la API. A Supabase solo le habla para
  la sesión.

## Alternativas descartadas
- **Frontend contra Supabase directo** (sin API propia): menos código, pero la lógica de riesgo
  quedaría en el navegador, repetida y visible; cambiar de fuente obligaría a tocar la interfaz.
- **Todo en el frontend con datos estáticos**: sirve para una demo, pero no permite el respaldo
  ante falla ni los indicadores del documento.

## Consecuencias
- **Ganamos:** reemplazar Supabase por una fuente oficial toca solo `services/`; el frontend se
  puede probar contra el dataset de respaldo sin base de datos.
- **Pagamos:** un salto de red más (navegador → API → Supabase) y una API que mantener y
  desplegar (Render). Cada cambio de la forma de una respuesta hay que coordinarlo entre las dos
  personas.
- **Deuda conocida:** hoy buena parte de la lógica de análisis sigue en los archivos de
  `routes/` (no rompe las reglas, pero dificulta probarla). Se mueve a servicios en el paquete 3.2.

## Cómo se verifica
`node tools/verificar-capas.js` corre en el CI en cada PR y falla si:
- **R1** un archivo de `Backend/src/routes/` importa Supabase directamente;
- **R2** un archivo de `Backend/src/services/` o `utils/` importa Express;
- **R3** el frontend consulta datos a Supabase (`.from(`, `.rpc(`, `.storage`) en vez de a la API.
