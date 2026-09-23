const express = require('express')
const router = express.Router()

// Las 20 localidades ya no viven en este repositorio: estan en la tabla
// `localities` de Supabase y se leen por localityStore, que mantiene el
// archivo original como respaldo si la base no responde.
const { distancePointToLine } = require('../utils/geo')
const { buildZones, MAX_AGE_DAYS } = require('../services/dynamicRiskService')
const store = require('../services/reportStore')
const localityStore = require('../services/localityStore')

const DAY_MS = 24 * 60 * 60 * 1000

// Carga las zonas con el riesgo ya mezclado con los reportes ciudadanos.
//
// Dos fuentes, y cada una degrada distinto a propósito:
//   · localidades -> Supabase, con respaldo al archivo del repo si no responde.
//     Son datos oficiales de solo lectura; el mapa no puede quedarse en blanco.
//   · reportes    -> la VISTA pública sanitizada. Si falla, se sigue mostrando
//     la línea base histórica: mejor un mapa sin la capa viva que ningún mapa.
async function loadZones(mode, at) {
    const since = new Date(Date.now() - MAX_AGE_DAYS * DAY_MS).toISOString()
    const { localities, source } = await localityStore.getLocalities()

    try {
        const reports = await store.listPublic(since)
        return { ...buildZones(reports, { mode, at, localities }), live: true, localitySource: source }
    } catch (err) {
        console.error('[risk] no se pudieron cargar los reportes, usando la linea base:', err.message)
        return { ...buildZones([], { mode, at, localities }), live: false, localitySource: source }
    }
}

// Permite consultar el mapa a otra hora (?at=2026-09-09T03:00:00Z).
// Por defecto es "ahora", que es lo que usa la app: el mapa se repinta solo.
function requestedTime(req) {
    if (!req.query.at) return new Date()
    const at = new Date(req.query.at)
    return Number.isNaN(at.getTime()) ? new Date() : at
}

// GET /api/risk/search?q=text - Buscar zonas por nombre (máximo 5 resultados)
router.get('/search', async (req, res) => {
    const { q } = req.query

    if (!q || q.trim() === '') {
        return res.status(400).json({
            success: false,
            error: 'Se requiere el parámetro de búsqueda: q'
        })
    }

    const { zones } = await loadZones(req.query.mode, requestedTime(req))
    const results = zones.filter(z =>
        z.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 5)

    res.json({
        success: true,
        query: q,
        total: results.length,
        data: results
    })
})

// GET /api/risk/zones - Todas las zonas, con el riesgo del momento
//
// ?mode=carro|moto|bici|peatón|publico  medio de transporte (filtra qué reportes cuentan)
// ?at=<ISO>                             hora de consulta (por defecto, ahora)
// ?q=<texto>                            búsqueda por nombre
router.get('/zones', async (req, res) => {
    const { q } = req.query
    const result = await loadZones(req.query.mode, requestedTime(req))

    const meta = {
        mode: result.mode,
        timeWindow: result.timeWindow,
        reportClusters: result.clusterCount,
        // De donde salio cada mitad del dato, para poder decirselo al usuario
        // en vez de disimular una degradacion.
        localitySource: result.localitySource,
        live: result.live
    }

    if (q && q.trim() !== '') {
        const searchTerm = q.toLowerCase().trim()
        const results = result.zones.filter(zone =>
            zone.name.toLowerCase().includes(searchTerm)
        )
        return res.json({ success: true, query: q, total: results.length, data: results, meta })
    }

    res.json({ success: true, data: result.zones, total: result.zones.length, meta })
})

// GET /api/risk/zones/:id - Obtener una zona por ID
router.get('/zones/:id', async (req, res) => {
    const zoneId = parseInt(req.params.id)
    const { zones } = await loadZones(req.query.mode, requestedTime(req))
    const zone = zones.find(z => z.id === zoneId)

    if (!zone) return res.status(404).json({ success: false, error: 'Zona no encontrada' })
    res.json({ success: true, data: zone })
})

// GET /api/risk/zone/:localidad - Detalle por nombre de localidad
// (lo consume getZoneDetail del frontend)
router.get('/zone/:localidad', async (req, res) => {
    const { zones } = await loadZones(req.query.vehicle || req.query.mode, requestedTime(req))
    const name = decodeURIComponent(req.params.localidad).toLowerCase()
    const zone = zones.find(z => z.name.toLowerCase() === name) ||
        zones.find(z => z.name.toLowerCase().includes(name))

    if (!zone) return res.status(404).json({ success: false, error: 'Localidad no encontrada' })
    res.json({ success: true, data: zone })
})

// POST /api/risk/analyze - Analizar riesgo de una ruta entre dos coordenadas
router.post('/analyze', async (req, res) => {
    const { origin, destination, vehicleType } = req.body

    if (!origin || !destination || !vehicleType) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere origin, destination y vehicleType'
        })
    }

    const thresholdKm = 2 // Distancia máxima de la ruta para considerar una zona
    const { zones, timeWindow } = await loadZones(vehicleType, requestedTime(req))

    const nearbyZones = zones.filter(zone =>
        distancePointToLine(zone.coordinates, origin, destination) < thresholdKm
    )

    if (nearbyZones.length === 0) {
        return res.json({
            success: true,
            riskLevel: 'low',
            zones: [],
            recommendation: 'Ruta segura. No se detectan zonas de riesgo significativas en el trayecto.',
            vehicleType,
            timeWindow
        })
    }

    // Calcular nivel de riesgo promedio basado en el tipo de vehículo
    const riskValues = { low: 1, medium: 2, high: 3 }
    const totalRisk = nearbyZones.reduce((sum, zone) => {
        const zoneRisk = zone.vehicleRisks[vehicleType] || zone.riskLevel
        return sum + riskValues[zoneRisk]
    }, 0)

    const avgRisk = totalRisk / nearbyZones.length
    let overallRiskLevel = 'low'
    if (avgRisk >= 2.5) overallRiskLevel = 'high'
    else if (avgRisk >= 1.5) overallRiskLevel = 'medium'

    // Generar recomendación
    let recommendation = ''
    if (overallRiskLevel === 'high') {
        recommendation = `ALTO RIESGO: El trayecto atraviesa ${nearbyZones.length} zona(s) de riesgo alto para ${vehicleType}. `
        recommendation += 'Se recomienda evitar esta ruta o tomar precauciones extremas como usar vías alternas, '
        recommendation += 'mantener las puertas bloqueadas y no detenerse en zonas aisladas.'
    } else if (overallRiskLevel === 'medium') {
        recommendation = `RIESGO MEDIO: El trayecto atraviesa ${nearbyZones.length} zona(s) con nivel de riesgo moderado para ${vehicleType}. `
        recommendation += 'Se recomienda mantener cautela, evitar zonas oscuras y tener precaución con posibles hurtos.'
    } else {
        recommendation = 'Ruta relativamente segura. Se recomienda mantener las precauciones habituales de seguridad vial.'
    }

    res.json({
        success: true,
        riskLevel: overallRiskLevel,
        zones: nearbyZones.map(z => ({
            name: z.name,
            riskLevel: z.riskLevel,
            vehicleRisk: z.vehicleRisks[vehicleType] || z.riskLevel,
            accidents: z.accidents,
            thefts: z.thefts,
            reportCount: z.reportCount,
            dominantWindow: z.dominantWindow
        })),
        recommendation,
        vehicleType,
        timeWindow,
        zonesCount: nearbyZones.length
    })
})

module.exports = router
