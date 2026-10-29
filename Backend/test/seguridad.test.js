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
