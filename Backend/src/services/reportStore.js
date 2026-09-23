// Acceso a la tabla `reports`.
//
// CAMBIO IMPORTANTE frente a la version anterior: ya NO hay respaldo en un
// archivo local. Aquel respaldo tenia sentido cuando no habia base de datos,
// pero ahora hace daño: cuando RLS empezo a denegar el acceso, los reportes se
// siguieron guardando en silencio en un JSON que el usuario jamas podria
// recuperar, y el fallo de permisos quedo tapado. Un error honesto es mejor.
//
// El respaldo local sigue existiendo, pero solo para las localidades
// (localityStore.js), que es lo que el acta pedia: datos oficiales de solo
// lectura que no deben dejar el mapa en blanco.
//
// Cada funcion recibe el CLIENTE con el que operar. Para lo que toca datos
// personales se pasa `req.db`, que actua en nombre del usuario, de modo que
// RLS se aplica aunque este codigo se equivoque.

const { randomUUID } = require('crypto')
const supabase = require('./supabaseService')

const TABLA = 'reports'
const VISTA_PUBLICA = 'public_reports'

class StoreError extends Error {
    constructor(message, codigoPg) {
        super(message)
        this.codigoPg = codigoPg
        // 42501 = permiso denegado, 42P01 = la relacion no existe.
        // Son errores de configuracion, no del usuario: hay que verlos, no
        // disimularlos con un respaldo.
        this.esProblemaDePermisos = codigoPg === '42501' || codigoPg === '42P01'
    }
}

function lanzar(error, queHaciamos) {
    throw new StoreError(`${queHaciamos}: ${error.message}`, error.code)
}

// ---------- Escritura (siempre en nombre del usuario) ----------

async function insert(client, report) {
    const fila = { id: randomUUID(), created_at: new Date().toISOString(), ...report }
    const { data, error } = await client.from(TABLA).insert(fila).select().single()
    if (error) lanzar(error, 'no se pudo guardar el reporte')
    return data
}

async function update(client, id, patch) {
    const { data, error } = await client.from(TABLA).update(patch).eq('id', id).select().maybeSingle()
    if (error) lanzar(error, 'no se pudo actualizar el reporte')
    return data
}

// ---------- Lectura de lo propio ----------

// RLS ya limita a las filas del usuario; el .eq no sobra, hace explicita la
// intencion y evita depender de una sola capa.
async function findById(client, id) {
    const { data, error } = await client.from(TABLA).select('*').eq('id', id).maybeSingle()
    if (error) lanzar(error, 'no se pudo leer el reporte')
    return data
}

async function listByUser(client) {
    const { data, error } = await client
        .from(TABLA).select('*').eq('status', 'active')
        .order('created_at', { ascending: false })
    if (error) lanzar(error, 'no se pudieron leer tus reportes')
    return data || []
}

// Base del limite de 5 al dia. Cuenta tambien los cancelados: si no, se podria
// reportar y deshacer en bucle para saltarse el limite.
async function countByUser(client, sinceIso) {
    const { count, error } = await client
        .from(TABLA).select('id', { count: 'exact', head: true })
        .gte('created_at', sinceIso)
    if (error) lanzar(error, 'no se pudo comprobar tu limite diario')
    return count || 0
}

// ---------- Lectura publica (el mapa) ----------

// Va contra la VISTA, no contra la tabla. La vista no expone device_hash,
// user_id ni description, asi que aqui es imposible filtrar datos personales
// por accidente: no estan.
async function listPublic(sinceIso) {
    const client = supabase.getAnonClient()
    if (!client) throw new StoreError('Supabase no esta configurado')

    const { data, error } = await client
        .from(VISTA_PUBLICA).select('*')
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .abortSignal(supabase.limiteDeEspera())
    if (error) lanzar(error, 'no se pudo leer la capa de reportes')
    return data || []
}

function status() {
    return {
        backend: supabase.isConfigured() ? 'supabase' : 'sin configurar',
        adminKey: supabase.hasAdminKey()
    }
}

module.exports = {
    insert, update, findById, listByUser, countByUser, listPublic,
    status, StoreError
}
