import { useState } from 'react'
import { analyzeRoute } from '../../services/api'

function SearchBar({ onRouteAnalyzed, selectedVehicle = 'carro' }) {
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

  const getResultColor = (level) => {
    switch (level) {
      case 'high': return '#EF4444'
      case 'medium': return '#F59E0B'
      case 'low': return '#10B981'
      default: return '#6B7280'
    }
  }

  const getBarColor = (percentage) => {
    if (percentage > 70) return '#EF4444'
    if (percentage > 40) return '#F59E0B'
    return '#10B981'
  }

  return (
    <div>
      {/* Input Origen */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={originInput}
          onChange={(e) => setOriginInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="📍 Ej: Chapinero, Kennedy, Suba..."
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: '#0F2744',
            border: '1px solid #1E3A5F',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            opacity: loading ? 0.7 : 1
          }}
        />
      </div>

      {/* Input Destino */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={destinationInput}
          onChange={(e) => setDestinationInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="🏁 Ej: Santa Fe, Usme, Bosa..."
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: '#0F2744',
            border: '1px solid #1E3A5F',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            opacity: loading ? 0.7 : 1
          }}
        />
      </div>

      {/* Botón analizar */}
      <button
        onClick={handleAnalyze}
        disabled={loading || !originInput.trim() || !destinationInput.trim()}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: loading ? '#065A82' : '#22D3EE',
          color: loading ? '#94A3B8' : '#0A1628',
          border: 'none',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s'
        }}
      >
        {loading ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #94A3B8',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Analizando ruta...
          </>
        ) : (
          '🔍 Analizar ruta'
        )}
      </button>

      {/* Resultado */}
      {error && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          color: '#dc2626',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {result && !loading && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#0F2744',
          border: '1px solid #1E3A5F',
          borderRadius: '12px'
        }}>
          {/* Nivel de riesgo.
              /api/route/analyze devuelve `overallRisk`, no `riskLevel`: se leía
              el campo equivocado y el badge siempre decía "Bajo". */}
          {(() => {
            const level = result.overallRisk || result.riskLevel
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Nivel de riesgo general:</span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: getResultColor(level)
                }}>
                  {level === 'high' ? 'Alto' : level === 'medium' ? 'Medio' : 'Bajo'}
                </span>
              </div>
            )
          })()}

          {/* Franja horaria en la que se está evaluando */}
          {result.timeWindow && (
            <div style={{ fontSize: '11px', color: '#22D3EE', marginBottom: '10px' }}>
              🕐 Evaluado para la {result.timeWindow.label}
            </div>
          )}

          {/* Route Info Panel */}
          {(result.routeDistance || result.routeDuration) && (
            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {result.routeDistance && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#0F2744',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>📏</span>
                  <span>Distancia: <strong>{result.routeDistance} km</strong></span>
                </div>
              )}
              {result.routeDuration && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#0F2744',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>⏱️</span>
                  <span>Tiempo: <strong>{result.routeDuration} min</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Zonas a evitar */}
          {result.safestRoute?.avoidZones?.length > 0 && (
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#F1F5F9'
            }}>
              <strong style={{ color: '#EF4444' }}>🛡️ Zonas a evitar:</strong>
              <span> {result.safestRoute.avoidZones.join(', ')}</span>
            </div>
          )}

          {/* Barra de progreso */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#94A3B8' }}>Porcentaje de inseguridad</span>
              <span style={{ color: getBarColor(result.insecurityPercentage), fontWeight: '600' }}>
                {result.insecurityPercentage}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#1E3A5F', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${result.insecurityPercentage}%`,
                height: '100%',
                backgroundColor: getBarColor(result.insecurityPercentage),
                borderRadius: '4px'
              }}></div>
            </div>
          </div>

          {/* Recomendación */}
          {result.recommendation && (
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(34, 211, 238, 0.1)',
              border: '1px solid #22D3EE',
              borderRadius: '8px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#22D3EE'
            }}>
              <strong>💡 Recomendación:</strong> {result.recommendation}
            </div>
          )}

          {/* Tips */}
          {result.tips && result.tips.length > 0 && (
            <div>
              <span style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                Consejos de seguridad:
              </span>
              {result.tips.map((tip, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '6px',
                  fontSize: '12px',
                  color: '#F1F5F9'
                }}>
                  <span>⚠️</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default SearchBar