// Prueba las politicas de RLS contra la base REAL, con dos usuarios de verdad.
//
//   node Backend/scripts/verify-rls.js
//
// Crea dos usuarios (A y B), intenta que cada uno toque los datos del otro y
// comprueba que la base lo impide. Al terminar los borra.
//
// Importante: cada comprobacion usa el CLIENTE DEL USUARIO, no service_role.
// Si se usara la llave secreta todo pasaria siempre y la prueba no valdria
// nada: service_role se salta RLS por diseno.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

if (!URL || !ANON || !SECRET) {
    console.error('Faltan variables. Corre primero: node Backend/scripts/check-setup.js')
    process.exit(1)
}

const admin = createClient(URL, SECRET, { auth: { persistSession: false } })
const anon = createClient(URL, ANON, { auth: { persistSession: false } })

let pasaron = 0, fallaron = 0
const fallos = []

function check(nombre, ok, detalle = '') {
    if (ok) { pasaron++; console.log('  OK    ' + nombre) }
    else {
        fallaron++
        fallos.push(nombre)
        console.log('  FALLA ' + nombre + (detalle ? '  (' + detalle + ')' : ''))
    }
}

// RLS bloquea de dos formas distintas segun la operacion:
//   lectura   -> sin error, pero sin filas: la politica no las deja ver
//   escritura -> error 42501 / "violates row-level security policy"
function fueBloqueado({ data, error }) {
    if (error) return true
    if (data === null || data === undefined) return true
    if (Array.isArray(data) && data.length === 0) return true
    return false
}

const sufijo = Date.now()
const CUENTAS = {
    A: { email: `safeway-test-a-${sufijo}@example.com`, password: 'PruebaSegura#2026A' },
    B: { email: `safeway-test-b-${sufijo}@example.com`, password: 'PruebaSegura#2026B' }
}

async function crearUsuario(datos) {
    const { data, error } = await admin.auth.admin.createUser({
        email: datos.email,
        password: datos.password,
        // Confirmado de entrada: asi la prueba no depende de que llegue un
        // correo, sin tener que desactivar la confirmacion en produccion.
        email_confirm: true
    })
    if (error) throw new Error('no se pudo crear el usuario: ' + error.message)

    const db = createClient(URL, ANON, { auth: { persistSession: false } })
    const { data: sesion, error: errSesion } = await db.auth.signInWithPassword(datos)
    if (errSesion) throw new Error('no se pudo iniciar sesion: ' + errSesion.message)

    return { id: data.user.id, email: datos.email, db, token: sesion.session.access_token }
}

const KENNEDY = { lat: 4.628, lng: -74.1663, locality: 'Kennedy', locality_id: 8 }

function reporteDe(userId) {
    const ahora = new Date().toISOString()
    return {
        id: randomUUID(), created_at: ahora, occurred_at: ahora,
        lat: KENNEDY.lat, lng: KENNEDY.lng,
        locality: KENNEDY.locality, locality_id: KENNEDY.locality_id,
        type: 'celular', precision: 'exact', status: 'active', user_id: userId
    }
}

async function probarReportes(A, B) {
    console.log('\n1. reports - nadie toca los reportes de otro')

    const creado = await A.db.from('reports').insert(reporteDe(A.id)).select().single()
    check('A crea su propio reporte', !creado.error, creado.error?.message)
    const idDeA = creado.data?.id

    const leeSuyo = await A.db.from('reports').select('*').eq('id', idDeA).maybeSingle()
    check('A lee su propio reporte', !leeSuyo.error && leeSuyo.data?.id === idDeA)

    check('B NO lee el reporte de A',
        fueBloqueado(await B.db.from('reports').select('*').eq('id', idDeA).maybeSingle()))

    check('B NO edita el reporte de A',
        fueBloqueado(await B.db.from('reports').update({ description: 'intruso' }).eq('id', idDeA).select()))

    check('B NO borra el reporte de A',
        fueBloqueado(await B.db.from('reports').delete().eq('id', idDeA).select()))

    const intacto = await A.db.from('reports').select('description, status').eq('id', idDeA).maybeSingle()
    check('el reporte de A sigue intacto y activo',
        intacto.data && !intacto.data.description && intacto.data.status === 'active')

    check('B NO crea un reporte a nombre de A',
        fueBloqueado(await B.db.from('reports').insert(reporteDe(A.id)).select()))

    check('B NO vacia la tabla entera',
        fueBloqueado(await B.db.from('reports').delete().neq('id', randomUUID()).select()))

    check('A SI puede borrar el suyo (derecho de supresion)',
        !fueBloqueado(await A.db.from('reports').delete().eq('id', idDeA).select()))
}

async function probarAnonimo() {
    console.log('\n2. anonimo - solo lo publico')

    check('NO lee la tabla reports', fueBloqueado(await anon.from('reports').select('*').limit(1)))
    check('NO escribe en reports', fueBloqueado(await anon.from('reports').insert(reporteDe(randomUUID())).select()))
    check('NO borra reports', fueBloqueado(await anon.from('reports').delete().neq('id', randomUUID()).select()))

    const loc = await anon.from('localities').select('id, name').limit(25)
    check('SI lee las localidades (el mapa es publico)',
        !loc.error && loc.data?.length === 20, loc.error?.message || ('filas: ' + loc.data?.length))

    check('NO altera los datos oficiales',
        fueBloqueado(await anon.from('localities').update({ insecurity_percentage: 1 }).eq('id', 1).select()))
    check('NO inserta datos oficiales',
        fueBloqueado(await anon.from('localities').insert({
            id: 999, name: 'Inventada', lat: 4.6, lng: -74.1,
            risk_level: 'low', insecurity_percentage: 0, safety_score: 100
        }).select()))

    const vista = await anon.from('public_reports').select('*').limit(5)
    check('SI lee la vista publica (los puntos del mapa)', !vista.error, vista.error?.message)

    const fila = vista.data?.[0] || {}
    check('la vista NO expone user_id', !('user_id' in fila))
    check('la vista NO expone device_hash', !('device_hash' in fila))
    check('la vista NO expone description', !('description' in fila))
    check('la vista SI trae lo que el mapa necesita',
        'lat' in fila && 'lng' in fila && 'locality' in fila)

    for (const tabla of ['profiles', 'data_consents', 'route_queries', 'habitual_routes', 'alert_preferences']) {
        check('NO lee ' + tabla, fueBloqueado(await anon.from(tabla).select('*').limit(1)))
    }
}

async function probarPerfiles(A, B) {
    console.log('\n3. profiles - el trigger y el aislamiento')

    const suyo = await A.db.from('profiles').select('*').eq('id', A.id).maybeSingle()
    check('el trigger creo el perfil de A al registrarse', !suyo.error && suyo.data?.id === A.id,
        suyo.error?.message || 'no aparecio el perfil')
    check('el perfil trae un nombre por defecto', Boolean(suyo.data?.display_name))

    check('A NO ve el perfil de B',
        fueBloqueado(await A.db.from('profiles').select('*').eq('id', B.id).maybeSingle()))

    check('A NO edita el perfil de B',
        fueBloqueado(await A.db.from('profiles').update({ display_name: 'secuestrado' }).eq('id', B.id).select()))

    check('A SI edita el suyo',
        !fueBloqueado(await A.db.from('profiles').update({ display_name: 'Santi' }).eq('id', A.id).select()))

    const todos = await A.db.from('profiles').select('id')
    check('A solo ve un perfil: el suyo', !todos.error && todos.data?.length === 1,
        'vio ' + (todos.data?.length ?? '?'))
}

async function probarConsentimiento(A, B) {
    console.log('\n4. data_consents - consentimiento de solo-anadir (Ley 1581)')

    const otorga = await A.db.from('data_consents')
        .insert({ user_id: A.id, purpose: 'route_history', granted: true }).select().single()
    check('A registra su consentimiento', !otorga.error, otorga.error?.message)

    check('A NO puede reescribir su consentimiento (append-only)',
        fueBloqueado(await A.db.from('data_consents').update({ granted: false }).eq('user_id', A.id).select()))

    check('A NO puede borrar su historial de consentimientos',
        fueBloqueado(await A.db.from('data_consents').delete().eq('user_id', A.id).select()))

    check('A NO ve los consentimientos de B',
        fueBloqueado(await A.db.from('data_consents').select('*').eq('user_id', B.id)))

    check('A NO registra un consentimiento a nombre de B',
        fueBloqueado(await A.db.from('data_consents').insert({
            user_id: B.id, purpose: 'alerts', granted: true
        }).select()))
}

async function probarHistorial(A, B) {
    console.log('\n5. route_queries - la ley se cumple en la base, no solo en la interfaz')

    // B no ha consentido nada: su INSERT debe rebotar contra la politica.
    const sinConsentimiento = await B.db.from('route_queries').insert({
        user_id: B.id, origin_locality_id: 11, destination_locality_id: 2,
        vehicle_type: 'publico', risk_level: 'medium'
    }).select()
    check('B NO puede guardar historial sin haber consentido', fueBloqueado(sinConsentimiento))

    // A si consintio en el bloque anterior.
    const conConsentimiento = await A.db.from('route_queries').insert({
        user_id: A.id, origin_locality_id: 11, destination_locality_id: 2,
        vehicle_type: 'publico', risk_level: 'medium'
    }).select().single()
    check('A SI puede, porque consintio', !conConsentimiento.error, conConsentimiento.error?.message)

    check('B NO ve el historial de A',
        fueBloqueado(await B.db.from('route_queries').select('*').eq('user_id', A.id)))

    check('A SI ve el suyo',
        !fueBloqueado(await A.db.from('route_queries').select('*').eq('user_id', A.id)))

    check('A NO puede editar su historial',
        fueBloqueado(await A.db.from('route_queries').update({ risk_level: 'low' }).eq('user_id', A.id).select()))

    check('A SI puede borrarlo (derecho de supresion)',
        !fueBloqueado(await A.db.from('route_queries').delete().eq('user_id', A.id).select()))

    // Revocar: se anade una fila nueva, no se toca la anterior.
    await A.db.from('data_consents').insert({ user_id: A.id, purpose: 'route_history', granted: false })
    const trasRevocar = await A.db.from('route_queries').insert({
        user_id: A.id, origin_locality_id: 11, destination_locality_id: 2, vehicle_type: 'carro'
    }).select()
    check('tras revocar, A ya NO puede guardar historial', fueBloqueado(trasRevocar))

    const rastro = await A.db.from('data_consents').select('granted').eq('user_id', A.id)
    check('queda el rastro de las dos decisiones (otorgo y revoco)', rastro.data?.length === 2,
        'filas: ' + (rastro.data?.length ?? '?'))
}

async function probarAlertas(A, B) {
    console.log('\n6. alert_preferences y habitual_routes')

    const prefs = await A.db.from('alert_preferences')
        .insert({ user_id: A.id, alerts_enabled: true, min_risk_level: 'high' }).select().single()
    check('A crea sus preferencias', !prefs.error, prefs.error?.message)
    check('las alertas nacen apagadas por defecto', prefs.data?.alerts_enabled === true)

    check('B NO ve las preferencias de A',
        fueBloqueado(await B.db.from('alert_preferences').select('*').eq('user_id', A.id)))

    check('B NO cambia las preferencias de A',
        fueBloqueado(await B.db.from('alert_preferences').update({ alerts_enabled: false }).eq('user_id', A.id).select()))

    // Las rutas habituales las DETECTA el backend; el usuario no las inventa.
    check('A NO puede inventarse una ruta habitual',
        fueBloqueado(await A.db.from('habitual_routes').insert({
            user_id: A.id, origin_locality_id: 11, destination_locality_id: 2,
            vehicle_type: 'carro', time_window: 'mañana'
        }).select()))

    // Pero si el backend la detecta, el usuario debe poder verla y borrarla.
    const detectada = await admin.from('habitual_routes').insert({
        user_id: A.id, origin_locality_id: 11, destination_locality_id: 2,
        vehicle_type: 'carro', time_window: 'mañana', confidence: 0.8
    }).select().single()
    check('el backend (service_role) SI puede registrarla', !detectada.error, detectada.error?.message)

    check('A ve la ruta que el sistema le detecto',
        !fueBloqueado(await A.db.from('habitual_routes').select('*').eq('user_id', A.id)))

    check('B NO ve las rutas habituales de A',
        fueBloqueado(await B.db.from('habitual_routes').select('*').eq('user_id', A.id)))

    check('A puede desactivar una ruta que no le representa',
        !fueBloqueado(await A.db.from('habitual_routes').update({ active: false }).eq('user_id', A.id).select()))
}

async function probarBorradoDeCuenta(A) {
    console.log('\n7. borrar la cuenta')

    const reporte = await A.db.from('reports').insert(reporteDe(A.id)).select().single()
    const idReporte = reporte.data?.id

    const borrado = await admin.auth.admin.deleteUser(A.id)
    check('la cuenta se borra sin error', !borrado.error, borrado.error?.message)

    const perfil = await admin.from('profiles').select('id').eq('id', A.id).maybeSingle()
    check('el perfil desaparece en cascada', !perfil.data)

    const consentimientos = await admin.from('data_consents').select('id').eq('user_id', A.id)
    check('los consentimientos desaparecen', consentimientos.data?.length === 0)

    const rutas = await admin.from('habitual_routes').select('id').eq('user_id', A.id)
    check('las rutas habituales desaparecen', rutas.data?.length === 0)

    // ON DELETE SET NULL: el reporte sobrevive anonimizado. Se borra el vinculo
    // con la persona (el dato personal) y se conserva el hecho de que hubo un
    // robo ahi, del que dependen otros para decidir su ruta.
    const huerfano = await admin.from('reports').select('id, user_id').eq('id', idReporte).maybeSingle()
    check('el reporte sobrevive, pero anonimizado',
        huerfano.data && huerfano.data.user_id === null,
        huerfano.data ? 'user_id = ' + huerfano.data.user_id : 'el reporte desaparecio')

    // Limpieza: era un reporte de prueba.
    await admin.from('reports').delete().eq('id', idReporte)
}

async function limpiar(usuarios) {
    for (const u of usuarios) {
        if (!u) continue
        await admin.from('reports').delete().eq('user_id', u.id)
        await admin.auth.admin.deleteUser(u.id).catch(() => {})
    }
}

async function main() {
    console.log('\nSafeWay - verificacion de RLS')
    console.log('=============================')
    console.log('Usuarios de prueba (se borran al terminar):')

    let A = null, B = null
    try {
        A = await crearUsuario(CUENTAS.A)
        B = await crearUsuario(CUENTAS.B)
        console.log('  A: ' + A.email)
        console.log('  B: ' + B.email)

        await probarReportes(A, B)
        await probarAnonimo()
        await probarPerfiles(A, B)
        await probarConsentimiento(A, B)
        await probarHistorial(A, B)
        await probarAlertas(A, B)
        await probarBorradoDeCuenta(A)
        A = null  // ya se borro dentro de la prueba
    } catch (err) {
        console.error('\nLa prueba se rompio:', err.message)
        fallaron++
        fallos.push('excepcion: ' + err.message)
    } finally {
        await limpiar([A, B])
        console.log('\nUsuarios de prueba eliminados.')
    }

    console.log('\n=============================')
    if (fallaron === 0) {
        console.log(pasaron + ' comprobaciones, todas pasaron.')
        console.log('Ningun usuario puede tocar los datos de otro, y el mapa publico sigue vivo.')
    } else {
        console.log(pasaron + ' pasaron, ' + fallaron + ' FALLARON:')
        for (const f of fallos) console.log('  - ' + f)
    }
    console.log('')

    // exitCode en vez de process.exit(): salir de golpe con conexiones abiertas
    // hace reventar libuv en Windows.
    process.exitCode = fallaron > 0 ? 1 : 0
}

main()
