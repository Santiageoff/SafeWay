// Persistencia de los reportes ciudadanos.
//
// Dos backends detrás de la misma interfaz:
//   - Supabase, cuando hay credenciales en .env (producción / entrega).
//   - Un archivo JSON local, cuando no las hay (desarrollo y demo sin cuenta).
//
// Esto es lo que permite que el botón de alerta funcione de punta a punta HOY,
// sin esperar a que alguien cree el proyecto en Supabase, y es también la
// continuidad ante fallas que exige el objetivo #4 del acta.

const fs = require('fs/promises')
const path = require('path')
const { randomUUID } = require('crypto')
const supabase = require('./supabaseService')

const TABLE = 'reports'
const LOCAL_FILE = path.join(__dirname, '..', '..', 'data', 'reports.json')

// Si Supabase falla en caliente, degradamos a local y lo recordamos para no
// reintentar en cada request (y para poder avisarle al usuario en /health).
let degradedReason = null

function usingSupabase() {
    return supabase.isConfigured() && !degradedReason
}

function backendName() {
    return usingSupabase() ? 'supabase' : 'local'
}

function degrade(err) {
    if (!degradedReason) {
        degradedReason = err?.message || String(err)
        console.error('[reportStore] Supabase falló, degradando a almacenamiento local:', degradedReason)
    }
}

// ---------- Backend local (archivo JSON) ----------

async function readLocal() {
    try {
        const raw = await fs.readFile(LOCAL_FILE, 'utf8')
        return JSON.parse(raw)
    } catch (err) {
        if (err.code === 'ENOENT') return []
        throw err
    }
}

async function writeLocal(reports) {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true })
    await fs.writeFile(LOCAL_FILE, JSON.stringify(reports, null, 2), 'utf8')
}

// ---------- Interfaz pública ----------

async function insert(report) {
    const row = { id: randomUUID(), created_at: new Date().toISOString(), ...report }

    if (usingSupabase()) {
        try {
            const { data, error } = await supabase.getClient()
                .from(TABLE).insert(row).select().single()
            if (error) throw error
            return data
        } catch (err) {
            degrade(err)
        }
    }

    const reports = await readLocal()
    reports.push(row)
    await writeLocal(reports)
    return row
}

async function update(id, patch) {
    if (usingSupabase()) {
        try {
            const { data, error } = await supabase.getClient()
                .from(TABLE).update(patch).eq('id', id).select().single()
            if (error) throw error
            return data
        } catch (err) {
            degrade(err)
        }
    }

    const reports = await readLocal()
    const index = reports.findIndex(r => r.id === id)
    if (index === -1) return null
    reports[index] = { ...reports[index], ...patch }
    await writeLocal(reports)
    return reports[index]
}

async function findById(id) {
    if (usingSupabase()) {
        try {
            const { data, error } = await supabase.getClient()
                .from(TABLE).select('*').eq('id', id).maybeSingle()
            if (error) throw error
            return data
        } catch (err) {
            degrade(err)
        }
    }

    const reports = await readLocal()
    return reports.find(r => r.id === id) || null
}

// Reportes activos ocurridos desde `sinceIso`. Es la consulta que alimenta
// tanto la capa del mapa como el cálculo de riesgo dinámico.
async function listActive(sinceIso) {
    if (usingSupabase()) {
        try {
            const { data, error } = await supabase.getClient()
                .from(TABLE)
                .select('*')
                .eq('status', 'active')
                .gte('occurred_at', sinceIso)
                .order('occurred_at', { ascending: false })
            if (error) throw error
            return data || []
        } catch (err) {
            degrade(err)
        }
    }

    const reports = await readLocal()
    return reports
        .filter(r => r.status === 'active' && r.occurred_at >= sinceIso)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
}

// Cuántos reportes lleva este dispositivo desde `sinceIso`. Base del límite de 5/día.
// Cuenta también los cancelados: si no, alguien podría reportar y deshacer en bucle
// para saltarse el límite.
async function countByDevice(deviceHash, sinceIso) {
    if (usingSupabase()) {
        try {
            const { count, error } = await supabase.getClient()
                .from(TABLE)
                .select('id', { count: 'exact', head: true })
                .eq('device_hash', deviceHash)
                .gte('created_at', sinceIso)
            if (error) throw error
            return count || 0
        } catch (err) {
            degrade(err)
        }
    }

    const reports = await readLocal()
    return reports.filter(r => r.device_hash === deviceHash && r.created_at >= sinceIso).length
}

async function listByDevice(deviceHash) {
    if (usingSupabase()) {
        try {
            const { data, error } = await supabase.getClient()
                .from(TABLE)
                .select('*')
                .eq('device_hash', deviceHash)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        } catch (err) {
            degrade(err)
        }
    }

    const reports = await readLocal()
    return reports
        .filter(r => r.device_hash === deviceHash && r.status === 'active')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function status() {
    return {
        backend: backendName(),
        supabaseConfigured: supabase.isConfigured(),
        degradedReason
    }
}

module.exports = {
    insert, update, findById, listActive, countByDevice, listByDevice,
    backendName, status
}
