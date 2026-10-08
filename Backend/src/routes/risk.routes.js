const express = require('express')
const router = express.Router()

// Capa HTTP del riesgo por localidad: valida, llama a los servicios y
// responde. La carga de zonas vive en services/zoneService.js (issue #2).
const zoneService = require('../services/zoneService')

// Permite consultar el mapa a otra hora (?at=2026-09-09T03:00:00Z).
// Por defecto es "ahora", que es lo que usa la app: el mapa se repinta solo.
function requestedTime(req) {
    if (!req.query.at) return new Date()
    const at = new Date(req.query.at)
    return Number.isNaN(at.getTime()) ? new Date() : at
}

// Texto de búsqueda válido o null. `?q=a&q=b` llega como arreglo: se rechaza.
function textoDeBusqueda(q) {
    return typeof q === 'string' && q.trim() !== '' ? q : null
}

// GET /api/risk/search?q=text - Buscar zonas por nombre (máximo 5 resultados)
router.get('/search', async (req, res) => {
    const q = textoDeBusqueda(req.query.q)
    if (!q) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere el parámetro de búsqueda: q'
        })
    }

    const { zones } = await zoneService.loadZones(req.query.mode, requestedTime(req))
    const results = zoneService.searchByName(zones, q).slice(0, 5)

    res.json({ success: true, query: q, total: results.length, data: results })
})

// GET /api/risk/zones - Todas las zonas, con el riesgo del momento
//
// ?mode=carro|moto|bici|peatón|publico  medio de transporte (filtra qué reportes cuentan)
// ?at=<ISO>                             hora de consulta (por defecto, ahora)
// ?q=<texto>                            búsqueda por nombre
router.get('/zones', async (req, res) => {
    const result = await zoneService.loadZones(req.query.mode, requestedTime(req))

    const meta = {
        mode: result.mode,
        timeWindow: result.timeWindow,
        reportClusters: result.clusterCount,
        // De donde salio cada mitad del dato, para poder decirselo al usuario
        // en vez de disimular una degradacion.
        localitySource: result.localitySource,
        live: result.live
    }

    const q = textoDeBusqueda(req.query.q)
    if (q) {
        const results = zoneService.searchByName(result.zones, q)
        return res.json({ success: true, query: q, total: results.length, data: results, meta })
    }

    res.json({ success: true, data: result.zones, total: result.zones.length, meta })
})

// GET /api/risk/zones/:id - Obtener una zona por ID
router.get('/zones/:id', async (req, res) => {
    const zoneId = Number(req.params.id)
    if (!Number.isInteger(zoneId)) {
        return res.status(400).json({ success: false, error: 'El id de la zona debe ser un número entero' })
    }

    const { zones } = await zoneService.loadZones(req.query.mode, requestedTime(req))
    const zone = zones.find(z => z.id === zoneId)

    if (!zone) return res.status(404).json({ success: false, error: 'Zona no encontrada' })
    res.json({ success: true, data: zone })
})

// GET /api/risk/zone/:localidad - Detalle por nombre de localidad
// (lo consume getZoneDetail del frontend)
router.get('/zone/:localidad', async (req, res) => {
    const { zones } = await zoneService.loadZones(req.query.vehicle || req.query.mode, requestedTime(req))
    const zone = zoneService.findByName(zones, req.params.localidad)

    if (!zone) return res.status(404).json({ success: false, error: 'Localidad no encontrada' })
    res.json({ success: true, data: zone })
})

module.exports = router
