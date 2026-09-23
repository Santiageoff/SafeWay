// Lectura de los datos oficiales de riesgo por localidad.
//
// Fuente principal: la tabla `localities` de Supabase (lectura pública).
// Respaldo: Backend/src/data/localities.js, el archivo donde vivían antes.
//
// Este respaldo SÍ tiene sentido, al contrario que el de los reportes: son
// datos oficiales, de solo lectura y que cambian muy poco. Si Supabase no
// responde, el mapa sigue en pie con la última foto conocida en vez de quedarse
// en blanco. Es el objetivo #4 del acta (continuidad ante fallas de la fuente
// de datos principal), y se reporta al usuario en vez de disimularlo.

const { localities: RESPALDO } = require('../data/localities')
const supabase = require('./supabaseService')

// Cache en memoria: las cifras oficiales no cambian de un minuto a otro y
// estas filas se leen en cada consulta del mapa.
const TTL_MS = 5 * 60 * 1000
let cache = null
let cacheAt = 0
let ultimaFuente = 'desconocida'

// La tabla usa snake_case y columnas separadas para lat/lng; el resto de la
// app espera el formato del archivo original. Se traduce aquí, en un solo
// sitio, para no tener que tocar el motor de riesgo ni el frontend.
function desdeFila(fila) {
    return {
        id: fila.id,
        name: fila.name,
        coordinates: [fila.lat, fila.lng],
        riskLevel: fila.risk_level,
        description: fila.description,
        vehicleRisks: fila.vehicle_risks || {},
        accidents: fila.accidents,
        thefts: fila.thefts,
        insecurityPercentage: fila.insecurity_percentage,
        safetyScore: fila.safety_score,
        recommendation: fila.recommendation,
        source: fila.source,
        updatedAt: fila.updated_at
    }
}

async function getLocalities({ force = false } = {}) {
    if (!force && cache && Date.now() - cacheAt < TTL_MS) {
        return { localities: cache, source: ultimaFuente, cached: true }
    }

    const client = supabase.getAnonClient()

    if (client) {
        try {
            const { data, error } = await client
                .from('localities')
                .select('*')
                .order('id', { ascending: true })

            if (error) throw new Error(error.message)

            if (data && data.length > 0) {
                cache = data.map(desdeFila)
                cacheAt = Date.now()
                ultimaFuente = 'supabase'
                return { localities: cache, source: 'supabase', cached: false }
            }

            console.warn('[localityStore] la tabla localities esta vacia, usando el respaldo')
        } catch (err) {
            console.error('[localityStore] Supabase no respondio, usando el respaldo:', err.message)
        }
    }

    cache = RESPALDO
    cacheAt = Date.now()
    ultimaFuente = 'respaldo-local'
    return { localities: RESPALDO, source: 'respaldo-local', cached: false }
}

// Escritura de datos oficiales. Requiere service_role: el resto del mundo,
// incluidos los usuarios con sesión, tiene esta tabla en solo lectura.
async function upsertLocality(locality) {
    const admin = supabase.getAdminClient()
    if (!admin) {
        throw new Error('Falta SUPABASE_SECRET_KEY: sin ella el backend no puede escribir datos oficiales')
    }

    const { data, error } = await admin
        .from('localities')
        .upsert({ ...locality, updated_at: new Date().toISOString() })
        .select()
        .single()

    if (error) throw new Error(error.message)

    cache = null  // invalidar, para que la proxima lectura traiga lo nuevo
    return data
}

function status() {
    return { source: ultimaFuente, cachedAt: cacheAt ? new Date(cacheAt).toISOString() : null }
}

module.exports = { getLocalities, upsertLocality, status }
