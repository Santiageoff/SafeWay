// Límite de peticiones por IP (paso 3 del plan de seguridad).
//
// Sin esto, cualquiera puede mandar miles de peticiones por minuto: tumba la
// API (Render gratis tiene poca CPU) y, peor, hace que los servicios gratuitos
// que usa el análisis de ruta (OSRM y Nominatim, que piden un uso moderado)
// bloqueen a SafeWay para todos.
//
// Ventana fija en memoria: suficiente para UNA instancia de Render. Si algún
// día hay varias, el contador tendría que vivir en un sitio compartido.
//
// Los límites se pueden cambiar sin tocar código (variables de entorno).

const VENTANA_MS = 60_000

function crearLimite({ nombre, maximo, ventanaMs = VENTANA_MS, mensaje }) {
    const contadores = new Map() // ip -> { cuenta, reinicio }

    // Limpieza periódica para que el mapa no crezca sin fin.
    const limpieza = setInterval(() => {
        const ahora = Date.now()
        for (const [ip, c] of contadores) if (c.reinicio <= ahora) contadores.delete(ip)
    }, ventanaMs)
    limpieza.unref()

    return function limite(req, res, next) {
        const ahora = Date.now()
        // Con `trust proxy` (app.js), req.ip es la IP real de la persona y no
        // la del proxy de Render.
        const ip = req.ip || 'desconocida'
        let c = contadores.get(ip)
        if (!c || c.reinicio <= ahora) {
            c = { cuenta: 0, reinicio: ahora + ventanaMs }
            contadores.set(ip, c)
        }
        c.cuenta++

        const restantes = Math.max(0, maximo - c.cuenta)
        const segundos = Math.ceil((c.reinicio - ahora) / 1000)
        res.setHeader('RateLimit-Limit', String(maximo))
        res.setHeader('RateLimit-Remaining', String(restantes))
        res.setHeader('RateLimit-Reset', String(segundos))

        if (c.cuenta > maximo) {
            res.setHeader('Retry-After', String(segundos))
            console.warn(`[limite] ${nombre}: IP superó ${maximo} peticiones por minuto`)
            return res.status(429).json({
                success: false,
                code: 'rate_limited',
                error: `${mensaje} Intenta de nuevo en ${segundos} s.`
            })
        }
        next()
    }
}

const numero = (valor, porDefecto) => {
    const n = Number(valor)
    return Number.isFinite(n) && n > 0 ? n : porDefecto
}

// Toda la API: generoso, una persona usando la app nunca llega.
const limiteGeneral = crearLimite({
    nombre: 'api',
    maximo: numero(process.env.RATE_LIMIT_API_PER_MIN, 120),
    mensaje: 'Demasiadas peticiones seguidas.'
})

// Analizar ruta: cada consulta llama a OSRM (hasta 5 veces) y a Nominatim.
const limiteAnalisis = crearLimite({
    nombre: 'analisis',
    maximo: numero(process.env.RATE_LIMIT_ANALYZE_PER_MIN, 20),
    mensaje: 'Analizaste muchas rutas seguidas.'
})

// Escrituras (reportar, completar, perfil): además del límite de 5 reportes
// al día por cuenta, que ya existe.
const limiteEscrituras = crearLimite({
    nombre: 'escrituras',
    maximo: numero(process.env.RATE_LIMIT_WRITES_PER_MIN, 30),
    mensaje: 'Demasiados cambios seguidos.'
})

const soloEscrituras = (req, res, next) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? limiteEscrituras(req, res, next) : next()

module.exports = { crearLimite, limiteGeneral, limiteAnalisis, soloEscrituras }
