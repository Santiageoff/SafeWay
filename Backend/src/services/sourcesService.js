// Fuentes de datos complementarias (issue #4): hurto a vehículos y a
// residencias por localidad (SDSCJ) más hurtos en transporte público
// (reportes ciudadanos, CR-001). Ver supabase/migrations/20260927230000_
// fuentes_complementarias.sql para de dónde sale cada una.
//
// Es lectura pública de datos oficiales, igual que localityStore: cliente
// anon, nunca admin.

const supabase = require('./supabaseService')

const TABLA = 'locality_crime_sources'
const VISTA_TRANSPORTE = 'transit_incident_counts'

function agruparPorLocalidad(filas) {
    const porLocalidad = {}

    for (const fila of filas) {
        const id = fila.locality_id
        if (!porLocalidad[id]) {
            porLocalidad[id] = {
                localityId: id,
                localityName: fila.localities?.name ?? null,
                period: fila.period,
                source: fila.source,
                hurtoAutomotores: 0,
                hurtoMotocicletas: 0,
                hurtoResidencias: 0,
                hurtoTransportePublico: 0
            }
        }

        const clave = {
            hurto_automotores: 'hurtoAutomotores',
            hurto_motocicletas: 'hurtoMotocicletas',
            hurto_residencias: 'hurtoResidencias'
        }[fila.source_type]

        if (clave) porLocalidad[id][clave] = fila.count
    }

    return porLocalidad
}

function mezclarTransporte(porLocalidad, filasTransporte) {
    for (const fila of filasTransporte) {
        const entrada = porLocalidad[fila.locality_id]
        if (entrada) entrada.hurtoTransportePublico = fila.count
    }
}

// Todas las localidades con sus tres fuentes complementarias. Las que no
// tienen reportes de transporte público en `transit_incident_counts` quedan
// en 0: es una vista sobre reportes ciudadanos, no un respaldo con relleno.
async function getAll() {
    const client = supabase.getAnonClient()
    if (!client) throw new FuentesNoDisponibles('Supabase no está configurado')

    const [crimenes, transporte] = await Promise.all([
        client.from(TABLA)
            .select('locality_id, source_type, period, count, source, localities(name)')
            .abortSignal(supabase.limiteDeEspera()),
        client.from(VISTA_TRANSPORTE)
            .select('locality_id, count')
            .abortSignal(supabase.limiteDeEspera())
    ])

    if (crimenes.error) throw new FuentesNoDisponibles(crimenes.error.message)
    // La vista de transporte puede fallar sola (p. ej. si todavía no hay
    // reportes de tipo transmilenio) sin tumbar el resto de las fuentes.
    const filasTransporte = transporte.error ? [] : (transporte.data || [])

    const porLocalidad = agruparPorLocalidad(crimenes.data || [])
    mezclarTransporte(porLocalidad, filasTransporte)

    return Object.values(porLocalidad).sort((a, b) => a.localityId - b.localityId)
}

async function getByLocality(localityId) {
    const todas = await getAll()
    return todas.find(z => z.localityId === localityId) || null
}

class FuentesNoDisponibles extends Error {}

module.exports = { getAll, getByLocality, FuentesNoDisponibles }
