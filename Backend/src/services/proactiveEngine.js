// Motor del perfil proactivo (issue #8). Funciones PURAS: reciben datos y
// devuelven decisiones. No tocan la base ni HTTP, así que se prueban con un
// historial sintético (el criterio verificable del issue).
//
// Flujo:
//   historial de consultas -> detectarRutasHabituales -> rutas habituales
//   ruta habitual + zonas del momento -> nivelDeRuta -> nivel actual
//   nivel anterior + nivel actual + preferencias -> evaluarAlerta -> alerta o null

const { windowForHour, bogotaHour, TIME_WINDOWS } = require('./dynamicRiskService')
const { distancePointToLine } = require('../utils/geo')

// Una ruta es habitual si se repite en al menos 3 DÍAS distintos (no 3
// consultas: tres búsquedas en un minuto no son un hábito).
const MIN_DIAS = 3

// Radio, en km, para considerar que una localidad está en el trayecto.
// El mismo criterio que el análisis de ruta hasta que el issue #6 lo cambie.
const RADIO_KM = 3

const RANGO = { low: 0, medium: 1, high: 2 }

const franjaDe = (fecha) => windowForHour(bogotaHour(fecha)).id

// Día en Bogotá, como texto (para contar días distintos) y día de la semana.
function diaBogota(fecha) {
    const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000)
    return { clave: local.toISOString().slice(0, 10), semana: local.getUTCDay() }
}

// consultas: filas de route_queries
//   { origin_locality_id, destination_locality_id, vehicle_type, queried_at }
// Devuelve las rutas habituales con la forma de la tabla habitual_routes.
function detectarRutasHabituales(consultas, { minDias = MIN_DIAS } = {}) {
    const grupos = new Map()
    const diasActivos = new Set()

    for (const c of consultas) {
        if (!c.origin_locality_id || !c.destination_locality_id || !c.vehicle_type) continue
        const fecha = new Date(c.queried_at)
        if (Number.isNaN(fecha.getTime())) continue

        const dia = diaBogota(fecha)
        diasActivos.add(dia.clave)

        const franja = franjaDe(fecha)
        const clave = [c.origin_locality_id, c.destination_locality_id, c.vehicle_type, franja].join('|')
        if (!grupos.has(clave)) {
            grupos.set(clave, {
                origin_locality_id: c.origin_locality_id,
                destination_locality_id: c.destination_locality_id,
                vehicle_type: c.vehicle_type,
                time_window: franja,
                dias: new Set(),
                semana: new Set(),
                ultima: fecha
            })
        }
        const g = grupos.get(clave)
        g.dias.add(dia.clave)
        g.semana.add(dia.semana)
        if (fecha > g.ultima) g.ultima = fecha
    }

    const rutas = []
    for (const g of grupos.values()) {
        if (g.dias.size < minDias) continue
        rutas.push({
            origin_locality_id: g.origin_locality_id,
            destination_locality_id: g.destination_locality_id,
            vehicle_type: g.vehicle_type,
            time_window: g.time_window,
            days_of_week: [...g.semana].sort((a, b) => a - b),
            // Cuántos de los días en que usó la app hizo esta ruta (0 a 1).
            confidence: Math.round((g.dias.size / diasActivos.size) * 100) / 100,
            last_seen_at: g.ultima.toISOString()
        })
    }
    return rutas.sort((a, b) => b.confidence - a.confidence)
}

const nivelPara = (zona, medio) => zona.vehicleRisks?.[medio] || zona.riskLevel

// Nivel de una ruta habitual con las zonas del momento: el PEOR nivel, para
// ese medio, entre las localidades del trayecto (origen, destino y las que
// quedan a menos de RADIO_KM de la línea entre los dos).
function nivelDeRuta(ruta, zonas) {
    const origen = zonas.find(z => z.id === ruta.origin_locality_id)
    const destino = zonas.find(z => z.id === ruta.destination_locality_id)
    if (!origen || !destino) return null

    const enRuta = zonas.filter(z =>
        z.id === origen.id || z.id === destino.id ||
        distancePointToLine(z.coordinates, origen.coordinates, destino.coordinates) < RADIO_KM
    )
    let nivel = 'low'
    for (const z of enRuta) {
        if (RANGO[nivelPara(z, ruta.vehicle_type)] > RANGO[nivel]) nivel = nivelPara(z, ruta.vehicle_type)
    }
    return {
        level: nivel,
        zones: enRuta.filter(z => nivelPara(z, ruta.vehicle_type) === nivel).map(z => z.name)
    }
}

// ¿Hay que alertar? Solo si el nivel SUBIÓ y el nuevo llega al mínimo que la
// persona pidió. La primera evaluación no alerta: no hay con qué comparar.
function evaluarAlerta({ nivelAnterior, nivelActual, preferencias }) {
    if (!preferencias || !preferencias.alerts_enabled) return null
    if (!nivelAnterior || !nivelActual) return null
    const minimo = preferencias.min_risk_level || 'high'
    if (RANGO[nivelActual.level] <= RANGO[nivelAnterior]) return null
    if (RANGO[nivelActual.level] < RANGO[minimo]) return null
    return { previous_level: nivelAnterior, new_level: nivelActual.level, zones: nivelActual.zones }
}

// Horas de silencio en hora de Bogotá. Soporta rangos que cruzan medianoche
// (p. ej. de 22 a 6).
function enHorasDeSilencio(fecha, preferencias) {
    const { quiet_hours_start: ini, quiet_hours_end: fin } = preferencias || {}
    if (ini == null || fin == null || ini === fin) return false
    const h = bogotaHour(fecha)
    return ini < fin ? (h >= ini && h < fin) : (h >= ini || h < fin)
}

// ¿Es buen momento para mostrar la alerta de esta ruta? "Antes de la consulta
// habitual": hoy es uno de sus días y estamos en su franja o en la anterior.
function esMomentoDeAvisar(ruta, fecha, preferencias) {
    if (enHorasDeSilencio(fecha, preferencias)) return false
    if (!ruta.days_of_week.includes(diaBogota(fecha).semana)) return false
    const i = TIME_WINDOWS.findIndex(w => w.id === ruta.time_window)
    const actual = franjaDe(fecha)
    return actual === ruta.time_window || (i > 0 && actual === TIME_WINDOWS[i - 1].id)
}

// Estado vigente de cada consentimiento: la última fila por propósito
// (data_consents es de solo-añadir). Sin fila = sin consentimiento.
function consentimientosVigentes(filas) {
    const ordenadas = [...filas].sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at) || (a.id || 0) - (b.id || 0))
    const vigentes = { route_history: false, habitual_routes: false, alerts: false }
    for (const f of ordenadas) vigentes[f.purpose] = Boolean(f.granted)
    return vigentes
}

module.exports = {
    MIN_DIAS, RADIO_KM,
    franjaDe, diaBogota, detectarRutasHabituales, nivelDeRuta, evaluarAlerta,
    enHorasDeSilencio, esMomentoDeAvisar, consentimientosVigentes
}
