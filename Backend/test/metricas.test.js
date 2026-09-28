// Issue #7 · III.F del documento — indicadores del análisis de rutas.
//
// Criterio: N análisis -> el resumen refleja N, con p90 numérico; y medir nunca
// tumba la respuesta. Se usa un Supabase falso (PostgREST mínimo en memoria).

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { levantarApi } = require('../test-utils/api')

// PostgREST falso: guarda los INSERT de route_metrics y los devuelve en los GET.
// Con `colgado` acepta la conexión y no contesta nunca.
async function supabaseFalso({ colgado = false } = {}) {
    const filas = []
    const server = http.createServer((req, res) => {
        if (colgado) return
        let cuerpo = ''
        req.on('data', d => { cuerpo += d })
        req.on('end', () => {
            if (!req.url.startsWith('/rest/v1/route_metrics')) {
                res.statusCode = 404
                return res.end('{}')
            }
            res.setHeader('Content-Type', 'application/json')
            if (req.method === 'POST') {
                const nuevas = [].concat(JSON.parse(cuerpo))
                filas.push(...nuevas.map(f => ({ ...f, created_at: new Date().toISOString() })))
                res.statusCode = 201
                return res.end()
            }
            res.end(JSON.stringify(filas))
        })
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        filas,
        cerrar: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })
    }
}

// Carga metricsService con estas variables de entorno (los clientes de
// Supabase se crean al cargar el módulo, así que hay que recargarlo).
function cargarMetrics(env) {
    Object.assign(process.env, { SUPABASE_ANON_KEY: '', ...env })
    for (const k of Object.keys(require.cache)) {
        if (k.includes(`${require('node:path').sep}src${require('node:path').sep}`)) delete require.cache[k]
    }
    return require('../src/services/metricsService')
}

const analisis = (i) => ({
    mode: 'moto', originLocality: 'Suba', destinationLocality: 'Kennedy',
    durationMs: 100 * (i + 1), localitySource: i % 4 === 0 ? 'respaldo-local' : 'supabase',
    routeSource: 'osrm', overallRisk: i % 2 === 0 ? 'high' : 'low', evitaAlto: i % 2 !== 0
})

// ---------- Funciones puras ----------

test('resumir: N filas -> total N, p50/p90 numéricos y porcentajes', () => {
    const { resumir, filaDesde } = cargarMetrics({})
    const filas = Array.from({ length: 10 }, (_, i) => filaDesde(analisis(i)))
    const r = resumir(filas)
    assert.equal(r.totalConsultas, 10)
    assert.equal(r.duracionMs.p50, 500)
    assert.equal(r.duracionMs.p90, 900)
    assert.equal(r.porcentajeRespaldo, 30)     // i = 0, 4, 8
    assert.equal(r.porcentajeEvitaAlto, 50)
    assert.equal(r.porcentajeRutaReal, 100)
})

test('resumir sin filas no divide por cero', () => {
    const { resumir } = cargarMetrics({})
    const r = resumir([])
    assert.equal(r.totalConsultas, 0)
    assert.equal(r.duracionMs.p90, null)
    assert.equal(r.porcentajeRespaldo, null)
})

test('filaDesde descarta coordenadas, IP y user_id (Ley 1581)', () => {
    const { filaDesde } = cargarMetrics({})
    const fila = filaDesde({
        ...analisis(1), lat: 4.7, lng: -74.1, origin: [4.7, -74.1], userId: 'abc', user_id: 'abc', ip: '1.2.3.4'
    })
    assert.deepEqual(Object.keys(fila).sort(), [
        'destination_locality', 'duration_ms', 'evita_alto', 'locality_source',
        'mode', 'origin_locality', 'overall_risk', 'route_source'
    ])
})

test('evitaAlto usa el riesgo del medio de transporte', () => {
    const { evitaAlto } = cargarMetrics({})
    const zonas = [{ riskLevel: 'low', vehicleRisks: { moto: 'high', carro: 'low' } }]
    assert.equal(evitaAlto(zonas, 'moto'), false)
    assert.equal(evitaAlto(zonas, 'carro'), true)
    assert.equal(evitaAlto([], 'moto'), true)
})

// ---------- Registro ----------

test('N análisis registrados -> el resumen refleja N, con p90 numérico', async (t) => {
    const falso = await supabaseFalso()
    t.after(falso.cerrar)
    const metrics = cargarMetrics({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k', SUPABASE_SECRET_KEY: 's' })

    const N = 7
    for (let i = 0; i < N; i++) assert.equal(await metrics.registrar(analisis(i)), true)
    assert.equal(falso.filas.length, N)
    assert.ok(falso.filas.every(f => !('lat' in f) && !('user_id' in f)))

    const r = await metrics.obtenerResumen()
    assert.equal(r.totalConsultas, N)
    assert.equal(typeof r.duracionMs.p90, 'number')
})

test('registrar nunca lanza: sin llave secreta devuelve false', async () => {
    const metrics = cargarMetrics({ SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'k', SUPABASE_SECRET_KEY: '' })
    assert.equal(await metrics.registrar(analisis(0)), false)
})

test('registrar nunca lanza: con Supabase colgado devuelve false en < 5 s', async (t) => {
    const falso = await supabaseFalso({ colgado: true })
    t.after(falso.cerrar)
    const metrics = cargarMetrics({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k', SUPABASE_SECRET_KEY: 's' })
    const inicio = Date.now()
    assert.equal(await metrics.registrar(analisis(0)), false)
    assert.ok(Date.now() - inicio < 5000)
})

// ---------- Endpoint ----------

test('GET /api/metrics/resumen devuelve solo agregados', async (t) => {
    const falso = await supabaseFalso()
    t.after(falso.cerrar)
    const metrics = cargarMetrics({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k', SUPABASE_SECRET_KEY: 's' })
    for (let i = 0; i < 4; i++) await metrics.registrar(analisis(i))

    const api = await levantarApi({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '', SUPABASE_SECRET_KEY: 's' })
    t.after(api.cerrar)

    const res = await api.get('/api/metrics/resumen?dias=7')
    assert.equal(res.status, 200)
    const { data } = await res.json()
    assert.equal(data.totalConsultas, 4)
    assert.equal(data.dias, 7)
    assert.equal(typeof data.duracionMs.p90, 'number')
    assert.ok(!('filas' in data) && !Array.isArray(data), 'no debe devolver filas individuales')

    assert.equal((await api.get('/api/metrics/resumen?dias=0')).status, 400)
})

test('GET /api/metrics/resumen sin llave secreta responde 503, no 500', async (t) => {
    const api = await levantarApi({ SUPABASE_URL: '', SUPABASE_KEY: '', SUPABASE_ANON_KEY: '' })
    t.after(api.cerrar)
    const res = await api.get('/api/metrics/resumen')
    assert.equal(res.status, 503)
    assert.equal((await res.json()).code, 'metricas_no_disponibles')
})

// Pendiente: se vuelve prueba real cuando el análisis de ruta llame a
// metrics.registrar (después de #2, #5 y #6, que reorganizan route.route.js).
test.todo('N llamadas a POST /api/route/analyze -> el resumen refleja N; con Supabase caído el análisis sigue respondiendo')
