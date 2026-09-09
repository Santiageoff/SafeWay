// Identificador anónimo de dispositivo.
//
// NO es autenticación ni identifica a la persona: es un uuid aleatorio guardado
// en el navegador. Sirve para dos cosas: aplicar el límite de 5 reportes al día
// y poder devolverle a alguien SUS reportes para que los complete con calma,
// sin obligarlo a crear una cuenta en el peor momento de su día.
//
// Las cuentas de usuario quedaron como trabajo futuro.

const STORAGE_KEY = 'safeway_device_id'

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = generateId()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    // Modo incógnito o almacenamiento bloqueado: se genera uno por sesión.
    // La persona pierde el acceso a sus reportes previos, pero puede reportar.
    if (!window.__safewayDeviceId) window.__safewayDeviceId = generateId()
    return window.__safewayDeviceId
  }
}

// Pide la ubicación al navegador. Rechaza con un mensaje en español,
// porque el error del navegador es críptico y esto lo lee alguien alterado.
export function getCurrentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no permite compartir la ubicación'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const messages = {
          1: 'Necesitamos tu ubicación para saber dónde marcar el reporte. Puedes activarla o marcar el punto en el mapa.',
          2: 'No pudimos obtener tu ubicación. Marca el punto en el mapa.',
          3: 'La ubicación está tardando demasiado. Marca el punto en el mapa.'
        }
        reject(new Error(messages[err.code] || 'No pudimos obtener tu ubicación'))
      },
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    )
  })
}
