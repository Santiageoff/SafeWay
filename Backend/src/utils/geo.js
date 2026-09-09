// Utilidades geográficas compartidas.
// Antes `distanceKm` y `pointToLineDistance` estaban copiadas en risk.routes.js
// y route.route.js con nombres distintos.

const { localities } = require('../data/localities')

// Caja envolvente de Bogotá D.C. incluyendo Sumapaz (que baja hasta ~3.7 de latitud).
// Sirve para rechazar reportes con GPS incoherente (ej. alguien manipulando la API).
const BOGOTA_BOUNDS = { minLat: 3.65, maxLat: 4.85, minLng: -74.55, maxLng: -73.95 }

// Distancia en kilómetros entre dos puntos (fórmula de Haversine)
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Distancia de un punto al segmento origen-destino
function distancePointToLine(point, lineStart, lineEnd) {
    const [px, py] = point
    const [x1, y1] = lineStart
    const [x2, y2] = lineEnd
    const dx = x2 - x1
    const dy = y2 - y1
    if (dx === 0 && dy === 0) return distanceKm(px, py, x1, y1)
    const t = Math.max(0, Math.min(1,
        ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return distanceKm(px, py, x1 + t * dx, y1 + t * dy)
}

function isInsideBogota(lat, lng) {
    return lat >= BOGOTA_BOUNDS.minLat && lat <= BOGOTA_BOUNDS.maxLat &&
        lng >= BOGOTA_BOUNDS.minLng && lng <= BOGOTA_BOUNDS.maxLng
}

// Asigna un punto a una localidad por centroide más cercano.
//
// LIMITACIÓN CONOCIDA: es una aproximación de Voronoi, no un point-in-polygon real,
// porque el proyecto no tiene los polígonos de las localidades. Cerca de los bordes
// puede equivocarse. La mejora es cargar el GeoJSON de localidades de Datos Abiertos
// Bogotá y hacer point-in-polygon; queda como trabajo futuro.
function localityForPoint(lat, lng) {
    let closest = null
    let minDistance = Infinity

    for (const locality of localities) {
        const [zLat, zLng] = locality.coordinates
        const d = distanceKm(lat, lng, zLat, zLng)
        if (d < minDistance) {
            minDistance = d
            closest = locality
        }
    }

    return { locality: closest, distanceKm: minDistance }
}

module.exports = {
    distanceKm,
    distancePointToLine,
    isInsideBogota,
    localityForPoint,
    BOGOTA_BOUNDS
}
