// Utilidades geográficas que usa el análisis de ruta (EDT 4.1 / 4.2).

const test = require('node:test')
const assert = require('node:assert/strict')

const { distanceKm, distancePointToLine, isInsideBogota } = require('../src/utils/geo')

const cerca = (real, esperado, tolerancia = 0.05) =>
    assert.ok(Math.abs(real - esperado) <= tolerancia, `esperaba ~${esperado}, dio ${real}`)

test('distanceKm: 0 en el mismo punto y simétrica', () => {
    assert.equal(distanceKm(4.65, -74.08, 4.65, -74.08), 0)
    cerca(distanceKm(4.6, -74.1, 4.7, -74.05), distanceKm(4.7, -74.05, 4.6, -74.1), 1e-9)
})

test('distanceKm: 0,1° de latitud son ~11,12 km', () => {
    cerca(distanceKm(4.6, -74.1, 4.7, -74.1), 11.12)
})

test('distancePointToLine: un punto sobre el segmento está a ~0 km', () => {
    cerca(distancePointToLine([4.65, -74.1], [4.6, -74.1], [4.7, -74.1]), 0, 1e-6)
})

test('distancePointToLine: más allá del extremo mide contra el extremo, no contra la recta infinita', () => {
    const d = distancePointToLine([4.8, -74.1], [4.6, -74.1], [4.7, -74.1])
    cerca(d, distanceKm(4.8, -74.1, 4.7, -74.1))
})

test('isInsideBogota: el centro sí, Medellín no', () => {
    assert.equal(isInsideBogota(4.711, -74.0721), true)
    assert.equal(isInsideBogota(6.2442, -75.5812), false)
})
