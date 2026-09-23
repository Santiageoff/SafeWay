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
router.get('/mine', requireAuth, controller.mine)
router.post('/', requireAuth, controller.create)
router.patch('/:id', requireAuth, controller.complete)
router.delete('/:id', requireAuth, controller.cancel)

module.exports = router
