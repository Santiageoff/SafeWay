import { useState } from 'react'
import { RISK_LABELS, RISK_TAILWIND } from '../../utils/risk'

// Cuando el origen/destino fue una dirección (geocodificada con Nominatim,
// no el nombre de una localidad), conviene confirmar cómo se entendió: es la
// única manera de que la persona note si se equivocó de sitio.
function puntoLabel(punto) {
  if (!punto) return '?'
  if (punto.source === 'nominatim' && punto.locality) return `${punto.name} (${punto.locality})`
  return punto.name
}

// Nombre del medio para decir con qué se calculó el resultado.
const MEDIO = { carro: '🚗 Carro', moto: '🏍️ Moto', bici: '🚲 Bici', 'peatón': '🚶 A pie', publico: '🚌 Público' }

// El análisis (petición, resultado, error) vive en App: así hay UN solo
// resultado para el computador y la hoja del celular, y al cambiar el medio
// App vuelve a analizar la misma ruta. Antes el resultado se quedaba con el
// medio anterior (escogías Bici y seguía diciendo "en carro").
function SearchBar({
  onAnalyze, result = null, loading = false, error = null,
  vehicleSelector = null, selectedRouteId = 'segura', onSelectRoute = () => {}
}) {
  const [originInput, setOriginInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [validationError, setValidationError] = useState(null)

  const handleAnalyze = () => {
    if (!originInput.trim() || !destinationInput.trim()) {
      setValidationError('Ingresa origen y destino')
      return
    }
    setValidationError(null)
    onAnalyze(originInput.trim(), destinationInput.trim())
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAnalyze()
    }
  }

  const inputClass =
    'w-full min-h-[44px] rounded-campo border-3 border-texto bg-superficie px-4 py-3 text-sm text-texto placeholder:text-texto-tenue disabled:opacity-60'

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-texto-tenue">
        Planea tu ruta
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">Desde</label>
          <input
            type="text"
            value={originInput}
            onChange={(e) => setOriginInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ej: Chapinero o Calle 72 # 7-30"
            disabled={loading}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">Hasta</label>
          <input
            type="text"
            value={destinationInput}
            onChange={(e) => setDestinationInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ej: Kennedy o Parque de la 93"
            disabled={loading}
            className={inputClass}
          />
        </div>
      </div>

      {vehicleSelector && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">¿Cómo te mueves?</p>
          {vehicleSelector}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={loading || !originInput.trim() || !destinationInput.trim()}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-boton border-3 border-texto bg-acento px-4 py-3 font-display text-sm text-white shadow-dura transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-dura-chica disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            ANALIZANDO…
          </>
        ) : (
          '¡ANALIZAR RUTA!'
        )}
      </button>

      {(validationError || error) && (
        <div className="mt-3 rounded-campo border-3 border-texto bg-aviso px-3 py-2 text-xs text-texto">
          {validationError || error}
        </div>
      )}

      {result && !loading && (() => {
        // Ruta que se está viendo: la segura (recomendada) o la rápida. Los
        // datos de la respuesta principal son siempre los de la segura.
        const opciones = result.routeOptions || []
        const opcion = opciones.find(o => o.id === selectedRouteId) || null
        const esRapida = opcion?.id === 'rapida'
        const vista = opcion ? { ...result, ...opcion } : result
        const nombresZonas = opcion ? opcion.zonesInRoute : (result.zonesInRoute || []).map(z => z.name)
        const eleccion = result.safestChoice
        const altasDeLaRapida = eleccion ? [...eleccion.avoidedZones, ...eleccion.remainingHighZones] : []
        const level = vista.overallRisk || vista.riskLevel
        const plate = RISK_TAILWIND[level] || RISK_TAILWIND.low
        return (
          <div className="mt-4 rounded-tarjeta border-3 border-texto bg-superficie p-3 shadow-dura">
            <div className={`inline-block rounded-campo border-3 border-texto ${plate.bg} px-3 py-1 font-display text-xs text-texto`}>
              RIESGO {RISK_LABELS[level]?.toUpperCase() || RISK_LABELS.low.toUpperCase()}
            </div>

            <p className="mt-2 text-xs font-semibold text-texto">
              {puntoLabel(result.origin)} → {puntoLabel(result.destination)}
            </p>

            <p className="mt-1 text-[11px] text-texto-tenue">
              {MEDIO[result.vehicleType] || result.vehicleType}
              {result.timeWindow && <> · evaluado para la {result.timeWindow.label}</>}
            </p>

            {result.vehicleType === 'publico' && (
              <p className="mt-2 rounded-campo border-2 border-texto/30 bg-fondo px-2.5 py-1.5 text-[11px] text-texto-tenue">
                🚌 Trazado por las vías principales, con tiempo estimado de bus (paradas y esperas). No sigue una ruta exacta de TransMilenio o SITP.
              </p>
            )}

            {/* Escoger ruta: la más segura (recomendada) o la más rápida. */}
            {opciones.length > 1 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {opciones.map(o => {
                  const activa = o.id === selectedRouteId
                  return (
                    <button
                      key={o.id}
                      onClick={() => onSelectRoute(o.id)}
                      className={`min-h-[44px] rounded-campo border-3 border-texto px-2 py-1.5 text-left text-[11px] leading-tight ${activa ? 'bg-acento text-white shadow-dura-chica' : 'bg-fondo text-texto'}`}
                    >
                      <span className="block font-semibold">{o.id === 'segura' ? '🛡 Más segura' : '⚡ Más rápida'}</span>
                      <span className="block">{o.routeDuration} min · riesgo {RISK_LABELS[o.overallRisk]?.toLowerCase()}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {!esRapida && eleccion?.avoidedZones?.length > 0 && (
              <div className="mt-3 rounded-campo border-3 border-texto bg-ok px-3 py-2 text-xs text-texto">
                ✅ <strong>Evita {eleccion.avoidedZones.join(', ')}</strong>
                {eleccion.extraMinutes > 0 && ` · ${eleccion.extraMinutes} min más que la más rápida`}
              </div>
            )}
            {!esRapida && opciones.length === 1 && eleccion?.strategy === 'rapida' && eleccion.remainingHighZones.length === 0 && (
              <div className="mt-3 rounded-campo border-3 border-texto bg-ok px-3 py-2 text-xs text-texto">
                ✅ La ruta más rápida ya evita las zonas de riesgo alto.
              </div>
            )}
            {esRapida && altasDeLaRapida.length > 0 && (
              <div className="mt-3 rounded-campo border-3 border-texto bg-riesgo-alto px-3 py-2 text-xs text-texto">
                ⚠ <strong>La más rápida pasa por {altasDeLaRapida.join(', ')}</strong>, de riesgo alto para este medio.
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-campo border-3 border-texto bg-fondo px-2 py-2">
                <div className="text-sm font-bold text-texto">{vista.routeDistance ?? '—'}</div>
                <div className="text-[10px] text-texto-tenue">km</div>
              </div>
              <div className="rounded-campo border-3 border-texto bg-fondo px-2 py-2">
                <div className="text-sm font-bold text-texto">{vista.routeDuration ?? '—'}</div>
                <div className="text-[10px] text-texto-tenue">min</div>
              </div>
              <div className="rounded-campo border-3 border-texto bg-fondo px-2 py-2">
                <div className="text-sm font-bold text-texto">{vista.insecurityPercentage ?? '—'}%</div>
                <div className="text-[10px] text-texto-tenue">inseguridad</div>
              </div>
            </div>

            {nombresZonas.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">
                  Localidades del trayecto
                </p>
                <p className="text-xs text-texto">
                  {nombresZonas.join(' · ')}
                </p>
              </div>
            )}

            {!esRapida && result.safestRoute?.avoidZones?.length > 0 && (
              <div className="mt-3 rounded-campo border-3 border-texto bg-riesgo-alto px-3 py-2 text-xs text-texto">
                <strong>Evita si puedes:</strong> {result.safestRoute.avoidZones.join(', ')}
              </div>
            )}

            {!esRapida && result.recommendation && (
              <p className="mt-3 text-xs text-texto-tenue">{result.recommendation}</p>
            )}

            {result.tips?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {result.tips.map((tip, index) => (
                  <li key={index} className="text-xs text-texto-tenue">· {tip}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default SearchBar
