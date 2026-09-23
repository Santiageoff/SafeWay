const express = require('express')
const router = express.Router()
const fetch = require('node-fetch')

// Las 20 localidades estaban copiadas aquí y en risk.routes.js. Ahora ambos
// leen de la misma fuente, con el riesgo ya mezclado con reportes ciudadanos.
const { distanceKm, distancePointToLine } = require('../utils/geo')
const { buildZones, MAX_AGE_DAYS } = require('../services/dynamicRiskService')
const store = require('../services/reportStore')
const localityStore = require('../services/localityStore')

const DAY_MS = 24 * 60 * 60 * 1000

// OSRM público solo expone el perfil `driving`. Antes se usaba para los cuatro
// medios sin decirlo; ahora al menos queda explícito en la respuesta para no
// presentar como exacto un tiempo que no lo es.
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

// Carga las zonas con el riesgo ya mezclado con los reportes ciudadanos.
//
// Dos fuentes, y cada una degrada distinto a propósito:
//   · localidades -> Supabase, con respaldo al archivo del repo si no responde.
//     Son datos oficiales de solo lectura; el mapa no puede quedarse en blanco.
//   · reportes    -> la VISTA pública sanitizada. Si falla, se sigue mostrando
//     la línea base histórica: mejor un mapa sin la capa viva que ningún mapa.
async function loadZones(mode, at = new Date()) {
    const since = new Date(Date.now() - MAX_AGE_DAYS * DAY_MS).toISOString()
    const { localities, source } = await localityStore.getLocalities()

    try {
        const reports = await store.listPublic(since)
        return { ...buildZones(reports, { mode, at, localities }), live: true, localitySource: source }
    } catch (err) {
        console.error('[route] no se pudieron cargar los reportes, usando la linea base:', err.message)
        return { ...buildZones([], { mode, at, localities }), live: false, localitySource: source }
    }
}

// Función para obtener ruta real desde OSRM
async function getRealRoute(originCoords, destCoords, vehicleType) {
    const straightLineKm = distanceKm(originCoords[0], originCoords[1], destCoords[0], destCoords[1])

    try {
        const url = `http://router.project-osrm.org/route/v1/${OSRM_PROFILE}/` +
            `${originCoords[1]},${originCoords[0]};` +
            `${destCoords[1]},${destCoords[0]}` +
            `?overview=full&geometries=geojson`

        const response = await fetch(url)
        const data = await response.json()

        if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates
            const factor = SPEED_FACTOR[vehicleType] || 1
            return {
                routeCoordinates: coords.map(c => [c[1], c[0]]),
                routeDistance: Math.round(data.routes[0].distance / 1000 * 10) / 10,
                routeDuration: Math.round(data.routes[0].duration / 60 * factor),
                routeSource: 'osrm'
            }
        }
    } catch (error) {
        console.error('OSRM API error:', error)
    }

    // Respaldo: línea recta. Se marca como tal para no presentarla como ruta real.
    const factor = SPEED_FACTOR[vehicleType] || 1
    return {
        routeCoordinates: [originCoords, destCoords],
        routeDistance: Math.round(straightLineKm * 10) / 10,
        routeDuration: Math.round(straightLineKm / 30 * 60 * factor),
        routeSource: 'straight-line'
    }
}

// GET /api/route/plan - Planificar ruta evitando zonas de riesgo
router.get('/plan', (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de planificación de rutas - en desarrollo',
        data: null
    })
})

// POST /api/route/analyze - Analizar riesgo de una ruta
// Body: { origin: string, destination: string, vehicleType: string }
router.post('/analyze', async (req, res) => {
    const { origin, destination, vehicleType } = req.body

    if (!origin || !destination || !vehicleType) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere: origin (nombre de zona), destination (nombre de zona), vehicleType (carro/moto/bici/peatón/publico)'
        })
    }

    // Validar tipo de vehículo antes de trabajar
    const validVehicleTypes = ['carro', 'moto', 'bici', 'peatón', 'publico']
    if (!validVehicleTypes.includes(vehicleType)) {
        return res.status(400).json({
            success: false,
            error: `Tipo de vehículo inválido. Debe ser uno de: ${validVehicleTypes.join(', ')}`
        })
    }

    const { zones, timeWindow } = await loadZones(vehicleType)

    const originZone = zones.find(z => z.name.toLowerCase().includes(origin.toLowerCase()))
    if (!originZone) {
        return res.status(404).json({
            success: false,
            error: "No encontramos la zona de origen: " + origin
        })
    }

    const destinationZone = zones.find(z => z.name.toLowerCase().includes(destination.toLowerCase()))
    if (!destinationZone) {
        return res.status(404).json({
            success: false,
            error: "No encontramos la zona de destino: " + destination
        })
    }

    const routeData = await getRealRoute(originZone.coordinates, destinationZone.coordinates, vehicleType)

    // Encontrar zonas en la ruta (a menos de 3km de la línea origen-destino)
    const zonesInRoute = zones.filter(z =>
        distancePointToLine(z.coordinates,
            originZone.coordinates,
            destinationZone.coordinates) < 3
    )

    // El riesgo global sale del riesgo POR MEDIO, no del genérico: es el filtro
    // que define la función. En carro pesan los robos de carro; en transporte
    // público, el cosquilleo y el hurto de celular.
    const riskForMode = (z) => z.vehicleRisks?.[vehicleType] || z.riskLevel

    let overallRisk = 'low'
    if (zonesInRoute.some(z => riskForMode(z) === 'high')) {
        overallRisk = 'high'
    } else if (zonesInRoute.some(z => riskForMode(z) === 'medium')) {
        overallRisk = 'medium'
    }

    const insecurityPercentage = zonesInRoute.length > 0
        ? Math.round(zonesInRoute.reduce((sum, z) => sum + (z.insecurityPercentage || 0), 0) / zonesInRoute.length)
        : 5

    // Reportes ciudadanos recientes sobre el trayecto: el aviso concreto de
    // "esto pasó aquí hace poco", que es distinto del color de la localidad.
    const recentReports = zonesInRoute
        .filter(z => z.reportsAffectingMode > 0)
        .map(z => ({
            zone: z.name,
            count: z.reportsAffectingMode,
            lastAt: z.lastReportAt,
            window: z.dominantWindow?.label || null
        }))

    // Generar tips según vehicleType y overallRisk
    let tips = []
    if (vehicleType === 'moto' && overallRisk === 'high') {
        tips = ["Usa casco y ropa reflectiva", "Evita zonas oscuras de noche", "Prefiere vías principales"]
    } else if (vehicleType === 'bici' && overallRisk === 'high') {
        tips = ["Usa ciclovía si está disponible", "Evita circular de noche", "Lleva candado de seguridad"]
    } else if (vehicleType === 'peatón' && overallRisk === 'high') {
        tips = ["Camina por zonas iluminadas", "Evita calles solitarias", "Mantén el celular guardado"]
    } else if (vehicleType === 'publico' && overallRisk === 'high') {
        tips = ["Mantén el celular guardado, no lo uses en el bus", "Cuidado en la aglomeración al entrar y salir", "Lleva el maletín adelante"]
    } else {
        tips = ["Mantén las puertas cerradas", "No te detengas en zonas oscuras", "Usa rutas conocidas"]
    }

    const highRiskZones = zonesInRoute.filter(z => riskForMode(z) === 'high').map(z => z.name)
    const safestRoute = {
        description: overallRisk === 'low'
            ? "Ruta relativamente segura con pocas zonas de riesgo."
            : overallRisk === 'medium'
                ? "Ruta con riesgo moderado. Se recomienda precaución."
                : "Ruta con alto riesgo. Se recomienda evitar esta zona o tomar precauciones extremas.",
        avoidZones: highRiskZones
    }

    res.json({
        success: true,
        origin: { name: originZone.name, coordinates: originZone.coordinates },
        destination: { name: destinationZone.name, coordinates: destinationZone.coordinates },
        vehicleType,
        overallRisk,
        insecurityPercentage,
        routeCoordinates: routeData.routeCoordinates,
        routeDistance: routeData.routeDistance,
        routeDuration: routeData.routeDuration,
        routeSource: routeData.routeSource,
        timeWindow,
        recentReports,
        safestRoute,
        zonesInRoute: zonesInRoute.map(z => ({
            id: z.id,
            name: z.name,
            coordinates: z.coordinates,
            riskLevel: z.riskLevel,
            vehicleRisk: riskForMode(z),
            insecurityPercentage: z.insecurityPercentage,
            safetyScore: z.safetyScore,
            reportCount: z.reportsAffectingMode,
            dominantWindow: z.dominantWindow,
            recommendation: z.recommendation
        })),
        recommendation: "Ruta de " + originZone.name + " a " + destinationZone.name + ". Nivel de riesgo " + overallRisk + ". " + originZone.recommendation,
        tips
    })
})

module.exports = router
