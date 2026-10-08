import { formatDataSource } from '../../utils/dataSource'
import { RISK_LABELS, RISK_TAILWIND } from '../../utils/risk'

function RiskSummary({ zones, loading, error, vehicleType, timeWindow }) {
  // Respaldo cuando la zona no trae el porcentaje del backend
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
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-texto border-t-transparent"></div>
      </div>
    )
  }

  // Si falló la carga pero ya había un mapa cargado, se avisa sin tapar esa
  // lista: es mejor mostrar el último dato bueno que una pantalla en blanco.
  if (error && sortedZones.length === 0) {
    return (
      <div className="rounded-tarjeta border-3 border-texto bg-aviso p-4 text-center">
        <p className="m-0 text-sm text-texto">{error}</p>
      </div>
    )
  }

  const highRiskZones = sortedZones.filter(z => getVehicleRisk(z) === 'high')
  const mediumRiskZones = sortedZones.filter(z => getVehicleRisk(z) === 'medium')
  const lowRiskZones = sortedZones.filter(z => getVehicleRisk(z) === 'low')

  const renderZoneCard = (zone) => {
    const risk = getVehicleRisk(zone)
    const style = RISK_TAILWIND[risk] || RISK_TAILWIND.low
    const percentage = zone.insecurityPercentage ?? getPercentageFromRisk(risk)
    const reportCount = zone.reportsAffectingMode || 0
    const sourceLabel = formatDataSource(zone)

    return (
      <div key={zone.id} className="mb-2 rounded-campo border-3 border-texto bg-superficie p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-texto">
            {zone.name}
            {reportCount > 0 && (
              <span className="ml-1.5 text-[10px] font-medium text-riesgo-alto-texto">🚨 {reportCount}</span>
            )}
          </span>
          <span className={`rounded-pastilla border-3 border-texto px-2 py-0.5 text-[10px] font-bold text-texto ${style.bg}`}>
            {RISK_LABELS[risk]}
          </span>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px]">
            <span className="text-texto-tenue">Inseguridad</span>
            <span className={`font-semibold ${style.text}`}>{percentage}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-texto/30 bg-fondo">
            <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${percentage}%` }}></div>
          </div>
        </div>

        {sourceLabel && (
          <p className="mt-2 text-[10px] text-texto-tenue">{sourceLabel}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-texto">Zonas de riesgo</h2>
        <p className="m-0 mt-1 text-xs text-texto-tenue">{zones?.length || 0} localidades en Bogotá</p>
        {/* Contexto horario: el mapa ya está pintado para esta franja, no hay
            que tocar ningún control. Solo se dice qué se está viendo. */}
        {timeWindow && (
          <p className="m-0 mt-1.5 text-[11px] text-enlace">🕐 Riesgo de la {timeWindow.label}</p>
        )}
        {error && (
          <p className="m-0 mt-1.5 text-[11px] text-riesgo-alto-texto">⚠ {error}</p>
        )}
      </div>

      {highRiskZones.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-texto-tenue">
            <span className="h-2 w-2 rounded-full bg-riesgo-alto"></span>
            Alto riesgo ({highRiskZones.length})
          </div>
          {highRiskZones.map(renderZoneCard)}
        </div>
      )}

      {mediumRiskZones.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-texto-tenue">
            <span className="h-2 w-2 rounded-full bg-riesgo-medio"></span>
            Riesgo medio ({mediumRiskZones.length})
          </div>
          {mediumRiskZones.map(renderZoneCard)}
        </div>
      )}

      {lowRiskZones.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-texto-tenue">
            <span className="h-2 w-2 rounded-full bg-riesgo-bajo"></span>
            Bajo riesgo ({lowRiskZones.length})
          </div>
          {lowRiskZones.map(renderZoneCard)}
        </div>
      )}
    </div>
  )
}

export default RiskSummary
