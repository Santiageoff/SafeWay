import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const RISK_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981'
}

const RISK_LABELS = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo'
}

const VEHICLE_ICONS = {
  carro: '🚗',
  moto: '🏍️',
  bici: '🚲',
  peatón: '🚶'
}

// Convertir nivel de riesgo a porcentaje de inseguridad
const riskToPercentage = (risk) => {
  switch (risk) {
    case 'high': return 85
    case 'medium': return 55
    case 'low': return 25
    default: return 25
  }
}

// Convertir nivel de riesgo a puntaje de seguridad (0-100)
const riskToScore = (risk) => {
  switch (risk) {
    case 'high': return 15
    case 'medium': return 45
    case 'low': return 75
    default: return 75
  }
}

function getBarColor(percentage) {
  if (percentage > 70) return '#EF4444'
  if (percentage > 40) return '#F59E0B'
  return '#10B981'
}

function MapController({ zones, routeData }) {
  const map = useMap()

  useEffect(() => {
    // Auto zoom to route when routeData exists
    if (routeData?.routeCoordinates?.length > 0) {
      const bounds = L.latLngBounds(routeData.routeCoordinates)
      map.fitBounds(bounds, { padding: [60, 60] })
      return
    }

    if (!zones || zones.length === 0) return

    const validCoords = zones
      .filter(z => Array.isArray(z.coordinates) && z.coordinates.length === 2)
      .map(z => z.coordinates)

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [zones, routeData, map])

  return null
}

function ProgressBar({ percentage, color }) {
  return (
    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
      <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
    </div>
  )
}

function MapView({ zones = [], selectedVehicle = 'carro', highlightZones = [], originZone = null, destinationZone = null, routeData = null }) {
  const safeZones = Array.isArray(zones) ? zones : []
  const safeRouteZones = Array.isArray(highlightZones) ? highlightZones : []

  // Filtrar zonas válidas
  const validZones = safeZones.filter(
    zone => Array.isArray(zone.coordinates) && zone.coordinates.length === 2
  )

  // Determinar si resaltar zona (si está en la ruta)
  const isInRoute = (zoneId) => safeRouteZones.some(z => z.id === zoneId)

  const getVehicleRisk = (zone) =>
    zone.vehicleRisks?.[selectedVehicle] || zone.riskLevel || 'low'

  // Determinar opacidad y radio según si está en la ruta
  const getZoneStyle = (zone) => {
    if (safeRouteZones.length === 0) {
      return { fillOpacity: 0.25, opacity: 0.8, radius: 1200 }
    }
    if (isInRoute(zone.id)) {
      return { fillOpacity: 0.6, opacity: 1.0, radius: 1400 }
    }
    return { fillOpacity: 0.08, opacity: 0.3, radius: 1200 }
  }

  const getRouteColor = (risk) => {
    if (risk === 'high') return '#EF4444'
    if (risk === 'medium') return '#F59E0B'
    return '#10B981'
  }

  return (
    <MapContainer
      center={[4.711, -74.0721]}
      zoom={11}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />

      <MapController zones={validZones} routeData={routeData} />

      {/* Route Polyline */}
      {routeData?.routeCoordinates?.length > 1 && (
        <>
          {/* Shadow line for depth effect */}
          <Polyline
            positions={routeData.routeCoordinates}
            pathOptions={{
              color: '#000000',
              weight: 6,
              opacity: 0.2
            }}
          />
          {/* Main route line */}
          <Polyline
            positions={routeData.routeCoordinates}
            pathOptions={{
              color: getRouteColor(routeData.overallRisk),
              weight: 4,
              opacity: 0.9,
              dashArray: routeData.overallRisk === 'high' ? '8,4' : null
            }}
          />
        </>
      )}

      {/* Origin Marker */}
      {originZone?.coordinates && (
        <CircleMarker
          center={originZone.coordinates}
          radius={10}
          pathOptions={{
            color: '#22D3EE',
            fillColor: '#22D3EE',
            fillOpacity: 1,
            weight: 3
          }}
        >
          <Popup>
            <div style={{ fontFamily: 'sans-serif', padding: '8px' }}>
              <strong style={{ color: '#22D3EE' }}>📍 Origen</strong>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>{originZone.name}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                Inseguridad: {originZone.insecurityPercentage || 0}%
              </p>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Destination Marker */}
      {destinationZone?.coordinates && (
        <CircleMarker
          center={destinationZone.coordinates}
          radius={10}
          pathOptions={{
            color: '#A855F7',
            fillColor: '#A855F7',
            fillOpacity: 1,
            weight: 3
          }}
        >
          <Popup>
            <div style={{ fontFamily: 'sans-serif', padding: '8px' }}>
              <strong style={{ color: '#A855F7' }}>🏁 Destino</strong>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>{destinationZone.name}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                Inseguridad: {destinationZone.insecurityPercentage || 0}%
              </p>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {validZones.map((zone) => {
        const risk = getVehicleRisk(zone)
        const color = RISK_COLORS[risk] || RISK_COLORS.low
        const percentage = riskToPercentage(risk)
        const score = riskToScore(risk)
        const barColor = getBarColor(percentage)
        const zoneStyle = getZoneStyle(zone)

        return (
          <Circle
            key={zone.id}
            center={zone.coordinates}
            radius={zoneStyle.radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: zoneStyle.fillOpacity,
              weight: isInRoute(zone.id) ? 4 : 2,
              opacity: zoneStyle.opacity
            }}
          >
            <Popup>
              <div style={{ minWidth: '240px', fontFamily: 'system-ui, sans-serif' }}>
                {/* Título */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    display: 'inline-block',
                    boxShadow: `0 0 8px ${color}`
                  }}></span>
                  <strong style={{ fontSize: '18px', color: '#1e293b', fontWeight: '700' }}>
                    {zone.name}
                  </strong>
                </div>

                {/* Barra de progreso de inseguridad */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Porcentaje de inseguridad</span>
                    <span style={{ color: barColor, fontWeight: '600' }}>{percentage}%</span>
                  </div>
                  <ProgressBar percentage={percentage} color={barColor} />
                </div>

                {/* Puntaje de seguridad */}
                <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
                  <strong>Puntaje de seguridad:</strong> <span style={{ color: barColor, fontWeight: '600' }}>{score}/100</span>
                </div>

                {/* Tabla de vehículos */}
                <div style={{ fontSize: '12px', marginBottom: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '4px', color: '#64748b', fontSize: '11px' }}>Vehículo</th>
                        <th style={{ textAlign: 'left', padding: '4px', color: '#64748b', fontSize: '11px' }}>Nivel</th>
                        <th style={{ textAlign: 'center', padding: '4px', color: '#64748b', fontSize: '11px' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(VEHICLE_ICONS).map(([key, icon]) => {
                        const vehicleRisk = zone.vehicleRisks?.[key] || 'low'
                        const vColor = RISK_COLORS[vehicleRisk]
                        return (
                          <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 4px' }}>{icon}</td>
                            <td style={{ padding: '6px 4px', color: vColor, fontWeight: '500' }}>{RISK_LABELS[vehicleRisk]}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                              {vehicleRisk === 'high' ? '🔴' : vehicleRisk === 'medium' ? '🟡' : '🟢'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Recomendación */}
                {zone.recommendation && (
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #0ea5e9',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '12px',
                    color: '#0369a1'
                  }}>
                    <strong>💡 Recomendación:</strong> {zone.recommendation}
                  </div>
                )}
              </div>
            </Popup>
          </Circle>
        )
      })}
    </MapContainer>
  )
}

export default MapView