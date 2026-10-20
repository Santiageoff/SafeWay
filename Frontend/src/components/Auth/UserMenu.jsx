import { useState, lazy, Suspense } from 'react'
import { useAuth } from '../../context/useAuth'

// Solo se carga cuando alguien de verdad va a iniciar sesión: no bloquea el
// primer pintado del mapa (issue #12: LCP < 3s).
const AuthModal = lazy(() => import('./AuthModal'))

// Barra de sesion del panel lateral. Con sesion muestra quien eres y deja
// salir; sin ella, invita a entrar sin bloquear nada: el mapa se ve igual.
//
// `unseenAlerts` y `onOpenProfile` vienen de App.jsx: el perfil proactivo
// (issue #8) se maneja ahí, igual que pendingCount para los reportes.

function UserMenu({ unseenAlerts = 0, onOpenProfile }) {
  const { haySesion, user, cerrarSesion, disponible } = useAuth()
  const [abierto, setAbierto] = useState(false)

  if (!disponible) {
    return (
      <div className="rounded-campo border-3 border-texto bg-riesgo-medio px-3 py-2.5 text-[11px] leading-relaxed text-texto">
        ⚠ Falta configurar Supabase en Frontend/.env: no se puede iniciar sesión.
      </div>
    )
  }

  if (!haySesion) {
    return (
      <>
        <button
          onClick={() => setAbierto(true)}
          className="min-h-[44px] w-full rounded-boton border-3 border-texto bg-acento py-2.5 text-sm font-semibold text-white shadow-dura-chica"
        >
          Iniciar sesión
        </button>
        {/* En la barra compacta de celular no cabe: solo el botón. */}
        <p className="mt-1.5 hidden text-[10px] leading-relaxed text-texto-tenue md:block">
          El mapa se ve sin cuenta. La sesión hace falta para reportar.
        </p>
        {abierto && (
          <Suspense fallback={null}>
            <AuthModal onClose={() => setAbierto(false)} />
          </Suspense>
        )}
      </>
    )
  }

  const nombre = user.user_metadata?.display_name || user.email?.split('@')[0]

  return (
    <div className="rounded-campo border-3 border-texto bg-superficie px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-texto">{nombre}</div>
          <div className="truncate text-[10px] text-texto-tenue">{user.email}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onOpenProfile}
            className="relative rounded-campo border-3 border-texto bg-fondo px-2.5 py-1.5 text-[11px] font-semibold text-texto"
          >
            Perfil
            {unseenAlerts > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-texto bg-riesgo-alto px-1 text-[9px] font-bold text-texto">
                {unseenAlerts > 9 ? '9+' : unseenAlerts}
              </span>
            )}
          </button>
          <button
            onClick={cerrarSesion}
            className="rounded-campo border-3 border-texto bg-fondo px-2.5 py-1.5 text-[11px] font-semibold text-texto"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserMenu
