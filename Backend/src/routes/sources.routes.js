const express = require('express')
const router = express.Router()
const sources = require('../services/sourcesService')

// GET /api/sources
// Las 20 localidades con las tres fuentes complementarias del issue #4:
// hurto a vehículos (automotores/motocicletas), a residencias y en
// transporte público.
router.get('/', async (req, res, next) => {
    try {
        const data = await sources.getAll()
        res.json({ success: true, total: data.length, data })
    } catch (err) {
        if (err instanceof sources.FuentesNoDisponibles) {
            return res.status(503).json({ success: false, code: 'fuentes_no_disponibles', error: err.message })
        }
        next(err)
    }
})

// GET /api/sources/:localityId
router.get('/:localityId', async (req, res, next) => {
    const localityId = Number(req.params.localityId)
    if (!Number.isInteger(localityId) || localityId < 1) {
        return res.status(400).json({ success: false, code: 'localidad_invalida', error: 'localityId debe ser un entero positivo' })
    }

    try {
        const zona = await sources.getByLocality(localityId)
        if (!zona) return res.status(404).json({ success: false, code: 'localidad_no_encontrada', error: 'No hay datos complementarios para esa localidad' })
        res.json({ success: true, data: zona })
    } catch (err) {
        if (err instanceof sources.FuentesNoDisponibles) {
            return res.status(503).json({ success: false, code: 'fuentes_no_disponibles', error: err.message })
        }
        next(err)
    }
})

module.exports = router
