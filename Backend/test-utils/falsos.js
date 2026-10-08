// Servidores falsos para probar sin internet: Nominatim, OSRM y Supabase
// (PostgREST mínimo en memoria). La API real se apunta a ellos con
// NOMINATIM_URL, OSRM_URL y SUPABASE_URL.

const http = require('node:http')

async function escuchar(manejador) {
    const server = http.createServer(manejador)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        cerrar: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })
    }
}

// direcciones: { 'texto en minúsculas': [lat, lng] }. Lo demás: sin resultados.
// colgado: acepta la conexión y no responde nunca.
async function nominatimFalso({ direcciones = {}, colgado = false } = {}) {
    const consultas = []
    const s = await escuchar((req, res) => {
        if (colgado) return
        const url = new URL(req.url, 'http://x')
        const q = (url.searchParams.get('q') || '').toLowerCase().replace(/, bogot[aá]$/, '')
        consultas.push({ q, at: Date.now(), userAgent: req.headers['user-agent'], params: Object.fromEntries(url.searchParams) })
        const punto = direcciones[q]
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(punto
            ? [{ lat: String(punto[0]), lon: String(punto[1]), name: q, display_name: `${q}, Bogotá, Colombia` }]
            : []))
    })
    return { ...s, consultas }
}

// Devuelve una ruta de 3 puntos entre origen y destino. Registra el perfil
// pedido (car/bike/foot) si la URL lo incluye.
// colgado: acepta la conexión y no responde nunca.
async function osrmFalso({ colgado = false } = {}) {
    const pedidos = []
    const s = await escuchar((req, res) => {
        if (colgado) return
        const m = req.url.match(/^(?:\/routed-(\w+))?\/route\/v1\/\w+\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/)
        if (!m) { res.statusCode = 400; return res.end('{}') }
        pedidos.push({ perfil: m[1] || null })
        const [lng1, lat1, lng2, lat2] = m.slice(2).map(Number)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
            code: 'Ok',
            routes: [{
                distance: 12345, duration: 1800,
                geometry: { coordinates: [[lng1, lat1], [(lng1 + lng2) / 2, (lat1 + lat2) / 2], [lng2, lat2]] }
            }]
        }))
    })
    return { ...s, pedidos }
}

// PostgREST en memoria: guarda los INSERT de route_metrics y los devuelve en
// los GET. Con `usuarios` ({ token: { id, email } }) también simula la sesión
// (GET /auth/v1/user) y guarda en `historial` los INSERT a route_queries, con
// el token con que llegaron. Cualquier otra tabla responde 404 (la API usa su
// respaldo).
async function supabaseFalso({ usuarios = {} } = {}) {
    const filas = []
    const historial = []
    const s = await escuchar((req, res) => {
        let cuerpo = ''
        req.on('data', d => { cuerpo += d })
        req.on('end', () => {
            res.setHeader('Content-Type', 'application/json')
            const token = (req.headers.authorization || '').replace(/^Bearer /, '')

            if (req.url.startsWith('/auth/v1/user')) {
                const usuario = usuarios[token]
                res.statusCode = usuario ? 200 : 401
                return res.end(JSON.stringify(usuario
                    ? { aud: 'authenticated', role: 'authenticated', ...usuario }
                    : { code: 401, msg: 'invalid JWT' }))
            }
            if (req.url.startsWith('/rest/v1/route_queries') && req.method === 'POST') {
                historial.push(...[].concat(JSON.parse(cuerpo)).map(f => ({ ...f, _token: token })))
                res.statusCode = 201
                return res.end()
            }
            if (!req.url.startsWith('/rest/v1/route_metrics')) {
                res.statusCode = 404
                return res.end(JSON.stringify({ message: 'no existe en el falso' }))
            }
            if (req.method === 'POST') {
                filas.push(...[].concat(JSON.parse(cuerpo)).map(f => ({ ...f, created_at: new Date().toISOString() })))
                res.statusCode = 201
                return res.end()
            }
            res.end(JSON.stringify(filas))
        })
    })
    return { ...s, filas, historial }
}

module.exports = { nominatimFalso, osrmFalso, supabaseFalso }
