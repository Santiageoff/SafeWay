import { useState } from 'react'
import { useAuth } from '../../context/useAuth'
import AuthModal from './AuthModal'

// Barra de sesion del panel lateral. Con sesion muestra quien eres y deja
// salir; sin ella, invita a entrar sin bloquear nada: el mapa se ve igual.

function UserMenu() {
  const { haySesion, user, cerrarSesion, disponible } = useAuth()
  const [abierto, setAbierto] = useState(false)

  if (!disponible) {
    return (
      <div style={{ ...caja, borderColor: '#F59E0B', color: '#FCD34D' }}>
        ⚠ Falta configurar Supabase en Frontend/.env: no se puede iniciar sesión.
      </div>
    )
  }

  if (!haySesion) {
    return (
      <>
        <button onClick={() => setAbierto(true)} style={botonEntrar}>
          Iniciar sesión
        </button>
        <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#64748B', lineHeight: 1.4 }}>
          El mapa se ve sin cuenta. La sesión hace falta para reportar.
        </p>
        {abierto && <AuthModal onClose={() => setAbierto(false)} />}
      </>
    )
  }

  const nombre = user.user_metadata?.display_name || user.email?.split('@')[0]

  return (
    <div style={caja}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#F1F5F9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre}
          </div>
          <div style={{ fontSize: '10px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        </div>
        <button onClick={cerrarSesion} style={botonSalir}>Salir</button>
      </div>
    </div>
  )
}

const caja = {
  padding: '10px 12px', borderRadius: '10px',
  backgroundColor: '#0F2744', border: '1px solid #1E3A5F',
  fontSize: '11px', lineHeight: 1.5
}
const botonEntrar = {
  width: '100%', padding: '10px', borderRadius: '10px',
  border: '1px solid #22D3EE', backgroundColor: 'transparent',
  color: '#22D3EE', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
}
const botonSalir = {
  flexShrink: 0, padding: '6px 10px', borderRadius: '8px',
  border: '1px solid #1E3A5F', backgroundColor: 'transparent',
  color: '#94A3B8', fontSize: '11px', cursor: 'pointer'
}

export default UserMenu
