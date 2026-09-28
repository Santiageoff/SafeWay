import { useState } from 'react'
import { useAuth } from '../../context/useAuth'

// Se muestra cuando alguien llega desde el enlace de "olvide mi contrasena".
// Supabase ya le dejo con sesion iniciada al abrir el enlace, asi que aqui solo
// falta pedirle la clave nueva. No se puede cerrar: si se cierra sin cambiarla,
// la persona se queda dentro con la contrasena vieja, que es justo la que no
// recordaba.

const campo = 'mb-3.5 w-full rounded-campo border-3 border-texto bg-superficie px-3 py-2.5 text-sm text-texto'
const etiqueta = 'mb-1.5 mt-3.5 block text-[11px] font-semibold uppercase tracking-wide text-texto-tenue'

function ResetPassword() {
  const { cambiarPassword, cerrarSesion } = useAuth()
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== repetir) {
      setError('Las dos contraseñas no coinciden')
      return
    }

    setEnviando(true)
    const r = await cambiarPassword(password)
    setEnviando(false)
    if (r.error) setError(r.error)
  }

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-texto/80 p-5">
      <div className="w-full max-w-[380px] rounded-tarjeta border-3 border-acento bg-superficie p-5 shadow-dura">
        <h2 className="m-0 mb-1.5 font-display text-base text-texto">Elige una contraseña nueva</h2>
        <p className="mb-1 text-xs text-texto-tenue">
          Ya estás dentro. Solo falta que pongas la contraseña con la que vas a entrar de ahora en adelante.
        </p>

        <form onSubmit={enviar}>
          <label className={etiqueta}>Contraseña nueva</label>
          <input
            type="password" required minLength={6} value={password}
            autoComplete="new-password" onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" className={campo}
          />

          <label className={etiqueta}>Repítela</label>
          <input
            type="password" required minLength={6} value={repetir}
            autoComplete="new-password" onChange={(e) => setRepetir(e.target.value)}
            className={campo}
          />

          {error && (
            <div className="mb-3.5 rounded-campo border-3 border-texto bg-aviso px-3 py-2.5 text-xs text-texto">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-4 min-h-[44px] w-full rounded-boton border-3 border-texto bg-acento py-3 font-display text-sm text-white shadow-dura disabled:opacity-60"
          >
            {enviando ? 'GUARDANDO…' : 'GUARDAR Y CONTINUAR'}
          </button>
        </form>

        <button onClick={cerrarSesion} className="mt-3 bg-transparent p-0 text-xs text-texto-tenue underline">
          Cancelar y cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default ResetPassword
