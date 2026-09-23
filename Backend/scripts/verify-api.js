// Prueba la API por HTTP, como la usaria el navegador de verdad.
//
//   npm run verify:api        (con el backend corriendo en el puerto 3001)
//
// Complementa a verify-rls.js: aquel prueba las politicas de la base, este
// prueba que el backend las respete y que lo publico siga siendo publico.
// Crea dos usuarios, los usa, y los borra al terminar.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')

const API = process.env.API_URL || 'http://localhost:3001'
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

let ok = 0, mal = 0
const fallos = []
const check = (n, c, d = '') => {
    if (c) { ok++; console.log('  OK    ' + n) }
    else { mal++; fallos.push(n); console.log('  FALLA ' + n + (d ? '  (' + d + ')' : '')) }
}

const PASSWORD = 'PruebaApi#2026'

async function crearUsuario(tag) {
    const email = `e2e-${tag}-${Date.now()}@example.com`
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw new Error('no se pudo crear el usuario: ' + error.message)
    const cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } })
    const { data: s, error: e2 } = await cliente.auth.signInWithPassword({ email, password: PASSWORD })
    if (e2) throw new Error('no se pudo iniciar sesion: ' + e2.message)
    return { id: data.user.id, email, token: s.session.access_token }
}

const api = (ruta, opts = {}, token) => fetch(API + ruta, {
    ...opts,
    headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...opts.headers
    }
}).then(async r => ({ status: r.status, json: await r.json().catch(() => ({})) }))

const reporte = (lat, lng, type = 'celular') => ({ method: 'POST', body: JSON.stringify({ lat, lng, type }) })

async function main() {
    console.log('\nSafeWay - prueba de la API por HTTP')
    console.log('===================================')

    let A = null, B = null
    try {
        const salud = await api('/health')
        if (salud.status !== 200) throw new Error('el backend no responde en ' + API + '. Arrancalo con: npm start')

        A = await crearUsuario('a')
        B = await crearUsuario('b')
        console.log('  A: ' + A.email + '\n  B: ' + B.email)

        console.log('\n1. Lo publico sigue siendo publico (sin sesion)')
        const zonas = await api('/api/risk/zones?mode=publico')
        check('el mapa de riesgo carga sin sesion', zonas.status === 200 && zonas.json.total === 20, 'total: ' + zonas.json.total)
        check('las localidades vienen de Supabase', zonas.json.meta?.localitySource === 'supabase', zonas.json.meta?.localitySource)

        const capaInicial = await api('/api/reports')
        check('la capa de puntos carga sin sesion', capaInicial.status === 200)
        check('no expone datos personales',
            !JSON.stringify(capaInicial.json).match(/device_hash|user_id|source_token|description/))

        const ruta = await api('/api/route/analyze', {
            method: 'POST',
            body: JSON.stringify({ origin: 'Suba', destination: 'Chapinero', vehicleType: 'publico' })
        })
        check('el analisis de ruta funciona sin sesion', ruta.status === 200 && Boolean(ruta.json.overallRisk))

        console.log('\n2. Reportar exige sesion')
        const sin = await api('/api/reports', reporte(4.628, -74.1663))
        check('sin sesion -> 401', sin.status === 401 && sin.json.code === 'no_autenticado')

        const basura = await api('/api/reports/mine', {}, 'token-inventado')
        check('con un token falso -> 401', basura.status === 401 && basura.json.code === 'sesion_invalida')

        const creado = await api('/api/reports', reporte(4.628, -74.1663), A.token)
        check('con sesion -> 201', creado.status === 201, 'HTTP ' + creado.status + ' ' + (creado.json.error || ''))
        const idA = creado.json.report?.id
        check('el reporte queda a nombre de A', creado.json.report?.user_id === A.id)
        check('la localidad se deriva del GPS, no del cliente', creado.json.report?.locality === 'Kennedy')
        check('informa cuantos le quedan hoy', creado.json.remainingToday === 4, String(creado.json.remainingToday))

        console.log('\n3. B no puede tocar el reporte de A')
        check('B no lo edita',
            (await api('/api/reports/' + idA, { method: 'PATCH', body: JSON.stringify({ description: 'intruso' }) }, B.token)).status === 404)
        check('B no lo cancela',
            (await api('/api/reports/' + idA, { method: 'DELETE' }, B.token)).status === 404)

        const mineB = await api('/api/reports/mine', {}, B.token)
        check('B no lo ve entre los suyos', mineB.json.data?.length === 0, 'vio ' + mineB.json.data?.length)
        const mineA = await api('/api/reports/mine', {}, A.token)
        check('A si lo ve entre los suyos', mineA.json.data?.length === 1)

        console.log('')
        console.log('4. El limite diario ahora es por usuario, no por dispositivo')
        // Coordenadas distintas para que no se agrupen como un solo hecho.
        for (let i = 0; i < 4; i++) {
            await api('/api/reports', reporte(4.63 + i * 0.01, -74.16 - i * 0.01), A.token)
        }
        const sexto = await api('/api/reports', reporte(4.70, -74.10), A.token)
        check('el 6o de A se rechaza con 429', sexto.status === 429, 'HTTP ' + sexto.status)
        check('el mensaje recuerda el 123', /123/.test(sexto.json.error || ''))

        const primeroB = await api('/api/reports', reporte(4.72, -74.09), B.token)
        check('el limite de A no afecta a B', primeroB.status === 201, 'HTTP ' + primeroB.status)

        console.log('')
        console.log('5. Los reportes nuevos se ven en el mapa publico')
        const capaFinal = await api('/api/reports')
        check('aparecen sin necesidad de sesion', capaFinal.json.count > capaInicial.json.count,
            capaInicial.json.count + ' -> ' + capaFinal.json.count)
        check('siguen sin exponer datos personales',
            !JSON.stringify(capaFinal.json).match(/device_hash|user_id|source_token|description/))
    } catch (err) {
        console.error('\nLa prueba se rompio:', err.message)
        mal++
        fallos.push('excepcion: ' + err.message)
    }

    return { A, B }
}

async function limpiar({ A, B }) {
    for (const u of [A, B]) {
        if (!u) continue
        await admin.from('reports').delete().eq('user_id', u.id)
        await admin.auth.admin.deleteUser(u.id).catch(() => {})
    }
}

main()
    .then(limpiar)
    .then(() => {
        console.log('')
        console.log('Usuarios de prueba eliminados.')
        console.log('===================================')
        if (mal === 0) {
            console.log(ok + ' comprobaciones, todas pasaron.')
            console.log('Lo publico sigue publico y lo privado exige sesion.')
        } else {
            console.log(ok + ' pasaron, ' + mal + ' FALLARON:')
            for (const f of fallos) console.log('  - ' + f)
        }
        console.log('')
        process.exitCode = mal > 0 ? 1 : 0
    })
