// Mide el tiempo de respuesta de POST /api/route/analyze con 20 consultas
// reales (Nominatim y OSRM de verdad). Criterio del issue #5 / Anexo A 4.1:
// p90 < 5 s.
//
//   1. En otra terminal: npm run dev        (la API en http://localhost:3001)
//   2. npm run medir:tiempos                (o: node scripts/medir-tiempos.js http://otra-url)
//
// Pega la tabla del final en el PR.

const BASE = (process.argv[2] || process.env.API_URL || 'http://localhost:3001').replace(/\/+$/, '')

// Mezcla de direcciones reales, localidades y los 5 medios. Las direcciones se
// repiten a propósito: la segunda vez salen de la caché, como en el uso real.
const CONSULTAS = [
    ['Calle 72 # 7-30', 'Calle 26 # 68-35', 'carro'],
    ['Parque de la 93', 'Plaza de Bolívar', 'moto'],
    ['Universidad Jorge Tadeo Lozano', 'Centro Comercial Andino', 'peatón'],
    ['Portal Norte', 'Portal de las Américas', 'publico'],
    ['Suba', 'Kennedy', 'bici'],
    ['Usaquén', 'Chapinero', 'carro'],
    ['Calle 80 # 68-10', 'Avenida Boyacá # 13-20', 'moto'],
    ['Parque Simón Bolívar', 'Universidad Nacional', 'bici'],
    ['Plaza de Bolívar', 'Museo Nacional', 'peatón'],
    ['Bosa', 'Ciudad Bolívar', 'publico'],
    ['Calle 72 # 7-30', 'Parque de la 93', 'peatón'],
    ['Engativá', 'Fontibón', 'carro'],
    ['Centro Comercial Andino', 'Usaquén', 'moto'],
    ['Teusaquillo', 'Santa Fe', 'bici'],
    ['Portal de las Américas', 'Plaza de Bolívar', 'publico'],
    ['Calle 26 # 68-35', 'Aeropuerto El Dorado', 'carro'],
    ['Kennedy', 'Bosa', 'moto'],
    ['Universidad Nacional', 'Calle 72 # 7-30', 'bici'],
    ['Barrios Unidos', 'Suba', 'carro'],
    ['Museo Nacional', 'Universidad Jorge Tadeo Lozano', 'peatón']
]

function percentil(ordenados, p) {
    const i = Math.ceil((p / 100) * ordenados.length) - 1
    return ordenados[Math.min(Math.max(i, 0), ordenados.length - 1)]
}

async function main() {
    // Despierta la API (en Render gratis tarda en arrancar) y no cuenta ese tiempo.
    try { await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(90_000) }) } catch {
        console.error(`No se pudo conectar con ${BASE}. ¿Está corriendo la API?`)
        process.exitCode = 1
        return
    }

    const filas = []
    for (const [origin, destination, vehicleType] of CONSULTAS) {
        const inicio = performance.now()
        let estado, cuerpo
        try {
            const res = await fetch(`${BASE}/api/route/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, destination, vehicleType }),
                signal: AbortSignal.timeout(30_000)
            })
            estado = res.status
            cuerpo = await res.json()
        } catch (err) {
            estado = 'error'
            cuerpo = { error: err.message }
        }
        const ms = Math.round(performance.now() - inicio)
        filas.push({ origin, destination, vehicleType, ms, estado, ruta: cuerpo.routeSource || '-', nivel: cuerpo.overallRisk || cuerpo.code || '-' })
        console.log(`${String(ms).padStart(6)} ms  ${estado}  ${vehicleType.padEnd(8)} ${origin} -> ${destination}  [${cuerpo.routeSource || cuerpo.error || ''}]`)
    }

    const ok = filas.filter(f => f.estado === 200)
    const tiempos = ok.map(f => f.ms).sort((a, b) => a - b)
    const p50 = tiempos.length ? percentil(tiempos, 50) : null
    const p90 = tiempos.length ? percentil(tiempos, 90) : null

    console.log('\n--- Para pegar en el PR ---\n')
    console.log(`Medición contra ${BASE} — ${new Date().toISOString()}\n`)
    console.log('| # | Medio | Origen → Destino | Estado | Ruta | Nivel | ms |')
    console.log('|---|---|---|---|---|---|---|')
    filas.forEach((f, i) => console.log(`| ${i + 1} | ${f.vehicleType} | ${f.origin} → ${f.destination} | ${f.estado} | ${f.ruta} | ${f.nivel} | ${f.ms} |`))
    console.log(`\n**${ok.length}/${filas.length} respondieron 200 · p50 = ${p50} ms · p90 = ${p90} ms · ` +
        `${p90 !== null && p90 < 5000 ? 'cumple' : 'NO cumple'} p90 < 5 s**`)
}

main()
