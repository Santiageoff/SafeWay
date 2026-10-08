// RF-02 · EDT 3.3 — "El sistema opera sin interrupción al simular falla de Supabase"
// ADR-002 — Supabase como fuente principal, con dataset de respaldo.
//
// Se levanta la API real (src/app.js) con Supabase inalcanzable y se consulta
// por HTTP, igual que lo haría el frontend.

const test = require('node:test')
const assert = require('node:assert/strict')

const http = require('node:http')

const { levantarApi } = require('../test-utils/api')
const { localities } = require('../src/data/localities')

// Un puerto donde nadie escucha: la conexión se rechaza al instante.
const SUPABASE_CAIDO = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'llave-de-prueba', SUPABASE_ANON_KEY: '' }
// Un falso Supabase que acepta la conexión y nunca contesta (se "cuelga"),
// hasta que la prueba lo "revive" y empieza a responder como PostgREST.
async function supabaseColgado() {
    let vivo = false
    const server = http.createServer((req, res) => {
        if (!vivo) return  // acepta y no responde nunca
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(localities.map(l => ({
            id: l.id, name: l.name, lat: l.coordinates[0], lng: l.coordinates[1],
            risk_level: l.riskLevel, vehicle_risks: l.vehicleRisks || {},
            source: 'supabase-falso'
        }))))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        revivir: () => { vivo = true },
        cerrar: () => new Promise(resolve => {
            server.closeAllConnections()
            server.close(resolve)
        })
    }
}

const SUPABASE_SIN_CONFIGURAR = { SUPABASE_URL: '', SUPABASE_KEY: '', SUPABASE_ANON_KEY: '' }

test('Supabase caído: el mapa sigue con las 20 localidades y avisa que es respaldo', async (t) => {
    const api = await levantarApi(SUPABASE_CAIDO)
    t.after(api.cerrar)

    const res = await api.get('/api/risk/zones')
    assert.equal(res.status, 200)
    const cuerpo = await res.json()
    assert.equal(cuerpo.success, true)
    assert.equal(cuerpo.total, 20)
    assert.equal(cuerpo.data.length, 20)
    assert.equal(cuerpo.meta.localitySource, 'respaldo-local')

    const salud = await (await api.get('/health')).json()
    assert.equal(salud.storage.supabaseReachable, false, '/health debe reportar que Supabase no responde')
})

test('Supabase sin configurar (sin .env): también responde con el respaldo', async (t) => {
    const api = await levantarApi(SUPABASE_SIN_CONFIGURAR)
    t.after(api.cerrar)

    const cuerpo = await (await api.get('/api/risk/zones?mode=moto')).json()
    assert.equal(cuerpo.total, 20)
    assert.equal(cuerpo.meta.localitySource, 'respaldo-local')
    assert.equal(cuerpo.meta.mode, 'moto')
})

test('los endpoints de detalle funcionan con el respaldo', async (t) => {
    const api = await levantarApi(SUPABASE_CAIDO)
    t.after(api.cerrar)

    const porId = await api.get('/api/risk/zones/1')
    assert.equal(porId.status, 200)
    assert.equal((await porId.json()).data.id, 1)

    assert.equal((await api.get('/api/risk/zones/999')).status, 404)

    const busqueda = await (await api.get('/api/risk/search?q=suba')).json()
    assert.ok(busqueda.data.some(z => z.name === 'Suba'), 'la búsqueda no encontró Suba')
})

test('POST /api/route/analyze valida la entrada antes de calcular', async (t) => {
    const api = await levantarApi(SUPABASE_CAIDO)
    t.after(api.cerrar)

    const vacio = await api.post('/api/route/analyze', {})
    assert.equal(vacio.status, 400)

    const medioInvalido = await api.post('/api/route/analyze',
        { origin: 'Suba', destination: 'Kennedy', vehicleType: 'avion' })
    assert.equal(medioInvalido.status, 400)
})

test('Supabase colgado (acepta la conexión y no responde): conmuta al respaldo en < 5 s', async (t) => {
    const falso = await supabaseColgado()
    t.after(falso.cerrar)
    const api = await levantarApi({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'llave-de-prueba', SUPABASE_ANON_KEY: '' })
    t.after(api.cerrar)

    const inicio = Date.now()
    const res = await api.get('/api/risk/zones')
    const segundos = (Date.now() - inicio) / 1000
    assert.equal(res.status, 200)
    const cuerpo = await res.json()
    assert.ok(segundos < 5, `tardó ${segundos.toFixed(1)} s (máximo 5 s)`)
    assert.equal(cuerpo.total, 20)
    assert.equal(cuerpo.meta.localitySource, 'respaldo-local')

    const salud = await (await api.get('/health')).json()
    assert.equal(salud.storage.supabaseReachable, false, '/health no debe quedarse esperando')
})

test('cuando Supabase vuelve, se retoma sin esperar los 5 min de caché', async (t) => {
    const falso = await supabaseColgado()
    t.after(falso.cerrar)
    // Timeout y reintento cortos para que la prueba no tarde 30 s.
    const api = await levantarApi({
        SUPABASE_URL: falso.url, SUPABASE_KEY: 'llave-de-prueba', SUPABASE_ANON_KEY: '',
        SUPABASE_TIMEOUT_MS: '500', SUPABASE_RETRY_MS: '1000'
    })
    t.after(api.cerrar)

    const antes = await (await api.get('/api/risk/zones')).json()
    assert.equal(antes.meta.localitySource, 'respaldo-local')

    falso.revivir()
    await new Promise(resolve => setTimeout(resolve, 1200))

    const despues = await (await api.get('/api/risk/zones')).json()
    assert.equal(despues.meta.localitySource, 'supabase')
    assert.equal(despues.total, 20)
})

// Pendientes: se vuelven pruebas reales cuando se cierre su orden de trabajo.
test.todo('POST /api/route/analyze con origin no textual responde 400, no 500')
test.todo('POST /api/route/analyze sin sesión responde 200 — necesita OSRM configurable por variable de entorno')
