// Ruta más segura: la app debe EVITAR las zonas de riesgo alto cuando hay
// una alternativa razonable, no solo medir el riesgo de la ruta más rápida.

const test = require('node:test')
const assert = require('node:assert/strict')

const s = require('../src/services/safeRouteService')
const { distanceKm } = require('../src/utils/geo')

const zona = (id, name, coordinates, nivel) =>
    ({ id, name, coordinates, riskLevel: nivel, vehicleRisks: { carro: nivel }, insecurityPercentage: 50 })

// Origen al sur, destino al norte; ROJA justo en medio de la línea recta.
const ORIGEN = zona(1, 'Origen', [4.60, -74.10], 'low')
const DESTINO = zona(2, 'Destino', [4.70, -74.10], 'low')
const ROJA = zona(3, 'Roja', [4.65, -74.10], 'high')
const ZONAS = [ORIGEN, DESTINO, ROJA]
const EXTREMOS = [1, 2]

const ruta = (coords, minutos) => ({ routeCoordinates: coords, routeDistance: 10, routeDuration: minutos, routeSource: 'osrm' })
const RECTA = ruta([ORIGEN.coordinates, DESTINO.coordinates], 20)                                    // cruza ROJA
const RODEO = ruta([ORIGEN.coordinates, [4.60, -74.16], [4.70, -74.16], DESTINO.coordinates], 28)   // la rodea a ~6,6 km
const RODEO_LARGUISIMO = ruta(RODEO.routeCoordinates, 60)                                           // 3x más lento

// getRoutes falso: `directas` para la petición origen->destino, `conDesvio`
// para cualquier petición con punto de paso.
function osrmFalso({ directas = [RECTA], conDesvio = [] } = {}) {
    const pedidos = []
    const getRoutes = async (puntos, vehicleType, opts = {}) => {
        pedidos.push({ puntos, ...opts })
        return puntos.length === 2 ? directas : conDesvio
    }
    return { getRoutes, pedidos }
}

const buscar = (getRoutes, extra = {}) => s.buscarRutaSegura({
    origen: ORIGEN.coordinates, destino: DESTINO.coordinates, vehicleType: 'carro',
    zones: ZONAS, extremos: EXTREMOS, getRoutes, ...extra
})

test('puntosDeDesvio: uno a cada lado, perpendicular al trayecto y fuera del radio', () => {
    const [a, b] = s.puntosDeDesvio(ROJA, ORIGEN.coordinates, DESTINO.coordinates)
    for (const p of [a, b]) {
        const d = distanceKm(p[0], p[1], ROJA.coordinates[0], ROJA.coordinates[1])
        assert.ok(Math.abs(d - s.DESVIO_KM) < 0.1, `a ${d.toFixed(2)} km, se esperaba ${s.DESVIO_KM}`)
        assert.ok(Math.abs(p[0] - ROJA.coordinates[0]) < 0.001, 'el trayecto es norte-sur: el desvío va al este u oeste')
    }
    assert.ok((a[1] - ROJA.coordinates[1]) * (b[1] - ROJA.coordinates[1]) < 0, 'uno a cada lado')
})

test('evaluarRuta no cuenta origen ni destino, aunque sean de riesgo alto', () => {
    const destinoRojo = { ...DESTINO, riskLevel: 'high', vehicleRisks: { carro: 'high' } }
    const e = s.evaluarRuta(RODEO, [ORIGEN, destinoRojo, ROJA], 'carro', EXTREMOS)
    assert.equal(e.altas.length, 0)
})

test('CRITERIO: si la ruta rápida cruza una zona roja, se recomienda un desvío que la evita', async () => {
    const { getRoutes, pedidos } = osrmFalso({ conDesvio: [RODEO] })
    const r = await buscar(getRoutes)
    assert.equal(r.estrategia, 'desvio')
    assert.equal(r.segura.ruta, RODEO)
    assert.equal(r.segura.altas.length, 0)
    assert.deepEqual(r.rapida.altas.map(z => z.name), ['Roja'])
    // Pidió alternativas en la directa y 2 desvíos (uno por lado).
    assert.equal(pedidos[0].alternativas, true)
    assert.equal(pedidos.filter(p => p.puntos.length === 3).length, 2)
})

test('si OSRM ya trae una alternativa que evita la zona roja, se usa sin pedir desvíos', async () => {
    const { getRoutes, pedidos } = osrmFalso({ directas: [RECTA, RODEO] })
    const r = await buscar(getRoutes)
    assert.equal(r.estrategia, 'alternativa')
    assert.equal(r.segura.ruta, RODEO)
    assert.equal(pedidos.length, 1)
})

test('si la ruta rápida no cruza zonas rojas, se queda con la rápida', async () => {
    const { getRoutes, pedidos } = osrmFalso({ directas: [RODEO] })
    const r = await buscar(getRoutes)
    assert.equal(r.estrategia, 'rapida')
    assert.equal(r.segura, r.rapida)
    assert.equal(pedidos.length, 1)
})

test('un desvío que tarda más de 1,6 veces la rápida no se acepta', async () => {
    const { getRoutes } = osrmFalso({ conDesvio: [RODEO_LARGUISIMO] })
    const r = await buscar(getRoutes)
    assert.equal(r.estrategia, 'rapida')
    assert.deepEqual(r.segura.altas.map(z => z.name), ['Roja'])
})

test('sin respuesta de OSRM devuelve null (quien llama usa la línea recta)', async () => {
    const { getRoutes } = osrmFalso({ directas: [] })
    assert.equal(await buscar(getRoutes), null)
})

test('resumirEleccion: zonas evitadas, minutos extra y texto para la recomendación', async () => {
    const { getRoutes } = osrmFalso({ conDesvio: [RODEO] })
    const busqueda = await buscar(getRoutes)
    const e = s.resumirEleccion(busqueda, ZONAS, 'carro', EXTREMOS)
    assert.deepEqual(e.avoidedZones, ['Roja'])
    assert.equal(e.extraMinutes, 8)
    assert.match(e.texto, /evita Roja/)
    assert.match(e.texto, /8 min/)
})

test('resumirEleccion: avisa cuando el destino es de riesgo alto y no se puede evitar', async () => {
    const destinoRojo = { ...DESTINO, riskLevel: 'high', vehicleRisks: { carro: 'high' } }
    const zonas = [ORIGEN, destinoRojo, ROJA]
    const { getRoutes } = osrmFalso({ conDesvio: [RODEO] })
    const busqueda = await s.buscarRutaSegura({
        origen: ORIGEN.coordinates, destino: DESTINO.coordinates, vehicleType: 'carro',
        zones: zonas, extremos: EXTREMOS, getRoutes
    })
    const e = s.resumirEleccion(busqueda, zonas, 'carro', EXTREMOS)
    assert.deepEqual(e.unavoidableZones, ['Destino'])
    assert.match(e.texto, /no se puede evitar/)
})
