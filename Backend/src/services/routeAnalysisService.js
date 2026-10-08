// Análisis de riesgo de una ruta. Funciones puras: reciben las zonas, la ruta
// y el medio, y devuelven el resultado. No saben nada de HTTP ni de Supabase,
// así que se prueban sin levantar la API (issue #2, ADR-001).
//
// Hoy las zonas del trayecto se miden contra la LÍNEA RECTA origen-destino,
// no contra la ruta real: corregirlo es el issue #6.

const { distancePointToLine } = require('../utils/geo')

const VEHICLE_TYPES = ['carro', 'moto', 'bici', 'peatón', 'publico']

// Distancia máxima, en km, para considerar que una localidad está en el trayecto.
const RADIO_KM = 3

const TIPS_ALTO = {
    moto: ['Usa casco y ropa reflectiva', 'Evita zonas oscuras de noche', 'Prefiere vías principales'],
    bici: ['Usa ciclovía si está disponible', 'Evita circular de noche', 'Lleva candado de seguridad'],
    'peatón': ['Camina por zonas iluminadas', 'Evita calles solitarias', 'Mantén el celular guardado'],
    publico: ['Mantén el celular guardado, no lo uses en el bus', 'Cuidado en la aglomeración al entrar y salir', 'Lleva el maletín adelante']
}
const TIPS_GENERALES = ['Mantén las puertas cerradas', 'No te detengas en zonas oscuras', 'Usa rutas conocidas']

const DESCRIPCION = {
    low: 'Ruta relativamente segura con pocas zonas de riesgo.',
    medium: 'Ruta con riesgo moderado. Se recomienda precaución.',
    high: 'Ruta con alto riesgo. Se recomienda evitar esta zona o tomar precauciones extremas.'
}

// El riesgo sale del riesgo POR MEDIO, no del genérico: en carro pesan los
// robos de carro; en transporte público, el cosquilleo y el hurto de celular.
function riesgoParaMedio(zona, vehicleType) {
    return zona.vehicleRisks?.[vehicleType] || zona.riskLevel
}

function zonasEnTrayecto(zones, desde, hasta, radioKm = RADIO_KM) {
    return zones.filter(z => distancePointToLine(z.coordinates, desde, hasta) < radioKm)
}

// El PEOR nivel entre las zonas del trayecto.
function nivelGlobal(zonas, vehicleType) {
    const niveles = zonas.map(z => riesgoParaMedio(z, vehicleType))
    if (niveles.includes('high')) return 'high'
    if (niveles.includes('medium')) return 'medium'
    return 'low'
}

function porcentajeInseguridad(zonas) {
    if (zonas.length === 0) return 5
    return Math.round(zonas.reduce((s, z) => s + (z.insecurityPercentage || 0), 0) / zonas.length)
}

function consejos(vehicleType, nivel) {
    return nivel === 'high' && TIPS_ALTO[vehicleType] ? TIPS_ALTO[vehicleType] : TIPS_GENERALES
}

// Resultado completo del análisis, con la misma forma que ya consume el
// frontend en POST /api/route/analyze (no cambiarla sin avisar a Juan Camilo).
function analizarRuta({ zones, originZone, destinationZone, vehicleType, route, timeWindow }) {
    const enRuta = zonasEnTrayecto(zones, originZone.coordinates, destinationZone.coordinates)
    const overallRisk = nivelGlobal(enRuta, vehicleType)

    return {
        origin: { name: originZone.name, coordinates: originZone.coordinates },
        destination: { name: destinationZone.name, coordinates: destinationZone.coordinates },
        vehicleType,
        overallRisk,
        insecurityPercentage: porcentajeInseguridad(enRuta),
        routeCoordinates: route.routeCoordinates,
        routeDistance: route.routeDistance,
        routeDuration: route.routeDuration,
        routeSource: route.routeSource,
        timeWindow,
        // Reportes ciudadanos recientes sobre el trayecto: el aviso concreto
        // de "esto pasó aquí hace poco", distinto del color de la localidad.
        recentReports: enRuta
            .filter(z => z.reportsAffectingMode > 0)
            .map(z => ({
                zone: z.name,
                count: z.reportsAffectingMode,
                lastAt: z.lastReportAt,
                window: z.dominantWindow?.label || null
            })),
        safestRoute: {
            description: DESCRIPCION[overallRisk],
            avoidZones: enRuta.filter(z => riesgoParaMedio(z, vehicleType) === 'high').map(z => z.name)
        },
        zonesInRoute: enRuta.map(z => ({
            id: z.id,
            name: z.name,
            coordinates: z.coordinates,
            riskLevel: z.riskLevel,
            vehicleRisk: riesgoParaMedio(z, vehicleType),
            insecurityPercentage: z.insecurityPercentage,
            safetyScore: z.safetyScore,
            reportCount: z.reportsAffectingMode,
            dominantWindow: z.dominantWindow,
            recommendation: z.recommendation
        })),
        // ⚠️ Concatena la recomendación de la localidad de ORIGEN: una ruta
        // "high" puede decir "Zona segura". Se corrige en el issue #6.
        recommendation: `Ruta de ${originZone.name} a ${destinationZone.name}. Nivel de riesgo ${overallRisk}. ${originZone.recommendation}`,
        tips: consejos(vehicleType, overallRisk)
    }
}

module.exports = {
    VEHICLE_TYPES, RADIO_KM,
    riesgoParaMedio, zonasEnTrayecto, nivelGlobal, porcentajeInseguridad, consejos, analizarRuta
}
