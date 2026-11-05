const express = require('express')
const router = express.Router()
const controller = require('../controllers/report.controller')
const { requireAuth } = require('../middleware/auth')

// Capa de escritura de SafeWay: los reportes ciudadanos del botón de alerta.
//
// La única ruta pública es la capa del mapa: cualquiera, con sesión o sin ella,
// tiene que poder ver los puntos, porque es con eso con lo que la gente decide
// por dónde ir. Va contra la vista sanitizada, no contra la tabla.
router.get('/', controller.list)

// Todo lo demás toca datos personales y exige sesión.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
router.param('id', (req, res, next, id) => UUID.test(id)
    ? next()
    : res.status(404).json({ success: false, code: 'not_found', error: 'Reporte no encontrado' }))

router.get('/mine', requireAuth, controller.mine)
router.post('/', requireAuth, controller.create)
router.patch('/:id', requireAuth, controller.complete)
router.delete('/:id', requireAuth, controller.cancel)
router.delete('/:id/definitivo', requireAuth, controller.remove)

module.exports = router
