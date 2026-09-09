// Los seis tipos que cubre el botón de alerta.
// `modes` documenta a qué medio de transporte afecta cada uno: es el filtro
// que define la función. El backend tiene la copia autoritativa en
// reportService.TYPE_TO_MODES; esto es solo para explicárselo al usuario.
export const REPORT_TYPES = [
  { id: 'celular', icon: '📱', label: 'Celular', modes: ['peatón', 'publico'] },
  { id: 'moto', icon: '🏍️', label: 'Moto', modes: ['moto'] },
  { id: 'carro', icon: '🚗', label: 'Carro', modes: ['carro'] },
  { id: 'bici', icon: '🚲', label: 'Bici', modes: ['bici'] },
  { id: 'transmilenio', icon: '🚌', label: 'TransMi / SITP', modes: ['publico'] },
  { id: 'vivienda', icon: '🏠', label: 'Vivienda', modes: [] },
]

export const typeById = (id) => REPORT_TYPES.find(t => t.id === id) || null
