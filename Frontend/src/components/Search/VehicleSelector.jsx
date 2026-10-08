// Cinco medios. `publico` (TransMilenio, SITP y buses) es nuevo: sin él, el
// caso más común de Bogotá —el cosquilleo y el hurto de celular en el bus—
// no tenía dónde caer. Ir sentado en un articulado no es lo mismo que ir manejando.
const vehicles = [
  { id: 'carro', icon: '🚗', label: 'Carro' },
  { id: 'moto', icon: '🏍️', label: 'Moto' },
  { id: 'bici', icon: '🚲', label: 'Bici' },
  { id: 'peatón', icon: '🚶', label: 'A pie' },
  { id: 'publico', icon: '🚌', label: 'Público' },
]

function VehicleSelector({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {vehicles.map((vehicle) => {
        const isSelected = selected === vehicle.id
        return (
          <button
            key={vehicle.id}
            onClick={() => onSelect(vehicle.id)}
            title={vehicle.id === 'publico' ? 'TransMilenio, SITP y buses' : vehicle.label}
            className={
              'flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-campo border-3 border-texto px-1 py-2 transition-colors ' +
              (isSelected ? 'bg-acento text-white shadow-dura-chica' : 'bg-superficie text-texto-tenue')
            }
          >
            <span className="text-lg leading-none">{vehicle.icon}</span>
            <span className="text-[10px] font-semibold">{vehicle.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default VehicleSelector
