function RiskSummary({ zones, loading, error, vehicleType, timeWindow }) {
  const getRiskLabel = (level) => {
    switch (level) {
      case 'high': return 'Alto'
      case 'medium': return 'Medio'
      case 'low': return 'Bajo'
      default: return 'N/A'
    }
  }

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return '#EF4444'
      case 'medium': return '#F59E0B'
      case 'low': return '#10B981'
      default: return '#6B7280'
    }
  }

  // Respaldo cuando la zona no trae el porcentaje del backend (datos de demostración)
  const getPercentageFromRisk = (level) => {
    switch (level) {
      case 'high': return 85
      case 'medium': return 55
      case 'low': return 25
      default: return 25
    }
  }

  // Ordena por nivel y, dentro del mismo nivel, por porcentaje: así el cambio de
  // medio de transporte se nota de verdad en la lista, no solo en los colores.
  const sortedZones = [...(zones || [])].sort((a, b) => {
    const levelOrder = { high: 0, medium: 1, low: 2 }
    const aLevel = a.vehicleRisks?.[vehicleType] || a.riskLevel || 'low'
    const bLevel = b.vehicleRisks?.[vehicleType] || b.riskLevel || 'low'
    if (levelOrder[aLevel] !== levelOrder[bLevel]) return levelOrder[aLevel] - levelOrder[bLevel]
    return (b.insecurityPercentage ?? 0) - (a.insecurityPercentage ?? 0)
  })

  const getVehicleRisk = (zone) => zone.vehicleRisks?.[vehicleType] || zone.riskLevel || 'low'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #22D3EE',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '12px'
      }}>
        <p style={{ color: '#dc2626', fontSize: '14px', textAlign: 'center', margin: 0 }}>{error}</p>
        <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>Mostrando datos de demostración</p>
      </div>
    )
  }

  const highRiskZones = sortedZones.filter(z => getVehicleRisk(z) === 'high')
  const mediumRiskZones = sortedZones.filter(z => getVehicleRisk(z) === 'medium')
  const lowRiskZones = sortedZones.filter(z => getVehicleRisk(z) === 'low')

  const renderZoneCard = (zone) => {
    const risk = getVehicleRisk(zone)
    const color = getRiskColor(risk)
    const percentage = zone.insecurityPercentage ?? getPercentageFromRisk(risk)
    const reportCount = zone.reportsAffectingMode || 0

    return (
      <div
        key={zone.id}
        style={{
          padding: '12px',
          backgroundColor: '#0F2744',
          border: `1px solid ${color}40`,
          borderRadius: '10px',
          marginBottom: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
            {zone.name}
            {reportCount > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '10px', color: '#FCD34D', fontWeight: '500' }}>
                🚨 {reportCount}
              </span>
            )}
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '600',
            color: 'white',
            backgroundColor: color
          }}>
            {getRiskLabel(risk)}
          </span>
        </div>

        {/* Mini barra de porcentaje */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
            <span style={{ color: '#94A3B8' }}>Inseguridad</span>
            <span style={{ color: color, fontWeight: '600' }}>{percentage}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: '#1E3A5F', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: color,
              borderRadius: '2px'
            }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Zonas de Riesgo
        </h2>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', margin: 0 }}>
          {zones?.length || 0} localidades en Bogotá
        </p>
        {/* Contexto horario: el mapa ya está pintado para esta franja, no hay
            que tocar ningún control. Solo se dice qué se está viendo. */}
        {timeWindow && (
          <p style={{ fontSize: '11px', color: '#22D3EE', margin: '6px 0 0' }}>
            🕐 Riesgo de la {timeWindow.label}
          </p>
        )}
      </div>

      {highRiskZones.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }}></span>
            Alto riesgo ({highRiskZones.length})
          </div>
          {highRiskZones.map(renderZoneCard)}
        </div>
      )}

      {mediumRiskZones.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }}></span>
            Riesgo medio ({mediumRiskZones.length})
          </div>
          {mediumRiskZones.map(renderZoneCard)}
        </div>
      )}

      {lowRiskZones.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
            Bajo riesgo ({lowRiskZones.length})
          </div>
          {lowRiskZones.map(renderZoneCard)}
        </div>
      )}
    </div>
  )
}

export default RiskSummary