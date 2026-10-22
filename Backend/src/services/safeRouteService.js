// Ruta más segura (lo que promete SafeWay: "te dice la ruta más segura").
//
// OSRM no sabe nada de riesgo: siempre devuelve la ruta más rápida. Para
// evitar zonas de riesgo alto se le piden más candidatas y se elige:
//
//   1. La ruta más rápida y las alternativas que OSRM ofrezca (hasta 3).
//   2. Si todas cruzan zonas altas, rutas con un DESVÍO: un punto de paso a
//      cada lado de cada zona alta que cruza la ruta rápida, a una distancia
//      de su centro mayor que el radio con que se mide el riesgo.
//   3. De todas, la de MENOR puntaje: primero menos zonas altas, luego menos
//      medias, y a igualdad, la más rápida. Solo se aceptan candidatas que no
//      tarden más que MAX_PENALIZACION veces la rápida.
//
// Las localidades de ORIGEN y DESTINO no cuentan para elegir: hay que llegar
// a ellas sí o sí. Se informan aparte como "no evitables".
//
// Las funciones de puntaje y de desvío son puras; buscarRutaSegura recibe
// getRoutes inyectado para poder probarla sin red.

const { zonasEnTrayecto, riesgoParaMedio, RADIO_KM } = require('./routeAnalysisService')

// Como mucho, la ruta segura puede tardar un 60 % más que la rápida.
const MAX_PENALIZACION = Number(process.env.SAFE_ROUTE_MAX_PENALTY) || 1.6
// Distancia, en km, del centro de la zona al punto de desvío: más allá del
// radio con que se mide si una ruta "pasa por" una localidad.
const DESVIO_KM = RADIO_KM + 1.5
// Cuántas zonas altas se intentan rodear (2 lados cada una = peticiones a OSRM).
const MAX_ZONAS_A_RODEAR = 2

const KM_POR_GRADO = 111.32

// Zonas altas y medias que cruza una ruta, sin contar origen y destino.
function evaluarRuta(ruta, zones, vehicleType, extremos = []) {
    const enRuta = zonasEnTrayecto(zones, ruta.routeCoordinates)
    const intermedias = enRuta.filter(z => !extremos.includes(z.id))
    const altas = intermedias.filter(z => riesgoParaMedio(z, vehicleType) === 'high')
    const medias = intermedias.filter(z => riesgoParaMedio(z, vehicleType) === 'medium')
    return {
        ruta,
        altas,
        medias,
        puntaje: altas.length * 1000 + medias.length * 100 + (ruta.routeDuration || 0)
    }
}

// Dos puntos de paso, uno a cada lado de la zona, en dirección perpendicular
// al trayecto origen -> destino.
function puntosDeDesvio(zona, origen, destino, distanciaKm = DESVIO_KM) {
    const [lat0, lng0] = zona.coordinates
    const cosLat = Math.cos(lat0 * Math.PI / 180)
    // Dirección del trayecto en km (x = este, y = norte).
    const dx = (destino[1] - origen[1]) * KM_POR_GRADO * cosLat
    const dy = (destino[0] - origen[0]) * KM_POR_GRADO
    const largo = Math.hypot(dx, dy) || 1
    // Perpendicular unitaria.
    const px = -dy / largo
    const py = dx / largo
    return [1, -1].map(lado => [
        lat0 + (lado * py * distanciaKm) / KM_POR_GRADO,
        lng0 + (lado * px * distanciaKm) / (KM_POR_GRADO * cosLat)
    ])
}

// Elige entre candidatas ya evaluadas. La rápida siempre es candidata.
function elegirMasSegura(evaluadas, rapida) {
    const limite = rapida.ruta.routeDuration * MAX_PENALIZACION
    const aceptables = evaluadas.filter(e => e === rapida || e.ruta.routeDuration <= limite)
    return aceptables.reduce((mejor, e) => (e.puntaje < mejor.puntaje ? e : mejor), rapida)
}

// Busca la ruta más segura entre origen y destino.
// Devuelve { segura, rapida, estrategia, candidatas } donde segura y rapida
// son evaluaciones ({ ruta, altas, medias, puntaje }); estrategia dice de
// dónde salió la segura: 'rapida', 'alternativa' o 'desvio'. null si OSRM no
// devolvió nada (quien llama usa la línea recta).
async function buscarRutaSegura({ origen, destino, vehicleType, zones, extremos = [], getRoutes }) {
    const directas = await getRoutes([origen, destino], vehicleType, { alternativas: true })
    if (directas.length === 0) return null

    const evaluadas = directas.map(r => evaluarRuta(r, zones, vehicleType, extremos))
    const rapida = evaluadas[0]
    let segura = elegirMasSegura(evaluadas, rapida)
    let estrategia = segura === rapida ? 'rapida' : 'alternativa'

    // Si la mejor directa todavía cruza zonas altas, se prueban desvíos.
    if (segura.altas.length > 0) {
        const vias = rapida.altas
            .slice(0, MAX_ZONAS_A_RODEAR)
            .flatMap(z => puntosDeDesvio(z, origen, destino))
        const conDesvio = (await Promise.all(
            vias.map(via => getRoutes([origen, via, destino], vehicleType))
        )).flat()
        const evaluadasDesvio = conDesvio.map(r => evaluarRuta(r, zones, vehicleType, extremos))
        const mejor = elegirMasSegura([...evaluadas, ...evaluadasDesvio], rapida)
        if (mejor.puntaje < segura.puntaje) {
            segura = mejor
            estrategia = evaluadasDesvio.includes(mejor) ? 'desvio' : 'alternativa'
        }
        evaluadas.push(...evaluadasDesvio)
    }

    return { segura, rapida, estrategia, candidatas: evaluadas.length }
}

const nombres = (zonas) => zonas.map(z => z.name)
const lista = (n) => n.length <= 1 ? (n[0] || '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`

// Resumen de la elección para la respuesta y la recomendación.
//   evitadas:   zonas altas que cruzaba la rápida y la segura no.
//   noEvitables: origen o destino en riesgo alto (hay que llegar ahí).
function resumirEleccion({ segura, rapida, estrategia, candidatas }, zones, vehicleType, extremos = []) {
    const altasSegura = new Set(segura.altas.map(z => z.id))
    const evitadas = rapida.altas.filter(z => !altasSegura.has(z.id))
    const noEvitables = zones.filter(z => extremos.includes(z.id) && riesgoParaMedio(z, vehicleType) === 'high')

    let texto = ''
    if (evitadas.length > 0) {
        const extra = segura.ruta.routeDuration - rapida.ruta.routeDuration
        texto += ` Esta ruta evita ${lista(nombres(evitadas))}` +
            (extra > 0 ? `, a cambio de unos ${extra} min más que la más rápida.` : '.')
    } else if (segura.altas.length > 0) {
        texto += ` No encontramos una ruta razonable que evite ${lista(nombres(segura.altas))}.`
    }
    if (noEvitables.length > 0) {
        texto += ` ${lista(nombres(noEvitables))} ${noEvitables.length === 1 ? 'es' : 'son'} tu origen o destino: esa parte del trayecto no se puede evitar.`
    }

    return {
        strategy: estrategia,
        avoidedZones: nombres(evitadas),
        unavoidableZones: nombres(noEvitables),
        remainingHighZones: nombres(segura.altas),
        extraMinutes: Math.max(0, segura.ruta.routeDuration - rapida.ruta.routeDuration),
        candidatesEvaluated: candidatas,
        texto
    }
}

module.exports = {
    MAX_PENALIZACION, DESVIO_KM,
    evaluarRuta, puntosDeDesvio, elegirMasSegura, buscarRutaSegura, resumirEleccion
}
