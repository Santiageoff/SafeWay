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
