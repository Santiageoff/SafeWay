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
const metrics = require('../services/metricsService')
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

        const route = await routingService.getRoute(desde.coordinates, hasta.coordinates, vehicleType)
        const resultado = analizarRuta({
            zones, originZone: comoZona(desde), destinationZone: comoZona(hasta), vehicleType, route, timeWindow
        })

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
