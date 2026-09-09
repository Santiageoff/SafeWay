// Fuente única de verdad de las 20 localidades de Bogotá.
//
// Antes esta lista estaba duplicada en risk.routes.js y route.route.js: cualquier
// ajuste había que hacerlo dos veces y el riesgo dinámico se habría calculado
// distinto en cada endpoint. Ahora ambos importan de aquí.
//
// `insecurityPercentage` es la LÍNEA BASE histórica (cifras oficiales).
// Los reportes ciudadanos no la modifican: se suman aparte en dynamicRiskService.

const localities = [
    {
        id: 1,
        name: "Usaquén",
        coordinates: [4.7015, -74.0307],
        riskLevel: "low",
        description: "Zona residencial al norte de Bogotá con buena infraestructura vial",
        vehicleRisks: { carro: "low", moto: "low", bici: "low", peatón: "low" },
        accidents: 120,
        thefts: 45,
        insecurityPercentage: 18,
        safetyScore: 82,
        recommendation: "Zona segura. En carro, moto, bici y peatón el riesgo es bajo. Adecuado para circular a cualquier hora con precauciones normales."
    },
    {
        id: 2,
        name: "Chapinero",
        coordinates: [4.6473, -74.0662],
        riskLevel: "medium",
        description: "Zona comercial y residencial con tráfico moderado",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 280,
        thefts: 120,
        insecurityPercentage: 42,
        safetyScore: 58,
        recommendation: "Zona de riesgo medio. En carro moderada precaución. Moto alto riesgo, evitar de noche. Bici y peatón precaución moderada, evitando zonas aisladas."
    },
    {
        id: 3,
        name: "Santa Fe",
        coordinates: [4.5769, -74.0750],
        riskLevel: "high",
        description: "Centro histórico con alta concentración de peatones y tráfico vehicular",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 520,
        thefts: 380,
        insecurityPercentage: 88,
        safetyScore: 12,
        recommendation: "Zona de alto riesgo. Evitar transitar a pie de noche. En carro moderada precaución. Moto y bici alto riesgo, evitar horarios nocturnos."
    },
    {
        id: 4,
        name: "San Cristóbal",
        coordinates: [4.5490, -74.0833],
        riskLevel: "high",
        description: "Zona popular al sur con infraestructura vial limitada",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 480,
        thefts: 290,
        insecurityPercentage: 76,
        safetyScore: 24,
        recommendation: "Zona de alto riesgo. Evitar transitar a pie especialmente de noche. En carro y moto precaución extrema. Bici no recomendada."
    },
    {
        id: 5,
        name: "Usme",
        coordinates: [4.4787, -74.1282],
        riskLevel: "high",
        description: "Zona periférica con altas tasas de accidentalidad",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 410,
        thefts: 250,
        insecurityPercentage: 81,
        safetyScore: 19,
        recommendation: "Zona de alto riesgo. Alto riesgo para todos los medios de transporte. Evitar zona de noche. En carro mantener puertas bloqueadas."
    },
    {
        id: 6,
        name: "Tunjuelito",
        coordinates: [4.5731, -74.1331],
        riskLevel: "medium",
        description: "Zona residencial con tráfico moderado",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 220,
        thefts: 130,
        insecurityPercentage: 63,
        safetyScore: 37,
        recommendation: "Zona de riesgo medio. En carro precaución moderada. Moto alto riesgo. Bici y peatón precaución, evitar calles oscuras."
    },
    {
        id: 7,
        name: "Bosa",
        coordinates: [4.5984, -74.2019],
        riskLevel: "medium",
        description: "Zona industrial y residencial en expansión",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 310,
        thefts: 180,
        insecurityPercentage: 58,
        safetyScore: 42,
        recommendation: "Zona de riesgo medio. En carro circulación segura. Moto alto riesgo, usar equipo de protección. Bici y peatón precaución moderada."
    },
    {
        id: 8,
        name: "Kennedy",
        coordinates: [4.6280, -74.1663],
        riskLevel: "high",
        description: "Una de las localidades más pobladas con alto flujo vehicular",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 650,
        thefts: 420,
        insecurityPercentage: 79,
        safetyScore: 21,
        recommendation: "Zona de alto riesgo. Alto riesgo para todos los vehículos. Evitar circulación nocturna. Puertas bloqueadas en carro, moto evitar zonas aisladas."
    },
    {
        id: 9,
        name: "Fontibón",
        coordinates: [4.6727, -74.1469],
        riskLevel: "medium",
        description: "Zona industrial y comercial con buen mantenimiento vial",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 240,
        thefts: 110,
        insecurityPercentage: 45,
        safetyScore: 55,
        recommendation: "Zona de riesgo medio. En carro riesgo bajo. Moto alto riesgo por tráfico pesado. Bici y peatón precaución por vehículos industriales."
    },
    {
        id: 10,
        name: "Engativá",
        coordinates: [4.7044, -74.1139],
        riskLevel: "low",
        description: "Zona residencial con buena infraestructura y señalización",
        vehicleRisks: { carro: "low", moto: "low", bici: "low", peatón: "low" },
        accidents: 180,
        thefts: 80,
        insecurityPercentage: 38,
        safetyScore: 62,
        recommendation: "Zona segura. Todos los medios de transporte tienen riesgo bajo. Adecuada para circular con precauciones habituales."
    },
    {
        id: 11,
        name: "Suba",
        coordinates: [4.7558, -74.0833],
        riskLevel: "low",
        description: "Zona residencial al noroccidente con vías amplias",
        vehicleRisks: { carro: "low", moto: "low", bici: "low", peatón: "low" },
        accidents: 150,
        thefts: 70,
        insecurityPercentage: 22,
        safetyScore: 78,
        recommendation: "Zona segura. Circulación comfortable para carro, moto, bici y peatón. Buen mantenimiento vial."
    },
    {
        id: 12,
        name: "Barrios Unidos",
        coordinates: [4.6697, -74.0836],
        riskLevel: "medium",
        description: "Zona comercial con tráfico moderado",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 260,
        thefts: 140,
        insecurityPercentage: 47,
        safetyScore: 53,
        recommendation: "Zona de riesgo medio. En carro precaución moderada. Moto alto riesgo por congestionamiento. Bici y peatón cautela en horas pico."
    },
    {
        id: 13,
        name: "Teusaquillo",
        coordinates: [4.6445, -74.0934],
        riskLevel: "low",
        description: "Zona residencial y universitaria con buena infraestructura",
        vehicleRisks: { carro: "low", moto: "low", bici: "low", peatón: "low" },
        accidents: 130,
        thefts: 55,
        insecurityPercentage: 21,
        safetyScore: 79,
        recommendation: "Zona muy segura. Ideal para todos los medios de transporte. Universidad y zonas residenciales con bajo índice de criminalidad."
    },
    {
        id: 14,
        name: "Los Mártires",
        coordinates: [4.6028, -74.0892],
        riskLevel: "high",
        description: "Centro de la ciudad con alta concentración de delitos y accidentes",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 580,
        thefts: 450,
        insecurityPercentage: 84,
        safetyScore: 16,
        recommendation: "Zona de muy alto riesgo. Evitar transitar a pie o en bicicleta. En carro y moto extrema precaución, mantener puertas bloqueadas."
    },
    {
        id: 15,
        name: "Antonio Nariño",
        coordinates: [4.5847, -74.1014],
        riskLevel: "medium",
        description: "Zona central con tráfico mixto",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 290,
        thefts: 160,
        insecurityPercentage: 55,
        safetyScore: 45,
        recommendation: "Zona de riesgo medio. En carro precaución. Moto alto riesgo. Bici y peatón circulando con cautela, evitar zonas industriales."
    },
    {
        id: 16,
        name: "Puente Aranda",
        coordinates: [4.6230, -74.1130],
        riskLevel: "medium",
        description: "Zona industrial con alto flujo de camiones",
        vehicleRisks: { carro: "medium", moto: "high", bici: "medium", peatón: "medium" },
        accidents: 320,
        thefts: 190,
        insecurityPercentage: 51,
        safetyScore: 49,
        recommendation: "Zona de riesgo medio-alto. Alto flujo de camiones. En carro atención a maniobras de carga. Moto y bici evitar horas de carga."
    },
    {
        id: 17,
        name: "La Candelaria",
        coordinates: [4.5962, -74.0748],
        riskLevel: "high",
        description: "Centro histórico con alto flujo de peatones y turistas",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 490,
        thefts: 520,
        insecurityPercentage: 86,
        safetyScore: 14,
        recommendation: "Zona de muy alto riesgo. Alto riesgo para todos los medios. Evitar zona de noche. Turismo solo en grupo y horarios diurnos."
    },
    {
        id: 18,
        name: "Rafael Uribe",
        coordinates: [4.5480, -74.1082],
        riskLevel: "high",
        description: "Zona popular al sur con infraestructura limitada",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 440,
        thefts: 270,
        insecurityPercentage: 72,
        safetyScore: 28,
        recommendation: "Zona de alto riesgo. Alto riesgo para peatones y ciclistas. En carro y moto precaución extrema, evitar paradas."
    },
    {
        id: 19,
        name: "Ciudad Bolívar",
        coordinates: [4.4934, -74.1719],
        riskLevel: "high",
        description: "Zona periférica al sur con altas tasas de criminalidad",
        vehicleRisks: { carro: "high", moto: "high", bici: "high", peatón: "high" },
        accidents: 470,
        thefts: 310,
        insecurityPercentage: 83,
        safetyScore: 17,
        recommendation: "Zona de alto riesgo. Evitar transitar a pie o en bicicleta. En carro y moto usar vías principales, no detenerse."
    },
    {
        id: 20,
        name: "Sumapaz",
        coordinates: [4.0269, -74.3594],
        riskLevel: "low",
        description: "Zona rural al sur de Bogotá con poco tráfico vehicular",
        vehicleRisks: { carro: "low", moto: "low", bici: "low", peatón: "low" },
        accidents: 25,
        thefts: 10,
        insecurityPercentage: 12,
        safetyScore: 88,
        recommendation: "Zona muy segura y rural. Ideal para todos los medios de transporte. Poco tráfico y baja criminalidad."
    }
]

module.exports = { localities }
