import { useEffect, useState } from 'react'
import {
  getConsents, saveConsent, getPreferences, savePreferences,
  getAlerts, markAlertSeen, getHabitualRoutes, deleteProfileHistory
} from '../../services/api'
import { RISK_LABELS, RISK_TAILWIND } from '../../utils/risk'
import { WINDOW_LABELS, nombreLocalidad, formatDiasSemana, formatFechaRelativa } from '../../utils/profile'

// El perfil proactivo (issue #8): consentimiento (Ley 1581), preferencias de
// alertas, rutas habituales detectadas, alertas recibidas y el derecho de
// supresión. El motor que decide todo esto vive en el backend
// (proactiveEngine.js); aquí solo se pide permiso, se muestra y se borra.

const CONSENT_INFO = [
  {
    purpose: 'route_history',
    titulo: 'Guardar mis consultas de ruta',
    descripcion: 'Guarda la localidad de origen y destino, el medio y la hora de cada ruta que analizas. Nunca la dirección exacta que escribiste ni coordenadas.'
  },
  {
    purpose: 'habitual_routes',
    titulo: 'Detectar mis rutas habituales',
    descripcion: 'Si repites la misma ruta en la misma franja horaria al menos 3 días distintos, SafeWay la reconoce como habitual. Necesita el permiso de arriba.'
  },
  {
    purpose: 'alerts',
    titulo: 'Crear alertas de riesgo',
    descripcion: 'Permite guardar una alerta cuando sube el riesgo de una de tus rutas habituales. Necesita el permiso de "Detectar mis rutas habituales".'
  }
]

const VEHICLE_ICONS = { carro: '🚗', moto: '🏍️', bici: '🚲', 'peatón': '🚶', publico: '🚌' }

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={
        'relative h-7 w-12 shrink-0 rounded-pastilla border-3 border-texto transition-colors disabled:opacity-50 ' +
        (checked ? 'bg-acento' : 'bg-superficie')
      }
    >
      <span
        className={
          'absolute top-0.5 h-4 w-4 rounded-full bg-texto transition-transform ' +
          (checked ? 'translate-x-[22px]' : 'translate-x-1')
        }
      />
    </button>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-tenue">{titulo}</h3>
      {children}
    </div>
  )
}

function ProfileModal({ zones = [], onClose, onChanged }) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [consents, setConsents] = useState(null)
  const [preferences, setPreferences] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [habitualRoutes, setHabitualRoutes] = useState([])

  const [guardandoConsent, setGuardandoConsent] = useState(null) // purpose en curso, o null
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [borrado, setBorrado] = useState(false)

  const zonesById = Object.fromEntries(zones.map(z => [z.id, z]))

  useEffect(() => {
    let cancelado = false
    Promise.all([getConsents(), getPreferences(), getAlerts(), getHabitualRoutes()])
      .then(([c, p, a, h]) => {
        if (cancelado) return
        setConsents(c)
        setPreferences(p)
        setAlerts(a)
        setHabitualRoutes(h)
      })
      .catch(err => {
        if (cancelado) return
        setError(err.response?.data?.error || 'No pudimos cargar tu perfil.')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const cambiarConsent = async (purpose, granted) => {
    setGuardandoConsent(purpose)
    try {
      const nuevos = await saveConsent(purpose, granted)
      setConsents(nuevos)
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos guardar el permiso.')
    } finally {
      setGuardandoConsent(null)
    }
  }

  const cambiarPreferencia = async (patch) => {
    setGuardandoPrefs(true)
    try {
      const nuevas = await savePreferences(patch)
      setPreferences(nuevas)
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos guardar tus preferencias.')
    } finally {
      setGuardandoPrefs(false)
    }
  }

  const verAlerta = async (alerta) => {
    if (alerta.seen_at) return
    setAlerts(prev => prev.map(a => a.id === alerta.id ? { ...a, seen_at: new Date().toISOString() } : a))
    try {
      await markAlertSeen(alerta.id)
    } catch {
      // No se pudo marcar en el servidor; se deja como vista localmente
      // igual, no vale la pena molestar con un error por esto.
    }
  }

  const borrarHistorial = async () => {
    if (!confirmandoBorrado) { setConfirmandoBorrado(true); return }
    setBorrando(true)
    try {
      await deleteProfileHistory()
      setHabitualRoutes([])
      setAlerts([])
      setBorrado(true)
      onChanged?.()
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos borrar tu historial.')
    } finally {
      setBorrando(false)
      setConfirmandoBorrado(false)
    }
  }

  const handleClose = () => { onChanged?.(); onClose?.() }

  const rutaLabel = (r) =>
    `${nombreLocalidad(zonesById, r.origin_locality_id)} → ${nombreLocalidad(zonesById, r.destination_locality_id)}`

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-texto/60 p-5"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-tarjeta border-3 border-texto bg-superficie p-5 shadow-dura">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="m-0 font-display text-base text-texto">TU PERFIL</h2>
          <button onClick={handleClose} className="p-1 text-base text-texto-tenue">✕</button>
        </div>
        <p className="mb-4 text-xs text-texto-tenue">
          Nada de esto se guarda ni se deduce sin tu permiso. Puedes revocarlo o borrar todo cuando quieras.
        </p>

        {cargando && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-texto border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-campo border-3 border-texto bg-aviso px-3 py-2.5 text-xs text-texto">
            {error}
          </div>
        )}

        {!cargando && consents && (
          <>
            <Seccion titulo="Consentimiento (Ley 1581)">
              {CONSENT_INFO.map(info => (
                <div key={info.purpose} className="mb-2.5 flex items-start justify-between gap-3 rounded-campo border-3 border-texto bg-fondo px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-semibold text-texto">{info.titulo}</p>
                    <p className="m-0 mt-1 text-[11px] leading-relaxed text-texto-tenue">{info.descripcion}</p>
                  </div>
                  <Toggle
                    label={info.titulo}
                    checked={Boolean(consents[info.purpose])}
                    disabled={guardandoConsent === info.purpose}
                    onChange={(valor) => cambiarConsent(info.purpose, valor)}
                  />
                </div>
              ))}
            </Seccion>

            <Seccion titulo="Preferencias de alertas">
              {!consents.alerts ? (
                <p className="m-0 text-xs text-texto-tenue">
                  Activa "Crear alertas de riesgo" arriba para configurar esto.
                </p>
              ) : !preferences ? null : (
                <div className="rounded-campo border-3 border-texto bg-fondo p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-texto">Recibir alertas</span>
                    <Toggle
                      label="Recibir alertas"
                      checked={Boolean(preferences.alerts_enabled)}
                      disabled={guardandoPrefs}
                      onChange={(valor) => cambiarPreferencia({ alertsEnabled: valor })}
                    />
                  </div>

                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">
                    Avisarme desde
                  </label>
                  <div className="mb-3 grid grid-cols-2 gap-1.5">
                    {[['medium', 'Riesgo medio o más'], ['high', 'Solo riesgo alto']].map(([valor, texto]) => (
                      <button
                        key={valor}
                        type="button"
                        disabled={guardandoPrefs}
                        onClick={() => cambiarPreferencia({ minRiskLevel: valor })}
                        className={
                          'min-h-[44px] rounded-campo border-3 border-texto px-2 py-2 text-[11px] font-semibold disabled:opacity-50 ' +
                          (preferences.min_risk_level === valor ? 'bg-acento text-white' : 'bg-superficie text-texto-tenue')
                        }
                      >
                        {texto}
                      </button>
                    ))}
                  </div>

                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-texto-tenue">
                    Horario de silencio (hora de Bogotá, opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={preferences.quiet_hours_start ?? ''}
                      disabled={guardandoPrefs}
                      onChange={(e) => cambiarPreferencia({ quietHoursStart: e.target.value === '' ? null : Number(e.target.value) })}
                      className="min-h-[44px] flex-1 rounded-campo border-3 border-texto bg-superficie px-2 text-xs text-texto"
                    >
                      <option value="">Sin desde</option>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
                    </select>
                    <span className="text-xs text-texto-tenue">a</span>
                    <select
                      value={preferences.quiet_hours_end ?? ''}
                      disabled={guardandoPrefs}
                      onChange={(e) => cambiarPreferencia({ quietHoursEnd: e.target.value === '' ? null : Number(e.target.value) })}
                      className="min-h-[44px] flex-1 rounded-campo border-3 border-texto bg-superficie px-2 text-xs text-texto"
                    >
                      <option value="">Sin hasta</option>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
                    </select>
                  </div>
                </div>
              )}
            </Seccion>

            <Seccion titulo={`Tus alertas${alerts.length > 0 ? ` (${alerts.length})` : ''}`}>
              {alerts.length === 0 ? (
                <p className="m-0 text-xs text-texto-tenue">No tienes alertas todavía.</p>
              ) : (
                alerts.map(a => {
                  const style = RISK_TAILWIND[a.new_level] || RISK_TAILWIND.low
                  const sinVer = !a.seen_at
                  return (
                    <button
                      key={a.id}
                      onClick={() => verAlerta(a)}
                      className={
                        'mb-2 block w-full rounded-campo border-3 border-texto p-3 text-left ' +
                        (sinVer ? 'bg-ok' : 'bg-fondo')
                      }
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-texto">
                          {sinVer && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-riesgo-alto"></span>}
                          {rutaLabel(a.habitual_routes)} {VEHICLE_ICONS[a.habitual_routes?.vehicle_type] || ''}
                        </span>
                        <span className={`rounded-pastilla border-3 border-texto px-2 py-0.5 text-[10px] font-bold text-texto ${style.bg}`}>
                          {RISK_LABELS[a.new_level]}
                        </span>
                      </div>
                      <p className="m-0 text-[11px] text-texto-tenue">
                        Subió de {RISK_LABELS[a.previous_level] || 'sin dato'} a {RISK_LABELS[a.new_level]}
                        {a.zones?.length > 0 && <> por {a.zones.join(', ')}</>} · {formatFechaRelativa(a.created_at)}
                      </p>
                    </button>
                  )
                })
              )}
            </Seccion>

            <Seccion titulo={`Rutas habituales detectadas${habitualRoutes.length > 0 ? ` (${habitualRoutes.length})` : ''}`}>
              {habitualRoutes.length === 0 ? (
                <p className="m-0 text-xs text-texto-tenue">
                  Todavía no se detecta ninguna. Hace falta repetir la misma ruta, con el mismo medio y en la
                  misma franja horaria, en al menos 3 días distintos.
                </p>
              ) : (
                habitualRoutes.map(r => (
                  <div key={r.id} className="mb-2 rounded-campo border-3 border-texto bg-fondo p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-texto">
                        {rutaLabel(r)} {VEHICLE_ICONS[r.vehicle_type] || ''}
                      </span>
                      {r.last_risk_level && (
                        <span className={`rounded-pastilla border-3 border-texto px-2 py-0.5 text-[10px] font-bold text-texto ${(RISK_TAILWIND[r.last_risk_level] || RISK_TAILWIND.low).bg}`}>
                          {RISK_LABELS[r.last_risk_level]}
                        </span>
                      )}
                    </div>
                    <p className="m-0 text-[11px] text-texto-tenue">
                      {WINDOW_LABELS[r.time_window] || r.time_window} · {formatDiasSemana(r.days_of_week)}
                    </p>
                  </div>
                ))
              )}
            </Seccion>

            <Seccion titulo="Borrar mis datos">
              {borrado ? (
                <p className="m-0 text-xs text-texto-tenue">Listo, tu historial y tus rutas habituales ya se borraron.</p>
              ) : (
                <>
                  <p className="mb-2 text-[11px] leading-relaxed text-texto-tenue">
                    Borra tus consultas de ruta guardadas y las rutas habituales que se dedujeron de ellas.
                    Tus alertas se borran con ellas. No se puede deshacer.
                  </p>
                  <button
                    onClick={borrarHistorial}
                    disabled={borrando}
                    className={
                      'min-h-[44px] w-full rounded-boton border-3 border-texto px-4 py-3 text-sm font-semibold text-texto disabled:opacity-60 ' +
                      (confirmandoBorrado ? 'bg-riesgo-alto shadow-dura-chica' : 'bg-superficie')
                    }
                  >
                    {borrando ? 'Borrando…' : confirmandoBorrado ? '¿Seguro? Toca de nuevo para confirmar' : 'Borrar mi historial'}
                  </button>
                </>
              )}
            </Seccion>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfileModal
