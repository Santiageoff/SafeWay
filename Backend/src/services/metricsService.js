// Indicadores del análisis de rutas (issue #7 · III.F del documento).
//
// Cada análisis deja una fila en `route_metrics` y GET /api/metrics/resumen
// devuelve solo agregados. Dos reglas:
//
//   1. Medir no puede tumbar la respuesta. Si Supabase falla o no hay llave
//      secreta, se avisa en consola y el análisis sigue como si nada.
//   2. Sin datos personales (Ley 1581). `filaDesde` deja pasar SOLO las
//      columnas permitidas: aunque alguien le pase coordenadas o un user_id
//      por error, no llegan a la base.

const supabase = require('./supabaseService')

const TABLA = 'route_metrics'

// Tiempo máximo de espera a Supabase, igual que en las demás lecturas.
const TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS) || 3000
const limiteDeEspera = () => AbortSignal.timeout(TIMEOUT_MS)

// Días hacia atrás que cubre el resumen por defecto.
const DIAS_POR_DEFECTO = 30

let avisoSinLlave = false

// Cronómetro para medir la duración del análisis.
//   const fin = cronometro(); ...; registrar({ ..., durationMs: fin() })
function cronometro() {
    const inicio = process.hrtime.bigint()
    return () => Number((process.hrtime.bigint() - inicio) / 1_000_000n)
}

// true si ninguna zona del trayecto es de riesgo alto para ese medio.
function evitaAlto(zonas, mode) {
    return !(zonas || []).some(z => (z.vehicleRisks?.[mode] || z.vehicleRisk || z.riskLevel) === 'high')
}

// Traduce el resultado del análisis a la fila de la tabla. Lista blanca:
// cualquier otro campo se descarta.
function filaDesde(m) {
    return {
        mode: m.mode,
        origin_locality: m.originLocality ?? null,
        destination_locality: m.destinationLocality ?? null,
        duration_ms: Math.max(0, Math.round(Number(m.durationMs) || 0)),
        locality_source: m.localitySource,
        route_source: m.routeSource,
        overall_risk: m.overallRisk,
        evita_alto: Boolean(m.evitaAlto)
    }
}

// Guarda una métrica. Nunca lanza: devuelve true si se guardó.
async function registrar(m) {
    const admin = supabase.getAdminClient()
    if (!admin) {
        if (!avisoSinLlave) {
            console.warn('[metrics] sin SUPABASE_SECRET_KEY: los indicadores no se guardan')
            avisoSinLlave = true
        }
        return false
    }
    try {
        const { error } = await admin.from(TABLA).insert(filaDesde(m))
            .abortSignal(limiteDeEspera())
        if (error) throw new Error(error.message)
        return true
    } catch (err) {
        console.error('[metrics] no se pudo guardar la métrica:', err.message)
        return false
    }
}

// Percentil por el método del rango más cercano. `ordenados` ascendente.
function percentil(ordenados, p) {
    if (ordenados.length === 0) return null
    const i = Math.ceil((p / 100) * ordenados.length) - 1
    return ordenados[Math.min(Math.max(i, 0), ordenados.length - 1)]
}

const porcentaje = (parte, total) => total === 0 ? null : Math.round((parte / total) * 1000) / 10

// Agregados a partir de las filas. Función pura: se prueba sin base de datos.
function resumir(filas) {
    const total = filas.length
    const duraciones = filas.map(f => f.duration_ms).sort((a, b) => a - b)
    return {
        totalConsultas: total,
        duracionMs: { p50: percentil(duraciones, 50), p90: percentil(duraciones, 90) },
        porcentajeRespaldo: porcentaje(filas.filter(f => f.locality_source === 'respaldo-local').length, total),
        porcentajeEvitaAlto: porcentaje(filas.filter(f => f.evita_alto).length, total),
        porcentajeRutaReal: porcentaje(filas.filter(f => f.route_source === 'osrm').length, total)
    }
}

class MetricsNoDisponibles extends Error {}

// Lee las filas del periodo y devuelve solo el resumen.
async function obtenerResumen({ dias = DIAS_POR_DEFECTO } = {}) {
    const admin = supabase.getAdminClient()
    if (!admin) throw new MetricsNoDisponibles('Los indicadores necesitan SUPABASE_SECRET_KEY en el backend')

    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
    const { data, error } = await admin.from(TABLA)
        .select('duration_ms, locality_source, route_source, evita_alto')
        .gte('created_at', desde.toISOString())
        .abortSignal(limiteDeEspera())
    if (error) throw new MetricsNoDisponibles(`No se pudieron leer los indicadores: ${error.message}`)

    return { desde: desde.toISOString(), dias, ...resumir(data || []) }
}

module.exports = {
    cronometro, evitaAlto, filaDesde, registrar, resumir, percentil,
    obtenerResumen, MetricsNoDisponibles, DIAS_POR_DEFECTO
}
