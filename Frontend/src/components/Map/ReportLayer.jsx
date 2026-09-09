import { CircleMarker, Popup } from 'react-leaflet'
import { typeById } from '../Alert/reportTypes'

// Capa de reportes ciudadanos sobre el mapa.
//
// Se pintan aparte de las burbujas de localidad a propósito: la burbuja es el
// dato oficial agregado, el punto es "esto pasó aquí, hace poco". Mezclarlos
// visualmente sería vender un reporte sin verificar como cifra oficial.
//
// Cada punto es un HECHO, no un reporte: tres testigos del mismo atraco
// llegan agrupados en uno con `confirmations: 3`.

const HOUR_MS = 60 * 60 * 1000

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

// El punto se apaga con el tiempo, igual que su peso en el cálculo de riesgo.
// Lo que ves refleja lo que el motor está tomando en cuenta.
function freshness(iso) {
  const ageHours = (Date.now() - new Date(iso).getTime()) / HOUR_MS
  if (ageHours < 6) return { opacity: 0.95, radius: 9, label: 'Reciente' }
  if (ageHours < 24) return { opacity: 0.7, radius: 8, label: 'Últimas 24 h' }
  if (ageHours < 24 * 7) return { opacity: 0.45, radius: 7, label: 'Esta semana' }
  return { opacity: 0.25, radius: 6, label: 'Este mes' }
}

function ReportLayer({ reports = [], visible = true }) {
  if (!visible || reports.length === 0) return null

  return (
    <>
      {reports.map(report => {
        const style = freshness(report.occurred_at)
        const type = typeById(report.type)
        const isApprox = report.precision === 'approx'

        return (
          <CircleMarker
            key={report.id}
            center={[report.lat, report.lng]}
            radius={style.radius}
            pathOptions={{
              color: '#FFFFFF',
              weight: 2,
              fillColor: '#DC2626',
              fillOpacity: style.opacity,
              // La ubicación difuminada (vivienda) se dibuja punteada para no
              // dar a entender una precisión que no tiene.
              dashArray: isApprox ? '3,3' : null
            }}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{type?.icon || '🚨'}</span>
                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                    {type?.label || 'Robo reportado'}
                  </strong>
                </div>

                <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#475569' }}>
                  {report.locality} · {timeAgo(report.occurred_at)}
                  {report.occurred_end && ' (hora aproximada)'}
                </p>

                {report.station && (
                  <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#475569' }}>
                    📍 {report.station}
                  </p>
                )}

                {report.confirmations > 1 && (
                  <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                    ✓ Confirmado por {report.independentSources} personas
                  </p>
                )}

                {isApprox && (
                  <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    Ubicación aproximada por privacidad
                  </p>
                )}

                {!report.type && (
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    Reporte sin detalles: cuenta a media fuerza
                  </p>
                )}

                <p style={{ margin: '8px 0 0', paddingTop: '6px', borderTop: '1px solid #e2e8f0', fontSize: '10px', color: '#94a3b8' }}>
                  Reporte ciudadano sin verificar · {style.label}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

export default ReportLayer
