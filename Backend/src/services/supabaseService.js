// Clientes de Supabase.
//
// Hay TRES, y usar el equivocado es un fallo de seguridad. La diferencia entre
// ellos es quién eres para la base de datos:
//
//   anon   -> un visitante sin sesión. RLS aplica. Solo ve lo público.
//   user   -> una persona concreta, identificada por su JWT. RLS aplica y
//             `auth.uid()` devuelve su id, así que solo ve lo suyo.
//   admin  -> service_role. SE SALTA RLS POR COMPLETO.
//
// REGLA: para atender la petición de un usuario se usa SIEMPRE el cliente
// `user`. Nunca el admin. Así, si el código del backend tiene un bug y pide
// datos de otra persona, la base de datos lo rechaza igual. El admin queda
// reservado para datos oficiales y tareas internas, donde no hay un usuario
// de por medio.

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

const SIN_SESION = { auth: { persistSession: false, autoRefreshToken: false } }

// Tiempo máximo que se espera a Supabase en una lectura. Sin límite, una base
// que acepta la conexión pero no contesta (se "cuelga") deja la petición del
// usuario esperando para siempre y el respaldo nunca entra. Al vencer, la
// consulta se aborta y se trata igual que cualquier otro error.
const TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS) || 3000

// Señal para `.abortSignal()` de supabase-js: se crea una por consulta.
function limiteDeEspera() {
    return AbortSignal.timeout(TIMEOUT_MS)
}

let anonClient = null
let adminClient = null

function isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_KEY)
}

function hasAdminKey() {
    return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY)
}

// Visitante sin sesión. Para la vista pública del mapa y las localidades.
function getAnonClient() {
    if (!isConfigured()) return null
    if (!anonClient) anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, SIN_SESION)
    return anonClient
}

// service_role. Ignora RLS. Solo para datos oficiales, scripts y el detector
// de rutas habituales. Si lo usas para responderle a un usuario, te estás
// saltando tus propias políticas.
function getAdminClient() {
    if (!hasAdminKey()) return null
    if (!adminClient) adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, SIN_SESION)
    return adminClient
}

// Actúa EN NOMBRE del usuario: lleva su JWT, así que para Postgres es esa
// persona y `auth.uid()` dentro de las políticas devuelve su id.
// No se cachea: cada petición trae su propio token.
function getUserClient(accessToken) {
    if (!isConfigured() || !accessToken) return null
    return createClient(SUPABASE_URL, SUPABASE_KEY, {
        ...SIN_SESION,
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    })
}

// Valida un JWT contra Supabase y devuelve el usuario, o null.
//
// Va a la red en cada petición autenticada. Se podría cachear unos segundos,
// pero entonces un token revocado seguiría valiendo durante ese rato. Para el
// tamaño de este proyecto no compensa el riesgo.
async function verifyAccessToken(accessToken) {
    if (!accessToken) return null
    const client = getAnonClient()
    if (!client) return null
    try {
        const { data, error } = await client.auth.getUser(accessToken)
        if (error || !data?.user) return null
        return data.user
    } catch {
        return null
    }
}

// Comprueba que la conexión responda de verdad, no solo que haya variables.
// Consulta `localities`, que es de lectura pública: si consultara `reports`
// daría "permission denied" y parecería caída cuando en realidad RLS está
// haciendo justo su trabajo.
async function checkConnection() {
    if (!isConfigured()) {
        return { ok: false, reason: 'Supabase no configurado (falta SUPABASE_URL o SUPABASE_KEY)' }
    }
    try {
        const { error } = await getAnonClient().from('localities').select('id').limit(1)
            .abortSignal(limiteDeEspera())
        if (error) return { ok: false, reason: error.message }
        return { ok: true }
    } catch (err) {
        return { ok: false, reason: err.message }
    }
}

module.exports = {
    getAnonClient,
    getAdminClient,
    getUserClient,
    verifyAccessToken,
    isConfigured,
    hasAdminKey,
    checkConnection,
    limiteDeEspera,
    TIMEOUT_MS,
    // Alias heredado: antes `getClient` era el unico cliente que habia.
    getClient: getAnonClient
}
