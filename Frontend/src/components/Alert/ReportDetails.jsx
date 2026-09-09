import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet'
import { REPORT_TYPES } from './reportTypes'
import { createReport, updateReport } from '../../services/api'

// El momento de la calma.
//
// Aquí se completa lo que en el momento del robo nadie iba a escribir: qué fue,
// dónde exactamente, a qué hora. También es el camino del reporte en frío
// (el cosquilleo en TransMilenio, que se reporta desde la casa porque la
// víctima se quedó sin el celular con el que iba a reportar).

const BOGOTA_CENTER = [4.6482, -74.0776]

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, 13)
  }, [center, map])
  return null
}

// Convierte una fecha a lo que espera <input type="datetime-local">, en hora local.
function toLocalInput(date) {
  const d = new Date(date)
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

function ReportDetails({ report, zones = [], defaultLocation = null, onSaved, onClose }) {
  const isNew = !report

  const [type, setType] = useState(report?.type || null)
  const [station, setStation] = useState(report?.station || '')
  const [description, setDescription] = useState(report?.description || '')
  const [point, setPoint] = useState(
    report ? [report.lat, report.lng] : (defaultLocation || null)
  )
  const [occurredAt, setOccurredAt] = useState(
    toLocalInput(report?.occurred_at || Date.now())
  )
  const [unknownTime, setUnknownTime] = useState(Boolean(report?.occurred_end))
  const [occurredEnd, setOccurredEnd] = useState(
    toLocalInput(report?.occurred_end || Date.now())
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const sortedZones = useMemo(
    () => [...zones].sort((a, b) => a.name.localeCompare(b.name)),
    [zones]
  )

  const isHome = type === 'vivienda'
  const isTransmilenio = type === 'transmilenio'

  const handleSave = async () => {
    setError(null)

    if (!point) {
      setError('Marca en el mapa dónde ocurrió, o elige la localidad.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        type,
        station: isTransmilenio ? station : null,
        description: description.trim() || null,
        occurredAt: new Date(occurredAt).toISOString(),
        occurredEnd: unknownTime ? new Date(occurredEnd).toISOString() : null,
        lat: point[0],
        lng: point[1]
      }

      if (isNew) {
        const created = await createReport({
          lat: point[0], lng: point[1], type, occurredAt: payload.occurredAt
        })
        // El POST solo acepta lo esencial; el resto se completa enseguida.
        await updateReport(created.report.id, payload)
        onSaved?.(created.report)
      } else {
        const updated = await updateReport(report.id, payload)
        onSaved?.(updated)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos guardar los detalles.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', color: '#F1F5F9' }}>
            {isNew ? 'Reportar un robo' : 'Cuéntanos qué pasó'}
          </h2>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94A3B8' }}>
          {isNew
            ? 'Puedes reportar algo que pasó antes. Marca el lugar y la hora.'
            : 'Con calma. Cada dato ayuda a que el mapa avise mejor a otra persona.'}
        </p>

        {/* Tipo */}
        <label style={labelStyle}>¿Qué te robaron?</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
          {REPORT_TYPES.map(t => {
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => setType(active ? null : t.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  padding: '10px 4px', borderRadius: '10px',
                  border: active ? '1px solid #22D3EE' : '1px solid #1E3A5F',
                  backgroundColor: active ? '#065A82' : '#0F2744',
                  color: active ? 'white' : '#94A3B8',
                  fontSize: '10px', cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '18px' }}>{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>

        {isTransmilenio && (
          <>
            <label style={labelStyle}>¿En qué estación o ruta?</label>
            <input
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="Ej: Av. Jiménez, alimentador K43"
              style={inputStyle}
            />
          </>
        )}

        {isHome && (
          <div style={noticeStyle}>
            🔒 Para proteger tu privacidad, los robos a vivienda se guardan con la
            ubicación difuminada (unas cuadras). Nadie va a ver en el mapa dónde vives.
          </div>
        )}

        {/* Lugar */}
        <label style={labelStyle}>¿Dónde fue?</label>
        <select
          value=""
          onChange={(e) => {
            const zone = zones.find(z => String(z.id) === e.target.value)
            if (zone) setPoint(zone.coordinates)
          }}
          style={{ ...inputStyle, marginBottom: '8px' }}
        >
          <option value="">Saltar a una localidad…</option>
          {sortedZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>

        <div style={{ height: '200px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #1E3A5F', marginBottom: '6px' }}>
          <MapContainer center={point || BOGOTA_CENTER} zoom={point ? 14 : 11} style={{ width: '100%', height: '100%' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <ClickToPlace onPick={setPoint} />
            <Recenter center={point} />
            {point && (
              <CircleMarker
                center={point}
                radius={9}
                pathOptions={{ color: '#DC2626', fillColor: '#DC2626', fillOpacity: 0.9, weight: 3 }}
              />
            )}
          </MapContainer>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#64748B' }}>
          Toca el mapa para mover el punto exacto.
        </p>

        {/* Cuándo */}
        <label style={labelStyle}>¿Cuándo fue?</label>
        <input
          type="datetime-local"
          value={occurredAt}
          max={toLocalInput(Date.now())}
          onChange={(e) => setOccurredAt(e.target.value)}
          style={inputStyle}
        />

        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
          <input
            type="checkbox"
            checked={unknownTime}
            onChange={(e) => setUnknownTime(e.target.checked)}
            style={{ accentColor: '#22D3EE' }}
          />
          No sé la hora exacta, fue entre esa y otra
        </label>

        {/* El caso de la moto: la dejaste parqueada a las 6am y a las 2pm ya no estaba. */}
        {unknownTime && (
          <input
            type="datetime-local"
            value={occurredEnd}
            max={toLocalInput(Date.now())}
            onChange={(e) => setOccurredEnd(e.target.value)}
            style={inputStyle}
          />
        )}

        <label style={labelStyle}>¿Algo más? (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Ej: iban dos en moto, me apuntaron"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />

        {error && (
          <div style={{ ...noticeStyle, borderColor: '#EF4444', color: '#FECACA', backgroundColor: 'rgba(220,38,38,0.12)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ ...actionButtonStyle, backgroundColor: 'transparent', border: '1px solid #1E3A5F', color: '#94A3B8' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ ...actionButtonStyle, flex: 1, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando…' : isNew ? 'Enviar reporte' : 'Guardar detalles'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 2000,
  backgroundColor: 'rgba(2, 8, 20, 0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
}

const modalStyle = {
  width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
  padding: '20px', borderRadius: '16px',
  backgroundColor: '#0A1628', border: '1px solid #1E3A5F',
  boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
}

const labelStyle = {
  display: 'block', fontSize: '11px', color: '#94A3B8',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: '14px',
  borderRadius: '8px', border: '1px solid #1E3A5F',
  backgroundColor: '#0F2744', color: '#F1F5F9', fontSize: '13px'
}

const noticeStyle = {
  padding: '10px 12px', marginBottom: '14px', borderRadius: '8px',
  border: '1px solid #22D3EE', backgroundColor: 'rgba(34,211,238,0.08)',
  color: '#A5F3FC', fontSize: '11px', lineHeight: 1.5
}

const closeButtonStyle = {
  border: 'none', background: 'transparent', color: '#64748B',
  fontSize: '16px', cursor: 'pointer', padding: '4px'
}

const actionButtonStyle = {
  padding: '12px 18px', borderRadius: '10px', border: 'none',
  backgroundColor: '#DC2626', color: 'white',
  fontSize: '14px', fontWeight: '600', cursor: 'pointer'
}

export default ReportDetails
