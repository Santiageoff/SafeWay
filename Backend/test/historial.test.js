// Issue #8 — el análisis de ruta alimenta el historial del perfil proactivo,
// solo con sesión, y sin hacer más lento el análisis.

const test = require('node:test')
const assert = require('node:assert/strict')

const { levantarApi } = require('../test-utils/api')
const { osrmFalso, supabaseFalso } = require('../test-utils/falsos')
const { localities } = require('../src/data/localities')

const USUARIO = { id: '11111111-2222-3333-4444-555555555555', email: 'prueba@safeway.test' }
const esperar = (ms) => new Promise(r => setTimeout(r, ms))

let api, osrm, supa

test.before(async () => {
    osrm = await osrmFalso()
    supa = await supabaseFalso({ usuarios: { 'token-valido': USUARIO } })
    api = await levantarApi({
        SUPABASE_URL: supa.url, SUPABASE_KEY: 'llave-de-prueba', SUPABASE_ANON_KEY: '',
        OSRM_URL: osrm.url, NOMINATIM_URL: 'http://127.0.0.1:9'
    })
})
test.after(async () => {
    await api.cerrar()
    await supa.cerrar()
    await osrm.cerrar()
})

const analizar = (headers = {}) => fetch(`${api.base}/api/route/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ origin: 'Suba', destination: 'Kennedy', vehicleType: 'moto' }),
    signal: AbortSignal.timeout(8000)
})

test('sin sesión: el análisis responde y no se guarda nada en el historial', async () => {
    const antes = supa.historial.length
    assert.equal((await analizar()).status, 200)
    await esperar(300)
    assert.equal(supa.historial.length, antes)
})

test('con sesión: se guarda la consulta en su historial, solo con localidades', async () => {
    const antes = supa.historial.length
    const res = await analizar({ Authorization: 'Bearer token-valido' })
    assert.equal(res.status, 200)
    const r = await res.json()

    // Se guarda después de responder: se le da un momento.
    for (let i = 0; i < 20 && supa.historial.length === antes; i++) await esperar(100)
    assert.equal(supa.historial.length, antes + 1)

    const fila = supa.historial[supa.historial.length - 1]
    const suba = localities.find(l => l.name === 'Suba')
    const kennedy = localities.find(l => l.name === 'Kennedy')
    assert.equal(fila.user_id, USUARIO.id)
    assert.equal(fila.origin_locality_id, suba.id)
    assert.equal(fila.destination_locality_id, kennedy.id)
    assert.equal(fila.vehicle_type, 'moto')
    assert.equal(fila.risk_level, r.overallRisk)
    // Se inserta con el token de la persona (RLS exige su consentimiento),
    // no con la llave secreta.
    assert.equal(fila._token, 'token-valido')
    // Minimización (Ley 1581): nada de coordenadas ni direcciones.
    assert.deepEqual(Object.keys(fila).filter(k => k !== '_token').sort(),
        ['destination_locality_id', 'origin_locality_id', 'risk_level', 'user_id', 'vehicle_type'])
})

test('con un token inválido: responde 200 como visitante y no guarda nada', async () => {
    const antes = supa.historial.length
    assert.equal((await analizar({ Authorization: 'Bearer token-falso' })).status, 200)
    await esperar(500)
    assert.equal(supa.historial.length, antes)
})
