// Verifica que el entorno esté listo para continuar con Auth + RLS.
//
//   node Backend/scripts/check-setup.js
//
// NUNCA imprime el valor de una llave: solo dice si está, de qué tipo es y
// si responde. Se puede correr delante de quien sea.

const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..', '..')
const OK = '  [OK]   '
const FALTA = '  [FALTA]'
const AVISO = '  [!]    '

let faltantes = 0
let avisos = 0

function ok(msg) { console.log(OK + msg) }
function falta(msg, comoArreglar) {
    faltantes++
    console.log(FALTA + ' ' + msg)
    if (comoArreglar) console.log('           -> ' + comoArreglar)
}
function aviso(msg) { avisos++; console.log(AVISO + msg) }

// Lee un .env sin cargarlo al proceso, para no contaminar el entorno.
function leerEnv(ruta) {
    try {
        const crudo = fs.readFileSync(ruta, 'utf8')
        const vars = {}
        for (const linea of crudo.split(/\r?\n/)) {
            const limpia = linea.trim()
            if (!limpia || limpia.startsWith('#')) continue
            const i = limpia.indexOf('=')
            if (i === -1) continue
            vars[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim()
        }
        return vars
    } catch {
        return null
    }
}

function tipoDeLlave(valor) {
    if (!valor) return 'vacía'
    if (valor.startsWith('sb_secret_')) return 'SECRETA'
    if (valor.startsWith('sb_publishable_')) return 'publicable'
    if (valor.startsWith('eyJ')) return 'JWT (formato antiguo)'
    return 'desconocida'
}

console.log('')
console.log('SafeWay - verificación del entorno')
console.log('==================================')

// ---------- Paso 1: Backend/.env ----------
console.log('')
console.log('Paso 1 - Backend/.env')

const back = leerEnv(path.join(RAIZ, 'Backend', '.env'))
if (!back) {
    falta('No existe Backend/.env', 'copia Backend/.env.example a Backend/.env')
} else {
    if (back.SUPABASE_URL) ok('SUPABASE_URL presente (' + back.SUPABASE_URL.replace(/https:\/\/([a-z]{6}).*/, 'https://$1...') + ')')
    else falta('SUPABASE_URL vacía')

    const tipoPub = tipoDeLlave(back.SUPABASE_KEY)
    if (tipoPub === 'publicable') ok('SUPABASE_KEY presente y es la publicable')
    else if (tipoPub === 'vacía') falta('SUPABASE_KEY vacía')
    else if (tipoPub === 'SECRETA') falta('SUPABASE_KEY tiene la llave SECRETA', 'SUPABASE_KEY debe llevar la publishable; la secreta va en SUPABASE_SECRET_KEY')
    else aviso('SUPABASE_KEY es de tipo ' + tipoPub)

    const tipoSec = tipoDeLlave(back.SUPABASE_SECRET_KEY)
    if (tipoSec === 'SECRETA') ok('SUPABASE_SECRET_KEY presente y es la secreta')
    else if (tipoSec === 'vacía') falta('SUPABASE_SECRET_KEY vacía', 'Supabase > Project Settings > API Keys > secret (sb_secret_...)')
    else falta('SUPABASE_SECRET_KEY no parece la secreta (es ' + tipoSec + ')', 'debe empezar por sb_secret_')
}

// ---------- Paso 2: Frontend/.env ----------
console.log('')
console.log('Paso 2 - Frontend/.env')

const front = leerEnv(path.join(RAIZ, 'Frontend', '.env'))
if (!front || Object.keys(front).length === 0) {
    falta('Frontend/.env vacío o inexistente', 'copia Frontend/.env.example a Frontend/.env y llénalo')
} else {
    if (front.VITE_API_URL) ok('VITE_API_URL presente')
    else falta('VITE_API_URL vacía', 'normalmente http://localhost:3001')

    if (front.VITE_SUPABASE_URL) ok('VITE_SUPABASE_URL presente')
    else falta('VITE_SUPABASE_URL vacía')

    const tipoFront = tipoDeLlave(front.VITE_SUPABASE_ANON_KEY)
    if (tipoFront === 'SECRETA') {
        falta('PELIGRO: la llave SECRETA está en el frontend', 'quítala YA y rótala en Supabase. Todo lo VITE_ acaba en el navegador.')
    } else if (tipoFront === 'publicable') {
        ok('VITE_SUPABASE_ANON_KEY presente y es la publicable (correcto)')
    } else if (tipoFront === 'vacía') {
        falta('VITE_SUPABASE_ANON_KEY vacía', 'la misma publishable del backend')
    } else {
        aviso('VITE_SUPABASE_ANON_KEY es de tipo ' + tipoFront)
    }
}

// ---------- Paso 3: CLI enlazado ----------
console.log('')
console.log('Paso 3 - CLI de Supabase')

if (fs.existsSync(path.join(RAIZ, 'supabase', 'config.toml'))) {
    ok('Proyecto enlazado (existe supabase/config.toml)')
    const dirMigraciones = path.join(RAIZ, 'supabase', 'migrations')
    if (fs.existsSync(dirMigraciones)) {
        const n = fs.readdirSync(dirMigraciones).filter(f => f.endsWith('.sql')).length
        ok(n + ' migración(es) en supabase/migrations/')
    }
} else {
    falta('Proyecto sin enlazar', 'supabase login  &&  supabase link --project-ref legvvbvnvdgwqajydpay')
}

// ---------- Paso 4: que las llaves respondan ----------
console.log('')
console.log('Paso 4 - ¿responden las llaves?')

async function probar() {
    if (!back || !back.SUPABASE_URL) {
        aviso('Sin URL no se puede probar la conexión')
        return
    }

    for (const [nombre, llave] of [['publicable', back.SUPABASE_KEY], ['secreta', back.SUPABASE_SECRET_KEY]]) {
        if (!llave) continue
        try {
            const res = await fetch(back.SUPABASE_URL + '/rest/v1/reports?select=id&limit=1', {
                headers: { apikey: llave, Authorization: 'Bearer ' + llave },
                signal: AbortSignal.timeout(15000)
            })
            if (res.ok) ok('La llave ' + nombre + ' conecta con Supabase (HTTP ' + res.status + ')')
            else falta('La llave ' + nombre + ' responde HTTP ' + res.status, 'revisa que la copiaste completa')
        } catch (err) {
            falta('La llave ' + nombre + ' no conecta: ' + err.message)
        }
    }
}

probar().then(() => {
    console.log('')
    console.log('==================================')
    if (faltantes === 0) {
        console.log('Todo listo' + (avisos ? ' (' + avisos + ' aviso(s) para revisar)' : '') + '.')
        console.log('Ya puedes decirle a Claude que continúe con las migraciones.')
    } else {
        console.log('Faltan ' + faltantes + ' cosa(s). Mira las líneas [FALTA] de arriba.')
        console.log('Detalle completo en SETUP-AUTH-RLS.md')
    }
    console.log('')
    // exitCode en vez de process.exit(): en Windows, salir de golpe con
    // conexiones de fetch todavia abiertas hace reventar libuv.
    process.exitCode = faltantes > 0 ? 1 : 0
})
