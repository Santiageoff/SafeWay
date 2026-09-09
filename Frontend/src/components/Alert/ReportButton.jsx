import { useState } from 'react'
import { createReport } from '../../services/api'
import { getCurrentPosition } from '../../utils/device'

// El botón rojo.
//
// Un solo toque envía el reporte con GPS y hora. NO pregunta nada primero:
// una persona a la que acaban de robar está asustada y furiosa, no va a
// llenar un formulario. El tipo y los detalles se completan después, con calma,
// y el toque accidental se arregla con los 30 segundos para deshacer.

function ReportButton({ onReported, onNeedsManualLocation, disabled }) {
  const [state, setState] = useState('idle')  // idle | locating | sending | error
  const [error, setError] = useState(null)

  const handleClick = async () => {
    if (state === 'locating' || state === 'sending') return

    setError(null)
    setState('locating')

    let position
    try {
      position = await getCurrentPosition()
    } catch (err) {
      // Sin GPS no se bloquea el reporte: se abre el mapa para marcar el punto.
      // Es también el camino del que reporta en frío desde la casa.
      setState('idle')
      setError(err.message)
      onNeedsManualLocation?.(err.message)
      return
    }

    setState('sending')
    try {
      const result = await createReport({ lat: position.lat, lng: position.lng })
      setState('idle')
      onReported?.(result)
    } catch (err) {
      setState('error')
      const payload = err.response?.data
      setError(payload?.error || 'No pudimos enviar el reporte. Revisa tu conexión.')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  const label = {
    idle: 'Reportar robo',
    locating: 'Ubicando…',
    sending: 'Enviando…',
    error: 'No se pudo enviar'
  }[state]

  const busy = state === 'locating' || state === 'sending'

  return (
    <div style={{
      position: 'absolute',
      right: '20px',
      bottom: '24px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '8px'
    }}>
      {error && (
        <div style={{
          maxWidth: '260px',
          padding: '10px 12px',
          borderRadius: '10px',
          backgroundColor: '#7F1D1D',
          border: '1px solid #EF4444',
          color: '#FEE2E2',
          fontSize: '12px',
          lineHeight: 1.4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
        }}>
          {error}
        </div>
      )}

      {/* Aviso permanente, no letra pequeña: el botón NO llama a la policía
          y nadie debería quedarse esperando que alguien venga. */}
      <div style={{
        maxWidth: '260px',
        padding: '8px 12px',
        borderRadius: '10px',
        backgroundColor: 'rgba(10, 22, 40, 0.92)',
        border: '1px solid #1E3A5F',
        color: '#94A3B8',
        fontSize: '11px',
        lineHeight: 1.4,
        textAlign: 'right'
      }}>
        SafeWay no es línea de emergencia.<br />
        Si estás en peligro, llama al <strong style={{ color: '#F1F5F9' }}>123</strong>.
      </div>

      <button
        onClick={handleClick}
        disabled={disabled || busy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 22px',
          borderRadius: '999px',
          border: 'none',
          backgroundColor: state === 'error' ? '#7F1D1D' : '#DC2626',
          color: 'white',
          fontSize: '15px',
          fontWeight: '700',
          cursor: busy || disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: '0 10px 30px rgba(220, 38, 38, 0.45)',
          transition: 'transform 0.15s, background 0.2s'
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <span style={{ fontSize: '20px' }}>{busy ? '⏳' : '🚨'}</span>
        {label}
      </button>
    </div>
  )
}

export default ReportButton
