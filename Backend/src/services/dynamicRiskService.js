// Motor de riesgo dinámico: mezcla la línea base histórica (cifras oficiales)
// con los reportes ciudadanos recientes.
//
// Tres reglas gobiernan esto, y las tres salieron de la entrevista:
//
//  1. FILTRA, NO PONDERA. Todos los reportes valen igual; lo que cambia es el
//     lente. En carro ves dónde roban carros; en transporte público, dónde hay
//     cosquilleo. La misma localidad puede ser verde para uno y roja para otro.
//
//  2. EL PESO SE APAGA. Un reporte golpea fuerte las primeras horas y deja de
//     mover el color a los ~30 días. Si no, en unos meses todo Bogotá es rojo
//     y el mapa deja de servir para comparar.
//
//  3. NO ESTIGMATIZAR. El aporte ciudadano es sublineal y tiene techo: un
//     reporte suelto NUNCA cambia el color de una localidad.

const { groupReports, modesForType, weightForType, MODES } = require('./reportService')

// Ancla en porcentaje de inseguridad para cada nivel base.
// Convierte el nivel cualitativo de `vehicleRisks` en un número al que se le
// puede sumar el aporte ciudadano.
const LEVEL_ANCHOR = { low: 25, medium: 52, high: 80 }

// Umbrales de clasificación. Calibrados contra los 20 valores de
// `insecurityPercentage` del dataset actual: con 40/70 los 20 clasifican
// exactamente igual que el `riskLevel` que ya traían quemado.
const THRESHOLD_MEDIUM = 40
const THRESHOLD_HIGH = 70

// Vida media del decaimiento, en días. A las 0 h pesa 1.0; a los 3 días, 0.5;
// a los 30 días, ~0.001 (es decir, ya no mueve nada).
const HALF_LIFE_DAYS = 3
const MAX_AGE_DAYS = 30

// Techo del aporte ciudadano, en puntos de inseguridad.
// Una localidad base "baja" (25) no puede pasar de 55 solo con reportes: sube a
// media, nunca a alta. Una base "media" (52) sí puede llegar a alta con
// suficientes reportes, que es justo lo que queremos detectar.
const CONTRIBUTION_CAP = 30

// Constante de la curva sublineal: aporte = CAP * (1 - k^n).
// Con k = 0.75 hacen falta 4 reportes frescos para que una localidad baja
// pase a media. Uno solo mueve 7.5 puntos y no cambia ningún color.
const CURVE_K = 0.75

// Franjas horarias. Un solo campo derivado, no cuadruplica el modelo de datos.
const TIME_WINDOWS = [
    { id: 'madrugada', label: 'madrugada (12am-6am)', from: 0, to: 6 },
    { id: 'mañana', label: 'mañana (6am-12m)', from: 6, to: 12 },
    { id: 'tarde', label: 'tarde (12m-6pm)', from: 12, to: 18 },
    { id: 'noche', label: 'noche (6pm-12am)', from: 18, to: 24 }
]

// Un reporte de otra franja horaria sigue contando, pero mucho menos: que
// roben ahí de madrugada dice algo del sitio, aunque tú pases a mediodía.
const OFF_WINDOW_WEIGHT = 0.3

function windowForHour(hour) {
    return TIME_WINDOWS.find(w => hour >= w.from && hour < w.to) || TIME_WINDOWS[0]
}

// Hora local de Bogotá (UTC-5, sin horario de verano).
function bogotaHour(date) {
    return new Date(date.getTime() - 5 * 60 * 60 * 1000).getUTCHours()
}

function levelFromPercentage(pct) {
    if (pct >= THRESHOLD_HIGH) return 'high'
    if (pct >= THRESHOLD_MEDIUM) return 'medium'
    return 'low'
}

// Nivel base de una localidad para un medio de transporte.
// `publico` no existe en los datos históricos: usamos "peatón" como proxy,
// porque el pasajero de bus camina hasta la estación y va en aglomeración.
function baseLevelForMode(zone, mode) {
    if (mode === 'publico') {
        return zone.vehicleRisks?.['peatón'] || zone.riskLevel || 'low'
    }
    return zone.vehicleRisks?.[mode] || zone.riskLevel || 'low'
}

// Peso temporal: 0.5^(días/3). Es continuo, así que el color nunca salta de
// golpe cuando un reporte "expira".
function timeDecay(occurredAt, now) {
    const ageDays = (now.getTime() - new Date(occurredAt).getTime()) / (24 * 60 * 60 * 1000)
    if (ageDays < 0) return 0
    if (ageDays > MAX_AGE_DAYS) return 0
    return Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
}

// Peso de franja horaria. Si el reporte trae rango (la moto que pudo robarse
// entre las 6am y las 2pm), reparte su peso entre las franjas que abarca en
// vez de fingir que se sabe la hora exacta.
function windowWeight(cluster, targetWindow) {
    const start = new Date(cluster.occurred_at)

    if (!cluster.occurred_end) {
        const matches = windowForHour(bogotaHour(start)).id === targetWindow.id
        return matches ? 1 : OFF_WINDOW_WEIGHT
    }

    const end = new Date(cluster.occurred_end)
    const hoursSpanned = Math.max(1, Math.ceil((end - start) / (60 * 60 * 1000)))

    let matchingHours = 0
    for (let i = 0; i < hoursSpanned; i++) {
        const hour = bogotaHour(new Date(start.getTime() + i * 60 * 60 * 1000))
        if (windowForHour(hour).id === targetWindow.id) matchingHours++
    }

    const share = matchingHours / hoursSpanned
    return share + (1 - share) * OFF_WINDOW_WEIGHT
}

// Varios dispositivos independientes confirmando el mismo hecho es señal fuerte.
// El mismo dispositivo repitiendo, no: por eso se cuentan fuentes, no reportes.
function confirmationBoost(cluster) {
    return Math.min(2, 1 + 0.25 * (cluster.independentSources - 1))
}

// Aporte ciudadano en puntos de inseguridad, para una localidad y un medio.
function contributionFor(clusters, mode, targetWindow, now) {
    let weightedCount = 0

    for (const cluster of clusters) {
        const affectedModes = modesForType(cluster.type)
        if (!affectedModes.includes(mode)) continue

        const weight = timeDecay(cluster.occurred_at, now) *
            windowWeight(cluster, targetWindow) *
            weightForType(cluster.type) *
            confirmationBoost(cluster)

        weightedCount += weight
    }

    if (weightedCount <= 0) return 0

    // Curva sublineal con techo: los primeros reportes pesan más que los
    // siguientes y el total nunca supera CONTRIBUTION_CAP.
    return CONTRIBUTION_CAP * (1 - Math.pow(CURVE_K, weightedCount))
}

// Franja horaria dominante de una localidad, para la línea de contexto del panel.
function dominantWindow(clusters) {
    if (clusters.length === 0) return null

    const counts = {}
    for (const cluster of clusters) {
        const id = windowForHour(bogotaHour(new Date(cluster.occurred_at))).id
        counts[id] = (counts[id] || 0) + 1
    }

    const [topId, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    // Con menos de 3 reportes no hay patrón, solo ruido.
    if (topCount < 3) return null

    const window = TIME_WINDOWS.find(w => w.id === topId)
    return { ...window, count: topCount, share: topCount / clusters.length }
}

// Punto de entrada: devuelve las 20 localidades con el riesgo ya recalculado.
//
// `reports` son los reportes activos crudos; aquí se agrupan por hecho.
// `mode` es el medio seleccionado; `at` la hora de consulta (por defecto, ahora).
// `localities` llega como parámetro en vez de importarse: ahora viven en
// Supabase (localityStore) y ya no en un archivo de este repositorio.
function buildZones(reports = [], { mode = 'carro', at = new Date(), localities = [] } = {}) {
    const safeMode = MODES.includes(mode) ? mode : 'carro'
    const targetWindow = windowForHour(bogotaHour(at))
    const clusters = groupReports(reports)

    const byLocality = {}
    for (const cluster of clusters) {
        if (!cluster.locality_id) continue
        if (!byLocality[cluster.locality_id]) byLocality[cluster.locality_id] = []
        byLocality[cluster.locality_id].push(cluster)
    }

    const zones = localities.map(zone => {
        const zoneClusters = byLocality[zone.id] || []

        // Se recalculan los 5 medios, no solo el seleccionado, para que el popup
        // del mapa pueda mostrar la tabla completa.
        const vehicleRisks = {}
        const percentages = {}
        for (const m of MODES) {
            const basePct = LEVEL_ANCHOR[baseLevelForMode(zone, m)]
            const pct = Math.min(100, Math.round(basePct + contributionFor(zoneClusters, m, targetWindow, at)))
            percentages[m] = pct
            vehicleRisks[m] = levelFromPercentage(pct)
        }

        const window = dominantWindow(zoneClusters)

        return {
            ...zone,
            vehicleRisks,
            riskLevel: vehicleRisks[safeMode],
            insecurityPercentage: percentages[safeMode],
            safetyScore: 100 - percentages[safeMode],
            // Se conserva la línea base para poder mostrar "subió por reportes"
            // y para no perder de vista el dato oficial.
            baseRiskLevel: baseLevelForMode(zone, safeMode),
            baseInsecurityPercentage: LEVEL_ANCHOR[baseLevelForMode(zone, safeMode)],
            modePercentages: percentages,
            reportCount: zoneClusters.length,
            reportsAffectingMode: zoneClusters.filter(c => modesForType(c.type).includes(safeMode)).length,
            dominantWindow: window ? { id: window.id, label: window.label, count: window.count } : null,
            lastReportAt: zoneClusters.length > 0
                ? zoneClusters.map(c => c.occurred_at).sort().reverse()[0]
                : null
        }
    })

    return {
        zones,
        mode: safeMode,
        timeWindow: { id: targetWindow.id, label: targetWindow.label },
        clusterCount: clusters.length
    }
}

module.exports = {
    buildZones,
    levelFromPercentage,
    windowForHour,
    bogotaHour,
    timeDecay,
    contributionFor,
    dominantWindow,
    TIME_WINDOWS,
    LEVEL_ANCHOR,
    CONTRIBUTION_CAP,
    THRESHOLD_MEDIUM,
    THRESHOLD_HIGH,
    MAX_AGE_DAYS
}
