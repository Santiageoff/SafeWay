const express = require('express')
const cors = require('cors')
require('dotenv').config()

const riskRoutes = require('./routes/risk.routes')
const routeRoutes = require('./routes/route.route')
const reportRoutes = require('./routes/report.routes')
const reportStore = require('./services/reportStore')
const supabase = require('./services/supabaseService')

const app = express()
const PORT = process.env.PORT || 3001

// El navegador manda el uuid de dispositivo en este header; sin declararlo
// en CORS, el preflight bloquea el reporte.
app.use(cors({ allowedHeaders: ['Content-Type', 'X-Device-Id'] }))
app.use(express.json())

app.use('/api/risk', riskRoutes)
app.use('/api/route', routeRoutes)
app.use('/api/reports', reportRoutes)

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

// Test endpoint para verificar los datos
app.get('/api/test-zones', (req, res) => {
    // Directly read and evaluate the zones
    const zones = [
        {
            id: 1,
            name: "Usaquén",
            coordinates: [4.7015, -74.0307],
            riskLevel: "low",
            insecurityPercentage: 12,
            safetyScore: 88,
            recommendation: "Test recommendation"
        }
    ]
    res.json({ success: true, data: zones })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})