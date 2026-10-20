import axios from 'axios'
import { supabase, supabaseConfigurado } from '../lib/supabaseClient'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// Cada petición lleva el JWT de la sesión, si la hay.
//
// Antes viajaba un uuid de dispositivo sacado de localStorage, que el backend
// se creía sin comprobar nada: bastaba conocer el de otra persona para leer y
// borrar sus reportes. Ahora va un token firmado que el backend valida contra
// Supabase, y que ademas hace que RLS sepa quién eres.
//
// Es un interceptor asíncrono a propósito: `getSession` renueva el token solo
// si está a punto de caducar, así que nunca se manda uno vencido.
api.interceptors.request.use(async (config) => {
  if (!supabaseConfigurado) return config
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Una sesión caducada no debe dejar la app en un estado raro: se avisa una vez
// y quien escuche decide qué hacer (normalmente, abrir el login).
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('safeway:sesion-requerida', {
        detail: { code: error.response?.data?.code }
      }))
    }
    return Promise.reject(error)
  }
)

// ---------- Zonas de riesgo ----------

// `mode` filtra qué reportes ciudadanos cuentan; `at` permite consultar otra hora.
// Devuelve { zones, meta } porque ahora la respuesta trae contexto: franja
// horaria vigente, cuántos reportes la alimentan y si el dato es en vivo.
export const getRiskZones = async (mode = 'carro', at = null) => {
  const params = { mode }
  if (at) params.at = at instanceof Date ? at.toISOString() : at

  const response = await api.get('/api/risk/zones', { params })
  return { zones: response.data.data, meta: response.data.meta || {} }
}

export const analyzeRoute = (origin, destination, vehicleType) =>
  api.post('/api/route/analyze', { origin, destination, vehicleType })

export const getZoneDetail = (localidad, vehicleType) =>
  api.get(`/api/risk/zone/${encodeURIComponent(localidad)}`, { params: { vehicle: vehicleType } })

// ---------- Reportes ciudadanos (botón de alerta) ----------

// El toque del botón rojo. Requiere sesión. Solo lat/lng son obligatorios:
// el tipo y los detalles se completan después, con calma.
export const createReport = async ({ lat, lng, type = null, occurredAt = null }) => {
  const response = await api.post('/api/reports', { lat, lng, type, occurredAt })
  return response.data
}

// Completar en frío: tipo, estación, rango de hora, descripción, corregir el punto.
export const updateReport = async (id, patch) => {
  const response = await api.patch(`/api/reports/${id}`, patch)
  return response.data.report
}

// Deshacer. Solo funciona dentro de los 30 segundos siguientes.
export const cancelReport = async (id) => {
  const response = await api.delete(`/api/reports/${id}`)
  return response.data
}

// Capa de puntos del mapa, ya agrupada por hecho.
export const getReports = async (mode = null, days = 7) => {
  const params = { days }
  if (mode) params.mode = mode
  const response = await api.get('/api/reports', { params })
  return response.data.data
}

// Los reportes de este dispositivo, para poder completarlos después.
export const getMyReports = async () => {
  const response = await api.get('/api/reports/mine')
  return response.data
}

// ---------- Perfil proactivo (issue #8) ----------
// Todos exigen sesión (el interceptor ya manda el JWT si la hay).

// Estado vigente de los tres consentimientos (Ley 1581): route_history,
// habitual_routes, alerts. Todos empiezan en false.
export const getConsents = async () => {
  const response = await api.get('/api/profile/consents')
  return response.data.data
}

// Otorga o revoca uno. Nunca borra: añade una fila, para que quede prueba
// de cada decisión. Devuelve el estado completo ya actualizado.
export const saveConsent = async (purpose, granted) => {
  const response = await api.post('/api/profile/consents', { purpose, granted })
  return response.data.data
}

export const getPreferences = async () => {
  const response = await api.get('/api/profile/preferences')
  return response.data.data
}

// patch: alertsEnabled, minRiskLevel, quietHoursStart, quietHoursEnd — todos opcionales.
export const savePreferences = async (patch) => {
  const response = await api.put('/api/profile/preferences', patch)
  return response.data.data
}

// Corre el motor para la persona: detecta rutas habituales y crea alertas si
// subió el riesgo. La interfaz lo llama al abrir la app (con sesión).
export const refreshProfile = async () => {
  const response = await api.post('/api/profile/refresh')
  return response.data.data
}

export const getAlerts = async (unseenOnly = false) => {
  const response = await api.get('/api/profile/alerts', { params: unseenOnly ? { unseen: 'true' } : {} })
  return response.data.data
}

export const markAlertSeen = async (id) => {
  const response = await api.patch(`/api/profile/alerts/${id}/seen`)
  return response.data.data
}

export const getHabitualRoutes = async () => {
  const response = await api.get('/api/profile/habitual-routes')
  return response.data.data
}

// Derecho de supresión: borra el historial y las rutas habituales deducidas
// de él (sus alertas se borran en cascada).
export const deleteProfileHistory = async () => {
  const response = await api.delete('/api/profile/history')
  return response.data.data
}
