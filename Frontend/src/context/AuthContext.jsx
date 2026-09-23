import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseConfigurado } from '../lib/supabaseClient'
import { AuthContext } from './authContextObject'

// Estado de sesion de toda la app.
//
// Supabase guarda la sesion en localStorage y la renueva sola. Aqui solo se
// escucha: `onAuthStateChange` avisa al iniciar sesion, al cerrarla, al
// renovarse el token y cuando se abre un enlace de recuperacion de contrasena.

// Los mensajes de error de Supabase llegan en ingles y son cripticos.
// Esto los traduce a algo que una persona entienda.
function traducirError(mensaje = '') {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos'
  if (m.includes('email not confirmed')) return 'Falta confirmar tu correo. Revisa tu bandeja, y el spam.'
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese correo'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres'
  if (m.includes('unable to validate email')) return 'Ese correo no parece válido'
  if (m.includes('for security purposes')) return 'Espera unos segundos antes de volver a intentarlo'
  if (m.includes('email rate limit')) return 'Demasiados intentos. Espera un momento.'
  return mensaje || 'Algo salió mal. Inténtalo de nuevo.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // Si Supabase no esta configurado no hay nada que cargar: se arranca ya en
  // false en vez de llamar a setState dentro del efecto.
  const [cargando, setCargando] = useState(supabaseConfigurado)
  // Se activa cuando la persona llega desde el enlace de "olvidé mi contraseña":
  // Supabase la deja con sesión iniciada y hay que pedirle la nueva clave.
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    if (!supabaseConfigurado) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      setSession(nuevaSesion)
      setCargando(false)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const registrarse = useCallback(async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || null } }
    })
    if (error) return { error: traducirError(error.message) }

    // Si la confirmación por correo está activada, Supabase devuelve el usuario
    // pero sin sesión: hay que avisar de que revise su bandeja.
    return { necesitaConfirmar: !data.session, user: data.user }
  }, [])

  const iniciarSesion = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? { error: traducirError(error.message) } : {}
  }, [])

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const pedirRecuperacion = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    return error ? { error: traducirError(error.message) } : {}
  }, [])

  const cambiarPassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: traducirError(error.message) }
    setRecuperando(false)
    return {}
  }, [])

  const valor = {
    session,
    user: session?.user || null,
    haySesion: Boolean(session),
    cargando,
    recuperando,
    disponible: supabaseConfigurado,
    registrarse,
    iniciarSesion,
    cerrarSesion,
    pedirRecuperacion,
    cambiarPassword
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
