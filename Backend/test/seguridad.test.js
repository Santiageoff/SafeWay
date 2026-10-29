// Paso 2 del plan de seguridad: la API manda sus encabezados de seguridad en
// todas las respuestas, también en los errores, y no anuncia que es Express.

const test = require('node:test')
const assert = require('node:assert/strict')

const { levantarApi } = require('../test-utils/api')

const SUPABASE_CAIDO = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_KEY: 'llave-de-prueba', SUPABASE_ANON_KEY: '' }

let api
test.before(async () => { api = await levantarApi(SUPABASE_CAIDO) })
test.after(async () => { await api?.cerrar() })

function revisarEncabezados(res) {
    assert.match(res.headers.get('strict-transport-security') || '', /max-age=31536000/)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-frame-options'), 'DENY')
    assert.match(res.headers.get('content-security-policy') || '', /default-src 'none'/)
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(res.headers.get('x-powered-by'), null)
}

test('las respuestas normales llevan los encabezados de seguridad', async () => {
    const res = await api.get('/api/risk/zones')
    assert.equal(res.status, 200)
    revisarEncabezados(res)
})

test('los errores también llevan los encabezados de seguridad', async () => {
    const res = await api.post('/api/route/analyze', {})
    assert.equal(res.status, 400)
    revisarEncabezados(res)
})

// Paso 3: límite de peticiones por IP.
test('analizar ruta responde 429 al pasar el límite por minuto', async () => {
    const limitada = await levantarApi({ ...SUPABASE_CAIDO, RATE_LIMIT_ANALYZE_PER_MIN: '3' })
    try {
        const estados = []
        for (let i = 0; i < 4; i++) estados.push((await limitada.post('/api/route/analyze', {})).status)
        assert.deepEqual(estados.slice(0, 3), [400, 400, 400])
        assert.equal(estados[3], 429)

        const res = await limitada.post('/api/route/analyze', {})
        assert.equal(res.status, 429)
        assert.ok(Number(res.headers.get('retry-after')) > 0)
        const cuerpo = await res.json()
        assert.equal(cuerpo.code, 'rate_limited')
        assert.match(cuerpo.error, /Intenta de nuevo/)

        // El resto de la API sigue respondiendo: el límite es por ruta.
        assert.equal((await limitada.get('/api/risk/zones')).status, 200)
    } finally {
        await limitada.cerrar()
    }
})

test('/health no tiene límite (lo usa el workflow que mantiene despierto a Render)', async () => {
    const limitada = await levantarApi({ ...SUPABASE_CAIDO, RATE_LIMIT_API_PER_MIN: '2' })
    try {
        for (let i = 0; i < 4; i++) assert.equal((await limitada.get('/health')).status, 200)
        assert.equal((await limitada.get('/api/risk/zones')).status, 200)
        assert.equal((await limitada.get('/api/risk/zones')).status, 200)
        assert.equal((await limitada.get('/api/risk/zones')).status, 429)
    } finally {
        await limitada.cerrar()
    }
})
