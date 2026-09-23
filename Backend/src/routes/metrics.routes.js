const express = require('express')
const router = express.Router()
const metrics = require('../services/metricsService')

// GET /api/metrics/resumen?dias=30
// Indicadores del documento (III.F): p50/p90 del tiempo de análisis, % de
// consultas con respaldo, % de rutas que evitan riesgo alto. Solo agregados,
// nunca filas individuales.
router.get('/resumen', async (req, res, next) => {
    let dias = metrics.DIAS_POR_DEFECTO
    if (req.query.dias !== undefined) {
        dias = Number(req.query.dias)
        if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
            return res.status(400).json({ success: false, code: 'dias_invalido', error: 'dias debe ser un entero entre 1 y 365' })
        }
    }

    try {
        const data = await metrics.obtenerResumen({ dias })
        res.json({ success: true, data })
    } catch (err) {
        if (err instanceof metrics.MetricsNoDisponibles) {
            return res.status(503).json({ success: false, code: 'metricas_no_disponibles', error: err.message })
        }
        next(err)
    }
})

module.exports = router
