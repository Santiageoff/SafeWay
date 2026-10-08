// Análisis de riesgo de una ruta. Funciones puras: reciben las zonas, la ruta
// y el medio, y devuelven el resultado. No saben nada de HTTP ni de Supabase,
// así que se prueban sin levantar la API (issue #2, ADR-001).
//
// Las zonas del trayecto se miden contra la RUTA REAL (la polilínea que
// devuelve OSRM), no contra la línea recta entre origen y destino (issue #6).
// Una ruta que rodea una localidad no la cuenta; una que la cruza en curva sí.

const { distancePointToLine, distanceKm } = require('../utils/geo')

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

// Distancia mínima, en km, de un punto a la polilínea de la ruta: la menor
// distancia a cualquiera de sus segmentos.
function distanciaAPolilinea(punto, polilinea) {
    if (!Array.isArray(polilinea) || polilinea.length === 0) return Infinity
    if (polilinea.length === 1) return distanceKm(punto[0], punto[1], polilinea[0][0], polilinea[0][1])
    let minima = Infinity
    for (let i = 1; i < polilinea.length; i++) {
        const d = distancePointToLine(punto, polilinea[i - 1], polilinea[i])
        if (d < minima) minima = d
    }
    return minima
}

// Localidades del trayecto: las que tienen su centro a menos de radioKm de la
// ruta, más las localidades de origen y destino (siempre se pasa por ellas,
// aunque su centro quede lejos de la dirección exacta). Cada una lleva su
// distancia mínima a la ruta, ordenadas de la más cercana a la más lejana.
function zonasEnTrayecto(zones, polilinea, { radioKm = RADIO_KM, incluir = [] } = {}) {
    return zones
        .map(z => ({ zona: z, distancia: distanciaAPolilinea(z.coordinates, polilinea) }))
        .filter(({ zona, distancia }) => distancia < radioKm || incluir.includes(zona.id))
        .sort((a, b) => a.distancia - b.distancia)
        .map(({ zona, distancia }) => ({ ...zona, distanciaKm: Math.round(distancia * 100) / 100 }))
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

const NOMBRE_MEDIO = { carro: 'carro', moto: 'moto', bici: 'bicicleta', 'peatón': 'a pie', publico: 'transporte público' }
const NIVEL_TEXTO = { low: 'bajo', medium: 'medio', high: 'alto' }

const lista = (nombres) => nombres.length <= 1 ? (nombres[0] || '')
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`

// La recomendación sale del NIVEL DE LA RUTA y de las zonas que la suben, nunca
// del texto de una sola localidad: antes una ruta "alta" podía decir "Zona
// segura" porque copiaba la recomendación de la localidad de origen (issue #6).
function recomendacion({ origen, destino, vehicleType, nivel, zonas, routeSource }) {
    const medio = NOMBRE_MEDIO[vehicleType] || vehicleType
    const altas = zonas.filter(z => riesgoParaMedio(z, vehicleType) === 'high').map(z => z.name)
    const medias = zonas.filter(z => riesgoParaMedio(z, vehicleType) === 'medium').map(z => z.name)

    let texto = `Ruta de ${origen} a ${destino} en ${medio}: riesgo ${NIVEL_TEXTO[nivel]}.`
    if (nivel === 'high') {
        texto += ` Pasa cerca de ${lista(altas)}, con riesgo alto para este medio. Si puedes, busca una alternativa que las evite o extrema las precauciones.`
    } else if (nivel === 'medium') {
        texto += ` Pasa cerca de ${lista(medias)}, con riesgo medio para este medio. Mantente atento y evita detenerte en zonas solas u oscuras.`
    } else {
        texto += ' Ninguna localidad del trayecto tiene riesgo alto ni medio para este medio. Mantén las precauciones habituales.'
    }
    if (routeSource === 'straight-line') {
        texto += ' Ojo: el trazado real no estuvo disponible y se estimó en línea recta.'
    }
    return texto
}

function consejos(vehicleType, nivel) {
    return nivel === 'high' && TIPS_ALTO[vehicleType] ? TIPS_ALTO[vehicleType] : TIPS_GENERALES
}

// Resultado completo del análisis, con la misma forma que ya consume el
// frontend en POST /api/route/analyze (no cambiarla sin avisar a Juan Camilo).
function analizarRuta({ zones, originZone, destinationZone, vehicleType, route, timeWindow }) {
    // La polilínea real; si no hay, el segmento recto entre los dos puntos.
    const polilinea = Array.isArray(route.routeCoordinates) && route.routeCoordinates.length > 0
        ? route.routeCoordinates
        : [originZone.coordinates, destinationZone.coordinates]
    const enRuta = zonasEnTrayecto(zones, polilinea, {
        incluir: [originZone.id, destinationZone.id].filter(id => id != null)
    })
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
            recommendation: z.recommendation,
            // Distancia mínima, en km, del centro de la localidad a la ruta.
            distanceKm: z.distanciaKm
        })),
        recommendation: recomendacion({
            origen: originZone.name, destino: destinationZone.name, vehicleType,
            nivel: overallRisk, zonas: enRuta, routeSource: route.routeSource
        }),
        tips: consejos(vehicleType, overallRisk)
    }
}

module.exports = {
    VEHICLE_TYPES, RADIO_KM,
    riesgoParaMedio, distanciaAPolilinea, zonasEnTrayecto, nivelGlobal, porcentajeInseguridad,
    recomendacion, consejos, analizarRuta
}
