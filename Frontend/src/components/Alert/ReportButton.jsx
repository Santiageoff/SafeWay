import { useState } from 'react'
import { createReport } from '../../services/api'
import { getCurrentPosition } from '../../utils/device'
import { useAuth } from '../../context/useAuth'

// El botón rojo.
//
// Un solo toque envía el reporte con GPS y hora. NO pregunta nada más: una
// persona a la que acaban de robar está asustada y furiosa, no va a llenar un
// formulario. El tipo y los detalles se completan después, con calma, y el
// toque accidental se arregla con los 30 segundos para deshacer.
//
// Lo que sí exige ahora es sesión iniciada. Es una decisión de producto que
// tiene coste: quien acaba de perder el celular en la calle difícilmente va a
// crear una cuenta ahí mismo. A cambio, cierra de raíz la suplantación y el
// abuso anónimo. Si no hay sesión, el botón no reporta: abre el login
// explicando por qué, y recuerda el 123 antes que nada.

function ReportButton({ onReported, onNeedsManualLocation, onNeedsAuth, disabled }) {
  const { haySesion, disponible } = useAuth()
  const [state, setState] = useState('idle')  // idle | locating | sending | error
  const [error, setError] = useState(null)

  const handleClick = async () => {
    if (state === 'locating' || state === 'sending') return

    if (!disponible) {
      setError('Falta configurar Supabase. No se puede reportar todavía.')
      return
    }

    // Sin sesión no se pierde el gesto: se abre el login explicando por qué,
    // y al volver la persona ya puede pulsar otra vez.
    if (!haySesion) {
      setError(null)
      onNeedsAuth?.()
      return
    }

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
    idle: haySesion ? 'REPORTAR UN ROBO' : 'REPORTAR · REQUIERE CUENTA',
    locating: 'UBICANDO…',
    sending: 'ENVIANDO…',
    error: 'NO SE PUDO ENVIAR'
  }[state]

  const busy = state === 'locating' || state === 'sending'

  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {error && (
        <div className="max-w-[260px] rounded-campo border-3 border-texto bg-aviso px-3 py-2 text-xs leading-snug text-texto shadow-dura-chica">
          {error}
        </div>
      )}

      {/* Aviso permanente, no letra pequeña: el botón NO llama a la policía
          y nadie debería quedarse esperando que alguien venga. */}
      <div className="max-w-[260px] rounded-campo border-3 border-texto bg-superficie px-3 py-2 text-right text-[11px] leading-snug text-texto-tenue shadow-dura-chica">
        SafeWay no es línea de emergencia.<br />
        Si estás en peligro, llama al <strong className="text-texto">123</strong>.
      </div>

      <button
        onClick={handleClick}
        disabled={disabled || busy}
        className={
          'flex min-h-[44px] items-center gap-2 rounded-pastilla border-3 border-texto px-5 py-4 font-display text-sm text-texto shadow-dura transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-dura-chica disabled:opacity-50 ' +
          (state === 'error' ? 'bg-aviso' : 'bg-riesgo-alto')
        }
      >
        <span className="text-lg">{busy ? '⏳' : '🚨'}</span>
        {label}
      </button>
    </div>
  )
}

export default ReportButton
