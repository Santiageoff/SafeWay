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

// Endpoints públicos que se enriquecen si hay sesión.
// El mapa de riesgo lo usa: cualquiera lo ve, pero a quien tiene sesión se le
// puede además registrar la consulta en su historial.
async function optionalAuth(req, res, next) {
    const token = tokenDesde(req)

    if (token) {
        const user = await supabase.verifyAccessToken(token)
        if (user) {
            req.user = user
            req.accessToken = token
            req.db = supabase.getUserClient(token)
        }
    }

    // Un token inválido no rompe una ruta pública: simplemente se ignora y la
    // persona queda como visitante anónimo.
    next()
}

module.exports = { requireAuth, optionalAuth, tokenDesde }
