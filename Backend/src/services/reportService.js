// Reglas de negocio del botón de alerta.
//
// Todas las decisiones aquí salieron de la entrevista de definición del producto:
// el tipo de robo NO pondera, FILTRA; anónimo con límite de 5/día por dispositivo;
// deshacer 30s; agrupar reportes del mismo hecho; vivienda con ubicación difusa.

const store = require('./reportStore')
const { isInsideBogota, localityForPoint, distanceKm } = require('../utils/geo')

// Tipos de robo que cubre el botón
const REPORT_TYPES = ['celular', 'moto', 'carro', 'bici', 'vivienda', 'transmilenio', 'otro']

// Medios de transporte del selector (el quinto, `publico`, es nuevo)
const MODES = ['carro', 'moto', 'bici', 'peatón', 'publico']

// El corazón de la función: qué medio de transporte afecta cada tipo de robo.
// Si vas en carro te importa dónde roban carros; si vas en bus te importa
// el cosquilleo y el hurto de celular. La misma localidad puede ser verde
// para un carro y roja para un pasajero de bus, y eso es correcto.
const TYPE_TO_MODES = {
    moto: ['moto'],
    carro: ['carro'],
    bici: ['bici'],
    celular: ['peatón', 'publico'],
    otro: ['peatón', 'publico'],
    transmilenio: ['publico'],
    // El robo a vivienda no le sirve a quien va de paso: no entra al riesgo de
    // tránsito. Se ve en la capa de reportes y en la ficha de la localidad.
    vivienda: []
}

// Tope de texto libre. Sin esto cabian 100kb de texto por reporte.
const MAX_DESCRIPTION_LENGTH = 500
const MAX_STATION_LENGTH = 120

const MAX_REPORTS_PER_DAY = 5
const UNDO_WINDOW_SECONDS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Un reporte sin tipo (la persona cerró la app antes de completarlo) cuenta a
// media fuerza en todos los medios hasta que se complete.
const UNTYPED_WEIGHT = 0.5

// Agrupación de duplicados: mismo hecho reportado por varios testigos
const CLUSTER_RADIUS_KM = 0.15   // 150 metros
const CLUSTER_WINDOW_MS = 15 * 60 * 1000  // 15 minutos

// Rejilla de ~330 m para difuminar la ubicación de robos a vivienda.
// Nadie debería poder leer en el mapa la dirección exacta donde vive una víctima.
const PRIVACY_GRID_DEGREES = 0.003

class ReportError extends Error {
    constructor(message, statusCode = 400, code = 'invalid_report') {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

// Recorta y normaliza texto libre del usuario antes de guardarlo.
function sanitizeText(value, maxLength) {
    if (value === null || value === undefined) return null
    const trimmed = String(value).trim()
    if (!trimmed) return null
    return trimmed.slice(0, maxLength)
}

function modesForType(type) {
    if (!type) return MODES  // sin tipo: afecta a todos, con peso reducido
    return TYPE_TO_MODES[type] || []
}

function weightForType(type) {
    return type ? 1 : UNTYPED_WEIGHT
}

function blurCoordinate(value) {
    return Math.round(value / PRIVACY_GRID_DEGREES) * PRIVACY_GRID_DEGREES
}

// Valida y normaliza lo que llega del navegador. Nunca confiar en el cliente:
// el `locality` se DERIVA del GPS, no se acepta del request.
function buildReport({ lat, lng, type, occurredAt, occurredEnd, station, description, deviceHash }) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new ReportError('Se requiere una ubicación válida (lat, lng)')
    }
    if (!isInsideBogota(lat, lng)) {
        throw new ReportError('La ubicación está fuera de Bogotá D.C.', 400, 'outside_bogota')
    }
    if (!deviceHash || typeof deviceHash !== 'string' || deviceHash.length < 8) {
        throw new ReportError('Falta el identificador de dispositivo')
    }
    if (type && !REPORT_TYPES.includes(type)) {
        throw new ReportError(`Tipo de robo inválido. Debe ser uno de: ${REPORT_TYPES.join(', ')}`)
    }

    const now = new Date()
    const occurred = occurredAt ? new Date(occurredAt) : now
    if (Number.isNaN(occurred.getTime())) {
        throw new ReportError('La fecha del hecho no es válida')
    }
    if (occurred.getTime() > now.getTime() + 60000) {
        throw new ReportError('No se puede reportar un robo en el futuro')
    }

    // Rango horario: el caso de la moto parqueada, donde solo se sabe entre
    // qué horas pudo pasar.
    let end = null
    if (occurredEnd) {
        end = new Date(occurredEnd)
        if (Number.isNaN(end.getTime())) throw new ReportError('La hora final del rango no es válida')
        if (end.getTime() < occurred.getTime()) {
            throw new ReportError('La hora final del rango no puede ser anterior a la inicial')
        }
    }

    const isHome = type === 'vivienda'
    const storedLat = isHome ? blurCoordinate(lat) : lat
    const storedLng = isHome ? blurCoordinate(lng) : lng

    // La localidad se deriva del punto REAL, antes de difuminar, para no perder
    // precisión en el dato agregado por difuminar la privacidad.
    const { locality } = localityForPoint(lat, lng)

    return {
        occurred_at: occurred.toISOString(),
        occurred_end: end ? end.toISOString() : null,
        lat: storedLat,
        lng: storedLng,
        locality: locality ? locality.name : null,
        locality_id: locality ? locality.id : null,
        type: type || null,
        station: sanitizeText(station, MAX_STATION_LENGTH),
        description: sanitizeText(description, MAX_DESCRIPTION_LENGTH),
        precision: isHome ? 'approx' : 'exact',
        device_hash: deviceHash,
        status: 'active'
    }
}

// Límite de 5 reportes por día por dispositivo.
// Santi lo justificó así: a nadie lo roban más de cinco veces en un día;
// si pasa, es abuso, no una víctima.
async function assertWithinRateLimit(deviceHash) {
    const since = new Date(Date.now() - DAY_MS).toISOString()
    const count = await store.countByDevice(deviceHash, since)
    if (count >= MAX_REPORTS_PER_DAY) {
        throw new ReportError(
            `Alcanzaste el máximo de ${MAX_REPORTS_PER_DAY} reportes en 24 horas. ` +
            `Si estás en una emergencia, llama al 123.`,
            429,
            'rate_limited'
        )
    }
    return MAX_REPORTS_PER_DAY - count - 1  // reportes restantes tras este
}

async function createReport(input) {
    const report = buildReport(input)
    const remaining = await assertWithinRateLimit(input.deviceHash)
    const saved = await store.insert(report)
    return { report: saved, remainingToday: remaining }
}

// Completar un reporte en frío. Solo el dispositivo que lo creó puede editarlo:
// sin login, el device_hash guardado en localStorage es la única credencial.
async function completeReport(id, deviceHash, patch) {
    const existing = await store.findById(id)
    if (!existing) throw new ReportError('Reporte no encontrado', 404, 'not_found')
    if (existing.device_hash !== deviceHash) {
        throw new ReportError('Este reporte fue creado desde otro dispositivo', 403, 'forbidden')
    }
    if (existing.status !== 'active') {
        throw new ReportError('Este reporte fue cancelado', 409, 'cancelled')
    }

    const updates = {}

    if (patch.type !== undefined) {
        if (patch.type !== null && !REPORT_TYPES.includes(patch.type)) {
            throw new ReportError(`Tipo de robo inválido. Debe ser uno de: ${REPORT_TYPES.join(', ')}`)
        }
        updates.type = patch.type

        // Si al completar resulta ser un robo a vivienda, hay que difuminar la
        // ubicación que se guardó exacta en el momento del reporte.
        if (patch.type === 'vivienda' && existing.precision !== 'approx') {
            updates.lat = blurCoordinate(existing.lat)
            updates.lng = blurCoordinate(existing.lng)
            updates.precision = 'approx'
        }
    }
    if (patch.station !== undefined) updates.station = sanitizeText(patch.station, MAX_STATION_LENGTH)
    if (patch.description !== undefined) updates.description = sanitizeText(patch.description, MAX_DESCRIPTION_LENGTH)

    if (patch.occurredAt !== undefined) {
        const occurred = new Date(patch.occurredAt)
        if (Number.isNaN(occurred.getTime())) throw new ReportError('La fecha del hecho no es válida')
        if (occurred.getTime() > Date.now() + 60000) {
            throw new ReportError('No se puede reportar un robo en el futuro')
        }
        updates.occurred_at = occurred.toISOString()
    }
    if (patch.occurredEnd !== undefined) {
        if (patch.occurredEnd === null) {
            updates.occurred_end = null
        } else {
            const end = new Date(patch.occurredEnd)
            if (Number.isNaN(end.getTime())) throw new ReportError('La hora final del rango no es válida')
            const start = new Date(updates.occurred_at || existing.occurred_at)
            if (end.getTime() < start.getTime()) {
                throw new ReportError('La hora final del rango no puede ser anterior a la inicial')
            }
            updates.occurred_end = end.toISOString()
        }
    }

    // Corregir el lugar (el caso del cosquilleo en TransMilenio: se reporta
    // desde la casa y hay que marcar dónde fue de verdad).
    if (patch.lat !== undefined && patch.lng !== undefined) {
        if (!isInsideBogota(patch.lat, patch.lng)) {
            throw new ReportError('La ubicación está fuera de Bogotá D.C.', 400, 'outside_bogota')
        }
        const finalType = updates.type !== undefined ? updates.type : existing.type
        const isHome = finalType === 'vivienda'
        updates.lat = isHome ? blurCoordinate(patch.lat) : patch.lat
        updates.lng = isHome ? blurCoordinate(patch.lng) : patch.lng
        updates.precision = isHome ? 'approx' : 'exact'
        const { locality } = localityForPoint(patch.lat, patch.lng)
        updates.locality = locality ? locality.name : null
        updates.locality_id = locality ? locality.id : null
    }

    return store.update(id, updates)
}

// Deshacer: solo dentro de los 30 segundos siguientes. Arregla el toque
// accidental sin abrir la puerta a borrar evidencia días después.
async function cancelReport(id, deviceHash) {
    const existing = await store.findById(id)
    if (!existing) throw new ReportError('Reporte no encontrado', 404, 'not_found')
    if (existing.device_hash !== deviceHash) {
        throw new ReportError('Este reporte fue creado desde otro dispositivo', 403, 'forbidden')
    }

    const elapsedSeconds = (Date.now() - new Date(existing.created_at).getTime()) / 1000
    if (elapsedSeconds > UNDO_WINDOW_SECONDS) {
        throw new ReportError(
            `La ventana para deshacer (${UNDO_WINDOW_SECONDS}s) ya pasó`,
            409,
            'undo_expired'
        )
    }

    return store.update(id, { status: 'cancelled' })
}

// Agrupa reportes que describen EL MISMO hecho: mismo tipo, a menos de 150 m
// y dentro de 15 minutos. Tres testigos de un atraco son un robo confirmado
// tres veces, no tres robos distintos.
function groupReports(reports) {
    const clusters = []

    // De más viejo a más nuevo, para que el primer reporte ancle el grupo.
    const ordered = [...reports].sort(
        (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
    )

    for (const report of ordered) {
        const time = new Date(report.occurred_at).getTime()

        const match = clusters.find(cluster => {
            if ((cluster.type || null) !== (report.type || null)) return false
            if (Math.abs(time - cluster.anchorTime) > CLUSTER_WINDOW_MS) return false
            return distanceKm(cluster.lat, cluster.lng, report.lat, report.lng) <= CLUSTER_RADIUS_KM
        })

        if (match) {
            match.confirmations += 1
            match.reports.push(report)
            // Varios dispositivos distintos confirmando es señal fuerte;
            // el mismo dispositivo repitiendo, no.
            match.devices.add(report.device_hash)
        } else {
            clusters.push({
                id: report.id,
                type: report.type || null,
                lat: report.lat,
                lng: report.lng,
                locality: report.locality,
                locality_id: report.locality_id,
                station: report.station,
                precision: report.precision,
                occurred_at: report.occurred_at,
                occurred_end: report.occurred_end,
                anchorTime: time,
                confirmations: 1,
                devices: new Set([report.device_hash]),
                reports: [report]
            })
        }
    }

    return clusters.map(cluster => ({
        ...cluster,
        independentSources: cluster.devices.size,
        devices: undefined,
        anchorTime: undefined
    }))
}

module.exports = {
    REPORT_TYPES,
    MODES,
    TYPE_TO_MODES,
    MAX_REPORTS_PER_DAY,
    MAX_DESCRIPTION_LENGTH,
    UNDO_WINDOW_SECONDS,
    UNTYPED_WEIGHT,
    ReportError,
    modesForType,
    weightForType,
    createReport,
    completeReport,
    cancelReport,
    groupReports,
    buildReport
}
