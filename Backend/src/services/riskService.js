// Lógica de clasificación de riesgo
// Simple y efectiva para la beta

function calculateRiskLevel(accidents, thefts) {
    const score = (accidents * 0.6) + (thefts * 0.4)

    if (score > 80) return 'high'
    if (score > 40) return 'medium'
    return 'low'
}

function getRiskColor(riskLevel) {
    const colors = {
        high: '#EF4444',    // rojo
        medium: '#F59E0B',  // amarillo
        low: '#10B981'      // verde
    }
    return colors[riskLevel]
}

// Ajuste por tipo de vehículo
// Los ciclistas y peatones tienen umbral más bajo
function adjustRiskForVehicle(riskLevel, vehicleType) {
    if (vehicleType === 'bicycle' || vehicleType === 'pedestrian') {
        if (riskLevel === 'low') return 'medium'
        if (riskLevel === 'medium') return 'high'
    }
    return riskLevel
}

module.exports = { calculateRiskLevel, getRiskColor, adjustRiskForVehicle }