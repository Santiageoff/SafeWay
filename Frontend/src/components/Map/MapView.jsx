import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ReportLayer from './ReportLayer'
import { formatDataSource } from '../../utils/dataSource'
import { RISK_HEX as RISK_COLORS, RISK_TEXT_HEX as RISK_TEXT_COLORS, RISK_LABELS } from '../../utils/risk'

const VEHICLE_ICONS = {
  carro: '🚗',
  moto: '🏍️',
  bici: '🚲',
  peatón: '🚶',
  publico: '🚌'
}

// Respaldo cuando la zona no trae el porcentaje calculado por el backend.
const riskToPercentage = (risk) => {
  switch (risk) {
    case 'high': return 85
    case 'medium': return 55
    case 'low': return 25
    default: return 25
  }
}

function getBarColor(percentage) {
  if (percentage > 70) return RISK_COLORS.high
  if (percentage > 40) return RISK_COLORS.medium
  return RISK_COLORS.low
}

function getBarTextColor(percentage) {
  if (percentage > 70) return RISK_TEXT_COLORS.high
  if (percentage > 40) return RISK_TEXT_COLORS.medium
  return RISK_TEXT_COLORS.low
}

function MapController({ zones, routeData }) {
  const map = useMap()
  const didFitZones = useRef(false)
  const hadRoute = useRef(false)

  useEffect(() => {
    // Auto zoom to route when routeData exists
    if (routeData?.routeCoordinates?.length > 0) {
      hadRoute.current = true
      const bounds = L.latLngBounds(routeData.routeCoordinates)
      map.fitBounds(bounds, { padding: [60, 60] })
      return
    }

    // Encuadrar las 20 localidades solo hace falta una vez al cargar y al
    // volver de ver una ruta (cambiar de vehículo la limpia): repetirlo en
    // cada recarga (p. ej. "Actualizar datos") descartaba las teselas ya
    // pedidas y le movía el mapa a quien lo estaba explorando.
    const volviendoDeRuta = hadRoute.current
    hadRoute.current = false
    if ((didFitZones.current && !volviendoDeRuta) || !zones || zones.length === 0) return

    const validCoords = zones
      .filter(z => Array.isArray(z.coordinates) && z.coordinates.length === 2)
      .map(z => z.coordinates)

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords)
      map.fitBounds(bounds, { padding: [50, 50] })
      didFitZones.current = true
    }
  }, [zones, routeData, map])

  return null
}

function ProgressBar({ percentage, color }) {
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-texto/20 bg-fondo">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${percentage}%`, backgroundColor: color }}></div>
    </div>
  )
}

function MapView({ zones = [], selectedVehicle = 'carro', highlightZones = [], originZone = null, destinationZone = null, routeData = null, reports = [], showReports = true }) {
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

  // Relleno al 55% (90% en la ruta); el borde siempre es negro y solo cambia
  // de grosor (2,5 px normal, 4 px en la ruta), como en docs/diseno/README.md.
  const getZoneStyle = (zone) => {
    if (safeRouteZones.length === 0) {
      return { fillOpacity: 0.55, weight: 2.5 }
    }
    if (isInRoute(zone.id)) {
      return { fillOpacity: 0.9, weight: 4 }
    }
    return { fillOpacity: 0.15, weight: 2.5 }
  }

  return (
    <MapContainer
      // Centro y zoom ya calculados para las 20 localidades (de Usaquén a
      // Sumapaz): arrancar aquí evita pedir un primer set de teselas a un
      // zoom que igual se va a descartar en cuanto fitBounds calcule el
      // real, que es lo que más tardaba en el LCP (issue #12).
      center={[4.391, -74.195]}
      zoom={9}
      style={{ width: '100%', height: '100%' }}
    >
      {/* El basemap gratuito de CARTO (basemaps.cartocdn.com) empezó a pedir
          API key y solo devolvía teselas con ese aviso; se usa el tile
          estándar de OSM, que no la requiere. */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController zones={validZones} routeData={routeData} />

      {/* Route Polyline: azul de 5px sobre un borde negro de 11px (docs/diseno) */}
      {routeData?.routeCoordinates?.length > 1 && (
        <>
          <Polyline
            positions={routeData.routeCoordinates}
            pathOptions={{ color: '#111111', weight: 11, opacity: 1 }}
          />
          <Polyline
            positions={routeData.routeCoordinates}
            pathOptions={{ color: '#2F5BFF', weight: 5, opacity: 1 }}
          />
        </>
      )}

      {/* Origin Marker */}
      {originZone?.coordinates && (
        <CircleMarker
          center={originZone.coordinates}
          radius={10}
          pathOptions={{ color: '#111111', fillColor: '#2F5BFF', fillOpacity: 1, weight: 3 }}
        >
          <Popup>
            <div className="p-1">
              <strong className="text-acento">📍 Origen</strong>
              <p className="my-1 text-sm text-texto">{originZone.name}</p>
              <p className="m-0 text-xs text-texto-tenue">
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
          pathOptions={{ color: '#111111', fillColor: '#111111', fillOpacity: 1, weight: 3 }}
        >
          <Popup>
            <div className="p-1">
              <strong className="text-texto">🏁 Destino</strong>
              <p className="my-1 text-sm text-texto">{destinationZone.name}</p>
              <p className="m-0 text-xs text-texto-tenue">
                Inseguridad: {destinationZone.insecurityPercentage || 0}%
              </p>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {validZones.map((zone) => {
        const risk = getVehicleRisk(zone)
        const color = RISK_COLORS[risk] || RISK_COLORS.low
        // El porcentaje viene calculado del backend (base histórica + reportes
        // ciudadanos con decaimiento). Solo se deriva del nivel como respaldo.
        const percentage = zone.insecurityPercentage ?? riskToPercentage(risk)
        const score = zone.safetyScore ?? (100 - percentage)
        const barColor = getBarColor(percentage)
        const barTextColor = getBarTextColor(percentage)
        const zoneStyle = getZoneStyle(zone)
        const basePercentage = zone.baseInsecurityPercentage
        const raisedByReports = basePercentage != null && percentage > basePercentage
        const sourceLabel = formatDataSource(zone)

        return (
          <Circle
            key={zone.id}
            center={zone.coordinates}
            radius={1200 + (isInRoute(zone.id) ? 200 : 0)}
            pathOptions={{
              color: '#111111',
              fillColor: color,
              fillOpacity: zoneStyle.fillOpacity,
              weight: zoneStyle.weight,
              opacity: 1
            }}
          >
            {/* maxHeight: el popup trae título + barra + tabla de 5 vehículos +
                recomendación + fuente, y en un mapa bajo de celular eso es más
                alto que la tarjeta del mapa y tapa el botón de reportar. Con
                un tope, el contenido hace scroll adentro en vez de desbordar. */}
            <Popup maxHeight={260}>
              <div className="min-w-[240px] font-sans text-texto">
                {/* Título */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-texto" style={{ backgroundColor: color }}></span>
                  <strong className="text-lg font-bold">{zone.name}</strong>
                </div>

                {/* Barra de progreso de inseguridad */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-texto-tenue">Porcentaje de inseguridad</span>
                    <span className="font-semibold" style={{ color: barTextColor }}>{percentage}%</span>
                  </div>
                  <ProgressBar percentage={percentage} color={barColor} />

                  {/* Separar SIEMPRE el dato oficial del reporte ciudadano: si el
                      número subió, hay que decir por qué y desde dónde. */}
                  {raisedByReports && (
                    <p className="mt-1.5 text-[11px] text-riesgo-medio-texto">
                      ▲ Subió de {basePercentage}% por {zone.reportsAffectingMode} reporte
                      {zone.reportsAffectingMode === 1 ? '' : 's'} ciudadano
                      {zone.reportsAffectingMode === 1 ? '' : 's'} reciente
                      {zone.reportsAffectingMode === 1 ? '' : 's'}
                    </p>
                  )}

                  {zone.dominantWindow && (
                    <p className="mt-1 text-[11px] text-texto-tenue">
                      🕐 La mayoría de reportes son en la {zone.dominantWindow.label}
                    </p>
                  )}
                </div>

                {/* Puntaje de seguridad */}
                <div className="mb-3 border-b border-texto/20 pb-2.5 text-[13px]">
                  <strong>Puntaje de seguridad:</strong>{' '}
                  <span className="font-semibold" style={{ color: barTextColor }}>{score}/100</span>
                </div>

                {/* Tabla de vehículos */}
                <div className="mb-3 text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-texto/20">
                        <th className="p-1 text-left text-[11px] text-texto-tenue">Vehículo</th>
                        <th className="p-1 text-left text-[11px] text-texto-tenue">Nivel</th>
                        <th className="p-1 text-center text-[11px] text-texto-tenue">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(VEHICLE_ICONS).map(([key, icon]) => {
                        const vehicleRisk = zone.vehicleRisks?.[key] || 'low'
                        const vTextColor = RISK_TEXT_COLORS[vehicleRisk]
                        return (
                          <tr key={key} className="border-b border-texto/10">
                            <td className="py-1.5 px-1">{icon}</td>
                            <td className="py-1.5 px-1 font-medium" style={{ color: vTextColor }}>{RISK_LABELS[vehicleRisk]}</td>
                            <td className="py-1.5 px-1 text-center">
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
                  <div className="rounded-campo border-3 border-texto bg-fondo p-2.5 text-xs">
                    <strong>💡 Recomendación:</strong> {zone.recommendation}
                  </div>
                )}

                {sourceLabel && (
                  <p className="mt-2.5 text-[10px] text-texto-tenue">{sourceLabel}</p>
                )}
              </div>
            </Popup>
          </Circle>
        )
      })}

      {/* Reportes ciudadanos: puntos sobre las burbujas, nunca mezclados con ellas */}
      <ReportLayer reports={reports} visible={showReports} />
    </MapContainer>
  )
}

export default MapView
