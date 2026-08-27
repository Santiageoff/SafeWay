import { useState, useEffect } from 'react'
import MapView from './components/Map/MapView'
import SearchBar from './components/Search/SearchBar'
import VehicleSelector from './components/Search/VehicleSelector'
import RiskSummary from './components/RiskPanel/RiskSummary'
import { getRiskZones } from './services/api'
import logoSafeWay from './assets/Logo_SafeWay.png'
import './index.css'

function App() {
  const [riskZones, setRiskZones] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState('carro')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [routeResult, setRouteResult] = useState(null)
  const [highlightZones, setHighlightZones] = useState([])
  const [originZone, setOriginZone] = useState(null)
  const [destinationZone, setDestinationZone] = useState(null)
  const [routeData, setRouteData] = useState(null)

  useEffect(() => {
    loadRiskZones()
  }, [])

  const loadRiskZones = async () => {
    try {
      setLoading(true)
      const data = await getRiskZones()
      setRiskZones(data)
      setError(null)
    } catch (err) {
      console.error('Error loading risk zones:', err)
      setError('No se pudieron cargar las zonas de riesgo')
      setRiskZones([
        { id: 1, name: 'Usme', riskLevel: 'high', coordinates: [4.5115, -74.1144], vehicleRisks: { carro: 'high', moto: 'high', bici: 'medium', peatón: 'medium' } },
        { id: 2, name: 'Chapinero', riskLevel: 'medium', coordinates: [4.6329, -74.0579], vehicleRisks: { carro: 'low', moto: 'medium', bici: 'low', peatón: 'medium' } },
        { id: 3, name: 'Suba', riskLevel: 'low', coordinates: [4.7167, -74.0833], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', peatón: 'low' } },
        { id: 4, name: 'Kennedy', riskLevel: 'medium', coordinates: [4.6248, -74.1501], vehicleRisks: { carro: 'medium', moto: 'high', bici: 'medium', peatón: 'high' } },
        { id: 5, name: 'Engativá', riskLevel: 'low', coordinates: [4.6833, -74.1167], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', peatón: 'low' } },
        { id: 6, name: 'San Cristóbal', riskLevel: 'high', coordinates: [4.5719, -74.0923], vehicleRisks: { carro: 'high', moto: 'high', bici: 'medium', peatón: 'high' } },
        { id: 7, name: 'Rafael Uribe', riskLevel: 'high', coordinates: [4.5542, -74.1036], vehicleRisks: { carro: 'high', moto: 'high', bici: 'medium', peatón: 'high' } },
        { id: 8, name: 'Tunjuelito', riskLevel: 'medium', coordinates: [4.5714, -74.1443], vehicleRisks: { carro: 'medium', moto: 'medium', bici: 'medium', peatón: 'high' } },
        { id: 9, name: 'Barrios Unidos', riskLevel: 'low', coordinates: [4.6850, -74.0763], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', peatón: 'low' } },
        { id: 10, name: 'Teusaquillo', riskLevel: 'low', coordinates: [4.6457, -74.0787], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', peatón: 'low' } },
        { id: 11, name: 'Santa Fe', riskLevel: 'medium', coordinates: [4.5986, -74.0765], vehicleRisks: { carro: 'medium', moto: 'medium', bici: 'low', peatón: 'high' } },
        { id: 12, name: 'Antonio Nariño', riskLevel: 'medium', coordinates: [4.5738, -74.0947], vehicleRisks: { carro: 'medium', moto: 'medium', bici: 'medium', peatón: 'medium' } },
        { id: 13, name: 'Puente Aranda', riskLevel: 'medium', coordinates: [4.5984, -74.1081], vehicleRisks: { carro: 'medium', moto: 'high', bici: 'medium', peatón: 'medium' } },
        { id: 14, name: 'Candelaria', riskLevel: 'medium', coordinates: [4.5826, -74.0746], vehicleRisks: { carro: 'low', moto: 'medium', bici: 'low', peatón: 'high' } },
        { id: 15, name: 'Usaquén', riskLevel: 'low', coordinates: [4.7135, -74.0327], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', peatón: 'low' } },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleRouteAnalyzed = (result) => {
    setRouteResult(result)
    setHighlightZones(result.zonesInRoute || [])
    setOriginZone(result.origin || null)
    setDestinationZone(result.destination || null)
    setRouteData(result)
  }

  const handleVehicleChange = (vehicle) => {
    setSelectedVehicle(vehicle)
    // Limpiar resultado de ruta al cambiar vehículo
    setRouteResult(null)
    setHighlightZones([])
    setOriginZone(null)
    setDestinationZone(null)
    setRouteData(null)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0A1628', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1E3A5F', backgroundColor: '#0A1628' }}>
        {/* Logo */}
        <div style={{ padding: '20px', borderBottom: '1px solid #1E3A5F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={logoSafeWay}
              alt="SafeWay Logo"
              style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }}
            />
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>SafeWay</h1>
              <p style={{ fontSize: '12px', color: '#22D3EE', margin: 0 }}>Bogotá Risk Map</p>
            </div>
          </div>
        </div>

        {/* Search con análisis de ruta */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1E3A5F' }}>
          <SearchBar
            selectedVehicle={selectedVehicle}
            onRouteAnalyzed={handleRouteAnalyzed}
          />
        </div>

        {/* Vehicle Selector */}
        <div style={{ padding: '16px', paddingTop: '12px', paddingBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de vehículo</p>
          <VehicleSelector selected={selectedVehicle} onSelect={handleVehicleChange} />
        </div>

        {/* Resultado de ruta seleccionado */}
        {routeResult && (
          <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #1E3A5F' }}>
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(34, 211, 238, 0.1)',
              border: '1px solid #22D3EE',
              borderRadius: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>🛣️</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#22D3EE' }}>Ruta analizada</span>
              </div>
              <div style={{ fontSize: '12px', color: '#F1F5F9', marginBottom: '6px' }}>
                Zonas en el recorrido: <strong>{highlightZones.length}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                Las zonas del trayecto están resaltadas en el mapa
              </div>
            </div>
          </div>
        )}

        {/* Risk Summary */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingTop: '12px' }}>
          <RiskSummary zones={riskZones} loading={loading} error={error} vehicleType={selectedVehicle} />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid #1E3A5F' }}>
          <button
            onClick={loadRiskZones}
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', backgroundColor: '#065A82', color: 'white', fontWeight: '500', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar datos
          </button>
        </div>
      </aside>

      {/* Map */}
      <main style={{ flex: 1, position: 'relative' }}>
        <MapView
          zones={riskZones}
          selectedVehicle={selectedVehicle}
          highlightZones={highlightZones}
          originZone={originZone}
          destinationZone={destinationZone}
          routeData={routeData}
        />
      </main>
    </div>
  )
}

export default App