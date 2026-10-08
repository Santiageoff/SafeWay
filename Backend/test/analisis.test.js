// Issue #2 — el análisis de ruta como funciones puras, sin HTTP ni Supabase.

const test = require('node:test')
const assert = require('node:assert/strict')

const a = require('../src/services/routeAnalysisService')

const zona = (id, name, coordinates, riskLevel, vehicleRisks = {}, extra = {}) =>
    ({ id, name, coordinates, riskLevel, vehicleRisks, insecurityPercentage: 50, recommendation: 'r', ...extra })

// Tres zonas sobre una misma línea norte-sur, y una lejos al oriente.
const A = zona(1, 'A', [4.60, -74.10], 'low', { moto: 'low' })
const B = zona(2, 'B', [4.65, -74.10], 'low', { moto: 'high', carro: 'medium' }, { insecurityPercentage: 90 })
const C = zona(3, 'C', [4.70, -74.10], 'low', { moto: 'low' })
const LEJOS = zona(4, 'Lejos', [4.65, -73.90], 'high', { moto: 'high' })
const ZONAS = [A, B, C, LEJOS]
const RUTA = { routeCoordinates: [A.coordinates, C.coordinates], routeDistance: 11, routeDuration: 20, routeSource: 'osrm' }

test('zonasEnTrayecto deja fuera lo que está a más de 3 km', () => {
    const enRuta = a.zonasEnTrayecto(ZONAS, [A.coordinates, C.coordinates])
    assert.deepEqual(enRuta.map(z => z.name), ['A', 'B', 'C'])
})

test('nivelGlobal es el peor nivel para ese medio', () => {
    assert.equal(a.nivelGlobal([A, B, C], 'moto'), 'high')
    assert.equal(a.nivelGlobal([A, B, C], 'carro'), 'medium')
    assert.equal(a.nivelGlobal([A, C], 'moto'), 'low')
    assert.equal(a.nivelGlobal([], 'moto'), 'low')
})

test('porcentajeInseguridad promedia y da 5 sin zonas', () => {
    assert.equal(a.porcentajeInseguridad([A, B]), 70)
    assert.equal(a.porcentajeInseguridad([]), 5)
})

test('consejos por medio solo cuando el riesgo es alto', () => {
    assert.match(a.consejos('moto', 'high')[0], /casco/)
    assert.deepEqual(a.consejos('moto', 'low'), a.consejos('carro', 'high'))
})

test('analizarRuta arma la respuesta completa', () => {
    const r = a.analizarRuta({ zones: ZONAS, originZone: A, destinationZone: C, vehicleType: 'moto', route: RUTA, timeWindow: { id: 'noche' } })
    assert.equal(r.overallRisk, 'high')
    assert.deepEqual(r.safestRoute.avoidZones, ['B'])
    assert.equal(r.zonesInRoute.length, 3)
    assert.equal(r.zonesInRoute.find(z => z.name === 'B').vehicleRisk, 'high')
    assert.equal(r.routeSource, 'osrm')
    assert.deepEqual(r.timeWindow, { id: 'noche' })
    assert.ok(!r.zonesInRoute.some(z => z.name === 'Lejos'))
})

// ---------- Issue #6: riesgo sobre la ruta real ----------
//
// X está justo en la mitad de la línea recta entre ORIGEN y DESTINO, y tiene
// riesgo alto. Y está ~5,5 km al occidente, también con riesgo alto.
// RUTA_U sale de ORIGEN hacia el occidente, sube y vuelve: rodea a X y pasa
// por encima de Y.
const ORIGEN = zona(10, 'Origen', [4.60, -74.10], 'low', { moto: 'low' })
const DESTINO = zona(11, 'Destino', [4.70, -74.10], 'low', { moto: 'low' })
const X = zona(12, 'X', [4.65, -74.10], 'high', { moto: 'high' })
const Y = zona(13, 'Y', [4.65, -74.15], 'high', { moto: 'high' })
const ZONAS_U = [ORIGEN, DESTINO, X, Y]
const RECTA = [ORIGEN.coordinates, DESTINO.coordinates]
const RUTA_U = [ORIGEN.coordinates, [4.60, -74.15], [4.70, -74.15], DESTINO.coordinates]

test('distanciaAPolilinea: la menor distancia a cualquier segmento', () => {
    assert.ok(a.distanciaAPolilinea(X.coordinates, RECTA) < 0.01)
    assert.ok(a.distanciaAPolilinea(X.coordinates, RUTA_U) > 5)
    assert.ok(a.distanciaAPolilinea(Y.coordinates, RUTA_U) < 0.01)
    assert.equal(a.distanciaAPolilinea(X.coordinates, []), Infinity)
})

test('CRITERIO #6: una ruta en U que rodea una zona de riesgo alto NO la cuenta', () => {
    const nombres = a.zonasEnTrayecto(ZONAS_U, RUTA_U, { incluir: [10, 11] }).map(z => z.name)
    assert.ok(!nombres.includes('X'), 'X queda a más de 5 km de la ruta real')
    // Con la línea recta (lo que hacía antes) sí la contaba.
    assert.ok(a.zonasEnTrayecto(ZONAS_U, RECTA).map(z => z.name).includes('X'))
})

test('CRITERIO #6 (inversa): una ruta en curva que cruza una zona SÍ la cuenta', () => {
    assert.ok(a.zonasEnTrayecto(ZONAS_U, RUTA_U).map(z => z.name).includes('Y'))
    // Con la línea recta no la veía.
    assert.ok(!a.zonasEnTrayecto(ZONAS_U, RECTA).map(z => z.name).includes('Y'))
})

test('origen y destino siempre cuentan, aunque su centro quede lejos de la ruta', () => {
    const lejos = [[4.62, -74.20], [4.68, -74.20]]
    const nombres = a.zonasEnTrayecto([ORIGEN, DESTINO], lejos, { incluir: [10, 11] }).map(z => z.name)
    assert.deepEqual(nombres.sort(), ['Destino', 'Origen'])
})

test('analizarRuta usa la polilínea: el nivel cambia según por dónde va la ruta', () => {
    const base = { zones: [ORIGEN, DESTINO, X], originZone: ORIGEN, destinationZone: DESTINO, vehicleType: 'moto', timeWindow: null }
    const recta = a.analizarRuta({ ...base, route: { routeCoordinates: RECTA, routeSource: 'osrm' } })
    const enU = a.analizarRuta({ ...base, route: { routeCoordinates: RUTA_U, routeSource: 'osrm' } })
    assert.equal(recta.overallRisk, 'high')
    assert.equal(enU.overallRisk, 'low')
    assert.ok(enU.zonesInRoute.every(z => typeof z.distanceKm === 'number'))
})

test('la recomendación sale del nivel de la ruta, no del texto de la localidad de origen', () => {
    const origenEngañoso = { ...ORIGEN, recommendation: 'Zona segura. Circulación cómoda.' }
    const r = a.analizarRuta({
        zones: [origenEngañoso, DESTINO, X], originZone: origenEngañoso, destinationZone: DESTINO,
        vehicleType: 'moto', timeWindow: null, route: { routeCoordinates: RECTA, routeSource: 'osrm' }
    })
    assert.equal(r.overallRisk, 'high')
    assert.ok(!r.recommendation.includes('Zona segura'), r.recommendation)
    assert.match(r.recommendation, /riesgo alto/)
    assert.match(r.recommendation, /\bX\b/)
})

test('recomendación: baja, media y aviso de línea recta', () => {
    const baja = a.recomendacion({ origen: 'A', destino: 'B', vehicleType: 'bici', nivel: 'low', zonas: [], routeSource: 'osrm' })
    assert.match(baja, /riesgo bajo/)
    assert.match(baja, /bicicleta/)
    const media = a.recomendacion({ origen: 'A', destino: 'B', vehicleType: 'carro', nivel: 'medium', zonas: [B], routeSource: 'straight-line' })
    assert.match(media, /riesgo medio/)
    assert.match(media, /\bB\b/)
    assert.match(media, /línea recta/)
})
