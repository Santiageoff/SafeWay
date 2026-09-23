# ADR-004 — Rutas y geocodificación con servicios públicos de OpenStreetMap (OSRM y Nominatim)

- **Estado:** Aceptada, parcialmente implementada · **Fecha:** 2026-09-23 · **Responsable:** Julián Hernández

## Contexto
El análisis necesita convertir lo que escribe el usuario en un punto (geocodificar) y trazar el
recorrido entre dos puntos según el medio (III.D.2). El proyecto no tiene presupuesto para APIs de
pago y la infraestructura se limita a capas gratuitas (VII.D).

## Drivers
1. Costo cero y sin tarjeta de crédito.
2. Respuesta del análisis < 5 s en el 90 % de las consultas (criterio 4.1).
3. Licencias abiertas compatibles con un proyecto MIT académico.

## Decisión
- **Rutas:** OSRM, servidor público de demostración, llamado **desde la API** (no desde el
  navegador). Si no responde, se usa la línea recta y se declara `routeSource: "straight-line"`.
- **Geocodificación:** Nominatim, también desde la API, con `User-Agent` propio, máximo 1
  petición por segundo, limitado a la caja de Bogotá y con caché (lo exige su política de uso).
- Las URL de ambos servicios, configurables por variable de entorno.

## Alternativas descartadas
- **Google Maps / Mapbox Directions**: mejores perfiles y SLA, pero requieren cuenta con
  facturación y sus términos limitan guardar resultados.
- **Montar OSRM propio**: control total de perfiles, pero exige un servidor con varios GB de RAM
  para el mapa de Colombia; fuera del alcance de la capa gratuita.

## Consecuencias
- **Ganamos:** costo cero y datos abiertos, coherente con el enfoque CivicTech.
- **Pagamos:** sin garantía de servicio ni de velocidad, y límites de uso (Nominatim: 1 req/s).
  El servidor público de OSRM solo tiene el perfil de **carro**: bici y a pie se aproximan con un
  factor de tiempo sobre la ruta de carro (hay servidores públicos con perfiles `bike` y `foot`,
  p. ej. `routing.openstreetmap.de`).
- **Estado hoy:** OSRM funciona (por `http://`, sin timeout). Nominatim **aún no**: el origen y el
  destino son nombres de localidad. Ambos se completan en el paquete 4.1.

## Cómo se verifica
Pruebas con OSRM y Nominatim simulados por variable de entorno (sin red): el análisis devuelve
nivel y ruta; con OSRM caído, responde en < 5 s con `straight-line`. Medición de p90 con 20
consultas reales adjunta al PR del paquete 4.1.
