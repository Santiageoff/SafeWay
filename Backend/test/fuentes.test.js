// Issue #4 · Anexo A y IV — fuentes de datos complementarias.
//
// Criterio: la consulta devuelve al menos una fila por cada una de las tres
// fuentes (hurto a vehículos, a residencias, en transporte público) para las
// localidades cargadas. Se usa un Supabase falso, igual que en metricas.test.js.

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { levantarApi } = require('../test-utils/api')

// PostgREST falso: sirve locality_crime_sources y transit_incident_counts
// con datos fijos, sin importar el `select` exacto que mande supabase-js.
async function supabaseFalso({ conTransporte = true } = {}) {
    const crimenes = [
        { locality_id: 8, source_type: 'hurto_automotores', period: '2026-ene-ago', count: 352, source: 'SDSCJ', localities: { name: 'Kennedy' } },
        { locality_id: 8, source_type: 'hurto_motocicletas', period: '2026-ene-ago', count: 360, source: 'SDSCJ', localities: { name: 'Kennedy' } },
        { locality_id: 8, source_type: 'hurto_residencias', period: '2026-ene-ago', count: 469, source: 'SDSCJ', localities: { name: 'Kennedy' } },
        { locality_id: 20, source_type: 'hurto_automotores', period: '2026-ene-ago', count: 0, source: 'SDSCJ', localities: { name: 'Sumapaz' } },
        { locality_id: 20, source_type: 'hurto_motocicletas', period: '2026-ene-ago', count: 0, source: 'SDSCJ', localities: { name: 'Sumapaz' } },
        { locality_id: 20, source_type: 'hurto_residencias', period: '2026-ene-ago', count: 0, source: 'SDSCJ', localities: { name: 'Sumapaz' } }
    ]
    const transporte = conTransporte ? [{ locality_id: 8, count: 3 }] : []

    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.url.startsWith('/rest/v1/locality_crime_sources')) return res.end(JSON.stringify(crimenes))
        if (req.url.startsWith('/rest/v1/transit_incident_counts')) return res.end(JSON.stringify(transporte))
        res.statusCode = 404
        res.end('{}')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        cerrar: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })
    }
}

function cargarSources(env) {
    Object.assign(process.env, { SUPABASE_ANON_KEY: '', SUPABASE_SECRET_KEY: '', ...env })
    for (const k of Object.keys(require.cache)) {
        if (k.includes(`${require('node:path').sep}src${require('node:path').sep}`)) delete require.cache[k]
    }
    return require('../src/services/sourcesService')
}

// ---------- Servicio ----------

test('getAll: al menos una fila por cada una de las tres fuentes', async (t) => {
    const falso = await supabaseFalso()
    t.after(falso.cerrar)
    const sources = cargarSources({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k' })

    const zonas = await sources.getAll()
    assert.equal(zonas.length, 2)

    const kennedy = zonas.find(z => z.localityId === 8)
    assert.equal(kennedy.localityName, 'Kennedy')
    assert.ok(kennedy.hurtoAutomotores > 0)
    assert.ok(kennedy.hurtoMotocicletas > 0)
    assert.ok(kennedy.hurtoResidencias > 0)
    assert.ok(kennedy.hurtoTransportePublico > 0)
})

test('getAll: sin reportes de transporte esa fuente queda en 0, no rompe las demás', async (t) => {
    const falso = await supabaseFalso({ conTransporte: false })
    t.after(falso.cerrar)
    const sources = cargarSources({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k' })

    const zonas = await sources.getAll()
    const kennedy = zonas.find(z => z.localityId === 8)
    assert.equal(kennedy.hurtoTransportePublico, 0)
    assert.ok(kennedy.hurtoAutomotores > 0, 'las otras dos fuentes siguen presentes')
})

test('getByLocality: localidad sin datos devuelve null, no lanza', async (t) => {
    const falso = await supabaseFalso()
    t.after(falso.cerrar)
    const sources = cargarSources({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k' })

    assert.equal(await sources.getByLocality(1), null)
    assert.equal((await sources.getByLocality(20)).localityName, 'Sumapaz')
})

// ---------- Endpoint ----------

test('GET /api/sources devuelve las localidades con las tres fuentes', async (t) => {
    const falso = await supabaseFalso()
    t.after(falso.cerrar)
    const api = await levantarApi({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '' })
    t.after(api.cerrar)

    const res = await api.get('/api/sources')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.total, 2)
    assert.ok(body.data.some(z => z.hurtoAutomotores > 0))
    assert.ok(body.data.some(z => z.hurtoResidencias > 0))
    assert.ok(body.data.some(z => z.hurtoTransportePublico > 0))
})

test('GET /api/sources/:localityId — 404 si no hay datos, 400 si no es un entero', async (t) => {
    const falso = await supabaseFalso()
    t.after(falso.cerrar)
    const api = await levantarApi({ SUPABASE_URL: falso.url, SUPABASE_KEY: 'k', SUPABASE_ANON_KEY: '' })
    t.after(api.cerrar)

    const ok = await api.get('/api/sources/8')
    assert.equal(ok.status, 200)
    assert.equal((await ok.json()).data.localityName, 'Kennedy')

    assert.equal((await api.get('/api/sources/1')).status, 404)
    assert.equal((await api.get('/api/sources/abc')).status, 400)
})

test('GET /api/sources sin Supabase configurado responde 503, no 500', async (t) => {
    const api = await levantarApi({ SUPABASE_URL: '', SUPABASE_KEY: '', SUPABASE_ANON_KEY: '' })
    t.after(api.cerrar)
    const res = await api.get('/api/sources')
    assert.equal(res.status, 503)
    assert.equal((await res.json()).code, 'fuentes_no_disponibles')
})
