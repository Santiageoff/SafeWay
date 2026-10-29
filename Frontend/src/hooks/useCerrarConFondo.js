import { useRef } from 'react'

// Cerrar una ventana al tocar el fondo oscuro, SIN cerrarla por accidente.
//
// Antes se cerraba con onClick si el clic caía en el fondo. Pero si la
// persona presiona dentro del formulario (seleccionando texto, o escogiendo
// una sugerencia de autocompletar) y suelta el mouse afuera, el navegador
// reporta el clic en el fondo, y la ventana se cerraba con todo lo escrito.
// Ahora solo se cierra si el clic EMPEZÓ y TERMINÓ en el fondo.
//
// Uso: <div {...useCerrarConFondo(onClose)} className="fixed inset-0 …">
export function useCerrarConFondo(onClose) {
  const empezoEnFondo = useRef(false)
  return {
    onMouseDown: (e) => { empezoEnFondo.current = e.target === e.currentTarget },
    onClick: (e) => {
      if (empezoEnFondo.current && e.target === e.currentTarget) onClose?.()
      empezoEnFondo.current = false
    }
  }
}
