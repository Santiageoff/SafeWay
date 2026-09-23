#!/usr/bin/env node
// Función de aptitud del requisito "arquitectura desacoplada en tres capas"
// (RNF-01, ADR-001). No prueba que el código funcione: prueba que se respete la
// decisión. Corre en el CI y sale con código 1 si alguna regla se rompe.
//
//   node tools/verificar-capas.js
//
// Una regla que no revisa ningún archivo también falla: si alguien mueve las
// carpetas, el verificador no puede quedarse en verde sin mirar nada.

const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')

const REGLAS = [
    {
        id: 'R1',
        nombre: 'Las rutas HTTP no hablan con Supabase directamente',
        porque: 'El acceso a datos vive en services/. Si una ruta consulta Supabase, cambiar de fuente obliga a tocar la capa HTTP (ADR-001).',
        carpetas: ['Backend/src/routes'],
        extensiones: ['.js'],
        prohibido: [
            /require\(\s*['"][^'"]*supabaseService['"]\s*\)/,
            /require\(\s*['"]@supabase\/supabase-js['"]\s*\)/
        ]
    },
    {
        id: 'R2',
        nombre: 'Los servicios y utilidades no dependen de Express',
        porque: 'La lógica de datos y de análisis tiene que poder probarse y reutilizarse sin un servidor HTTP (ADR-001).',
        carpetas: ['Backend/src/services', 'Backend/src/utils'],
        extensiones: ['.js'],
        prohibido: [/require\(\s*['"]express['"]\s*\)/]
    },
    {
        id: 'R3',
        nombre: 'El frontend pide los datos a la API, no a la base de datos',
        porque: 'A Supabase el frontend solo le habla para la sesión. Los datos de riesgo pasan por la API, que aplica el respaldo y el cálculo (ADR-001, ADR-002).',
        carpetas: ['Frontend/src'],
        extensiones: ['.js', '.jsx'],
        prohibido: [/\bsupabase\s*\.\s*(from|rpc|storage)\b/]
    }
]

function archivos(carpeta, extensiones) {
    const abs = path.join(RAIZ, carpeta)
    if (!fs.existsSync(abs)) return []
    const salida = []
    for (const entrada of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = path.posix.join(carpeta, entrada.name)
        if (entrada.isDirectory()) salida.push(...archivos(rel, extensiones))
        else if (extensiones.includes(path.extname(entrada.name))) salida.push(rel)
    }
    return salida
}

let fallos = 0

for (const regla of REGLAS) {
    const revisados = regla.carpetas.flatMap(c => archivos(c, regla.extensiones))
    const violaciones = []

    for (const rel of revisados) {
        const lineas = fs.readFileSync(path.join(RAIZ, rel), 'utf8').split(/\r?\n/)
        lineas.forEach((linea, i) => {
            if (/^\s*(\/\/|\*)/.test(linea)) return  // comentarios
            if (regla.prohibido.some(re => re.test(linea))) {
                violaciones.push(`${rel}:${i + 1}  ${linea.trim()}`)
            }
        })
    }

    if (revisados.length === 0) {
        fallos++
        console.log(`✗ ${regla.id} ${regla.nombre}\n    No revisó ningún archivo en ${regla.carpetas.join(', ')}: ¿se movieron las carpetas?`)
    } else if (violaciones.length > 0) {
        fallos++
        console.log(`✗ ${regla.id} ${regla.nombre} (${revisados.length} archivos)`)
        for (const v of violaciones) console.log(`    ${v}`)
        console.log(`    Por qué: ${regla.porque}`)
    } else {
        console.log(`✓ ${regla.id} ${regla.nombre} (${revisados.length} archivos)`)
    }
}

if (fallos > 0) {
    console.log(`\n${fallos} regla(s) rota(s). Ver docs/arquitectura/adr/ADR-001-tres-capas.md`)
    process.exit(1)
}
console.log('\nLas tres capas siguen desacopladas.')
