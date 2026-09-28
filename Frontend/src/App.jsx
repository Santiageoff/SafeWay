import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import MapView from './components/Map/MapView'
import SearchBar from './components/Search/SearchBar'
import VehicleSelector from './components/Search/VehicleSelector'
import RiskSummary from './components/RiskPanel/RiskSummary'
import ReportButton from './components/Alert/ReportButton'
import UserMenu from './components/Auth/UserMenu'
import { useAuth } from './context/useAuth'
import { getRiskZones, getReports, getMyReports } from './services/api'
import './index.css'

// El mapa (Leaflet) es lo primero que hay que pintar; estos son paneles que
// solo aparecen tras una acción del usuario, así que se cargan aparte y no
// bloquean el LCP en carga inicial (issue #12: LCP < 3s).
const ReportToast = lazy(() => import('./components/Alert/ReportToast'))
const ReportDetails = lazy(() => import('./components/Alert/ReportDetails'))
const AuthModal = lazy(() => import('./components/Auth/AuthModal'))
const ResetPassword = lazy(() => import('./components/Auth/ResetPassword'))

const VEHICLE_LABELS = { carro: 'Carro', moto: 'Moto', bici: 'Bici', 'peatón': 'A pie', publico: 'Público' }

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
  const [routeSheetOpen, setRouteSheetOpen] = useState(false)

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
      // El respaldo de datos oficiales ya vive en el backend (localityStore);
      // si ni así responde, se deja el último mapa cargado en vez de tapar
      // el error con datos de mentira.
      console.error('Error loading risk zones:', err)
      setError('No se pudieron cargar las zonas de riesgo. Mostrando lo último disponible.')
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

  const vehicleSelector = <VehicleSelector selected={selectedVehicle} onSelect={handleVehicleChange} />

  const reportsStrip = (
    <div className="rounded-campo border-3 border-texto bg-superficie px-3 py-2.5 text-xs text-texto-tenue">
      <div className="mb-1 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${totalReports > 0 ? 'bg-riesgo-alto' : 'bg-texto-tenue/30'}`}></span>
        <strong className="text-texto">
          {totalReports} reporte{totalReports === 1 ? '' : 's'} ciudadano{totalReports === 1 ? '' : 's'}
        </strong>
      </div>
      {meta.timeWindow
        ? `Últimos 30 días · viendo el riesgo de la ${meta.timeWindow.label}`
        : 'Últimos 30 días'}
      {/* meta.storage no existe en la respuesta de /api/risk/zones (solo en
          /health); el campo real para saber si se está usando el respaldo
          del backend en vez de Supabase es meta.localitySource. */}
      {meta.localitySource === 'respaldo-local' && (
        <div className="mt-1 text-riesgo-medio-texto">⚠ Datos de respaldo (Supabase sin configurar o caído)</div>
      )}
      {haySesion && pendingCount > 0 && (
        <button
          onClick={() => setDetailsFor('new')}
          className="mt-2 w-full rounded-campo border-3 border-texto bg-riesgo-medio px-2.5 py-2 text-left text-[11px] leading-relaxed text-texto"
        >
          Tienes {pendingCount} reporte{pendingCount === 1 ? '' : 's'} sin detalles.
          <br />Cuéntanos qué pasó cuando puedas.
        </button>
      )}
    </div>
  )

  const routeButtonLabel = routeResult
    ? `${routeResult.origin?.name?.toUpperCase()} → ${routeResult.destination?.name?.toUpperCase()} · ${VEHICLE_LABELS[selectedVehicle] || selectedVehicle}`
    : 'PLANEA TU RUTA'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-fondo">
      {/* Barra superior */}
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b-3 border-texto bg-barra px-4 py-2 md:min-h-[84px] md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/simbolo-d.svg" alt="" className="h-9 w-9 shrink-0 md:h-11 md:w-11" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg leading-none text-texto md:text-2xl">SAFEWAY</h1>
            <p className="mt-0.5 hidden text-xs text-texto-tenue md:block">Riesgo por localidad · Bogotá</p>
          </div>
        </div>
        <div className="w-[150px] shrink-0 md:w-[220px]">
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Columna izquierda (computador) */}
        <aside className="hidden w-[440px] shrink-0 flex-col gap-4 overflow-y-auto border-r-3 border-texto p-4 md:flex">
          {reportsStrip}

          <div className="rounded-tarjeta border-3 border-texto bg-superficie p-4 shadow-dura">
            <SearchBar
              selectedVehicle={selectedVehicle}
              onRouteAnalyzed={handleRouteAnalyzed}
              vehicleSelector={vehicleSelector}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-tarjeta border-3 border-texto bg-superficie p-4 shadow-dura">
            <RiskSummary
              zones={riskZones}
              loading={loading}
              error={error}
              vehicleType={selectedVehicle}
              timeWindow={meta.timeWindow}
            />
          </div>
        </aside>

        {/* Botón de ruta (celular): abre el formulario en una hoja inferior */}
        <div className="border-b-3 border-texto bg-fondo p-3 md:hidden">
          <button
            onClick={() => setRouteSheetOpen(true)}
            className="min-h-[44px] w-full truncate rounded-boton border-3 border-texto bg-superficie px-4 py-3 text-left text-sm font-semibold text-texto shadow-dura-chica"
          >
            {routeButtonLabel}
          </button>
        </div>

        {/* Mapa */}
        <main className="relative h-[55vh] w-full shrink-0 p-3 md:h-auto md:w-auto md:flex-1 md:shrink md:p-4">
          <div className="relative h-full overflow-hidden rounded-tarjeta border-3 border-texto shadow-dura">
            <MapView
              zones={riskZones}
              selectedVehicle={selectedVehicle}
              highlightZones={highlightZones}
              originZone={originZone}
              destinationZone={destinationZone}
              routeData={routeData}
              reports={reports}
            />

            {/* Leyenda como stickers, girados -2°. A la derecha para no chocar
                con el control de zoom de Leaflet, que también vive arriba a
                la izquierda. */}
            <div className="pointer-events-none absolute right-3 top-3 z-[900] flex gap-2">
              <span className="-rotate-2 rounded-pastilla border-3 border-texto bg-riesgo-bajo px-2.5 py-1 text-[10px] font-bold text-texto shadow-dura-chica">Bajo</span>
              <span className="-rotate-2 rounded-pastilla border-3 border-texto bg-riesgo-medio px-2.5 py-1 text-[10px] font-bold text-texto shadow-dura-chica">Medio</span>
              <span className="-rotate-2 rounded-pastilla border-3 border-texto bg-riesgo-alto px-2.5 py-1 text-[10px] font-bold text-texto shadow-dura-chica">Alto</span>
            </div>

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
              <Suspense fallback={null}>
                <ReportToast
                  report={toast.report}
                  remainingToday={toast.remainingToday}
                  undoWindowSeconds={toast.undoWindowSeconds}
                  onClose={() => { setToast(null); refreshAll() }}
                  onChanged={refreshAll}
                  onOpenDetails={(report) => { setToast(null); setDetailsFor(report) }}
                />
              </Suspense>
            )}
          </div>
        </main>

        {/* Zonas de riesgo (celular): la misma lista que en el computador,
            debajo del mapa en vez de en una columna aparte. */}
        <div className="border-t-3 border-texto bg-fondo p-3 md:hidden">
          <div className="rounded-tarjeta border-3 border-texto bg-superficie p-4 shadow-dura">
            <RiskSummary
              zones={riskZones}
              loading={loading}
              error={error}
              vehicleType={selectedVehicle}
              timeWindow={meta.timeWindow}
            />
          </div>
        </div>
      </div>

      {/* Hoja inferior con el formulario (celular) */}
      {routeSheetOpen && (
        <div
          className="fixed inset-0 z-[1500] flex items-end justify-center bg-texto/60 md:hidden"
          onClick={(e) => { if (e.target === e.currentTarget) setRouteSheetOpen(false) }}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-tarjeta border-3 border-b-0 border-texto bg-fondo p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-texto-tenue">Planea tu ruta</span>
              <button onClick={() => setRouteSheetOpen(false)} className="min-h-[44px] min-w-[44px] p-1 text-lg text-texto-tenue">✕</button>
            </div>
            <div className="mb-4">{reportsStrip}</div>
            <div className="rounded-tarjeta border-3 border-texto bg-superficie p-4 shadow-dura">
              <SearchBar
                selectedVehicle={selectedVehicle}
                onRouteAnalyzed={handleRouteAnalyzed}
                vehicleSelector={vehicleSelector}
              />
            </div>
          </div>
        </div>
      )}

      {detailsFor && (
        <Suspense fallback={null}>
          <ReportDetails
            report={detailsFor === 'new' ? null : detailsFor}
            zones={riskZones}
            onSaved={() => { setDetailsFor(null); refreshAll() }}
            onClose={() => { setDetailsFor(null); refreshAll() }}
          />
        </Suspense>
      )}

      {authMotivo !== null && (
        <Suspense fallback={null}>
          <AuthModal motivo={authMotivo} onClose={() => setAuthMotivo(null)} />
        </Suspense>
      )}

      {/* Llegó desde el enlace de "olvidé mi contraseña": se le pide la nueva
          y no se puede saltar, porque si no se queda dentro con la vieja. */}
      {recuperando && (
        <Suspense fallback={null}>
          <ResetPassword />
        </Suspense>
      )}
    </div>
  )
}

export default App
