// Imprime el estado de RLS de todas las tablas.
//
//   npm run audit:rls
//
// Lee la vista security_audit, que solo puede consultar service_role. Sirve
// para comprobar en cualquier momento que ninguna tabla se quedo abierta,
// incluso meses despues de este trabajo.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false }
})
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    auth: { persistSession: false }
})

;(async () => {
    const { data, error } = await admin.from('security_audit').select('*')
    if (error) {
        console.error('No se pudo leer la auditoria:', error.message)
        process.exitCode = 1
        return
    }

    console.log('')
    console.log('SafeWay - estado de RLS')
    console.log('='.repeat(96))
    console.log('TABLA'.padEnd(20) + 'TIPO'.padEnd(8) + 'RLS'.padEnd(6) + 'POL'.padEnd(5) + 'VEREDICTO')
    console.log('-'.repeat(96))

    let abiertas = 0
    for (const f of data) {
        if (f.tipo === 'tabla' && !f.rls_activada) abiertas++
        console.log(
            String(f.tabla).padEnd(20) +
            String(f.tipo).padEnd(8) +
            (f.tipo === 'vista' ? '-' : (f.rls_activada ? 'si' : 'NO')).padEnd(6) +
            String(f.politicas).padEnd(5) +
            f.veredicto
        )
    }

    console.log('')
    console.log('Politicas por tabla:')
    for (const f of data.filter(x => x.politicas > 0)) {
        console.log('  ' + f.tabla + ': ' + f.detalle)
    }

    // Comprobacion viva: que un anonimo no pueda leer ni siquiera esta vista.
    const fuga = await anon.from('security_audit').select('*').limit(1)
    const protegida = Boolean(fuga.error) || (fuga.data?.length ?? 0) === 0

    console.log('')
    console.log('='.repeat(96))
    console.log(abiertas === 0
        ? 'Ninguna tabla tiene RLS desactivada.'
        : 'ATENCION: ' + abiertas + ' tabla(s) con RLS DESACTIVADA.')
    console.log(protegida
        ? 'Un anonimo no puede leer ni esta auditoria.'
        : 'ATENCION: un anonimo puede leer la auditoria de seguridad.')
    console.log('')

    process.exitCode = (abiertas === 0 && protegida) ? 0 : 1
})()
