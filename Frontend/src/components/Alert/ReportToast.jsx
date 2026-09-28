import { useEffect, useState } from 'react'
import { REPORT_TYPES } from './reportTypes'
import { cancelReport, updateReport } from '../../services/api'

// Lo que aparece justo después de enviar el reporte.
//
// Hace tres cosas a la vez, y las tres importan:
//  1. Confirma que YA quedó registrado (aunque cierre la app en este segundo).
//  2. Da 30 segundos para deshacer, que es lo que arregla el toque accidental.
//  3. Ofrece la grilla de tipos por si alcanza a tocar uno, sin exigirlo.

function ReportToast({ report, remainingToday, undoWindowSeconds = 30, onClose, onChanged, onOpenDetails }) {
  const [secondsLeft, setSecondsLeft] = useState(undoWindowSeconds)
  const [type, setType] = useState(report?.type || null)
  const [cancelled, setCancelled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const handleUndo = async () => {
    try {
      await cancelReport(report.id)
      setCancelled(true)
      onChanged?.()
      setTimeout(() => onClose?.(), 1600)
    } catch {
      setSecondsLeft(0)
    }
  }

  // Tocar un icono enriquece el reporte que ya existe: no crea uno nuevo,
  // así que no gasta uno del cupo diario.
  const handleType = async (typeId) => {
    const next = type === typeId ? null : typeId
    setType(next)
    setSaving(true)
    try {
      await updateReport(report.id, { type: next })
      onChanged?.()
    } catch {
      setType(type)
    } finally {
      setSaving(false)
    }
  }

  const shellClass = 'absolute bottom-4 right-4 z-[1200] w-[320px] rounded-tarjeta border-3 border-texto bg-superficie p-4 shadow-dura md:bottom-6 md:right-6'

  if (cancelled) {
    return (
      <div className={shellClass}>
        <div className="text-sm text-texto-tenue">
          Reporte cancelado. El mapa quedó como estaba.
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <strong className="text-sm text-texto">Reporte enviado</strong>
          </div>
          <p className="mt-1 text-xs text-texto-tenue">
            Ya quedó registrado en {report.locality || 'tu zona'}. Puedes cerrar la app.
          </p>
        </div>

        {secondsLeft > 0 ? (
          <button
            onClick={handleUndo}
            className="shrink-0 whitespace-nowrap rounded-campo border-3 border-texto bg-riesgo-medio px-3 py-2 text-xs font-semibold text-texto"
          >
            Deshacer ({secondsLeft}s)
          </button>
        ) : (
          <button
            onClick={onClose}
            className="shrink-0 whitespace-nowrap rounded-campo border-3 border-texto bg-superficie px-3 py-2 text-xs font-semibold text-texto-tenue"
          >
            Cerrar
          </button>
        )}
      </div>

      <div className="mt-3.5 border-t border-texto/20 pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-texto-tenue">
          ¿Qué te robaron? <span className="normal-case tracking-normal font-normal">(opcional, puedes hacerlo después)</span>
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {REPORT_TYPES.map(t => {
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => handleType(t.id)}
                disabled={saving}
                className={
                  'flex flex-col items-center gap-1 rounded-campo border-3 border-texto px-1 py-2.5 text-[10px] font-medium ' +
                  (active ? 'bg-acento text-white' : 'bg-superficie text-texto-tenue')
                }
              >
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => onOpenDetails?.(report)}
            className="rounded-campo border-3 border-texto bg-fondo px-3.5 py-2 text-xs font-semibold text-texto"
          >
            Agregar detalles
          </button>
          <span className="text-[11px] text-texto-tenue">
            {remainingToday != null ? `Te quedan ${remainingToday} reportes hoy` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ReportToast
