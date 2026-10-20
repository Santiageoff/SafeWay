// Mismas franjas horarias que usa el motor de riesgo (dynamicRiskService.js
// en el backend): se repiten aquí solo como texto, para mostrar las rutas
// habituales y las alertas.
export const WINDOW_LABELS = {
  madrugada: 'madrugada (12am-6am)',
  mañana: 'mañana (6am-12m)',
  tarde: 'tarde (12m-6pm)',
  noche: 'noche (6pm-12am)'
}

// 0 = domingo, igual que lo documenta docs/api.md.
export const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function nombreLocalidad(zonesById, id) {
  return zonesById?.[id]?.name || `Localidad ${id}`
}

export function formatDiasSemana(dias) {
  if (!Array.isArray(dias) || dias.length === 0) return ''
  return [...dias].sort((a, b) => a - b).map(d => DAY_LABELS[d] ?? '?').join(', ')
}

export function formatFechaRelativa(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const horas = Math.round(diffMs / 3_600_000)
  if (horas < 1) return 'hace un momento'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}
