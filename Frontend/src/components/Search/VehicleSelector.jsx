const vehicles = [
  { id: 'carro', icon: '🚗', label: 'Carro' },
  { id: 'moto', icon: '🏍️', label: 'Moto' },
  { id: 'bici', icon: '🚲', label: 'Bici' },
  { id: 'peatón', icon: '🚶', label: 'Peatón' },
]

function VehicleSelector({ selected, onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
      {vehicles.map((vehicle) => {
        const isSelected = selected === vehicle.id
        return (
          <button
            key={vehicle.id}
            onClick={() => onSelect(vehicle.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              borderRadius: '12px',
              border: isSelected ? '1px solid #22D3EE' : '1px solid #1E3A5F',
              backgroundColor: isSelected ? '#065A82' : '#0F2744',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '24px', marginBottom: '4px' }}>{vehicle.icon}</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: isSelected ? 'white' : '#94A3B8' }}>
              {vehicle.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default VehicleSelector