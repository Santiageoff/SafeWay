// Issue #8 · EDT 4.4 — perfil proactivo.
// Criterio: "prueba del detector con un historial sintético -> marca la ruta
// habitual y genera la alerta al cambiar el nivel".

const test = require('node:test')
const assert = require('node:assert/strict')

const e = require('../src/services/proactiveEngine')
const { localities } = require('../src/data/localities')
const { levantarApi } = require('../test-utils/api')

const porNombre = (n) => localities.find(l => l.name === n)
const SUBA = porNombre('Suba')
const KENNEDY = porNombre('Kennedy')

// Hora de Bogotá -> Date en UTC (Bogotá es UTC-5).
const bogota = (fecha, hora) => new Date(`${fecha}T${String(hora).padStart(2, '0')}:00:00-05:00`)

const consulta = (fecha, hora, extra = {}) => ({
    origin_locality_id: SUBA.id, destination_locality_id: KENNEDY.id, vehicle_type: 'moto',
    queried_at: bogota(fecha, hora).toISOString(), ...extra
})

// Lunes 5, martes 6 y miércoles 7 de octubre de 2026, a las 7 am.
const HISTORIAL_HABITUAL = [consulta('2026-10-05', 7), consulta('2026-10-06', 7), consulta('2026-10-07', 7)]

// ---------- Detector ----------

test('detector: la misma ruta en 3 días distintos, en la misma franja, es habitual', () => {
    const rutas = e.detectarRutasHabituales(HISTORIAL_HABITUAL)
    assert.equal(rutas.length, 1)
    const [r] = rutas
    assert.equal(r.origin_locality_id, SUBA.id)
    assert.equal(r.destination_locality_id, KENNEDY.id)
    assert.equal(r.vehicle_type, 'moto')
    assert.equal(r.time_window, 'mañana')
    assert.deepEqual(r.days_of_week, [1, 2, 3])
    assert.equal(r.confidence, 1)
})

test('detector: 2 días no bastan, y 3 consultas el mismo día tampoco', () => {
    assert.equal(e.detectarRutasHabituales(HISTORIAL_HABITUAL.slice(0, 2)).length, 0)
    const mismoDia = [consulta('2026-10-05', 7), consulta('2026-10-05', 8), consulta('2026-10-05', 9)]
    assert.equal(e.detectarRutasHabituales(mismoDia).length, 0)
})

test('detector: otra franja horaria u otro medio es otra ruta', () => {
    const mezclado = [
        consulta('2026-10-05', 7), consulta('2026-10-06', 19), consulta('2026-10-07', 7, { vehicle_type: 'carro' })
    ]
    assert.equal(e.detectarRutasHabituales(mezclado).length, 0)
})

test('detector: la confianza es la fracción de días activos con esa ruta', () => {
    const conOtrosDias = [...HISTORIAL_HABITUAL,
        consulta('2026-10-08', 15, { destination_locality_id: SUBA.id, origin_locality_id: KENNEDY.id }),
        consulta('2026-10-09', 15, { destination_locality_id: SUBA.id, origin_locality_id: KENNEDY.id })]
    const [r] = e.detectarRutasHabituales(conOtrosDias)
    assert.equal(r.confidence, 0.6)   // 3 de 5 días
})

test('detector: la hora se toma en Bogotá (11 pm en Bogotá es madrugada del otro día en UTC)', () => {
    const noche = [consulta('2026-10-05', 23), consulta('2026-10-06', 23), consulta('2026-10-07', 23)]
    const [r] = e.detectarRutasHabituales(noche)
    assert.equal(r.time_window, 'noche')
    assert.deepEqual(r.days_of_week, [1, 2, 3])
})

// ---------- Nivel y alerta ----------

// Las 20 localidades en riesgo bajo para moto, salvo Kennedy, que va en el
// nivel indicado. Así el nivel de la ruta depende solo de Kennedy.
const zonasCon = (nivelKennedyMoto) => localities.map(l => ({
    ...l, riskLevel: 'low',
    vehicleRisks: { ...l.vehicleRisks, moto: l.id === KENNEDY.id ? nivelKennedyMoto : 'low' }
}))

const PREFS = { alerts_enabled: true, min_risk_level: 'high', quiet_hours_start: null, quiet_hours_end: null }

test('CRITERIO: historial sintético -> ruta habitual -> alerta cuando sube el nivel', () => {
    const [ruta] = e.detectarRutasHabituales(HISTORIAL_HABITUAL)

    // Primera evaluación: fija la línea base, no alerta.
    const antes = e.nivelDeRuta(ruta, zonasCon('medium'))
    assert.equal(antes.level, 'medium')
    assert.equal(e.evaluarAlerta({ nivelAnterior: null, nivelActual: antes, preferencias: PREFS }), null)

    // Kennedy sube a alto para moto: la ruta pasa a alto y hay alerta.
    const despues = e.nivelDeRuta(ruta, zonasCon('high'))
    assert.equal(despues.level, 'high')
    assert.deepEqual(despues.zones, ['Kennedy'])

    const alerta = e.evaluarAlerta({ nivelAnterior: antes.level, nivelActual: despues, preferencias: PREFS })
    assert.deepEqual(alerta, { previous_level: 'medium', new_level: 'high', zones: ['Kennedy'] })

    // Si vuelve a evaluarse sin cambios, no se repite la alerta.
    assert.equal(e.evaluarAlerta({ nivelAnterior: 'high', nivelActual: despues, preferencias: PREFS }), null)
})

test('evaluarAlerta: sin alertas activadas, bajando o sin llegar al mínimo, no alerta', () => {
    const alto = { level: 'high', zones: ['Kennedy'] }
    const medio = { level: 'medium', zones: ['Kennedy'] }
    assert.equal(e.evaluarAlerta({ nivelAnterior: 'low', nivelActual: alto, preferencias: { ...PREFS, alerts_enabled: false } }), null)
    assert.equal(e.evaluarAlerta({ nivelAnterior: 'high', nivelActual: medio, preferencias: PREFS }), null)
    assert.equal(e.evaluarAlerta({ nivelAnterior: 'high', nivelActual: alto, preferencias: PREFS }), null)
    assert.equal(e.evaluarAlerta({ nivelAnterior: 'low', nivelActual: medio, preferencias: PREFS }), null)
    assert.ok(e.evaluarAlerta({ nivelAnterior: 'low', nivelActual: medio, preferencias: { ...PREFS, min_risk_level: 'medium' } }))
})

test('nivelDeRuta: null si la localidad no existe', () => {
    assert.equal(e.nivelDeRuta({ origin_locality_id: 999, destination_locality_id: KENNEDY.id, vehicle_type: 'moto' }, localities), null)
})

// ---------- Cuándo avisar ----------

test('horas de silencio, también cruzando medianoche', () => {
    const noche = { quiet_hours_start: 22, quiet_hours_end: 6 }
    assert.equal(e.enHorasDeSilencio(bogota('2026-10-05', 23), noche), true)
    assert.equal(e.enHorasDeSilencio(bogota('2026-10-05', 3), noche), true)
    assert.equal(e.enHorasDeSilencio(bogota('2026-10-05', 7), noche), false)
    assert.equal(e.enHorasDeSilencio(bogota('2026-10-05', 3), {}), false)
})

test('esMomentoDeAvisar: su día, en su franja o la anterior, fuera de silencio', () => {
    const [ruta] = e.detectarRutasHabituales(HISTORIAL_HABITUAL)   // lun-mié, mañana
    assert.equal(e.esMomentoDeAvisar(ruta, bogota('2026-10-12', 5), PREFS), true)   // lunes madrugada
    assert.equal(e.esMomentoDeAvisar(ruta, bogota('2026-10-12', 8), PREFS), true)   // lunes mañana
    assert.equal(e.esMomentoDeAvisar(ruta, bogota('2026-10-12', 15), PREFS), false) // lunes tarde
    assert.equal(e.esMomentoDeAvisar(ruta, bogota('2026-10-10', 8), PREFS), false)  // sábado
    assert.equal(e.esMomentoDeAvisar(ruta, bogota('2026-10-12', 5), { quiet_hours_start: 0, quiet_hours_end: 6 }), false)
})

// ---------- Consentimiento ----------

test('consentimiento: vale la última decisión; sin fila, no hay consentimiento', () => {
    assert.deepEqual(e.consentimientosVigentes([]), { route_history: false, habitual_routes: false, alerts: false })
    const filas = [
        { id: 1, purpose: 'alerts', granted: true, created_at: '2026-10-01T10:00:00Z' },
        { id: 2, purpose: 'alerts', granted: false, created_at: '2026-10-02T10:00:00Z' },
        { id: 3, purpose: 'route_history', granted: true, created_at: '2026-10-01T10:00:00Z' }
    ]
    assert.deepEqual(e.consentimientosVigentes(filas), { route_history: true, habitual_routes: false, alerts: false })
})

// ---------- Endpoints ----------

test('/api/profile/* exige sesión', async (t) => {
    const api = await levantarApi({ SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '' })
    t.after(api.cerrar)
    for (const ruta of ['/api/profile/consents', '/api/profile/alerts', '/api/profile/habitual-routes', '/api/profile/preferences']) {
        assert.equal((await api.get(ruta)).status, 401, ruta)
    }
    assert.equal((await api.post('/api/profile/refresh', {})).status, 401)
})

// Contra el Supabase REAL (consentimiento en route_queries y RLS de
// risk_alerts) lo comprueba `npm run verify:rls`, secciones 5 y 6b: necesita
// la llave secreta, así que no corre en el CI.
