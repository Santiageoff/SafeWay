const express = require('express')
const router = express.Router()
const controller = require('../controllers/report.controller')

// Capa de escritura de SafeWay: los reportes ciudadanos del botón de alerta.
// Es lo primero de la app que guarda información en vez de solo leerla.

router.post('/', controller.create)        // el toque del botón rojo
router.get('/', controller.list)           // capa de puntos del mapa
router.get('/mine', controller.mine)       // "mis reportes", para completarlos en frío
router.patch('/:id', controller.complete)  // completar con calma
router.delete('/:id', controller.cancel)   // deshacer (30 s)

module.exports = router
