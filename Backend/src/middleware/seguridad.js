// Encabezados de seguridad de la API (paso 2 del plan de seguridad).
//
// La API solo responde JSON: nunca la abre una persona como página. Por eso
// la política es la más cerrada posible: no carga nada, no se deja meter en
// un iframe y le dice al navegador que use HTTPS siempre. Se escribe a mano
// en vez de usar helmet porque son seis líneas y así no suma una dependencia.

const UN_ANIO = 60 * 60 * 24 * 365

const ENCABEZADOS = {
    // HTTPS obligatorio por un año, también en subdominios. Render ya sirve
    // HTTPS con certificado automático; esto evita que un navegador vuelva a
    // intentar por HTTP (donde un atacante en la misma red podría meterse).
    'Strict-Transport-Security': `max-age=${UN_ANIO}; includeSubDomains`,
    // Que el navegador no "adivine" que un JSON es HTML o un script.
    'X-Content-Type-Options': 'nosniff',
    // Nadie puede incrustar la API en un iframe (clickjacking).
    'X-Frame-Options': 'DENY',
    // Una respuesta JSON no necesita cargar nada: si alguien lograra que se
    // interprete como página, no podría ejecutar ni pedir nada.
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    // La URL de la API no se filtra a otros sitios.
    'Referrer-Policy': 'no-referrer',
    // Las respuestas con datos de la persona (perfil, mis reportes) no se
    // guardan en cachés intermedias.
    'Cache-Control': 'no-store'
}

function encabezadosDeSeguridad(req, res, next) {
    for (const [nombre, valor] of Object.entries(ENCABEZADOS)) res.setHeader(nombre, valor)
    next()
}

module.exports = { encabezadosDeSeguridad, ENCABEZADOS }
