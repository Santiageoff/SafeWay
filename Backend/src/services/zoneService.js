// Zonas de riesgo listas para usar: las 20 localidades con el riesgo oficial
// mezclado con los reportes ciudadanos recientes.
//
// Antes esta función estaba copiada en risk.routes.js y en route.route.js.
// Ahora vive aquí y las dos rutas la importan (issue #2).
//
// Dos fuentes, y cada una degrada distinto a propósito:
//   · localidades -> Supabase, con respaldo al archivo del repo si no responde.
//     Son datos oficiales de solo lectura; el mapa no puede quedarse en blanco.
//   · reportes    -> la VISTA pública sanitizada. Si falla, se sigue mostrando
//     la línea base histórica: mejor un mapa sin la capa viva que ningún mapa.

const { buildZones, MAX_AGE_DAYS } = require('./dynamicRiskService')
const store = require('./reportStore')
const localityStore = require('./localityStore')

const DAY_MS = 24 * 60 * 60 * 1000

async function loadZones(mode, at = new Date()) {
    const since = new Date(Date.now() - MAX_AGE_DAYS * DAY_MS).toISOString()
    // Las dos lecturas van en paralelo: si Supabase se cuelga, el usuario
    // espera un solo timeout y no la suma de los dos.
    const [{ localities, source }, reportes] = await Promise.all([
        localityStore.getLocalities(),
        store.listPublic(since).then(
            data => ({ data }),
            err => ({ err })
        )
    ])

    if (reportes.err) {
        console.error('[zones] no se pudieron cargar los reportes, usando la linea base:', reportes.err.message)
        return { ...buildZones([], { mode, at, localities }), live: false, localitySource: source }
    }
    return { ...buildZones(reportes.data, { mode, at, localities }), live: true, localitySource: source }
}

const normalizar = (texto) => String(texto).toLowerCase().trim()

// Zonas cuyo nombre contiene el texto (sin distinguir mayúsculas).
function searchByName(zones, texto) {
    const q = normalizar(texto)
    return zones.filter(z => normalizar(z.name).includes(q))
}

// Una zona por nombre: primero coincidencia exacta, luego parcial.
function findByName(zones, texto) {
    const q = normalizar(texto)
    return zones.find(z => normalizar(z.name) === q) ||
        zones.find(z => normalizar(z.name).includes(q)) ||
        null
}

module.exports = { loadZones, searchByName, findByName }
