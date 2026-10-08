// Verificación del JWT de Supabase.
//
// Reemplaza al header `X-Device-Id`, que era la "credencial" anterior: un uuid
// que mandaba el propio cliente y que nadie comprobaba. Bastaba conocer el
// device_hash de alguien —y se podían leer todos desde la base, porque RLS
// estaba apagada— para leer, editar y borrar sus reportes.
//
// Cada petición autenticada deja en `req`:
//   req.user        el usuario de Supabase (id, email, ...)
//   req.accessToken su JWT
//   req.db          un cliente de Supabase que actúa COMO él, con RLS aplicada

const supabase = require('../services/supabaseService')

function tokenDesde(req) {
    const header = req.get('Authorization') || ''
    if (!header.startsWith('Bearer ')) return null
    const token = header.slice(7).trim()
    return token || null
}

// Endpoints privados: sin sesión válida no se pasa.
async function requireAuth(req, res, next) {
    const token = tokenDesde(req)

    if (!token) {
        return res.status(401).json({
            success: false,
            code: 'no_autenticado',
            error: 'Necesitas iniciar sesión para hacer esto'
        })
    }

    const user = await supabase.verifyAccessToken(token)

    if (!user) {
        return res.status(401).json({
            success: false,
            code: 'sesion_invalida',
            error: 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.'
        })
    }

    req.user = user
    req.accessToken = token
    req.db = supabase.getUserClient(token)
    next()
}

// Sesión OPCIONAL para endpoints públicos que se enriquecen si hay sesión
// (el análisis de ruta guarda el historial de quien inició sesión).
// No es un middleware: devuelve una promesa que el endpoint puede esperar
// DESPUÉS de responder, así verificar el token no hace más lento el análisis.
// Un token inválido o vencido da null: la persona sigue como visitante.
async function sesionOpcional(req) {
    const token = tokenDesde(req)
    if (!token) return null
    try {
        const user = await supabase.verifyAccessToken(token)
        if (!user) return null
        return { user, db: supabase.getUserClient(token) }
    } catch {
        return null
    }
}

module.exports = { requireAuth, sesionOpcional, tokenDesde }
