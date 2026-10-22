const express = require('express')
const router = express.Router()

// Capa HTTP del análisis de ruta: valida, llama a los servicios y responde.
//   · zoneService          -> las 20 zonas con el riesgo del momento
//   · geocodingService     -> texto ("Calle 72 # 7-30" o "Suba") -> punto en Bogotá
//   · routingService       -> el trazado según el medio (OSRM, con respaldo a línea recta)
//   · routeAnalysisService -> el cálculo del riesgo (funciones puras)
//   · metricsService       -> los indicadores del documento (issue #7)
const zoneService = require('../services/zoneService')
const geocoding = require('../services/geocodingService')
const routingService = require('../services/routingService')
const safeRoute = require('../services/safeRouteService')
const metrics = require('../services/metricsService')
const profile = require('../services/proactiveService')
const { sesionOpcional } = require('../middleware/auth')
const { analizarRuta, VEHICLE_TYPES } = require('../services/routeAnalysisService')

const esTexto = (v) => typeof v === 'string' && v.trim() !== ''

// Punto geocodificado -> la forma que espera el análisis.
function comoZona(punto) {
    return {
        id: punto.locality?.id ?? null,
        name: punto.name,
        coordinates: punto.coordinates,
        recommendation: punto.locality?.recommendation || ''
    }
}

// POST /api/route/analyze - Analizar riesgo de una ruta
// Body: { origin: string, destination: string, vehicleType: string }
// origin y destination pueden ser una dirección ("Calle 72 # 7-30") o el
// nombre de una localidad ("Suba").
router.post('/analyze', async (req, res, next) => {
    const fin = metrics.cronometro()
    // Si trae sesión, se verifica EN PARALELO con el análisis y se usa solo
    // después de responder: no suma tiempo a la consulta.
    const sesion = sesionOpcional(req)
    const { origin, destination, vehicleType } = req.body || {}

    if (!esTexto(origin) || !esTexto(destination) || !vehicleType) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere: origin (dirección o localidad), destination (dirección o localidad), vehicleType (carro/moto/bici/peatón/publico)'
        })
    }

    if (!VEHICLE_TYPES.includes(vehicleType)) {
        return res.status(400).json({
            success: false,
            error: `Tipo de vehículo inválido. Debe ser uno de: ${VEHICLE_TYPES.join(', ')}`
        })
    }

    try {
        const { zones, timeWindow, localitySource } = await zoneService.loadZones(vehicleType)

        // En paralelo: el turno de 1 petición por segundo a Nominatim lo
        // administra el propio servicio.
        const [desde, hasta] = await Promise.all([
            geocoding.geocodificar(origin, zones).catch(err => { err.lado = 'origen'; throw err }),
            geocoding.geocodificar(destination, zones).catch(err => { err.lado = 'destino'; throw err })
        ])

        // La ruta más segura entre la rápida, las alternativas de OSRM y
        // desvíos alrededor de las zonas altas (issue: evitar zonas rojas).
        // Origen y destino no cuentan para elegir: hay que llegar a ellos.
        const extremos = [desde.locality?.id, hasta.locality?.id].filter(id => id != null)
        const busqueda = await safeRoute.buscarRutaSegura({
            origen: desde.coordinates, destino: hasta.coordinates, vehicleType, zones, extremos,
            getRoutes: routingService.getRoutes
        })
        // Si OSRM no respondió: línea recta, como siempre, y sin opciones.
        const route = busqueda
            ? busqueda.segura.ruta
            : routingService.lineaRecta(desde.coordinates, hasta.coordinates, vehicleType)

        const base = { zones, originZone: comoZona(desde), destinationZone: comoZona(hasta), vehicleType, timeWindow }
        const resultado = analizarRuta({ ...base, route })

        // Las opciones para que la persona escoja en el mapa. La principal
        // (los campos de arriba) es siempre la recomendada: la más segura.
        if (busqueda) {
            const eleccion = safeRoute.resumirEleccion(busqueda, zones, vehicleType, extremos)
            resultado.recommendation += eleccion.texto
            const { texto, ...safestChoice } = eleccion
            resultado.safestChoice = safestChoice
            const opcion = (id, analisis, ruta) => ({
                id,
                routeCoordinates: ruta.routeCoordinates,
                routeDistance: ruta.routeDistance,
                routeDuration: ruta.routeDuration,
                overallRisk: analisis.overallRisk,
                insecurityPercentage: analisis.insecurityPercentage,
                zonesInRoute: analisis.zonesInRoute.map(z => z.name)
            })
            resultado.routeOptions = [{ ...opcion('segura', resultado, route), recommended: true }]
            if (busqueda.rapida !== busqueda.segura) {
                const rapida = analizarRuta({ ...base, route: busqueda.rapida.ruta })
                resultado.routeOptions.push({ ...opcion('rapida', rapida, busqueda.rapida.ruta), recommended: false })
            }
        }

        // Datos extra que no rompen la forma que ya usa el frontend.
        resultado.origin.locality = desde.locality?.name ?? null
        resultado.origin.source = desde.source
        resultado.destination.locality = hasta.locality?.name ?? null
        resultado.destination.source = hasta.source
        resultado.routeProfile = route.routeProfile

        res.json({ success: true, ...resultado })

        // Medir nunca tumba la respuesta: ya se envió, y registrar() no lanza.
        metrics.registrar({
            mode: vehicleType,
            originLocality: resultado.origin.locality,
            destinationLocality: resultado.destination.locality,
            durationMs: fin(),
            localitySource,
            routeSource: route.routeSource,
            overallRisk: resultado.overallRisk,
            evitaAlto: metrics.evitaAlto(resultado.zonesInRoute, vehicleType)
        })

        // Historial y motor proactivo (issue #8), solo con sesión. Guarda la
        // LOCALIDAD de origen y destino, nunca las coordenadas ni la dirección.
        sesion.then(s => profile.registrarAnalisis(s, {
            originLocalityId: desde.locality?.id,
            destinationLocalityId: hasta.locality?.id,
            vehicleType,
            riskLevel: resultado.overallRisk
        }, zones)).catch(err => console.error('[route] historial:', err.message))
    } catch (err) {
        if (err instanceof geocoding.GeocodingError) {
            const mensaje = err.statusCode === 404
                ? `No encontramos la ${err.lado === 'origen' ? 'dirección de origen' : 'dirección de destino'}: ${err.lado === 'origen' ? origin : destination}`
                : err.message
            return res.status(err.statusCode).json({ success: false, code: err.code, error: mensaje })
        }
        next(err)
    }
})

module.exports = router
