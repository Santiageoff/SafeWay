// RF-01 · EDT 3.1 — "99% de las 20 localidades cargadas con un nivel de riesgo"
// ADR-003 — el riesgo se modela por localidad.
//
// Se prueba el dataset de respaldo (`src/data/localities.js`): es lo que la API
// sirve cuando Supabase falla, así que tiene que estar completo por sí solo.

const test = require('node:test')
const assert = require('node:assert/strict')

const { localities } = require('../src/data/localities')
const { isInsideBogota } = require('../src/utils/geo')

const NIVELES = ['low', 'medium', 'high']
// `publico` no está en los datos históricos: el motor usa `peatón` como proxy.
const MEDIOS_EN_DATOS = ['carro', 'moto', 'bici', 'peatón']

test('el respaldo tiene exactamente las 20 localidades de Bogotá', () => {
    assert.equal(localities.length, 20)
})

test('ids y nombres únicos', () => {
    assert.equal(new Set(localities.map(l => l.id)).size, 20, 'hay ids repetidos')
    assert.equal(new Set(localities.map(l => l.name)).size, 20, 'hay nombres repetidos')
})

test('cada localidad tiene coordenadas dentro de Bogotá', () => {
    for (const l of localities) {
        assert.ok(Array.isArray(l.coordinates) && l.coordinates.length === 2, `${l.name}: coordenadas mal formadas`)
        const [lat, lng] = l.coordinates
        assert.ok(isInsideBogota(lat, lng), `${l.name}: [${lat}, ${lng}] está fuera de Bogotá`)
    }
})

test('cada localidad tiene nivel de riesgo general y por medio de transporte', () => {
    for (const l of localities) {
        assert.ok(NIVELES.includes(l.riskLevel), `${l.name}: riskLevel inválido (${l.riskLevel})`)
        for (const medio of MEDIOS_EN_DATOS) {
            assert.ok(NIVELES.includes(l.vehicleRisks?.[medio]),
                `${l.name}: falta o es inválido el nivel para ${medio}`)
        }
    }
})
