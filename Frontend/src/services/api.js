import axios from 'axios'
import { getDeviceId } from '../utils/device'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// El uuid anónimo del dispositivo viaja en todas las peticiones de reportes.
api.interceptors.request.use((config) => {
  config.headers['X-Device-Id'] = getDeviceId()
  return config
})

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

// El toque del botón rojo. Solo lat/lng son obligatorios: el tipo y los
// detalles se completan después, con calma.
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
