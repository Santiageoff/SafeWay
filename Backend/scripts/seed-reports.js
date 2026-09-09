// Carga reportes SIMULADOS para la sustentación.
//
// Por qué existe: con pocos usuarios reales el mapa dinámico no se mueve, y una
// demo donde nada cambia no demuestra nada. Estos datos son inventados y hay que
// decirlo en voz alta al presentar: NO son reportes reales de ciudadanos.
//
//   node scripts/seed-reports.js          carga los reportes de demostración
//   node scripts/seed-reports.js --clear  borra todo y deja el mapa limpio

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const store = require('../src/services/reportStore')
const { buildReport } = require('../src/services/reportService')
const fs = require('fs/promises')

const HOUR = 60 * 60 * 1000
const hoursAgo = (h) => new Date(Date.now() - h * HOUR).toISOString()

// Escenarios pensados para que la demo muestre cada regla funcionando.
const SCENARIOS = [
    // Kennedy: hurto de celular concentrado de noche. Sube el riesgo de quien
    // va a pie y en transporte público, no el de quien va en carro.
    { lat: 4.6280, lng: -74.1663, type: 'celular', hours: 3, device: 'demo-device-01' },
    { lat: 4.6295, lng: -74.1610, type: 'celular', hours: 14, device: 'demo-device-02' },
    { lat: 4.6250, lng: -74.1700, type: 'celular', hours: 26, device: 'demo-device-03' },
    { lat: 4.6310, lng: -74.1640, type: 'celular', hours: 38, device: 'demo-device-04' },
    { lat: 4.6265, lng: -74.1680, type: 'transmilenio', hours: 50, device: 'demo-device-05', station: 'Banderas' },

    // Un mismo hecho reportado por tres testigos: debe aparecer agrupado.
    { lat: 4.6136, lng: -74.0686, type: 'celular', hours: 5, device: 'demo-device-06' },
    { lat: 4.6137, lng: -74.0687, type: 'celular', hours: 5, device: 'demo-device-07' },
    { lat: 4.6135, lng: -74.0685, type: 'celular', hours: 5, device: 'demo-device-08' },

    // Suba: robo de motos, todos recientes. Es el caso que muestra el filtro
    // más claro: Suba pasa de verde a amarilla SOLO si eliges "moto".
    // Van frescos a propósito, para que el decaimiento no los apague antes de
    // que se note el cambio de color en la demo.
    { lat: 4.7558, lng: -74.0833, type: 'moto', hours: 1, device: 'demo-device-09' },
    { lat: 4.7600, lng: -74.0800, type: 'moto', hours: 2, device: 'demo-device-10' },
    { lat: 4.7500, lng: -74.0900, type: 'moto', hours: 3, device: 'demo-device-11' },
    { lat: 4.7620, lng: -74.0870, type: 'moto', hours: 4, device: 'demo-device-12' },
    { lat: 4.7480, lng: -74.0790, type: 'moto', hours: 5, device: 'demo-device-16' },

    // Chapinero: robo de carro, con rango de horas (estaba parqueado).
    { lat: 4.6473, lng: -74.0662, type: 'carro', hours: 30, endHours: 22, device: 'demo-device-13' },

    // Teusaquillo: robo a vivienda. Se guarda difuminado y NO toca el riesgo
    // de tránsito de ningún medio.
    { lat: 4.6445, lng: -74.0934, type: 'vivienda', hours: 16, device: 'demo-device-14' },

    // Un reporte sin completar: cuenta a media fuerza.
    { lat: 4.5769, lng: -74.0750, type: null, hours: 6, device: 'demo-device-15' },
]

async function clear() {
    const file = path.join(__dirname, '..', 'data', 'reports.json')
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, '[]', 'utf8')
    console.log('Reportes locales borrados.')
    if (store.backendName() === 'supabase') {
        console.log('OJO: esto solo borra el archivo local. En Supabase, borra la tabla a mano.')
    }
}

async function seed() {
    console.log(`Cargando ${SCENARIOS.length} reportes de DEMOSTRACIÓN en: ${store.backendName()}`)
    console.log('Recuerda decir en la sustentación que estos datos son simulados.\n')

    for (const scenario of SCENARIOS) {
        const report = buildReport({
            lat: scenario.lat,
            lng: scenario.lng,
            type: scenario.type,
            occurredAt: hoursAgo(scenario.hours),
            occurredEnd: scenario.endHours ? hoursAgo(scenario.endHours) : null,
            station: scenario.station,
            description: '[DATO SIMULADO PARA DEMOSTRACIÓN]',
            deviceHash: scenario.device
        })
        const saved = await store.insert(report)
        console.log(`  ${saved.locality.padEnd(16)} ${(scenario.type || 'sin tipo').padEnd(13)} hace ${scenario.hours}h`)
    }

    console.log('\nListo. Prueba a cambiar de medio de transporte en la app:')
    console.log('  - "A pie" o "Público": Kennedy se calienta')
    console.log('  - "Moto": Suba se calienta, Kennedy no')
    console.log('  - "Carro": casi nada cambia')
}

const main = process.argv.includes('--clear') ? clear : seed
main().catch(err => { console.error(err); process.exit(1) })
