// Cliente de Supabase.
//
// El acta prometía Supabase desde la semana 6 pero el archivo estaba vacío y la app
// nunca se conectó a una base de datos. Aquí se conecta de verdad, y si no hay
// credenciales configuradas la app NO se cae: reportStore.js usa un respaldo local.
// Eso cumple el objetivo #4 del acta (continuidad ante fallas de la fuente principal).

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY

let client = null

function isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_KEY)
}

function getClient() {
    if (!isConfigured()) return null
    if (!client) {
        client = createClient(SUPABASE_URL, SUPABASE_KEY)
    }
    return client
}

// Comprueba que la conexión responda de verdad, no solo que haya variables de entorno.
async function checkConnection() {
    if (!isConfigured()) {
        return { ok: false, reason: 'Supabase no configurado (falta SUPABASE_URL o SUPABASE_KEY)' }
    }
    try {
        const { error } = await getClient().from('reports').select('id').limit(1)
        if (error) return { ok: false, reason: error.message }
        return { ok: true }
    } catch (err) {
        return { ok: false, reason: err.message }
    }
}

module.exports = { getClient, isConfigured, checkConnection }
