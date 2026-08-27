const fetch = require('node-fetch')

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

async function analyzeRisk(zoneData) {
    const prompt = `
    Eres un experto en seguridad vial de Bogotá, Colombia.
    Analiza esta zona y da una recomendación corta en español (máximo 3 oraciones):
    
    Zona: ${zoneData.name}
    Localidad: ${zoneData.localidad}
    Accidentes registrados: ${zoneData.accidents}
    Hurtos registrados: ${zoneData.thefts}
    Nivel de riesgo calculado: ${zoneData.riskLevel}
    Tipo de vehículo consultado: ${zoneData.vehicleType}
    
    Responde solo con la recomendación, sin saludos ni explicaciones extra.
  `

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'qwen2.5:14b',
            prompt,
            stream: false
        })
    })

    const data = await response.json()
    return data.response
}

module.exports = { analyzeRisk }