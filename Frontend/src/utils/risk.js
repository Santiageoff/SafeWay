// Colores y etiquetas de riesgo del design system (docs/diseno/README.md),
// en un solo lugar: antes vivían repetidos con valores ligeramente
// distintos en MapView, RiskSummary y SearchBar.

export const RISK_LABELS = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo'
}

// Para estilos inline (Leaflet no puede leer clases de Tailwind en sus
// pathOptions).
export const RISK_HEX = {
  high: '#FF3B30',
  medium: '#FFC800',
  low: '#00B86B'
}

export const RISK_TEXT_HEX = {
  high: '#C21F14',
  medium: '#7A5A00',
  low: '#00703F'
}

// Para JSX normal, ya generadas como texto completo de clase (Tailwind
// necesita ver la clase literal en el código para incluirla en el build).
export const RISK_TAILWIND = {
  high: { bg: 'bg-riesgo-alto', text: 'text-riesgo-alto-texto' },
  medium: { bg: 'bg-riesgo-medio', text: 'text-riesgo-medio-texto' },
  low: { bg: 'bg-riesgo-bajo', text: 'text-riesgo-bajo-texto' }
}
