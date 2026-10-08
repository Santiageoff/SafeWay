// Geocodificación: convierte lo que escribe la persona ("Calle 72 # 7-30",
// "Suba") en un punto [lat, lng] dentro de Bogotá (issue #5).
//
// Orden:
//   1. Atajo: si el texto es el nombre de una de las 20 localidades, se usa su
//      centro sin salir a internet (así funcionaba antes, y sigue igual).
//   2. Nominatim (OpenStreetMap), SOLO desde el backend y respetando su política
//      de uso: User-Agent propio, máximo 1 petición por segundo y caché.
//      https://operations.osmfoundation.org/policies/nominatim/
//
// NOMINATIM_URL permite apuntar a otro servidor (uno propio o uno falso en las
// pruebas). Nunca se llama desde el navegador: expondría el patrón de uso de
// cada persona y rompería la política de Nominatim.

const { isInsideBogota, localityForPoint, BOGOTA_BOUNDS } = require('../utils/geo')

const NOMINATIM_URL = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '')
const NOMINATIM_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS) || 2500
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ||
    'SafeWay/1.0 (proyecto academico UJTL; +https://github.com/Santiageoff/SafeWay)'

// Política de Nominatim: como mucho 1 petición por segundo, para toda la app.
const INTERVALO_MS = Number(process.env.NOMINATIM_INTERVAL_MS ?? 1000)

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 500
const MAX_LARGO = 200

// Caja de Bogotá para `viewbox` (lng_izq, lat_arriba, lng_der, lat_abajo).
const VIEWBOX = [BOGOTA_BOUNDS.minLng, BOGOTA_BOUNDS.maxLat, BOGOTA_BOUNDS.maxLng, BOGOTA_BOUNDS.minLat].join(',')

class GeocodingError extends Error {
    constructor(message, statusCode, code) {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

const normalizar = (texto) => String(texto).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// ---------- Caché (Map con orden de inserción = LRU sencillo) ----------

const cache = new Map()

function desdeCache(clave) {
    const e = cache.get(clave)
    if (!e) return undefined
    if (Date.now() - e.at > CACHE_TTL_MS) { cache.delete(clave); return undefined }
    cache.delete(clave); cache.set(clave, e)   // la refresca como "reciente"
    return e.valor
}

function guardarEnCache(clave, valor) {
    cache.set(clave, { valor, at: Date.now() })
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

// ---------- 1 petición por segundo ----------

let siguienteTurno = 0
async function esperarTurno() {
    const ahora = Date.now()
    const turno = Math.max(ahora, siguienteTurno)
    siguienteTurno = turno + INTERVALO_MS
    if (turno > ahora) await new Promise(r => setTimeout(r, turno - ahora))
}

// ---------- Atajo por nombre de localidad ----------

// Exacto primero; luego parcial ("santa" -> Santa Fe), como funcionaba antes,
// con al menos 3 letras para que "a" no caiga en cualquier localidad.
function porLocalidad(texto, zonas) {
    const q = normalizar(texto)
    const zona = zonas.find(z => normalizar(z.name) === q) ||
        (q.length >= 3 ? zonas.find(z => normalizar(z.name).includes(q)) : null)
    if (!zona) return null
    return { name: zona.name, coordinates: zona.coordinates, locality: zona, source: 'localidad' }
}

// ---------- Nominatim ----------

async function consultarNominatim(texto) {
    // Se le agrega la ciudad para que "Calle 72 # 7-30" no acabe en otro municipio.
    const q = /bogot/i.test(texto) ? texto : `${texto}, Bogotá`
    const params = new URLSearchParams({
        q, format: 'jsonv2', limit: '1', countrycodes: 'co',
        viewbox: VIEWBOX, bounded: '1', 'accept-language': 'es'
    })

    await esperarTurno()
    let respuesta
    try {
        respuesta = await fetch(`${NOMINATIM_URL}/search?${params}`, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS)
        })
    } catch (err) {
        console.error('[geocoding] Nominatim no respondió:', err.message)
        throw new GeocodingError('El servicio de direcciones no respondió. Intenta con el nombre de una localidad.', 503, 'geocodificacion_no_disponible')
    }
    if (!respuesta.ok) {
        console.error('[geocoding] Nominatim respondió', respuesta.status)
        throw new GeocodingError('El servicio de direcciones no está disponible. Intenta con el nombre de una localidad.', 503, 'geocodificacion_no_disponible')
    }

    const datos = await respuesta.json()
    const r = Array.isArray(datos) ? datos[0] : null
    if (!r) return null
    const lat = Number(r.lat)
    const lng = Number(r.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng, label: r.name || String(r.display_name || texto).split(',')[0] }
}

// Devuelve { name, coordinates: [lat, lng], locality, source } o lanza
// GeocodingError (404 si no se encuentra, 503 si Nominatim no responde).
// `zonas` son las 20 localidades (para el atajo y para asignar la localidad).
async function geocodificar(texto, zonas) {
    if (typeof texto !== 'string' || texto.trim() === '') {
        throw new GeocodingError('La dirección está vacía', 400, 'direccion_vacia')
    }
    if (texto.length > MAX_LARGO) {
        throw new GeocodingError(`La dirección no puede tener más de ${MAX_LARGO} caracteres`, 400, 'direccion_muy_larga')
    }

    const atajo = porLocalidad(texto, zonas)
    if (atajo) return atajo

    const clave = normalizar(texto)
    let punto = desdeCache(clave)
    if (punto === undefined) {
        punto = await consultarNominatim(texto.trim())
        guardarEnCache(clave, punto)   // también se guarda "no encontrado"
    }

    if (!punto || !isInsideBogota(punto.lat, punto.lng)) {
        throw new GeocodingError(`No encontramos "${texto.trim()}" en Bogotá`, 404, 'direccion_no_encontrada')
    }

    // La localidad del punto, con los datos de riesgo del momento.
    const { locality } = localityForPoint(punto.lat, punto.lng)
    const zona = (locality && zonas.find(z => z.id === locality.id)) || locality
    return { name: punto.label, coordinates: [punto.lat, punto.lng], locality: zona, source: 'nominatim' }
}

// Solo para pruebas.
function _reiniciar() { cache.clear(); siguienteTurno = 0 }

module.exports = { geocodificar, GeocodingError, _reiniciar }
