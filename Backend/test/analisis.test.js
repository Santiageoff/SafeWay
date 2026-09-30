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
    const enRuta = a.zonasEnTrayecto(ZONAS, A.coordinates, C.coordinates)
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
