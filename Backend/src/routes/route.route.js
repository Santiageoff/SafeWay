const express = require('express')
const router = express.Router()

// Capa HTTP del análisis de ruta: valida, llama a los servicios y responde.
//   · zoneService          -> las 20 zonas con el riesgo del momento
//   · routingService       -> el trazado (OSRM, con respaldo a línea recta)
//   · routeAnalysisService -> el cálculo del riesgo (funciones puras)
const zoneService = require('../services/zoneService')
const routingService = require('../services/routingService')
const { analizarRuta, VEHICLE_TYPES } = require('../services/routeAnalysisService')

const esTexto = (v) => typeof v === 'string' && v.trim() !== ''

// POST /api/route/analyze - Analizar riesgo de una ruta
// Body: { origin: string, destination: string, vehicleType: string }
router.post('/analyze', async (req, res) => {
    const { origin, destination, vehicleType } = req.body || {}

    if (!esTexto(origin) || !esTexto(destination) || !vehicleType) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere: origin (nombre de zona), destination (nombre de zona), vehicleType (carro/moto/bici/peatón/publico)'
        })
    }

    if (!VEHICLE_TYPES.includes(vehicleType)) {
        return res.status(400).json({
            success: false,
            error: `Tipo de vehículo inválido. Debe ser uno de: ${VEHICLE_TYPES.join(', ')}`
        })
    }

    const { zones, timeWindow } = await zoneService.loadZones(vehicleType)

    const originZone = zoneService.findByName(zones, origin)
    if (!originZone) {
        return res.status(404).json({ success: false, error: 'No encontramos la zona de origen: ' + origin })
    }

    const destinationZone = zoneService.findByName(zones, destination)
    if (!destinationZone) {
        return res.status(404).json({ success: false, error: 'No encontramos la zona de destino: ' + destination })
    }

    const route = await routingService.getRoute(originZone.coordinates, destinationZone.coordinates, vehicleType)

    res.json({
        success: true,
        ...analizarRuta({ zones, originZone, destinationZone, vehicleType, route, timeWindow })
    })
})

module.exports = router
