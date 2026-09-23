import { createContext } from 'react'

// El objeto de contexto, separado del provider y del hook.
// React Fast Refresh solo recarga en caliente los archivos que exportan
// unicamente componentes, asi que el contexto y el hook van en sus propios
// archivos aunque conceptualmente sean la misma pieza.
export const AuthContext = createContext(null)
