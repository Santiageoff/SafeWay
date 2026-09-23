import { useState } from 'react'
import { useAuth } from '../../context/useAuth'

// Se muestra cuando alguien llega desde el enlace de "olvide mi contrasena".
// Supabase ya le dejo con sesion iniciada al abrir el enlace, asi que aqui solo
// falta pedirle la clave nueva. No se puede cerrar: si se cierra sin cambiarla,
// la persona se queda dentro con la contrasena vieja, que es justo la que no
// recordaba.

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
    <div style={fondo}>
      <div style={ventana}>
        <h2 style={{ margin: '0 0 6px', fontSize: '18px', color: '#F1F5F9' }}>Elige una contraseña nueva</h2>
        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94A3B8' }}>
          Ya estás dentro. Solo falta que pongas la contraseña con la que vas a entrar de ahora en adelante.
        </p>

        <form onSubmit={enviar}>
          <label style={etiqueta}>Contraseña nueva</label>
          <input
            type="password" required minLength={6} value={password}
            autoComplete="new-password" onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" style={campo}
          />

          <label style={etiqueta}>Repítela</label>
          <input
            type="password" required minLength={6} value={repetir}
            autoComplete="new-password" onChange={(e) => setRepetir(e.target.value)}
            style={campo}
          />

          {error && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #EF4444', color: '#FECACA', fontSize: '12px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={enviando} style={{ ...boton, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </form>

        <button onClick={cerrarSesion} style={enlace}>
          Cancelar y cerrar sesión
        </button>
      </div>
    </div>
  )
}

const fondo = {
  position: 'fixed', inset: 0, zIndex: 4000,
  backgroundColor: 'rgba(2, 8, 20, 0.92)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
}
const ventana = {
  width: '100%', maxWidth: '380px', padding: '22px', borderRadius: '16px',
  backgroundColor: '#0A1628', border: '1px solid #22D3EE',
  boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
}
const etiqueta = {
  display: 'block', fontSize: '11px', color: '#94A3B8',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', marginTop: '14px'
}
const campo = {
  width: '100%', boxSizing: 'border-box', padding: '11px 12px',
  borderRadius: '8px', border: '1px solid #1E3A5F',
  backgroundColor: '#0F2744', color: '#F1F5F9', fontSize: '14px'
}
const boton = {
  width: '100%', marginTop: '18px', padding: '12px',
  borderRadius: '10px', border: 'none',
  backgroundColor: '#22D3EE', color: '#0A1628',
  fontSize: '14px', fontWeight: '700', cursor: 'pointer'
}
const enlace = {
  marginTop: '12px', background: 'none', border: 'none',
  color: '#64748B', fontSize: '12px', cursor: 'pointer', padding: 0
}

export default ResetPassword
