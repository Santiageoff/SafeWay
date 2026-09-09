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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
      {vehicles.map((vehicle) => {
        const isSelected = selected === vehicle.id
        return (
          <button
            key={vehicle.id}
            onClick={() => onSelect(vehicle.id)}
            title={vehicle.id === 'publico' ? 'TransMilenio, SITP y buses' : vehicle.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px',
              borderRadius: '12px',
              border: isSelected ? '1px solid #22D3EE' : '1px solid #1E3A5F',
              backgroundColor: isSelected ? '#065A82' : '#0F2744',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '20px', marginBottom: '4px' }}>{vehicle.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: '500', color: isSelected ? 'white' : '#94A3B8' }}>
              {vehicle.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default VehicleSelector
