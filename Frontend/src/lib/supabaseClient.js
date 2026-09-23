import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase del navegador.
//
// Usa SOLO la llave publicable, que es publica por diseno: cualquiera que abra
// la web la puede leer del codigo. Lo que protege los datos no es el secreto de
// esta llave, es RLS. La llave secreta (sb_secret_...) vive unicamente en el
// backend y no debe aparecer jamas en una variable VITE_, porque todo lo VITE_
// queda incrustado en el archivo que se descarga el navegador.

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en Frontend/.env. ' +
    'El mapa funcionara, pero no se podra iniciar sesion ni reportar.'
  )
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        // La sesion sobrevive a recargar la pagina y a cerrar el navegador.
        persistSession: true,
        autoRefreshToken: true,
        // Necesario para que el enlace de recuperacion de contrasena, que
        // vuelve con el token en el fragmento de la URL, inicie sesion solo.
        detectSessionInUrl: true
      }
    })
  : null

export const supabaseConfigurado = Boolean(supabase)
