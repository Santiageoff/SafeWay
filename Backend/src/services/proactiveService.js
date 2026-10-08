// Perfil proactivo (issue #8): la parte que habla con Supabase. Las decisiones
// (qué es una ruta habitual, cuándo hay alerta) viven en proactiveEngine.js.
//
// Dos clientes, cada uno para lo suyo (ver supabaseService.js):
//   · `db` = req.db, actúa COMO la persona: RLS aplica. Todo lo que ella lee,
//     guarda o borra de sí misma pasa por aquí. La base rechaza guardar
//     historial sin consentimiento aunque este código se equivoque.
//   · admin (service_role): solo para el motor, que ESCRIBE rutas habituales y
//     alertas, cosa que el usuario no puede hacer desde el navegador. El
//     userId sale siempre de la sesión verificada, nunca del cuerpo.

const supabase = require('./supabaseService')
const engine = require('./proactiveEngine')

const TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS) || 3000
const limite = () => AbortSignal.timeout(TIMEOUT_MS)

// Días de historial que mira el detector.
const DIAS_HISTORIAL = 60

const PROPOSITOS = ['route_history', 'habitual_routes', 'alerts']
const MEDIOS = ['carro', 'moto', 'bici', 'peatón', 'publico']
const NIVELES = ['low', 'medium', 'high']

const PREFERENCIAS_POR_DEFECTO = {
    alerts_enabled: false, min_risk_level: 'high', quiet_hours_start: null, quiet_hours_end: null
}

class ProfileError extends Error {
    constructor(message, statusCode = 400, code = 'solicitud_invalida') {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

function fallo(error, queHaciamos) {
    console.error(`[profile] ${queHaciamos}:`, error.message)
    throw new ProfileError(`No se pudo ${queHaciamos}`, 500, 'error_base_de_datos')
}

// ---------- Consentimiento (Ley 1581) ----------

async function misConsentimientos(db) {
    const { data, error } = await db.from('data_consents')
        .select('id, purpose, granted, policy_version, created_at').abortSignal(limite())
    if (error) fallo(error, 'leer tus consentimientos')
    return engine.consentimientosVigentes(data || [])
}

// Otorgar o revocar. Siempre AÑADE una fila: la tabla es de solo-añadir para
// que quede prueba de cada decisión.
async function guardarConsentimiento(db, userId, { purpose, granted, policyVersion }) {
    if (!PROPOSITOS.includes(purpose)) {
        throw new ProfileError(`purpose debe ser uno de: ${PROPOSITOS.join(', ')}`)
    }
    if (typeof granted !== 'boolean') throw new ProfileError('granted debe ser true o false')

    const fila = { user_id: userId, purpose, granted }
    if (typeof policyVersion === 'string' && policyVersion.length <= 20) fila.policy_version = policyVersion

    const { error } = await db.from('data_consents').insert(fila).abortSignal(limite())
    if (error) fallo(error, 'guardar tu consentimiento')
    return misConsentimientos(db)
}

// ---------- Preferencias de alertas ----------

async function misPreferencias(db) {
    const { data, error } = await db.from('alert_preferences')
        .select('alerts_enabled, min_risk_level, quiet_hours_start, quiet_hours_end')
        .maybeSingle().abortSignal(limite())
    if (error) fallo(error, 'leer tus preferencias')
    return data || { ...PREFERENCIAS_POR_DEFECTO }
}

const horaValida = (h) => h === null || (Number.isInteger(h) && h >= 0 && h <= 23)

async function guardarPreferencias(db, userId, entrada = {}) {
    const actuales = await misPreferencias(db)
    const nuevas = { ...actuales }

    if ('alertsEnabled' in entrada) {
        if (typeof entrada.alertsEnabled !== 'boolean') throw new ProfileError('alertsEnabled debe ser true o false')
        nuevas.alerts_enabled = entrada.alertsEnabled
    }
    if ('minRiskLevel' in entrada) {
        if (!['medium', 'high'].includes(entrada.minRiskLevel)) throw new ProfileError('minRiskLevel debe ser medium o high')
        nuevas.min_risk_level = entrada.minRiskLevel
    }
    for (const [campo, columna] of [['quietHoursStart', 'quiet_hours_start'], ['quietHoursEnd', 'quiet_hours_end']]) {
        if (campo in entrada) {
            if (!horaValida(entrada[campo])) throw new ProfileError(`${campo} debe ser una hora de 0 a 23, o null`)
            nuevas[columna] = entrada[campo]
        }
    }

    const { error } = await db.from('alert_preferences')
        .upsert({ user_id: userId, ...nuevas, updated_at: new Date().toISOString() })
        .abortSignal(limite())
    if (error) fallo(error, 'guardar tus preferencias')
    return nuevas
}

// ---------- Historial ----------

// Guarda una consulta de ruta en el historial. Nunca lanza: sin
// consentimiento la base la rechaza (RLS) y simplemente no se guarda.
async function registrarConsulta(db, userId, { originLocalityId, destinationLocalityId, vehicleType, riskLevel }) {
    if (!db || !userId) return { guardado: false, motivo: 'sin_sesion' }
    const fila = {
        user_id: userId,
        origin_locality_id: Number.isInteger(originLocalityId) ? originLocalityId : null,
        destination_locality_id: Number.isInteger(destinationLocalityId) ? destinationLocalityId : null,
        vehicle_type: vehicleType,
        risk_level: NIVELES.includes(riskLevel) ? riskLevel : null
    }
    if (!MEDIOS.includes(fila.vehicle_type)) return { guardado: false, motivo: 'medio_invalido' }
    try {
        const { error } = await db.from('route_queries').insert(fila).abortSignal(limite())
        if (!error) return { guardado: true }
        // 42501 = RLS lo rechazó: no hay consentimiento de historial vigente.
        if (error.code === '42501') return { guardado: false, motivo: 'sin_consentimiento' }
        console.error('[profile] no se pudo guardar la consulta:', error.message)
    } catch (err) {
        console.error('[profile] no se pudo guardar la consulta:', err.message)
    }
    return { guardado: false, motivo: 'error' }
}

// Derecho de supresión: borra el historial y lo que se dedujo de él (rutas
// habituales; sus alertas caen en cascada).
async function borrarHistorial(db, userId) {
    const historial = await db.from('route_queries').delete().eq('user_id', userId).abortSignal(limite())
    if (historial.error) fallo(historial.error, 'borrar tu historial')
    const rutas = await db.from('habitual_routes').delete().eq('user_id', userId).abortSignal(limite())
    if (rutas.error) fallo(rutas.error, 'borrar tus rutas habituales')
    return { borrado: true }
}

// ---------- Rutas habituales y alertas (lectura propia) ----------

async function misRutasHabituales(db) {
    const { data, error } = await db.from('habitual_routes')
        .select('id, origin_locality_id, destination_locality_id, vehicle_type, time_window, days_of_week, confidence, last_seen_at, last_risk_level, active')
        .order('confidence', { ascending: false }).abortSignal(limite())
    if (error) fallo(error, 'leer tus rutas habituales')
    return data || []
}

async function misAlertas(db, { soloNoVistas = false } = {}) {
    let consulta = db.from('risk_alerts')
        .select('id, habitual_route_id, previous_level, new_level, zones, created_at, seen_at, habitual_routes(origin_locality_id, destination_locality_id, vehicle_type, time_window, days_of_week)')
        .order('created_at', { ascending: false }).limit(50)
    if (soloNoVistas) consulta = consulta.is('seen_at', null)
    const { data, error } = await consulta.abortSignal(limite())
    if (error) fallo(error, 'leer tus alertas')
    return data || []
}

async function marcarAlertaVista(db, id) {
    if (!Number.isInteger(id) || id < 1) throw new ProfileError('id de alerta inválido')
    const { data, error } = await db.from('risk_alerts')
        .update({ seen_at: new Date().toISOString() }).eq('id', id)
        .select('id, seen_at').maybeSingle().abortSignal(limite())
    if (error) fallo(error, 'marcar la alerta')
    if (!data) throw new ProfileError('Alerta no encontrada', 404, 'alerta_no_encontrada')
    return data
}

// ---------- El motor ----------

// Detecta las rutas habituales de UNA persona y crea sus alertas si el nivel
// de alguna subió. `zonas` son las localidades con el riesgo del momento.
async function actualizarPerfil(userId, zonas, ahora = new Date()) {
    const admin = supabase.getAdminClient()
    if (!admin) throw new ProfileError('El motor proactivo necesita SUPABASE_SECRET_KEY en el backend', 503, 'motor_no_disponible')

    const consentimientos = await admin.from('data_consents')
        .select('id, purpose, granted, created_at').eq('user_id', userId).abortSignal(limite())
    if (consentimientos.error) fallo(consentimientos.error, 'leer los consentimientos')
    const vigentes = engine.consentimientosVigentes(consentimientos.data || [])

    // Sin permiso para deducir patrones, el motor no hace nada.
    if (!vigentes.habitual_routes) return { rutasHabituales: 0, alertasNuevas: [], consentimientos: vigentes }

    const desde = new Date(ahora.getTime() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000).toISOString()
    const historial = await admin.from('route_queries')
        .select('origin_locality_id, destination_locality_id, vehicle_type, queried_at')
        .eq('user_id', userId).gte('queried_at', desde).abortSignal(limite())
    if (historial.error) fallo(historial.error, 'leer el historial')

    const detectadas = engine.detectarRutasHabituales(historial.data || [])
    if (detectadas.length > 0) {
        const { error } = await admin.from('habitual_routes')
            .upsert(detectadas.map(r => ({ ...r, user_id: userId })), {
                onConflict: 'user_id,origin_locality_id,destination_locality_id,vehicle_type,time_window'
            }).abortSignal(limite())
        if (error) fallo(error, 'guardar las rutas habituales')
    }

    const rutas = await admin.from('habitual_routes')
        .select('id, origin_locality_id, destination_locality_id, vehicle_type, time_window, days_of_week, last_risk_level')
        .eq('user_id', userId).eq('active', true).abortSignal(limite())
    if (rutas.error) fallo(rutas.error, 'leer las rutas habituales')

    const prefs = await admin.from('alert_preferences')
        .select('alerts_enabled, min_risk_level, quiet_hours_start, quiet_hours_end')
        .eq('user_id', userId).maybeSingle().abortSignal(limite())
    if (prefs.error) fallo(prefs.error, 'leer las preferencias')
    const preferencias = prefs.data || PREFERENCIAS_POR_DEFECTO

    const alertasNuevas = []
    for (const ruta of rutas.data || []) {
        const nivelActual = engine.nivelDeRuta(ruta, zonas)
        if (!nivelActual) continue

        const alerta = vigentes.alerts
            ? engine.evaluarAlerta({ nivelAnterior: ruta.last_risk_level, nivelActual, preferencias })
            : null
        if (alerta) {
            const { data, error } = await admin.from('risk_alerts')
                .insert({ ...alerta, user_id: userId, habitual_route_id: ruta.id })
                .select('id, habitual_route_id, previous_level, new_level, zones, created_at').single()
                .abortSignal(limite())
            if (error) fallo(error, 'guardar la alerta')
            alertasNuevas.push(data)
        }

        const { error } = await admin.from('habitual_routes')
            .update({ last_risk_level: nivelActual.level, last_evaluated_at: ahora.toISOString() })
            .eq('id', ruta.id).abortSignal(limite())
        if (error) fallo(error, 'actualizar el nivel de la ruta')
    }

    return { rutasHabituales: (rutas.data || []).length, alertasNuevas, consentimientos: vigentes }
}

module.exports = {
    PROPOSITOS, ProfileError,
    misConsentimientos, guardarConsentimiento, misPreferencias, guardarPreferencias,
    registrarConsulta, borrarHistorial, misRutasHabituales, misAlertas, marcarAlertaVista,
    actualizarPerfil
}
