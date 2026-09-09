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

  if (cancelled) {
    return (
      <div style={shellStyle}>
        <div style={{ color: '#94A3B8', fontSize: '13px' }}>
          Reporte cancelado. El mapa quedó como estaba.
        </div>
      </div>
    )
  }

  return (
    <div style={shellStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>✅</span>
            <strong style={{ color: '#F1F5F9', fontSize: '14px' }}>Reporte enviado</strong>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
            Ya quedó registrado en {report.locality || 'tu zona'}. Puedes cerrar la app.
          </p>
        </div>

        {secondsLeft > 0 ? (
          <button onClick={handleUndo} style={undoButtonStyle}>
            Deshacer ({secondsLeft}s)
          </button>
        ) : (
          <button onClick={onClose} style={{ ...undoButtonStyle, borderColor: '#1E3A5F', color: '#94A3B8' }}>
            Cerrar
          </button>
        )}
      </div>

      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #1E3A5F' }}>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ¿Qué te robaron? <span style={{ textTransform: 'none', letterSpacing: 0 }}>(opcional, puedes hacerlo después)</span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {REPORT_TYPES.map(t => {
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => handleType(t.id)}
                disabled={saving}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 4px',
                  borderRadius: '10px',
                  border: active ? '1px solid #22D3EE' : '1px solid #1E3A5F',
                  backgroundColor: active ? '#065A82' : '#0F2744',
                  color: active ? 'white' : '#94A3B8',
                  fontSize: '10px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '18px' }}>{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '8px' }}>
          <button onClick={() => onOpenDetails?.(report)} style={detailsButtonStyle}>
            Agregar detalles
          </button>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            {remainingToday != null ? `Te quedan ${remainingToday} reportes hoy` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

const shellStyle = {
  position: 'absolute',
  right: '20px',
  bottom: '24px',
  zIndex: 1200,
  width: '320px',
  padding: '16px',
  borderRadius: '14px',
  backgroundColor: '#0A1628',
  border: '1px solid #22D3EE',
  boxShadow: '0 16px 40px rgba(0,0,0,0.5)'
}

const undoButtonStyle = {
  flexShrink: 0,
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #F59E0B',
  backgroundColor: 'transparent',
  color: '#F59E0B',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const detailsButtonStyle = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#065A82',
  color: 'white',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer'
}

export default ReportToast
