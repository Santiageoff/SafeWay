const express = require('express')
const cors = require('cors')
require('dotenv').config()

const riskRoutes = require('./routes/risk.routes')
const routeRoutes = require('./routes/route.route')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/risk', riskRoutes)
app.use('/api/route', routeRoutes)

app.get('/health', (req, res) => {
    res.json({ status: 'SafeWay AI backend running' })
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