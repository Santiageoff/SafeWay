// Auditoría de seguridad 2026-11: lo que se corrigió en el backend.

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildReport } = require('../src/services/reportService')
const { buildZones } = require('../src/services/dynamicRiskService')
const { localities } = require('../src/data/localities')
const { levantarApi } = require('../test-utils/api')

const base = { lat: 4.6283, lng: -74.1662, userId: 'usuario-de-prueba' }
const HORA = 60 * 60 * 1000

test('un rango horario de más de 24 h se rechaza', () => {
    const inicio = new Date(Date.now() - 30 * HORA)
    assert.throws(() => buildReport({ ...base, occurredAt: inicio.toISOString(), occurredEnd: new Date().toISOString() }),
        /no puede pasar de 24 horas/)
})

test('la hora final del rango no puede estar en el futuro', () => {
    assert.throws(() => buildReport({ ...base, occurredEnd: new Date(Date.now() + 2 * HORA).toISOString() }),
        /no puede estar en el futuro/)
})

test('un rango de 8 h (la moto parqueada) sigue siendo válido', () => {
    const fin = new Date()
    const r = buildReport({ ...base, occurredAt: new Date(fin - 8 * HORA).toISOString(), occurredEnd: fin.toISOString() })
    assert.ok(r.occurred_end)
})

test('una fecha de hace más de un año se rechaza', () => {
    assert.throws(() => buildReport({ ...base, occurredAt: '1900-01-01T00:00:00Z' }), /demasiado antigua/)
})

test('una fila vieja con un rango enorme no congela el cálculo del mapa', () => {
    const ahora = new Date()
    const reporte = {
        id: 'viejo', type: null, lat: 4.6283, lng: -74.1662, locality: 'Kennedy', locality_id: 8,
        occurred_at: ahora.toISOString(), occurred_end: new Date(ahora.getTime() + 1000 * 365 * 24 * HORA).toISOString()
    }
    const inicio = Date.now()
    buildZones([reporte], { mode: 'carro', at: ahora, localities })
    assert.ok(Date.now() - inicio < 200, `tardó ${Date.now() - inicio} ms`)
})

test('un id que no es UUID da 404 sin tocar la base', async (t) => {
    const api = await levantarApi({ SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '' })
    t.after(() => api.cerrar())
    const res = await fetch(api.base + '/api/reports/no-es-uuid', { method: 'DELETE' })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'not_found')
})
