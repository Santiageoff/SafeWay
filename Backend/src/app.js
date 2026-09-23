const express = require('express')
const cors = require('cors')
require('dotenv').config()

const riskRoutes = require('./routes/risk.routes')
const routeRoutes = require('./routes/route.route')
const reportRoutes = require('./routes/report.routes')
const metricsRoutes = require('./routes/metrics.routes')
const reportStore = require('./services/reportStore')
const supabase = require('./services/supabaseService')

const app = express()
const PORT = process.env.PORT || 3001

// CORS cerrado por lista blanca. Antes se respondia Access-Control-Allow-Origin: *
// a cualquier origen, asi que cualquier web podia llamar a esta API desde el
// navegador de un visitante.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

app.use(cors({
    origin(origin, callback) {
        // Sin cabecera Origin son peticiones que no vienen de un navegador
        // (curl, Postman, el propio servidor). No hay nada que proteger ahi:
        // CORS solo defiende al usuario de una web maliciosa.
        if (!origin) return callback(null, true)
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
        const error = new Error(`Origen no permitido por CORS: ${origin}`)
        error.status = 403
        error.code = 'cors_rejected'
        callback(error)
    },
    // X-Device-Id sigue declarado mientras exista el flujo anonimo; sin el,
    // el preflight bloquea el reporte.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
    credentials: true
}))
// Limite explicito de cuerpo. El descriptivo por defecto de Express es 100kb;
// para lo que manda esta API (un punto y unos campos cortos) 32kb sobra.
app.use(express.json({ limit: '32kb' }))

app.use('/api/risk', riskRoutes)
app.use('/api/route', routeRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/metrics', metricsRoutes)

app.get('/health', async (req, res) => {
    // Sondea Supabase de verdad en vez de asumir que funciona porque hay
    // variables de entorno. Es el objetivo #4 del acta: saber y reportar
    // cuántas consultas usan la fuente real y cuántas el respaldo.
    const connection = await supabase.checkConnection()

    res.json({
        status: 'SafeWay AI backend running',
        storage: { ...reportStore.status(), supabaseReachable: connection.ok },
        ...(connection.ok ? {} : { supabaseError: connection.reason })
    })
})

// Manejador de errores. Sin esto, un origen rechazado por CORS devolvia
// HTTP 500, que hace pensar que el servidor se rompio cuando en realidad
// la peticion fue correctamente denegada.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)

    const status = err.status || 500
    if (status >= 500) console.error('[app] error no controlado:', err)

    res.status(status).json({
        success: false,
        code: err.code || 'internal_error',
        // Los errores 500 no cuentan detalles hacia afuera: podrian filtrar
        // rutas de archivos o estructura interna.
        error: status >= 500 ? 'Error interno del servidor' : err.message
    })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})