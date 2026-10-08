// Issue #5 · EDT 4.1 — geocodificar con Nominatim y trazar la ruta según el medio.
// Issue #7 — cada análisis queda registrado en los indicadores.
//
// Todo con servidores falsos (NOMINATIM_URL, OSRM_URL, SUPABASE_URL): las
// pruebas no dependen de internet.

const test = require('node:test')
const assert = require('node:assert/strict')

const { levantarApi } = require('../test-utils/api')
const { nominatimFalso, osrmFalso, supabaseFalso } = require('../test-utils/falsos')

const SIN_SUPABASE = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '' }

// Direcciones que conoce el Nominatim falso.
const DIRECCIONES = {
    'calle 72 # 7-30': [4.6578, -74.0563],          // Chapinero
    'plaza de kennedy': [4.6285, -74.1580],         // Kennedy
    'parque de la 93': [4.6766, -74.0482],          // Chapinero
    'centro de medellin': [6.2476, -75.5658]        // fuera de Bogotá
}

async function montar(t, { osrm = {}, nominatim = {}, env = {} } = {}) {
    const n = await nominatimFalso({ direcciones: DIRECCIONES, ...nominatim })
    const o = await osrmFalso(osrm)
    t.after(n.cerrar)
    t.after(o.cerrar)
    const api = await levantarApi({
        ...SIN_SUPABASE, NOMINATIM_URL: n.url, OSRM_URL: `${o.url}/routed-{perfil}`, ...env
    })
    t.after(api.cerrar)
    return { api, nominatim: n, osrm: o }
}

const analizar = (api, origin, destination, vehicleType = 'moto') =>
    api.post('/api/route/analyze', { origin, destination, vehicleType })

test('CRITERIO: con Nominatim y OSRM simulados devuelve ruta y nivel para una dirección', async (t) => {
    const { api, nominatim } = await montar(t)
    const res = await analizar(api, 'Calle 72 # 7-30', 'Plaza de Kennedy')
    assert.equal(res.status, 200)
    const r = await res.json()

    assert.equal(r.origin.source, 'nominatim')
    assert.deepEqual(r.origin.coordinates, DIRECCIONES['calle 72 # 7-30'])
    assert.equal(r.origin.locality, 'Chapinero')
    assert.equal(r.destination.locality, 'Kennedy')
    assert.equal(r.routeSource, 'osrm')
    assert.ok(['low', 'medium', 'high'].includes(r.overallRisk))
    assert.ok(r.zonesInRoute.length > 0)

    // Política de uso de Nominatim: identificación propia y solo dentro de Bogotá.
    const [c] = nominatim.consultas
    assert.match(c.userAgent, /^SafeWay\//)
    assert.equal(c.params.bounded, '1')
    assert.ok(c.params.viewbox)
})

test('el nombre de una localidad sigue funcionando sin llamar a Nominatim', async (t) => {
    const { api, nominatim } = await montar(t)
    const r = await (await analizar(api, 'Suba', 'santa')).json()
    assert.equal(r.origin.name, 'Suba')
    assert.equal(r.origin.source, 'localidad')
    assert.equal(r.destination.name, 'Santa Fe')
    assert.equal(nominatim.consultas.length, 0)
})

test('perfil de OSRM por medio: bici -> bike, peatón -> foot, el resto -> car', async (t) => {
    const { api, osrm } = await montar(t)
    for (const [medio, perfil] of [['bici', 'bike'], ['peatón', 'foot'], ['moto', 'car'], ['publico', 'car'], ['carro', 'car']]) {
        const r = await (await analizar(api, 'Suba', 'Kennedy', medio)).json()
        assert.equal(r.routeProfile, perfil, medio)
        assert.equal(osrm.pedidos.at(-1).perfil, perfil, medio)
    }
})

test('CRITERIO: con OSRM colgado responde en < 5 s con línea recta', async (t) => {
    const { api } = await montar(t, { osrm: { colgado: true } })
    const inicio = Date.now()
    const r = await (await analizar(api, 'Calle 72 # 7-30', 'Kennedy')).json()
    const s = (Date.now() - inicio) / 1000
    assert.ok(s < 5, `tardó ${s.toFixed(1)} s`)
    assert.equal(r.routeSource, 'straight-line')
    assert.equal(r.routeCoordinates.length, 2)
})

test('con Nominatim colgado responde 503 en < 5 s, sin quedarse esperando', async (t) => {
    const { api } = await montar(t, { nominatim: { colgado: true } })
    const inicio = Date.now()
    const res = await analizar(api, 'Calle 72 # 7-30', 'Kennedy')
    assert.ok(Date.now() - inicio < 5000)
    assert.equal(res.status, 503)
    assert.equal((await res.json()).code, 'geocodificacion_no_disponible')
})

test('dirección no encontrada o fuera de Bogotá -> 404 que dice cuál', async (t) => {
    const { api } = await montar(t)
    const noExiste = await analizar(api, 'Suba', 'Calle inventada 999')
    assert.equal(noExiste.status, 404)
    assert.match((await noExiste.json()).error, /destino/)

    const fuera = await analizar(api, 'Centro de Medellin', 'Kennedy')
    assert.equal(fuera.status, 404)
    assert.match((await fuera.json()).error, /origen/)
})

test('caché: la misma dirección no se le vuelve a pedir a Nominatim', async (t) => {
    const { api, nominatim } = await montar(t)
    await analizar(api, 'Parque de la 93', 'Kennedy')
    await analizar(api, 'parque de la 93', 'Suba')
    assert.equal(nominatim.consultas.length, 1)
})

test('máximo 1 petición por segundo a Nominatim, aunque lleguen juntas', async (t) => {
    const { api, nominatim } = await montar(t)
    await analizar(api, 'Calle 72 # 7-30', 'Plaza de Kennedy')
    const [a, b] = nominatim.consultas
    assert.ok(b.at - a.at >= 950, `separadas por ${b.at - a.at} ms`)
})

test('dirección muy larga -> 400', async (t) => {
    const { api } = await montar(t)
    assert.equal((await analizar(api, 'x'.repeat(201), 'Suba')).status, 400)
})

// ---------- Issue #7: los análisis quedan en los indicadores ----------

test('CRITERIO #7: N análisis -> el resumen refleja N, con p90 numérico', async (t) => {
    const supa = await supabaseFalso()
    t.after(supa.cerrar)
    const { api } = await montar(t, {
        env: { SUPABASE_URL: supa.url, SUPABASE_KEY: 'k', SUPABASE_SECRET_KEY: 's' }
    })

    const N = 5
    for (let i = 0; i < N; i++) {
        assert.equal((await analizar(api, 'Suba', 'Kennedy', i % 2 ? 'bici' : 'carro')).status, 200)
    }
    // La métrica se guarda después de responder: se le da un momento.
    for (let i = 0; i < 20 && supa.filas.length < N; i++) await new Promise(r => setTimeout(r, 50))

    assert.equal(supa.filas.length, N)
    assert.ok(supa.filas.every(f => !('lat' in f) && !('user_id' in f) && f.origin_locality === 'Suba'))

    const { data } = await (await api.get('/api/metrics/resumen')).json()
    assert.equal(data.totalConsultas, N)
    assert.equal(typeof data.duracionMs.p90, 'number')
    assert.equal(data.porcentajeRespaldo, 100)    // el falso no tiene localidades: respaldo
    assert.equal(data.porcentajeRutaReal, 100)
})
