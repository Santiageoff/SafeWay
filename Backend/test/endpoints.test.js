// Issue #2 · EDT 3.2 — "Endpoints documentados y probados para las 20 localidades".
//
// Se levanta la API real con Supabase caído (dataset de respaldo) y con un OSRM
// falso, para que el camino feliz de /api/route/analyze no dependa de internet.

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { levantarApi } = require('../test-utils/api')
const { localities } = require('../src/data/localities')

const SUPABASE_CAIDO = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'llave-de-prueba', SUPABASE_ANON_KEY: '' }

// OSRM falso: devuelve una ruta de 3 puntos entre origen y destino.
async function osrmFalso() {
    let llamadas = 0
    const server = http.createServer((req, res) => {
        llamadas++
        const m = req.url.match(/\/route\/v1\/\w+\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/)
        if (!m) { res.statusCode = 400; return res.end('{}') }
        const [lng1, lat1, lng2, lat2] = m.slice(1).map(Number)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
            code: 'Ok',
            routes: [{
                distance: 12345, duration: 1800,
                geometry: { coordinates: [[lng1, lat1], [(lng1 + lng2) / 2, (lat1 + lat2) / 2], [lng2, lat2]] }
            }]
        }))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        llamadas: () => llamadas,
        cerrar: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })
    }
}

let api, osrm

test.before(async () => {
    osrm = await osrmFalso()
    api = await levantarApi({ ...SUPABASE_CAIDO, OSRM_URL: osrm.url })
})
test.after(async () => {
    await api.cerrar()
    await osrm.cerrar()
})

// ---------- GET /api/risk/zones/:id ----------

test('GET /api/risk/zones/:id responde las 20 localidades', async () => {
    for (const l of localities) {
        const res = await api.get(`/api/risk/zones/${l.id}`)
        assert.equal(res.status, 200, `id ${l.id}`)
        const { data } = await res.json()
        assert.equal(data.name, l.name)
        assert.ok(['low', 'medium', 'high'].includes(data.riskLevel), `${l.name}: nivel ${data.riskLevel}`)
    }
    assert.equal((await api.get('/api/risk/zones/999')).status, 404)
    assert.equal((await api.get('/api/risk/zones/abc')).status, 400)
})

// ---------- GET /api/risk/zone/:localidad ----------

test('GET /api/risk/zone/:localidad encuentra las 20 por su nombre', async () => {
    for (const l of localities) {
        const res = await api.get(`/api/risk/zone/${encodeURIComponent(l.name)}?vehicle=moto`)
        assert.equal(res.status, 200, l.name)
        assert.equal((await res.json()).data.id, l.id, l.name)
    }
    // Sin distinguir mayúsculas; y un nombre que no existe da 404.
    assert.equal((await (await api.get('/api/risk/zone/SUBA')).json()).data.name, 'Suba')
    assert.equal((await api.get('/api/risk/zone/Medellin')).status, 404)
})

// ---------- GET /api/risk/search ----------

test('GET /api/risk/search encuentra las 20 y limita a 5 resultados', async () => {
    for (const l of localities) {
        const { data } = await (await api.get(`/api/risk/search?q=${encodeURIComponent(l.name)}`)).json()
        assert.ok(data.some(z => z.id === l.id), `la búsqueda no encontró ${l.name}`)
    }
    const { data } = await (await api.get('/api/risk/search?q=a')).json()
    assert.ok(data.length <= 5)
    assert.equal((await api.get('/api/risk/search')).status, 400)
    assert.equal((await api.get('/api/risk/search?q=a&q=b')).status, 400, 'q repetido no debe dar 500')
})

// ---------- GET /api/risk/zones ----------

test('GET /api/risk/zones con ?q filtra y mantiene meta', async () => {
    const cuerpo = await (await api.get('/api/risk/zones?q=san')).json()
    assert.ok(cuerpo.total >= 1)
    assert.ok(cuerpo.data.every(z => z.name.toLowerCase().includes('san')))
    assert.equal(cuerpo.meta.localitySource, 'respaldo-local')
})

// ---------- POST /api/route/analyze ----------

test('POST /api/route/analyze: camino feliz con OSRM, para los 5 medios', async () => {
    for (const vehicleType of ['carro', 'moto', 'bici', 'peatón', 'publico']) {
        const res = await api.post('/api/route/analyze', { origin: 'Suba', destination: 'Kennedy', vehicleType })
        assert.equal(res.status, 200, vehicleType)
        const r = await res.json()
        assert.equal(r.success, true)
        assert.equal(r.origin.name, 'Suba')
        assert.equal(r.destination.name, 'Kennedy')
        assert.equal(r.vehicleType, vehicleType)
        assert.equal(r.routeSource, 'osrm')
        assert.equal(r.routeCoordinates.length, 3)
        assert.equal(r.routeDistance, 12.3)
        assert.ok(['low', 'medium', 'high'].includes(r.overallRisk))
        assert.ok(Array.isArray(r.zonesInRoute) && r.zonesInRoute.length > 0)
        assert.ok(Array.isArray(r.tips) && r.tips.length > 0)
        // La forma que consume el frontend.
        for (const campo of ['insecurityPercentage', 'routeDuration', 'timeWindow', 'recentReports', 'safestRoute', 'recommendation']) {
            assert.ok(campo in r, `falta ${campo}`)
        }
    }
    assert.ok(osrm.llamadas() >= 5)
})

test('POST /api/route/analyze: cualquier par de las 20 localidades responde 200', async () => {
    const nombres = localities.map(l => l.name)
    for (let i = 0; i < nombres.length; i++) {
        const origin = nombres[i]
        const destination = nombres[(i + 7) % nombres.length]
        const res = await api.post('/api/route/analyze', { origin, destination, vehicleType: 'carro' })
        assert.equal(res.status, 200, `${origin} -> ${destination}`)
    }
})

test('POST /api/route/analyze: errores de entrada son 400/404, nunca 500', async () => {
    const casos = [
        [{}, 400],
        [{ origin: 123, destination: 'Kennedy', vehicleType: 'moto' }, 400],
        [{ origin: 'Suba', destination: ['Kennedy'], vehicleType: 'moto' }, 400],
        [{ origin: '   ', destination: 'Kennedy', vehicleType: 'moto' }, 400],
        [{ origin: 'Suba', destination: 'Kennedy', vehicleType: 'avion' }, 400],
        [{ origin: 'Medellin', destination: 'Kennedy', vehicleType: 'moto' }, 404],
        [{ origin: 'Suba', destination: 'Medellin', vehicleType: 'moto' }, 404]
    ]
    for (const [cuerpo, esperado] of casos) {
        const res = await api.post('/api/route/analyze', cuerpo)
        assert.equal(res.status, esperado, JSON.stringify(cuerpo))
    }
})

test('los endpoints obsoletos ya no existen', async () => {
    assert.equal((await api.post('/api/risk/analyze', { origin: [4.6, -74.1], destination: [4.7, -74.0], vehicleType: 'moto' })).status, 404)
    assert.equal((await api.get('/api/route/plan')).status, 404)
})

test('POST /api/route/analyze con OSRM caído usa la línea recta y lo dice', async (t) => {
    const sinOsrm = await levantarApi({ ...SUPABASE_CAIDO, OSRM_URL: 'http://127.0.0.1:9' })
    t.after(sinOsrm.cerrar)
    const r = await (await sinOsrm.post('/api/route/analyze', { origin: 'Suba', destination: 'Kennedy', vehicleType: 'moto' })).json()
    assert.equal(r.routeSource, 'straight-line')
    assert.equal(r.routeCoordinates.length, 2)
})
