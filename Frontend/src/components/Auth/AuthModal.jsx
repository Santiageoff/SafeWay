import { useState } from 'react'
import { useAuth } from '../../context/useAuth'

// Registro, inicio de sesion y recuperacion de contrasena, en una sola ventana.
//
// `motivo` explica POR QUE se esta pidiendo la sesion. No es lo mismo que
// alguien pulse "entrar" a que le acaben de robar y el boton le pida una
// cuenta: en ese caso hay que decirlo de frente, y recordarle el 123.

const MODOS = { entrar: 'entrar', registro: 'registro', olvide: 'olvide' }

const campo = 'mb-3.5 w-full rounded-campo border-3 border-texto bg-superficie px-3 py-2.5 text-sm text-texto'
const etiqueta = 'mb-1.5 mt-3 block text-[11px] font-semibold uppercase tracking-wide text-texto-tenue'
const enlace = 'bg-transparent p-0 text-left text-xs text-enlace underline'

function AuthModal({ motivo = null, onClose, modoInicial = MODOS.entrar }) {
  const { iniciarSesion, registrarse, pedirRecuperacion } = useAuth()

  const [modo, setModo] = useState(modoInicial)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    setAviso(null)
    setEnviando(true)

    try {
      if (modo === MODOS.olvide) {
        const r = await pedirRecuperacion(email)
        if (r.error) setError(r.error)
        else setAviso('Si ese correo tiene cuenta, te llega un enlace. Revisa también el spam.')
        return
      }

      if (modo === MODOS.registro) {
        const r = await registrarse(email, password, nombre)
        if (r.error) { setError(r.error); return }
        if (r.necesitaConfirmar) {
          setAviso('Te mandamos un correo para confirmar la cuenta. Ábrelo y vuelve aquí.')
          return
        }
        onClose?.()
        return
      }

      const r = await iniciarSesion(email, password)
      if (r.error) setError(r.error)
      else onClose?.()
    } finally {
      setEnviando(false)
    }
  }

  const titulos = {
    entrar: 'INICIA SESIÓN',
    registro: 'CREA TU CUENTA',
    olvide: 'RECUPERAR CONTRASEÑA'
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-texto/60 p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="w-full max-w-[380px] rounded-tarjeta border-3 border-texto bg-superficie p-5 shadow-dura">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-display text-base text-texto">{titulos[modo]}</h2>
          <button onClick={onClose} className="p-1 text-base text-texto-tenue">✕</button>
        </div>

        {motivo && (
          <div className="mt-3 rounded-campo border-3 border-texto bg-riesgo-medio px-3 py-2.5 text-xs leading-relaxed text-texto">
            {motivo}
          </div>
        )}

        <form onSubmit={enviar}>
          <label className={etiqueta}>Correo</label>
          <input
            type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com" className={campo}
          />

          {modo === MODOS.registro && (
            <>
              <label className={etiqueta}>¿Cómo te llamamos? (opcional)</label>
              <input
                value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Santi" className={campo} maxLength={60}
              />
            </>
          )}

          {modo !== MODOS.olvide && (
            <>
              <label className={etiqueta}>Contraseña</label>
              <input
                type="password" required minLength={6} value={password}
                autoComplete={modo === MODOS.registro ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" className={campo}
              />
            </>
          )}

          {error && <div className="mb-3.5 rounded-campo border-3 border-texto bg-aviso px-3 py-2.5 text-xs leading-relaxed text-texto">{error}</div>}
          {aviso && <div className="mb-3.5 rounded-campo border-3 border-texto bg-ok px-3 py-2.5 text-xs leading-relaxed text-texto">{aviso}</div>}

          <button
            type="submit"
            disabled={enviando}
            className="mt-4 min-h-[44px] w-full rounded-boton border-3 border-texto bg-acento py-3 font-display text-sm text-white shadow-dura transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-dura-chica disabled:opacity-60"
          >
            {enviando ? 'UN MOMENTO…'
              : modo === MODOS.registro ? 'CREAR CUENTA'
              : modo === MODOS.olvide ? 'ENVIARME EL ENLACE'
              : 'ENTRAR'}
          </button>
        </form>

        <div className="mt-3.5 flex flex-col gap-1.5">
          {modo === MODOS.entrar && (
            <>
              <button onClick={() => { setModo(MODOS.registro); setError(null); setAviso(null) }} className={enlace}>
                ¿No tienes cuenta? Créala
              </button>
              <button onClick={() => { setModo(MODOS.olvide); setError(null); setAviso(null) }} className={enlace}>
                Olvidé mi contraseña
              </button>
            </>
          )}
          {modo !== MODOS.entrar && (
            <button onClick={() => { setModo(MODOS.entrar); setError(null); setAviso(null) }} className={enlace}>
              Volver a iniciar sesión
            </button>
          )}
        </div>

        <p className="mb-0 mt-4 text-[11px] leading-relaxed text-texto-tenue">
          Solo guardamos tu correo para identificarte. El mapa de riesgo se puede
          ver sin cuenta; la sesión hace falta para reportar y para tus datos.
        </p>
      </div>
    </div>
  )
}

export default AuthModal
