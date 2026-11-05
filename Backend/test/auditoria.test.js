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

// ---------- PR 2: supresión y mejoras ----------

function cuatroReportes(zona, usuarios, at) {
    return usuarios.map((u, i) => ({
        id: `r${i}`, type: 'carro', user_id: u, locality: zona.name, locality_id: zona.id,
        lat: zona.coordinates[0] + i * 0.003, lng: zona.coordinates[1],
        occurred_at: new Date(at.getTime() - i * 15 * 60 * 1000).toISOString()
    }))
}

test('una sola cuenta con 4 reportes NO cambia el color de una localidad', () => {
    const at = new Date('2026-11-05T20:00:00Z')   // 3 p. m. en Bogotá: franja "tarde"
    const zona = localities.find(z => (z.vehicleRisks?.carro || z.riskLevel) === 'low')
    const misma = buildZones(cuatroReportes(zona, ['u1', 'u1', 'u1', 'u1'], at), { mode: 'carro', at, localities })
    assert.equal(misma.zones.find(z => z.id === zona.id).riskLevel, 'low')
})

test('4 personas distintas reportando SÍ cambian el color', () => {
    const at = new Date('2026-11-05T20:00:00Z')
    const zona = localities.find(z => (z.vehicleRisks?.carro || z.riskLevel) === 'low')
    const distintas = buildZones(cuatroReportes(zona, ['u1', 'u2', 'u3', 'u4'], at), { mode: 'carro', at, localities })
    assert.equal(distintas.zones.find(z => z.id === zona.id).riskLevel, 'medium')
})

test('la API no expone detalles internos y responde JSON en errores comunes', async (t) => {
    const api = await levantarApi({ SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '' })
    t.after(() => api.cerrar())

    const salud = await (await api.get('/health')).json()
    assert.equal(salud.storage.supabaseReachable, false)
    assert.equal(salud.supabaseError, undefined)
    assert.equal(salud.storage.adminKey, undefined)

    const noExiste = await api.get('/api/no-existe')
    assert.equal(noExiste.status, 404)
    assert.equal((await noExiste.json()).code, 'not_found')

    const malo = await fetch(api.base + '/api/route/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"origin":' })
    assert.equal(malo.status, 400)
    assert.equal((await malo.json()).code, 'json_invalido')

    for (const ruta of ['/api/profile/account', '/api/reports/11111111-1111-4111-8111-111111111111/definitivo']) {
        const r = await fetch(api.base + ruta, { method: 'DELETE' })
        assert.equal(r.status, 401, ruta)
    }
})
