// Controlador del botón de alerta.
//
// Todo lo que toca un reporte concreto pasa por `requireAuth`, así que aquí
// siempre hay `req.user` (quién es) y `req.db` (un cliente de Supabase que
// actúa en su nombre, con RLS aplicada).
//
// La capa pública del mapa es la única excepción: no pide sesión, porque la
// gente decide su ruta con lo que ve ahí.

const reportService = require('../services/reportService')
const store = require('../services/reportStore')
const { MAX_AGE_DAYS } = require('../services/dynamicRiskService')

const DAY_MS = 24 * 60 * 60 * 1000

function handleError(res, err) {
    if (err instanceof reportService.ReportError) {
        return res.status(err.statusCode).json({ success: false, code: err.code, error: err.message })
    }

    // Un fallo de permisos aquí significa que las políticas de RLS y el código
    // no están de acuerdo. Es un error de configuración y hay que verlo, no
    // disimularlo con un mensaje genérico.
    if (err instanceof store.StoreError && err.esProblemaDePermisos) {
        console.error('[reports] RLS esta rechazando al backend:', err.message)
        return res.status(500).json({
            success: false,
            code: 'permisos_mal_configurados',
            error: 'Problema de permisos en la base de datos. Avisa al equipo.'
        })
    }

    console.error('[reports] error inesperado:', err)
    return res.status(500).json({ success: false, error: 'Error interno al procesar el reporte' })
}

// POST /api/reports - el toque del botón rojo. Requiere sesión.
async function create(req, res) {
    try {
        const { lat, lng, type, occurredAt, occurredEnd, station, description } = req.body || {}

        const { report, remainingToday } = await reportService.createReport(req.db, {
            lat, lng, type, occurredAt, occurredEnd, station, description,
            // El dueño sale del JWT verificado, NUNCA del cuerpo de la petición.
            userId: req.user.id
        })

        res.status(201).json({
            success: true,
            report,
            remainingToday,
            undoWindowSeconds: reportService.UNDO_WINDOW_SECONDS
        })
    } catch (err) {
        handleError(res, err)
    }
}

// PATCH /api/reports/:id - completar en frío, con calma
async function complete(req, res) {
    try {
        const updated = await reportService.completeReport(
            req.db, req.user.id, req.params.id, req.body || {}
        )
        res.json({ success: true, report: updated })
    } catch (err) {
        handleError(res, err)
    }
}

// DELETE /api/reports/:id - deshacer dentro de los 30 s
async function cancel(req, res) {
    try {
        await reportService.cancelReport(req.db, req.user.id, req.params.id)
        res.json({ success: true, cancelled: req.params.id })
    } catch (err) {
        handleError(res, err)
    }
}

// GET /api/reports - capa de puntos del mapa. PÚBLICA, sin sesión.
// Lee de la vista sanitizada: sin user_id, sin device_hash, sin descripción.
async function list(req, res) {
    try {
        const days = Math.min(MAX_AGE_DAYS, Number(req.query.days) || 7)
        const since = new Date(Date.now() - days * DAY_MS).toISOString()

        const reports = await store.listPublic(since)
        let clusters = reportService.groupReports(reports)

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
            // `reports` interno lleva los tokens de origen; no sale de aquí.
            data: clusters.map(({ reports: _r, ...cluster }) => cluster)
        })
    } catch (err) {
        handleError(res, err)
    }
}

// GET /api/reports/mine - los reportes propios, para completarlos con calma
async function mine(req, res) {
    try {
        const reports = await store.listByUser(req.db)
        const since = new Date(Date.now() - DAY_MS).toISOString()
        const usedToday = await store.countByUser(req.db, since)

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
