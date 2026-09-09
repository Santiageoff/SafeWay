// Controlador del botón de alerta.
// Los routers de este proyecto tenían toda la lógica adentro y los controllers
// estaban vacíos; aquí se usa el patrón como estaba previsto.

const reportService = require('../services/reportService')
const store = require('../services/reportStore')
const { MAX_AGE_DAYS } = require('../services/dynamicRiskService')

const DAY_MS = 24 * 60 * 60 * 1000

// El identificador de dispositivo viaja en un header. No es autenticación:
// es un uuid de localStorage que sirve para el límite diario y para devolverle
// a la persona sus propios reportes sin obligarla a crear cuenta.
function deviceHashFrom(req) {
    return req.get('X-Device-Id') || req.body?.deviceHash || null
}

function handleError(res, err) {
    if (err instanceof reportService.ReportError) {
        return res.status(err.statusCode).json({ success: false, code: err.code, error: err.message })
    }
    console.error('[reports] error inesperado:', err)
    return res.status(500).json({ success: false, error: 'Error interno al procesar el reporte' })
}

// POST /api/reports — el toque del botón rojo
async function create(req, res) {
    try {
        const { lat, lng, type, occurredAt, occurredEnd, station, description } = req.body || {}

        const { report, remainingToday } = await reportService.createReport({
            lat, lng, type, occurredAt, occurredEnd, station, description,
            deviceHash: deviceHashFrom(req)
        })

        res.status(201).json({
            success: true,
            report,
            remainingToday,
            undoWindowSeconds: reportService.UNDO_WINDOW_SECONDS,
            storage: store.backendName()
        })
    } catch (err) {
        handleError(res, err)
    }
}

// PATCH /api/reports/:id — completar en frío, con calma
async function complete(req, res) {
    try {
        const updated = await reportService.completeReport(
            req.params.id,
            deviceHashFrom(req),
            req.body || {}
        )
        res.json({ success: true, report: updated })
    } catch (err) {
        handleError(res, err)
    }
}

// DELETE /api/reports/:id — deshacer dentro de los 30 s
async function cancel(req, res) {
    try {
        await reportService.cancelReport(req.params.id, deviceHashFrom(req))
        res.json({ success: true, cancelled: req.params.id })
    } catch (err) {
        handleError(res, err)
    }
}

// GET /api/reports — capa de puntos del mapa
async function list(req, res) {
    try {
        const days = Math.min(MAX_AGE_DAYS, Number(req.query.days) || 7)
        const since = new Date(Date.now() - days * DAY_MS).toISOString()

        const reports = await store.listActive(since)
        let clusters = reportService.groupReports(reports)

        // Filtro por medio: si vas en carro no te llenamos el mapa de
        // cosquilleos en bus.
        if (req.query.mode) {
            clusters = clusters.filter(c => reportService.modesForType(c.type).includes(req.query.mode))
        }
        if (req.query.locality) {
            clusters = clusters.filter(c => c.locality === req.query.locality)
        }

        res.json({
            success: true,
            days,
            count: clusters.length,
            storage: store.backendName(),
            // `reports` interno no se expone: contiene device_hash de otras personas.
            data: clusters.map(({ reports: _reports, ...cluster }) => cluster)
        })
    } catch (err) {
        handleError(res, err)
    }
}

// GET /api/reports/mine — los reportes de este dispositivo, para poder completarlos
async function mine(req, res) {
    try {
        const deviceHash = deviceHashFrom(req)
        if (!deviceHash) {
            return res.status(400).json({ success: false, error: 'Falta el identificador de dispositivo' })
        }

        const reports = await store.listByDevice(deviceHash)
        const since = new Date(Date.now() - DAY_MS).toISOString()
        const usedToday = await store.countByDevice(deviceHash, since)

        res.json({
            success: true,
            data: reports,
            incomplete: reports.filter(r => !r.type).length,
            remainingToday: Math.max(0, reportService.MAX_REPORTS_PER_DAY - usedToday)
        })
    } catch (err) {
        handleError(res, err)
    }
}

module.exports = { create, complete, cancel, list, mine }
