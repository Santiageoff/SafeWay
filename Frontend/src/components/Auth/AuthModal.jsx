import { useState } from 'react'
import { useAuth } from '../../context/useAuth'

// Registro, inicio de sesion y recuperacion de contrasena, en una sola ventana.
//
// `motivo` explica POR QUE se esta pidiendo la sesion. No es lo mismo que
// alguien pulse "entrar" a que le acaben de robar y el boton le pida una
// cuenta: en ese caso hay que decirlo de frente, y recordarle el 123.

const MODOS = { entrar: 'entrar', registro: 'registro', olvide: 'olvide' }

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
    entrar: 'Inicia sesión',
    registro: 'Crea tu cuenta',
    olvide: 'Recuperar contraseña'
  }

  return (
    <div style={fondo} onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div style={ventana}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#F1F5F9' }}>{titulos[modo]}</h2>
          <button onClick={onClose} style={cerrar}>✕</button>
        </div>

        {motivo && (
          <div style={motivoCaja}>
            {motivo}
          </div>
        )}

        <form onSubmit={enviar}>
          <label style={etiqueta}>Correo</label>
          <input
            type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com" style={campo}
          />

          {modo === MODOS.registro && (
            <>
              <label style={etiqueta}>¿Cómo te llamamos? (opcional)</label>
              <input
                value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Santi" style={campo} maxLength={60}
              />
            </>
          )}

          {modo !== MODOS.olvide && (
            <>
              <label style={etiqueta}>Contraseña</label>
              <input
                type="password" required minLength={6} value={password}
                autoComplete={modo === MODOS.registro ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" style={campo}
              />
            </>
          )}

          {error && <div style={{ ...caja, borderColor: '#EF4444', color: '#FECACA' }}>{error}</div>}
          {aviso && <div style={{ ...caja, borderColor: '#22D3EE', color: '#A5F3FC' }}>{aviso}</div>}

          <button type="submit" disabled={enviando} style={{ ...boton, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Un momento…'
              : modo === MODOS.registro ? 'Crear cuenta'
              : modo === MODOS.olvide ? 'Enviarme el enlace'
              : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {modo === MODOS.entrar && (
            <>
              <button onClick={() => { setModo(MODOS.registro); setError(null); setAviso(null) }} style={enlace}>
                ¿No tienes cuenta? Créala
              </button>
              <button onClick={() => { setModo(MODOS.olvide); setError(null); setAviso(null) }} style={enlace}>
                Olvidé mi contraseña
              </button>
            </>
          )}
          {modo !== MODOS.entrar && (
            <button onClick={() => { setModo(MODOS.entrar); setError(null); setAviso(null) }} style={enlace}>
              Volver a iniciar sesión
            </button>
          )}
        </div>

        <p style={{ marginTop: '16px', marginBottom: 0, fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
          Solo guardamos tu correo para identificarte. El mapa de riesgo se puede
          ver sin cuenta; la sesión hace falta para reportar y para tus datos.
        </p>
      </div>
    </div>
  )
}

const fondo = {
  position: 'fixed', inset: 0, zIndex: 3000,
  backgroundColor: 'rgba(2, 8, 20, 0.8)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
}
const ventana = {
  width: '100%', maxWidth: '380px', padding: '22px', borderRadius: '16px',
  backgroundColor: '#0A1628', border: '1px solid #1E3A5F',
  boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
}
const etiqueta = {
  display: 'block', fontSize: '11px', color: '#94A3B8',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', marginTop: '12px'
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
  background: 'none', border: 'none', color: '#22D3EE',
  fontSize: '12px', cursor: 'pointer', padding: 0, textAlign: 'left'
}
const caja = {
  marginTop: '14px', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid', backgroundColor: 'rgba(255,255,255,0.04)',
  fontSize: '12px', lineHeight: 1.5
}
const motivoCaja = {
  marginTop: '12px', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #F59E0B', backgroundColor: 'rgba(245,158,11,0.1)',
  color: '#FCD34D', fontSize: '12px', lineHeight: 1.5
}
const cerrar = {
  border: 'none', background: 'transparent', color: '#64748B',
  fontSize: '16px', cursor: 'pointer', padding: '4px'
}

export default AuthModal
