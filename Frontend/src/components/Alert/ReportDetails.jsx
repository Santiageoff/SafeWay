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

const inputClass = 'mb-3.5 w-full rounded-campo border-3 border-texto bg-superficie px-3 py-2.5 text-sm text-texto'
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-texto-tenue'

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
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-texto/60 p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-tarjeta border-3 border-texto bg-superficie p-5 shadow-dura">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="m-0 font-display text-base text-texto">
            {isNew ? 'REPORTAR UN ROBO' : 'Cuéntanos qué pasó'}
          </h2>
          <button onClick={onClose} className="p-1 text-base text-texto-tenue">✕</button>
        </div>
        <p className="mb-4 text-xs text-texto-tenue">
          {isNew
            ? 'Puedes reportar algo que pasó antes. Marca el lugar y la hora.'
            : 'Con calma. Cada dato ayuda a que el mapa avise mejor a otra persona.'}
        </p>

        {/* Tipo */}
        <label className={labelClass}>¿Qué te robaron?</label>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {REPORT_TYPES.map(t => {
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => setType(active ? null : t.id)}
                className={
                  'flex min-h-[44px] flex-col items-center gap-1 rounded-campo border-3 border-texto px-1 py-2.5 text-[10px] ' +
                  (active ? 'bg-acento text-white shadow-dura-chica' : 'bg-superficie text-texto-tenue')
                }
              >
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>

        {isTransmilenio && (
          <>
            <label className={labelClass}>¿En qué estación o ruta?</label>
            <input
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="Ej: Av. Jiménez, alimentador K43"
              className={inputClass}
            />
          </>
        )}

        {isHome && (
          <div className="mb-3.5 rounded-campo border-3 border-texto bg-fondo px-3 py-2.5 text-[11px] leading-relaxed text-texto">
            🔒 Para proteger tu privacidad, los robos a vivienda se guardan con la
            ubicación difuminada (unas cuadras). Nadie va a ver en el mapa dónde vives.
          </div>
        )}

        {/* Lugar */}
        <label className={labelClass}>¿Dónde fue?</label>
        <select
          value=""
          onChange={(e) => {
            const zone = zones.find(z => String(z.id) === e.target.value)
            if (zone) setPoint(zone.coordinates)
          }}
          className={`${inputClass} mb-2`}
        >
          <option value="">Saltar a una localidad…</option>
          {sortedZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>

        <div className="mb-1.5 h-[200px] overflow-hidden rounded-campo border-3 border-texto">
          <MapContainer center={point || BOGOTA_CENTER} zoom={point ? 14 : 11} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ClickToPlace onPick={setPoint} />
            <Recenter center={point} />
            {point && (
              <CircleMarker
                center={point}
                radius={9}
                pathOptions={{ color: '#111111', fillColor: '#FF3B30', fillOpacity: 0.9, weight: 3 }}
              />
            )}
          </MapContainer>
        </div>
        <p className="mb-4 text-[11px] text-texto-tenue">
          Toca el mapa para mover el punto exacto.
        </p>

        {/* Cuándo */}
        <label className={labelClass}>¿Cuándo fue?</label>
        <input
          type="datetime-local"
          value={occurredAt}
          max={toLocalInput(Date.now())}
          onChange={(e) => setOccurredAt(e.target.value)}
          className={inputClass}
        />

        <label className={`${labelClass} mt-1 flex cursor-pointer items-center gap-2`}>
          <input
            type="checkbox"
            checked={unknownTime}
            onChange={(e) => setUnknownTime(e.target.checked)}
            className="accent-acento"
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
            className={inputClass}
          />
        )}

        <label className={labelClass}>¿Algo más? (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Ej: iban dos en moto, me apuntaron"
          className={`${inputClass} resize-y font-sans`}
        />

        {error && (
          <div className="mb-3.5 rounded-campo border-3 border-texto bg-aviso px-3 py-2.5 text-[11px] leading-relaxed text-texto">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="min-h-[44px] rounded-boton border-3 border-texto bg-superficie px-4 py-3 text-sm font-semibold text-texto-tenue"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] flex-1 rounded-boton border-3 border-texto bg-riesgo-alto px-4 py-3 text-sm font-semibold text-texto shadow-dura-chica disabled:opacity-60"
          >
            {saving ? 'Guardando…' : isNew ? 'Enviar reporte' : 'Guardar detalles'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReportDetails
