// Fuente oficial de las cifras de una localidad, para mostrarla junto al dato
// (OT-010): quien ve un porcentaje de inseguridad tiene que poder saber de
// dónde sale y qué tan reciente es.

export function formatDataSource(zone) {
  if (!zone?.source) return null

  const corte = zone.updatedAt
    ? new Date(zone.updatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return corte ? `Fuente: ${zone.source}, corte ${corte}` : `Fuente: ${zone.source}`
}
