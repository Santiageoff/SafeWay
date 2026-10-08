const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const profile = require('../services/proactiveService')
const zoneService = require('../services/zoneService')

// Perfil proactivo (issue #8). Todo exige sesión: son datos de la persona.
// La interfaz (consentimiento, alertas, borrar historial) la hace Juan Camilo
// sobre estos endpoints.
router.use(requireAuth)

// Envuelve cada handler: los ProfileError salen con su código HTTP y el resto
// sigue al manejador de errores de app.js.
const manejar = (fn) => async (req, res, next) => {
    try {
        res.json({ success: true, data: await fn(req) })
    } catch (err) {
        if (err instanceof profile.ProfileError) {
            return res.status(err.statusCode).json({ success: false, code: err.code, error: err.message })
        }
        next(err)
    }
}

// Consentimiento (Ley 1581): estado vigente y otorgar/revocar.
router.get('/consents', manejar(req => profile.misConsentimientos(req.db)))
router.post('/consents', manejar(req => profile.guardarConsentimiento(req.db, req.user.id, req.body || {})))

// Preferencias de alertas.
router.get('/preferences', manejar(req => profile.misPreferencias(req.db)))
router.put('/preferences', manejar(req => profile.guardarPreferencias(req.db, req.user.id, req.body || {})))

// Lo que el motor sabe de la persona.
router.get('/habitual-routes', manejar(req => profile.misRutasHabituales(req.db)))
router.get('/alerts', manejar(req => profile.misAlertas(req.db, { soloNoVistas: req.query.unseen === 'true' })))
router.patch('/alerts/:id/seen', manejar(req => profile.marcarAlertaVista(req.db, Number(req.params.id))))

// Corre el motor para esta persona: la interfaz lo llama al abrir la app.
// Compara contra el riesgo del momento (dato oficial + reportes ciudadanos).
router.post('/refresh', manejar(async req => {
    const { zones } = await zoneService.loadZones()
    return profile.actualizarPerfil(req.user.id, zones)
}))

// Derecho de supresión.
router.delete('/history', manejar(req => profile.borrarHistorial(req.db, req.user.id)))

module.exports = router
