# API de SafeWay — contrato

Base local: `http://localhost:3001`. Todas las respuestas son JSON con `success: true | false`.
Los errores traen `error` (mensaje) y, cuando aplica, `code`.

> **Quien cambie un endpoint actualiza este archivo en el mismo PR.** Es el entregable del
> paquete 3.2 ("endpoints documentados") y el contrato entre backend y frontend.

## Convenciones

- **Medios de transporte** (`mode` / `vehicleType`): `carro` · `moto` · `bici` · `peatón` · `publico`.
  Ojo: `peatón` lleva tilde (codifícala en la URL: `pe%C3%B3n`).
- **Niveles de riesgo**: `low` · `medium` · `high` (en la interfaz: bajo, medio, alto).
- **Fuente del dato** (`meta.localitySource`): `supabase` = base de datos real;
  `respaldo-local` = dataset de respaldo de la API (Supabase no configurado o caído). Es el
  indicador de madurez del pipeline (III.F del documento).
- **Coordenadas**: `[lat, lng]`.
- **Sesión**: `Authorization: Bearer <access_token de Supabase>`. Solo la exigen los endpoints
  marcados 🔒.

---

## Riesgo por localidad

### `GET /api/risk/zones`
Las 20 localidades con el riesgo del momento.

| Query | Opcional | Qué hace |
|---|---|---|
| `mode` | sí (por defecto `carro`) | Medio para el que se calcula el riesgo |
| `at` | sí (por defecto ahora) | Fecha ISO para ver el riesgo en otra franja horaria |
| `q` | sí | Filtra por nombre (contiene, sin distinguir mayúsculas) |

```json
{
  "success": true,
  "total": 20,
  "data": [{
    "id": 1, "name": "Usaquén", "coordinates": [4.7015, -74.0307],
    "riskLevel": "low",
    "vehicleRisks": { "carro": "low", "moto": "low", "bici": "low", "peatón": "low", "publico": "low" },
    "accidents": 120, "thefts": 45, "insecurityPercentage": 25, "safetyScore": 75,
    "recommendation": "Zona segura…", "baseRiskLevel": "low", "modePercentages": { "carro": 25 }
  }],
  "meta": {
    "mode": "carro",
    "timeWindow": { "id": "tarde", "label": "tarde (12m-6pm)" },
    "reportClusters": 0,
    "localitySource": "supabase",
    "live": true
  }
}
```
`meta.live: false` = no se pudieron leer los reportes ciudadanos y se muestra solo la línea base.

### `GET /api/risk/zones/:id`
Una localidad por id (1-20). Acepta `mode` y `at`. `400` si el id no es un entero · `404` si no existe.

### `GET /api/risk/zone/:localidad`
Una localidad por nombre (exacto, o si no, que contenga el texto). Acepta `vehicle` o `mode`, y
`at`. `404` si no existe. La usa el frontend para el detalle.

### `GET /api/risk/search?q=<texto>`
Hasta 5 localidades cuyo nombre contiene `q`. `400` si `q` está vacío o viene repetido. (Hace
lo mismo que `/zones?q=`; candidato a unificarse.)

---

## Análisis de ruta

### `POST /api/route/analyze` — el que usa la interfaz

```json
{ "origin": "Calle 72 # 7-30", "destination": "Kennedy", "vehicleType": "moto" }
```
`origin` y `destination` son texto (máx. 200 caracteres) y aceptan dos cosas:
- **El nombre de una localidad** ("Suba", o parte: "santa" → Santa Fe). Se usa su centro, sin salir
  a internet. Es como funcionaba antes.
- **Una dirección o lugar** ("Calle 72 # 7-30", "Parque de la 93"). Se geocodifica en el
  backend con Nominatim (OpenStreetMap), solo dentro de Bogotá, con caché de 24 h y como máximo
  1 petición por segundo para toda la app (política de uso de Nominatim). El navegador nunca
  llama a Nominatim.

Además de los campos de abajo, `origin` y `destination` traen `locality` (la localidad del
punto) y `source` (`localidad` o `nominatim`), y la respuesta trae `routeProfile`
(`car`, `bike`, `foot`, o `null` si fue línea recta).

Respuesta (real, 23-sep, con el dataset de respaldo; `zonesInRoute` recortado):
```json
{
  "success": true,
  "origin": { "name": "Suba", "coordinates": [4.7558, -74.0833] },
  "destination": { "name": "Kennedy", "coordinates": [4.628, -74.1663] },
  "vehicleType": "moto",
  "overallRisk": "high",
  "insecurityPercentage": 53,
  "routeCoordinates": [[4.755664, -74.083411], "…"],
  "routeDistance": 21.5,
  "routeDuration": 25,
  "routeSource": "osrm",
  "timeWindow": { "id": "tarde", "label": "tarde (12m-6pm)" },
  "zonesInRoute": [
    { "id": 8, "name": "Kennedy", "riskLevel": "high", "vehicleRisk": "high", "insecurityPercentage": 80, "distanceKm": 0.4 },
    { "id": 11, "name": "Suba", "riskLevel": "low", "vehicleRisk": "low", "insecurityPercentage": 25, "distanceKm": 1.2 }
  ],
  "safestRoute": { "description": "Ruta con alto riesgo…", "avoidZones": ["Kennedy", "Fontibón"] },
  "recentReports": [],
  "recommendation": "Ruta de Suba a Kennedy en moto: riesgo alto. Pasa cerca de Kennedy, con riesgo alto para este medio. Si puedes, busca una alternativa que las evite o extrema las precauciones.",
  "tips": ["Usa casco y ropa reflectiva", "Evita zonas oscuras de noche", "Prefiere vías principales"]
}
```
`recommendation` sale del **nivel de la ruta** y nombra las localidades que lo suben. Antes
copiaba la recomendación de la localidad de origen, y una ruta `high` podía decir "Zona segura"
(corregido en el issue #6). Si la ruta se estimó en línea recta, lo dice.

| Campo | Significado |
|---|---|
| `overallRisk` | El **peor** nivel, para ese medio, entre las localidades del trayecto (`zonesInRoute`) |
| `insecurityPercentage` | Promedio simple del % de inseguridad de las localidades del trayecto (el mismo dato de `GET /api/risk/zones`). 5 solo si no hubiera ninguna, lo que en la práctica no pasa porque origen y destino siempre cuentan |
| `routeDistance` / `routeDuration` | km y minutos. Bici y a pie usan su propio perfil de OSRM; moto y público ajustan con un factor la duración del perfil de carro |
| `routeSource` | `osrm` = ruta real · `straight-line` = OSRM no respondió en 3 s (o no devolvió ruta), línea recta estimada |
| `zonesInRoute` | Localidades del trayecto, de la más cercana a la más lejana: las que tienen su **centro a menos de 3 km de la ruta real** (`routeCoordinates`, la polilínea de OSRM), más las localidades de origen y destino. `distanceKm` es la distancia mínima del centro a la ruta. Una ruta que rodea una localidad no la cuenta; una que la cruza en curva sí |

Errores: `400` falta un campo, `origin` o `destination` no son texto o pasan de 200 caracteres,
o `vehicleType` inválido · `404` (`direccion_no_encontrada`) no se encontró el origen o el
destino en Bogotá (el mensaje dice cuál) · `503` (`geocodificacion_no_disponible`) Nominatim no
respondió en 2,5 s: con el nombre de una localidad sigue funcionando. No exige sesión.

Cada análisis queda registrado en los indicadores (`GET /api/metrics/resumen`), después de
responder: medir nunca demora ni tumba la respuesta.

Variables (todas opcionales): `OSRM_URL` (por defecto `https://routing.openstreetmap.de/routed-{perfil}`;
`{perfil}` se reemplaza por car/bike/foot), `OSRM_TIMEOUT_MS` (3000), `NOMINATIM_URL`,
`NOMINATIM_USER_AGENT` y `NOMINATIM_TIMEOUT_MS` (2500). Para medir el tiempo de respuesta con 20
consultas reales: `npm run medir:tiempos` con la API corriendo. La lógica vive en `services/routeAnalysisService.js` (funciones puras),
`services/routingService.js` (OSRM) y `services/zoneService.js` (zonas).

> `POST /api/risk/analyze` (un segundo algoritmo que daba resultados distintos) y
> `GET /api/route/plan` (respondía "en desarrollo") **se eliminaron** en el issue #2. Hoy
> responden `404`.

---

## Reportes ciudadanos (🔀 entran por CR-001, ver ADR-005)

### `GET /api/reports`
Capa pública de puntos del mapa, agrupados por hecho. **Sin datos personales** (lee una vista
sanitizada: sin `user_id`, sin descripción, coordenadas difuminadas).

| Query | Qué hace |
|---|---|
| `days` | Ventana en días (por defecto 7, máximo 30) |
| `mode` | Solo los tipos que afectan a ese medio |
| `locality` | Solo una localidad |

### `GET /api/reports/mine` 🔒
Los reportes propios, cuántos están incompletos y cuántos quedan hoy (`remainingToday`).

### `POST /api/reports` 🔒
```json
{ "lat": 4.65, "lng": -74.06, "type": "celular", "occurredAt": null }
```
Solo `lat` y `lng` son obligatorios. `type`: `celular` · `moto` · `carro` · `bici` · `vivienda` ·
`transmilenio` · `otro`. Máximo 5 por usuario en 24 h. Responde `201` con `report`,
`remainingToday` y `undoWindowSeconds` (30).
Errores: `400` ubicación inválida o fuera de Bogotá (`outside_bogota`) · `401` sin sesión
(`no_autenticado`) o token inválido (`sesion_invalida`) · `429` límite diario.

### `PATCH /api/reports/:id` 🔒
Completa un reporte propio: `type`, `station`, `description` (máx. 500), rango de hora, punto.

### `DELETE /api/reports/:id` 🔒
Deshace un reporte propio dentro de los 30 s siguientes.

---

## Indicadores (issue #7 · III.F del documento)

### `GET /api/metrics/resumen?dias=30`
Los tres indicadores del documento, **solo agregados** (nunca filas individuales). `dias` es
opcional, entero de 1 a 365, 30 por defecto.
```json
{
  "success": true,
  "data": {
    "desde": "2026-08-24T23:40:00.000Z",
    "dias": 30,
    "totalConsultas": 128,
    "duracionMs": { "p50": 640, "p90": 1850 },
    "porcentajeRespaldo": 3.1,
    "porcentajeEvitaAlto": 42.2,
    "porcentajeRutaReal": 96.9
  }
}
```

| Campo | Significado |
|---|---|
| `totalConsultas` | Análisis de ruta registrados en el periodo |
| `duracionMs` | Percentiles 50 y 90 del tiempo de respuesta del análisis, en ms |
| `porcentajeRespaldo` | % de consultas que cayeron al dataset de respaldo en vez de Supabase |
| `porcentajeEvitaAlto` | % de rutas que no pasan por ninguna zona de riesgo alto para su medio |
| `porcentajeRutaReal` | % de rutas calculadas con OSRM (el resto, línea recta) |

---

## Fuentes de datos complementarias (issue #4 · Anexo A y IV)

Hurto a vehículos y a residencias (Secretaría Distrital de Seguridad, Convivencia y Justicia —
capa "Delitos Alto Impacto Localidad") y hurtos en transporte público (reportes ciudadanos,
CR-001). Ver `data-processing/README.md` para de dónde sale cada fuente y cómo se refresca.

### `GET /api/sources`
Las 20 localidades con las tres fuentes. No exige sesión: son datos oficiales de solo lectura,
igual que `/api/risk/zones`.
```json
{
  "success": true,
  "total": 20,
  "data": [{
    "localityId": 8, "localityName": "Kennedy",
    "period": "2026-ene-ago", "source": "SDSCJ - Delito de Alto Impacto (oaiee.scj.gov.co)",
    "hurtoAutomotores": 352, "hurtoMotocicletas": 360, "hurtoResidencias": 469,
    "hurtoTransportePublico": 0
  }]
}
```
`hurtoTransportePublico` viene de los reportes ciudadanos de tipo `transmilenio`: puede estar en
0 mientras no haya reportes de ese tipo en esa localidad, no es un respaldo con relleno.

### `GET /api/sources/:localityId`
Una localidad (1-20). `404` si no hay datos cargados para ese id, `400` si no es un entero.

Errores: `503 fuentes_no_disponibles` si Supabase no está configurado o no responde.

Con 0 consultas, los percentiles y porcentajes vienen en `null`. Errores: `400` `dias` inválido ·
`503` (`metricas_no_disponibles`) el backend no tiene `SUPABASE_SECRET_KEY` o Supabase no respondió.

Los datos salen de la tabla `route_metrics`, sin datos personales: guarda la **localidad** de
origen y destino, nunca coordenadas, IP ni `user_id`. Solo el backend la lee y escribe (RLS sin
políticas). Cada `POST /api/route/analyze` que responde 200 deja una fila (desde el issue #5).

---

## Salud

### `GET /health`
```json
{ "status": "…", "storage": { "backend": "supabase", "adminKey": false, "supabaseReachable": true } }
```
Si Supabase no responde: `supabaseReachable: false` y `supabaseError` con el motivo.

---

## Perfil proactivo 🔒 (issue #8 · IV.A y Anexo A 4.4)

Todos exigen sesión. Nada se guarda ni se deduce sin **consentimiento** (Ley 1581): son tres
permisos separados y todos empiezan en `false`.

| Propósito | Qué permite |
|---|---|
| `route_history` | Guardar las consultas de ruta (solo localidades y hora, nunca coordenadas) |
| `habitual_routes` | Deducir rutas habituales del historial |
| `alerts` | Crear alertas cuando sube el riesgo de una ruta habitual |

### `GET /api/profile/consents` · `POST /api/profile/consents`
`GET` devuelve el estado vigente: `{ "route_history": true, "habitual_routes": true, "alerts": false }`.
`POST` otorga o revoca uno: `{ "purpose": "alerts", "granted": true }` (opcional `policyVersion`).
Nunca borra: añade una fila, para que quede prueba de cada decisión. Responde el estado nuevo.

### `GET /api/profile/preferences` · `PUT /api/profile/preferences`
```json
{ "alertsEnabled": true, "minRiskLevel": "high", "quietHoursStart": 22, "quietHoursEnd": 6 }
```
Todos los campos son opcionales en el `PUT`. `minRiskLevel`: `medium` o `high`. Horas de 0 a 23 en
hora de Bogotá, o `null`. Las alertas nacen **apagadas** (`alertsEnabled: false`).

### `POST /api/profile/refresh`
Corre el motor para la persona: detecta sus rutas habituales (la misma ruta origen-destino-medio en
**3 días distintos**, en la misma franja horaria) y crea una alerta por cada ruta cuyo nivel **subió**
hasta el mínimo que pidió. La interfaz lo llama al abrir la app.
```json
{ "rutasHabituales": 1, "alertasNuevas": [ { "id": 7, "previous_level": "medium", "new_level": "high", "zones": ["Kennedy"] } ],
  "consentimientos": { "route_history": true, "habitual_routes": true, "alerts": true } }
```
Sin consentimiento de `habitual_routes` no hace nada. La primera evaluación de una ruta fija su
nivel base y no alerta. `503` (`motor_no_disponible`) si el backend no tiene la llave secreta.

### `GET /api/profile/alerts?unseen=true` · `PATCH /api/profile/alerts/:id/seen`
Las últimas 50 alertas, con la ruta habitual a la que pertenecen (`habitual_routes`). `unseen=true`
trae solo las no vistas. El `PATCH` la marca como vista; `404` si no es suya o no existe.

### `GET /api/profile/habitual-routes`
Las rutas habituales detectadas: localidades de origen y destino, medio, franja, días de la semana
(0 = domingo), `confidence` (0 a 1: fracción de sus días activos en que hizo esa ruta) y el último nivel.

### `DELETE /api/profile/history`
Derecho de supresión: borra el historial y las rutas habituales deducidas de él (sus alertas se
borran en cascada).

> ⚠️ Pendiente de conectar: `POST /api/route/analyze` todavía no guarda la consulta en el historial.
> Se conecta cuando se fusionen #2, #5 y #6, que reorganizan ese endpoint.
