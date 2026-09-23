# ADR-003 — El riesgo se modela por localidad, no por barrio ni por tramo de vía

- **Estado:** Aceptada · **Fecha:** 2026-09-23 (formaliza la restricción IV.D del Acta) · **Responsable:** Sergio Aza

## Contexto
Las cifras oficiales que el equipo puede conseguir y cargar a mano en un semestre (SIEDCO,
Secretaría de Seguridad) se publican agregadas por localidad. El detalle por barrio o por tramo de
vía existe solo parcialmente y exigiría geometrías y cargas que no caben en 16 semanas.

## Drivers
1. Datos disponibles y citables como fuente oficial.
2. Un modelo que cubra toda la ciudad (20 localidades) desde el primer día.
3. Poder refinarlo después sin cambiar la interfaz.

## Decisión
- La unidad de riesgo es la **localidad** (20 en Bogotá), con un nivel general y un nivel por
  medio de transporte (`vehicleRisks`).
- Cada localidad se representa por su **centroide**; en el mapa, una burbuja de 1,2 km.
- Una ruta "toca" una localidad si pasa a menos de 3 km de su centroide.

## Alternativas descartadas
- **Por barrio o por tramo**: más preciso, pero sin datos oficiales completos a ese nivel ni
  tiempo para cargarlos. Queda como trabajo futuro (el documento lo excluye de esta versión).
- **Polígonos reales de las localidades** (GeoJSON de Datos Abiertos Bogotá): mejor para decidir
  a qué localidad pertenece un punto; se deja como mejora, no bloquea nada hoy.

## Consecuencias
- **Ganamos:** el modelo completo cabe en 20 filas; se puede citar la fuente de cada cifra.
- **Pagamos:** precisión. Una localidad grande (Suba, Kennedy) tiene zonas muy distintas y se
  pinta de un solo color. Asignar un punto a la localidad más cercana por centroide
  (`utils/geo.js`, `localityForPoint`) se equivoca cerca de los bordes.

## Cómo se verifica
`Backend/test/localidades.test.js`: el dataset tiene exactamente 20 localidades con id único,
nombre, coordenadas dentro de Bogotá y nivel `low | medium | high` (general y por cada medio).
