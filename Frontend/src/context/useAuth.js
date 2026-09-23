import { useContext } from 'react'
import { AuthContext } from './authContextObject'

// El hook vive aparte del provider: si un archivo exporta a la vez un
// componente y otras cosas, React Fast Refresh deja de recargar en caliente.
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
