// Levanta la API real como proceso aparte para probarla por HTTP.
//
// Se lanza `src/app.js` tal cual (sin modificarlo) con las variables de entorno
// que pide cada prueba, en un puerto libre. Las variables que se pasan pisan las
// del .env local: dotenv no sobrescribe lo que ya está definido.

const { spawn } = require('node:child_process')
const net = require('node:net')
const path = require('node:path')

const BACKEND_DIR = path.join(__dirname, '..')

function puertoLibre() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer()
        srv.unref()
        srv.on('error', reject)
        srv.listen(0, () => {
            const { port } = srv.address()
            srv.close(() => resolve(port))
        })
    })
}

// env: variables extra (p. ej. { SUPABASE_URL: '' } para simular "sin configurar").
async function levantarApi(env = {}) {
    const port = await puertoLibre()
    const proc = spawn(process.execPath, ['src/app.js'], {
        cwd: BACKEND_DIR,
        env: { ...process.env, SUPABASE_SECRET_KEY: '', ...env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    let salida = ''
    proc.stdout.on('data', d => { salida += d })
    proc.stderr.on('data', d => { salida += d })

    await new Promise((resolve, reject) => {
        const limite = setTimeout(() => {
            proc.kill()
            reject(new Error(`La API no arrancó en 10 s. Salida:\n${salida}`))
        }, 10_000)
        proc.stdout.on('data', () => {
            if (salida.includes('Server running')) {
                clearTimeout(limite)
                resolve()
            }
        })
        proc.on('exit', code => {
            clearTimeout(limite)
            reject(new Error(`La API terminó con código ${code}. Salida:\n${salida}`))
        })
    })

    const base = `http://127.0.0.1:${port}`
    return {
        base,
        get: (ruta) => fetch(base + ruta, { signal: AbortSignal.timeout(8_000) }),
        post: (ruta, cuerpo) => fetch(base + ruta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(8_000)
        }),
        cerrar: () => new Promise(resolve => {
            if (proc.exitCode !== null) return resolve()
            proc.once('exit', resolve)
            proc.kill()
        })
    }
}

module.exports = { levantarApi }
