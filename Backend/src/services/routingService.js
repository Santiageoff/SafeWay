// Trazado de la ruta entre dos puntos (OSRM), con respaldo a línea recta.
//
// Un perfil por medio de transporte (issue #5). El OSRM público de
// project-osrm.org solo trae `driving`; el de routing.openstreetmap.de expone
// un servidor por perfil: routed-car, routed-bike y routed-foot.
//
//   carro, moto, publico -> car   (moto y público ajustan el tiempo con un factor)
//   bici                 -> bike
//   peatón               -> foot
//
// OSRM_URL es configurable (un servidor propio, o uno falso en las pruebas).
// Si contiene `{perfil}`, se reemplaza por car/bike/foot; si no, se usa tal
// cual para todos los medios. A los OSRM_TIMEOUT_MS sin respuesta se usa la
// línea recta, y se dice (`routeSource: "straight-line"`).

const { distanceKm } = require('../utils/geo')

const OSRM_URL = (process.env.OSRM_URL || 'https://routing.openstreetmap.de/routed-{perfil}').replace(/\/+$/, '')
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS) || 3000

const PERFIL = { carro: 'car', moto: 'car', publico: 'car', bici: 'bike', 'peatón': 'foot' }

// Ajuste del tiempo cuando el perfil no es el del medio: la moto se filtra en
// el tráfico; el transporte público suma paradas, trasbordos y esperas.
const FACTOR_SOBRE_CARRO = { carro: 1, moto: 0.85, publico: 1.8, bici: 1, 'peatón': 1 }

// Para el respaldo en línea recta: velocidad media aproximada en Bogotá (km/h).
const VELOCIDAD_KMH = { carro: 30, moto: 35, publico: 17, bici: 15, 'peatón': 4.5 }

const redondear1 = (n) => Math.round(n * 10) / 10

function perfilDe(vehicleType) {
    return PERFIL[vehicleType] || 'car'
}

function urlDe(vehicleType, originCoords, destCoords) {
    const base = OSRM_URL.replace('{perfil}', perfilDe(vehicleType))
    return `${base}/route/v1/driving/` +
        `${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}` +
        '?overview=full&geometries=geojson'
}

function lineaRecta(originCoords, destCoords, vehicleType) {
    const km = distanceKm(originCoords[0], originCoords[1], destCoords[0], destCoords[1])
    const velocidad = VELOCIDAD_KMH[vehicleType] || VELOCIDAD_KMH.carro
    return {
        routeCoordinates: [originCoords, destCoords],
        routeDistance: redondear1(km),
        routeDuration: Math.round(km / velocidad * 60),
        routeSource: 'straight-line',
        routeProfile: null
    }
}

// URL de OSRM para una ruta que pasa por `puntos` ([lat, lng], en orden).
// Con `alternativas`, OSRM devuelve hasta 3 rutas distintas entre los dos
// extremos (solo funciona con 2 puntos, sin desvíos).
function urlParaPuntos(vehicleType, puntos, { alternativas = false } = {}) {
    const base = OSRM_URL.replace('{perfil}', perfilDe(vehicleType))
    const coords = puntos.map(p => `${p[1]},${p[0]}`).join(';')
    const extra = alternativas && puntos.length === 2 ? '&alternatives=3' : ''
    return `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson${extra}`
}

function desdeOsrm(ruta, vehicleType) {
    const factor = FACTOR_SOBRE_CARRO[vehicleType] ?? 1
    return {
        routeCoordinates: ruta.geometry.coordinates.map(c => [c[1], c[0]]),
        routeDistance: redondear1(ruta.distance / 1000),
        routeDuration: Math.round(ruta.duration / 60 * factor),
        routeSource: 'osrm',
        routeProfile: perfilDe(vehicleType)
    }
}

// Todas las rutas que OSRM devuelva para esos puntos. Nunca lanza: si OSRM
// falla o no responde a tiempo, devuelve [] y quien llama decide.
async function getRoutes(puntos, vehicleType, { alternativas = false } = {}) {
    try {
        const response = await fetch(urlParaPuntos(vehicleType, puntos, { alternativas }), {
            headers: { 'User-Agent': 'SafeWay/1.0 (+https://github.com/Santiageoff/SafeWay)' },
            signal: AbortSignal.timeout(OSRM_TIMEOUT_MS)
        })
        const data = await response.json()
        if (Array.isArray(data.routes) && data.routes.length > 0) {
            return data.routes.map(r => desdeOsrm(r, vehicleType))
        }
        console.error('[routing] OSRM no devolvió ruta:', data.code || response.status)
    } catch (err) {
        console.error('[routing] OSRM no respondió:', err.message)
    }
    return []
}

// La ruta principal entre dos puntos, o la línea recta si OSRM no responde.
async function getRoute(originCoords, destCoords, vehicleType) {
    const [ruta] = await getRoutes([originCoords, destCoords], vehicleType)
    if (ruta) return ruta
    // Respaldo: línea recta. Se marca como tal para no presentarla como ruta real.
    return lineaRecta(originCoords, destCoords, vehicleType)
}

module.exports = { getRoute, getRoutes, lineaRecta, perfilDe, urlDe, urlParaPuntos }
