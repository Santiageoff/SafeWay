// Trazado de la ruta entre dos puntos (OSRM), con respaldo a línea recta.
//
// OSRM_URL permite apuntar a otro servidor (uno propio, o uno falso en las
// pruebas). Sin timeout, un OSRM lento dejaba la petición del usuario
// esperando sin límite; ahora a los OSRM_TIMEOUT_MS se usa la línea recta.
// La geocodificación y los perfiles por medio de transporte son del issue #5.

const { distanceKm } = require('../utils/geo')

const OSRM_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/+$/, '')
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS) || 4000

// OSRM público solo expone el perfil `driving`. Queda explícito en la
// respuesta (`routeSource`) para no presentar como exacto un tiempo que no lo es.
const OSRM_PROFILE = 'driving'

// Velocidad media aproximada en Bogotá, para corregir la duración que OSRM
// calcula siempre como si fueras en carro.
const SPEED_FACTOR = {
    carro: 1,
    moto: 0.85,   // se filtra en el tráfico: llega antes
    bici: 3.5,
    'peatón': 11,
    publico: 1.8  // paradas, trasbordos y esperas
}

const redondear1 = (n) => Math.round(n * 10) / 10

function lineaRecta(originCoords, destCoords, vehicleType) {
    const km = distanceKm(originCoords[0], originCoords[1], destCoords[0], destCoords[1])
    const factor = SPEED_FACTOR[vehicleType] || 1
    return {
        routeCoordinates: [originCoords, destCoords],
        routeDistance: redondear1(km),
        routeDuration: Math.round(km / 30 * 60 * factor),
        routeSource: 'straight-line'
    }
}

async function getRoute(originCoords, destCoords, vehicleType) {
    const url = `${OSRM_URL}/route/v1/${OSRM_PROFILE}/` +
        `${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}` +
        '?overview=full&geometries=geojson'

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) })
        const data = await response.json()
        const ruta = data.routes && data.routes[0]
        if (ruta) {
            const factor = SPEED_FACTOR[vehicleType] || 1
            return {
                routeCoordinates: ruta.geometry.coordinates.map(c => [c[1], c[0]]),
                routeDistance: redondear1(ruta.distance / 1000),
                routeDuration: Math.round(ruta.duration / 60 * factor),
                routeSource: 'osrm'
            }
        }
        console.error('[routing] OSRM no devolvió ruta:', data.code || response.status)
    } catch (err) {
        console.error('[routing] OSRM no respondió, usando línea recta:', err.message)
    }

    // Respaldo: línea recta. Se marca como tal para no presentarla como ruta real.
    return lineaRecta(originCoords, destCoords, vehicleType)
}

module.exports = { getRoute, lineaRecta, SPEED_FACTOR }
