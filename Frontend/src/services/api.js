import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

export const getRiskZones = async () => {
  const response = await api.get('/api/risk/zones')
  return response.data.data  // extrae el array directo
}

export const analyzeRoute = (origin, destination, vehicleType) =>
  api.post('/api/route/analyze', { origin, destination, vehicleType })

export const getZoneDetail = (localidad, vehicleType) =>
  api.get(`/api/risk/zone/${localidad}?vehicle=${vehicleType}`)