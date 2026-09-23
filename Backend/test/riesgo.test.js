// RF-06 · EDT 4.2 — "Puntaje y nivel (bajo/medio/alto) calculado para cada ruta"
//
// Prueba el motor que le pone nivel a cada localidad según el medio de
// transporte (`dynamicRiskService`). Sin reportes ciudadanos, el nivel tiene que
// coincidir con el dato oficial: los reportes pueden subirlo, nunca inventarlo.

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildZones, levelFromPercentage, THRESHOLD_MEDIUM, THRESHOLD_HIGH } =
    require('../src/services/dynamicRiskService')
const { localities } = require('../src/data/localities')

const NIVELES = ['low', 'medium', 'high']
const MEDIOS = ['carro', 'moto', 'bici', 'peatón', 'publico']

test('los umbrales separan bajo, medio y alto', () => {
    assert.equal(levelFromPercentage(0), 'low')
    assert.equal(levelFromPercentage(THRESHOLD_MEDIUM - 1), 'low')
    assert.equal(levelFromPercentage(THRESHOLD_MEDIUM), 'medium')
    assert.equal(levelFromPercentage(THRESHOLD_HIGH - 1), 'medium')
    assert.equal(levelFromPercentage(THRESHOLD_HIGH), 'high')
    assert.equal(levelFromPercentage(100), 'high')
})

for (const medio of MEDIOS) {
    test(`sin reportes, las 20 zonas tienen un nivel válido para ${medio}`, () => {
        const { zones, mode } = buildZones([], { mode: medio, localities })
        assert.equal(mode, medio)
        assert.equal(zones.length, 20)
        for (const z of zones) {
            assert.ok(NIVELES.includes(z.riskLevel), `${z.name}: nivel inválido`)
            assert.equal(z.riskLevel, z.vehicleRisks[medio], `${z.name}: riskLevel no es el del medio`)
            assert.ok(z.insecurityPercentage >= 0 && z.insecurityPercentage <= 100)
            assert.equal(z.safetyScore, 100 - z.insecurityPercentage)
        }
    })
}

test('sin reportes, el nivel es el del dato oficial (los reportes no inventan riesgo)', () => {
    for (const medio of ['carro', 'moto', 'bici', 'peatón']) {
        const { zones } = buildZones([], { mode: medio, localities })
        for (const z of zones) {
            const oficial = localities.find(l => l.id === z.id)
            assert.equal(z.riskLevel, oficial.vehicleRisks[medio],
                `${z.name} en ${medio}: el motor dice ${z.riskLevel}, el dato oficial ${oficial.vehicleRisks[medio]}`)
        }
    }
})

test('un medio desconocido cae a carro en vez de romper', () => {
    const { mode, zones } = buildZones([], { mode: 'avion', localities })
    assert.equal(mode, 'carro')
    assert.equal(zones.length, 20)
})
