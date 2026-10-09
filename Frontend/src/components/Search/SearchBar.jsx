import { useState } from 'react'
import { analyzeRoute } from '../../services/api'
import { RISK_LABELS, RISK_TAILWIND } from '../../utils/risk'

// Cuando el origen/destino fue una dirección (geocodificada con Nominatim,
// no el nombre de una localidad), conviene confirmar cómo se entendió: es la
// única manera de que la persona note si se equivocó de sitio.
function puntoLabel(punto) {
  if (!punto) return '?'
  if (punto.source === 'nominatim' && punto.locality) return `${punto.name} (${punto.locality})`
  return punto.name
}

function SearchBar({ onRouteAnalyzed, selectedVehicle = 'carro', vehicleSelector = null }) {
  const [originInput, setOriginInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleAnalyze = async () => {
    if (!originInput.trim() || !destinationInput.trim()) {
      setError('Ingresa origen y destino')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      // Antes esto llamaba a http://localhost:3001 quemado, ignorando VITE_API_URL.
      const response = await analyzeRoute(
        originInput.trim(),
        destinationInput.trim(),
        selectedVehicle || 'carro'
      )
      const data = response.data
      if (!data.success) {
        setError(data.error || 'No se encontró la zona. Intenta con: Chapinero, Kennedy, Suba...')
        return
      }
      setResult(data)
      if (onRouteAnalyzed) onRouteAnalyzed(data)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el servidor')
    } finally {
      setLoading(false)
    }
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

      {error && (
        <div className="mt-3 rounded-campo border-3 border-texto bg-aviso px-3 py-2 text-xs text-texto">
          {error}
        </div>
      )}

      {result && !loading && (() => {
        const level = result.overallRisk || result.riskLevel
        const plate = RISK_TAILWIND[level] || RISK_TAILWIND.low
        return (
          <div className="mt-4 rounded-tarjeta border-3 border-texto bg-superficie p-3 shadow-dura">
            <div className={`inline-block rounded-campo border-3 border-texto ${plate.bg} px-3 py-1 font-display text-xs text-texto`}>
              RIESGO {RISK_LABELS[level]?.toUpperCase() || RISK_LABELS.low.toUpperCase()}
            </div>

            <p className="mt-2 text-xs font-semibold text-texto">
              {puntoLabel(result.origin)} → {puntoLabel(result.destination)}
            </p>

            {result.timeWindow && (
              <p className="mt-1 text-[11px] text-texto-tenue">
                Evaluado para la {result.timeWindow.label}
              </p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-campo border-3 border-texto bg-fondo px-2 py-2">
                <div className="text-sm font-bold text-texto">{result.routeDistance ?? '—'}</div>
                <div className="text-[10px] text-texto-tenue">km</div>
              </div>
              <div className="rounded-campo border-3 border-texto bg-fondo px-2 py-2">
                <div className="text-sm font-bold text-texto">{result.routeDuration ?? '—'}</div>
                <div className="text-[10px] text-texto-tenue">min</div>
              </div>
              <div className="rounded-campo border-3 border-texto bg-fondo px-2 py-2">
                <div className="text-sm font-bold text-texto">{result.insecurityPercentage ?? '—'}%</div>
                <div className="text-[10px] text-texto-tenue">inseguridad</div>
              </div>
            </div>

            {result.zonesInRoute?.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">
                  Localidades del trayecto
                </p>
                <p className="text-xs text-texto">
                  {result.zonesInRoute.map(z => z.name).join(' · ')}
                </p>
              </div>
            )}

            {result.safestRoute?.avoidZones?.length > 0 && (
              <div className="mt-3 rounded-campo border-3 border-texto bg-riesgo-alto px-3 py-2 text-xs text-texto">
                <strong>Evita si puedes:</strong> {result.safestRoute.avoidZones.join(', ')}
              </div>
            )}

            {result.recommendation && (
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
