import { useState, useEffect, useCallback } from 'react'
import MapView from './components/Map/MapView'
import SearchBar from './components/Search/SearchBar'
import VehicleSelector from './components/Search/VehicleSelector'
import RiskSummary from './components/RiskPanel/RiskSummary'
import ReportButton from './components/Alert/ReportButton'
import ReportToast from './components/Alert/ReportToast'
import ReportDetails from './components/Alert/ReportDetails'
import AuthModal from './components/Auth/AuthModal'
import ResetPassword from './components/Auth/ResetPassword'
import UserMenu from './components/Auth/UserMenu'
import { useAuth } from './context/useAuth'
import { getRiskZones, getReports, getMyReports } from './services/api'
import logoSafeWay from './assets/Logo_SafeWay.png'
import './index.css'

// Datos de demostración: solo se usan si el backend no responde. El acta exige
// que el mapa nunca quede en blanco (objetivo #4, continuidad del servicio).
const DEMO_ZONES = [
  { id: 1, name: 'Usme', riskLevel: 'high', coordinates: [4.5115, -74.1144], vehicleRisks: { carro: 'high', moto: 'high', bici: 'medium', 'peatón': 'medium', publico: 'medium' } },
  { id: 2, name: 'Chapinero', riskLevel: 'medium', coordinates: [4.6329, -74.0579], vehicleRisks: { carro: 'low', moto: 'medium', bici: 'low', 'peatón': 'medium', publico: 'medium' } },
  { id: 3, name: 'Suba', riskLevel: 'low', coordinates: [4.7167, -74.0833], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', 'peatón': 'low', publico: 'low' } },
  { id: 4, name: 'Kennedy', riskLevel: 'medium', coordinates: [4.6248, -74.1501], vehicleRisks: { carro: 'medium', moto: 'high', bici: 'medium', 'peatón': 'high', publico: 'high' } },
  { id: 5, name: 'Engativá', riskLevel: 'low', coordinates: [4.6833, -74.1167], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', 'peatón': 'low', publico: 'low' } },
  { id: 6, name: 'San Cristóbal', riskLevel: 'high', coordinates: [4.5719, -74.0923], vehicleRisks: { carro: 'high', moto: 'high', bici: 'medium', 'peatón': 'high', publico: 'high' } },
  { id: 7, name: 'Rafael Uribe', riskLevel: 'high', coordinates: [4.5542, -74.1036], vehicleRisks: { carro: 'high', moto: 'high', bici: 'medium', 'peatón': 'high', publico: 'high' } },
  { id: 8, name: 'Tunjuelito', riskLevel: 'medium', coordinates: [4.5714, -74.1443], vehicleRisks: { carro: 'medium', moto: 'medium', bici: 'medium', 'peatón': 'high', publico: 'high' } },
  { id: 9, name: 'Barrios Unidos', riskLevel: 'low', coordinates: [4.6850, -74.0763], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', 'peatón': 'low', publico: 'low' } },
  { id: 10, name: 'Teusaquillo', riskLevel: 'low', coordinates: [4.6457, -74.0787], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', 'peatón': 'low', publico: 'low' } },
  { id: 11, name: 'Santa Fe', riskLevel: 'medium', coordinates: [4.5986, -74.0765], vehicleRisks: { carro: 'medium', moto: 'medium', bici: 'low', 'peatón': 'high', publico: 'high' } },
  { id: 12, name: 'Antonio Nariño', riskLevel: 'medium', coordinates: [4.5738, -74.0947], vehicleRisks: { carro: 'medium', moto: 'medium', bici: 'medium', 'peatón': 'medium', publico: 'medium' } },
  { id: 13, name: 'Puente Aranda', riskLevel: 'medium', coordinates: [4.5984, -74.1081], vehicleRisks: { carro: 'medium', moto: 'high', bici: 'medium', 'peatón': 'medium', publico: 'medium' } },
  { id: 14, name: 'Candelaria', riskLevel: 'medium', coordinates: [4.5826, -74.0746], vehicleRisks: { carro: 'low', moto: 'medium', bici: 'low', 'peatón': 'high', publico: 'high' } },
  { id: 15, name: 'Usaquén', riskLevel: 'low', coordinates: [4.7135, -74.0327], vehicleRisks: { carro: 'low', moto: 'low', bici: 'low', 'peatón': 'low', publico: 'low' } },
]

function App() {
  const { haySesion, recuperando } = useAuth()
  const [riskZones, setRiskZones] = useState([])
  const [meta, setMeta] = useState({})
  const [reports, setReports] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState('carro')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [routeResult, setRouteResult] = useState(null)
  const [highlightZones, setHighlightZones] = useState([])
  const [originZone, setOriginZone] = useState(null)
  const [destinationZone, setDestinationZone] = useState(null)
  const [routeData, setRouteData] = useState(null)

  // Botón de alerta
  const [toast, setToast] = useState(null)          // { report, remainingToday, undoWindowSeconds }
  const [detailsFor, setDetailsFor] = useState(null) // reporte a completar, o 'new'
  const [pendingCount, setPendingCount] = useState(0)
  const [authMotivo, setAuthMotivo] = useState(null)  // por qué se pide la sesión

  // El mapa se recarga cuando cambia el medio: el mismo dato se repinta según
  // qué robos te afectan a ti. En carro ves dónde roban carros; en bus, dónde
  // hay cosquilleo. Es el filtro que define la funcionalidad.
  const loadRiskZones = useCallback(async (mode = selectedVehicle) => {
    try {
      setLoading(true)
      const { zones, meta: responseMeta } = await getRiskZones(mode)
      setRiskZones(zones)
      setMeta(responseMeta)
      setError(null)
    } catch (err) {
      console.error('Error loading risk zones:', err)
      setError('No se pudieron cargar las zonas de riesgo')
      setRiskZones(DEMO_ZONES)
      setMeta({})
    } finally {
      setLoading(false)
    }
  }, [selectedVehicle])

  const loadReports = useCallback(async (mode = selectedVehicle) => {
    try {
      setReports(await getReports(mode, 30))
    } catch (err) {
      // Que falle la capa de reportes no debe tumbar el mapa histórico.
      console.error('Error loading reports:', err)
      setReports([])
    }
  }, [selectedVehicle])

  // Reportes propios sin completar: el recordatorio de "cuéntanos con calma".
  // "Mis reportes" es un endpoint privado: sin sesión no se pide siquiera.
  const loadPending = useCallback(async () => {
    if (!haySesion) { setPendingCount(0); return }
    try {
      const { incomplete } = await getMyReports()
      setPendingCount(incomplete || 0)
    } catch {
      setPendingCount(0)
    }
  }, [haySesion])

  useEffect(() => {
    loadRiskZones(selectedVehicle)
    loadReports(selectedVehicle)
  }, [selectedVehicle, loadRiskZones, loadReports])

  useEffect(() => { loadPending() }, [loadPending])

  // Si el backend responde 401 en mitad de algo (sesión caducada), se abre el
  // login en vez de dejar la pantalla en un estado raro.
  useEffect(() => {
    const alExpirar = () => setAuthMotivo('Tu sesión expiró. Vuelve a entrar para continuar.')
    window.addEventListener('safeway:sesion-requerida', alExpirar)
    return () => window.removeEventListener('safeway:sesion-requerida', alExpirar)
  }, [])

  const refreshAll = useCallback(() => {
    loadRiskZones(selectedVehicle)
    loadReports(selectedVehicle)
    loadPending()
  }, [selectedVehicle, loadRiskZones, loadReports, loadPending])

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

  const handleReported = (result) => {
    setToast(result)
    refreshAll()
  }

  const totalReports = reports.length

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
          <div style={{ marginTop: '14px' }}>
            <UserMenu />
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
          <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ¿Cómo te mueves?
          </p>
          <VehicleSelector selected={selectedVehicle} onSelect={handleVehicleChange} />
        </div>

        {/* Reportes ciudadanos en vivo */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: '#0F2744',
            border: '1px solid #1E3A5F',
            fontSize: '11px',
            color: '#94A3B8',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: totalReports > 0 ? '#DC2626' : '#334155' }}></span>
              <strong style={{ color: '#F1F5F9' }}>
                {totalReports} reporte{totalReports === 1 ? '' : 's'} ciudadano{totalReports === 1 ? '' : 's'}
              </strong>
            </div>
            {meta.timeWindow
              ? `Últimos 30 días · viendo el riesgo de la ${meta.timeWindow.label}`
              : 'Últimos 30 días'}
            {meta.storage === 'local' && (
              <div style={{ marginTop: '4px', color: '#F59E0B' }}>
                ⚠ Guardando local (Supabase sin configurar)
              </div>
            )}
          </div>

          {haySesion && pendingCount > 0 && (
            <button
              onClick={() => setDetailsFor('new')}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: '#FCD34D',
                fontSize: '11px',
                textAlign: 'left',
                cursor: 'pointer',
                lineHeight: 1.5
              }}
            >
              Tienes {pendingCount} reporte{pendingCount === 1 ? '' : 's'} sin detalles.
              <br />Cuéntanos qué pasó cuando puedas.
            </button>
          )}
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

              {/* Aviso concreto: "esto pasó aquí hace poco" es distinto del
                  color de la localidad, y se dice aparte. */}
              {routeResult.recentReports?.length > 0 && (
                <div style={{ fontSize: '11px', color: '#FCD34D', marginBottom: '6px' }}>
                  🚨 {routeResult.recentReports.reduce((sum, r) => sum + r.count, 0)} robo(s) reportado(s)
                  en tu trayecto: {routeResult.recentReports.map(r => r.zone).join(', ')}
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                Las zonas del trayecto están resaltadas en el mapa
              </div>
            </div>
          </div>
        )}

        {/* Risk Summary */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingTop: '12px' }}>
          <RiskSummary
            zones={riskZones}
            loading={loading}
            error={error}
            vehicleType={selectedVehicle}
            timeWindow={meta.timeWindow}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid #1E3A5F' }}>
          <button
            onClick={refreshAll}
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
          reports={reports}
        />

        {/* Botón de alerta: un toque envía con GPS y hora. */}
        {!toast && (
          <ReportButton
            onReported={handleReported}
            onNeedsManualLocation={() => setDetailsFor('new')}
            onNeedsAuth={() => setAuthMotivo(
              'Para reportar un robo necesitas una cuenta. Si estás en peligro ahora mismo, llama al 123 antes que nada.'
            )}
          />
        )}

        {toast && (
          <ReportToast
            report={toast.report}
            remainingToday={toast.remainingToday}
            undoWindowSeconds={toast.undoWindowSeconds}
            onClose={() => { setToast(null); refreshAll() }}
            onChanged={refreshAll}
            onOpenDetails={(report) => { setToast(null); setDetailsFor(report) }}
          />
        )}

        {detailsFor && (
          <ReportDetails
            report={detailsFor === 'new' ? null : detailsFor}
            zones={riskZones}
            onSaved={() => { setDetailsFor(null); refreshAll() }}
            onClose={() => { setDetailsFor(null); refreshAll() }}
          />
        )}

        {authMotivo !== null && (
          <AuthModal motivo={authMotivo} onClose={() => setAuthMotivo(null)} />
        )}

        {/* Llegó desde el enlace de "olvidé mi contraseña": se le pide la nueva
            y no se puede saltar, porque si no se queda dentro con la vieja. */}
        {recuperando && <ResetPassword />}
      </main>
    </div>
  )
}

export default App
