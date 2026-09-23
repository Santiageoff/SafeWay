# Requisitos y criterios de aceptación

Fuente: documento del proyecto (Acta de Constitución, Enunciado del Alcance y EDT, 2.º corte).
Cada requisito dice **de dónde sale**, **qué paquete de la EDT lo entrega** y **cómo se
comprueba**. Si un PR dice cumplir un requisito, la columna *Cómo se verifica* es lo que se revisa.

Estado al 2026-09-23: ✅ cumple con evidencia · 🟡 parcial · ❌ pendiente · 🔀 entra al alcance por
el cambio CR-001 (aprobado el 2026-09-23).

## Funcionales

| ID | Requisito | Fuente | EDT | Criterio de aceptación | Cómo se verifica | Estado |
|---|---|---|---|---|---|---|
| RF-01 | Exponer el nivel de riesgo de las 20 localidades por API | IV.C, VII.A | 3.1 · 3.2 | 99 % de las 20 localidades con nivel de riesgo; endpoints documentados y probados | `Backend/test/localidades.test.js` · `docs/api.md` | 🟡 |
| RF-02 | Conmutar automáticamente a un dataset de respaldo si la fuente principal falla | III.D.1, IV.C | 3.3 | Opera sin interrupción al simular falla de Supabase | `Backend/test/respaldo.test.js` (falla por rechazo ✅; por cuelgue ❌) | 🟡 |
| RF-03 | Integrar tres tipos de datos complementarios: zonas residenciales, transporte público y vehículos particulares | IV.A, VII.A | 3.4 | ≥ 1 fuente cargada por tipo, en las localidades con información | Consulta a la base por tipo de fuente | ❌ |
| RF-04 | Ingresar origen, destino y medio de transporte | IV.C | 4.1 | Acepta direcciones o lugares (no solo nombres de localidad) | Prueba de API con geocodificación simulada | 🟡 |
| RF-05 | Geolocalizar origen y destino y calcular la ruta según el medio | III.D.2 | 4.1 | Respuesta < 5 s en el 90 % de las consultas | Medición de 20 consultas (p90) adjunta al PR | 🟡 |
| RF-06 | Generar un puntaje y un nivel de riesgo global por ruta | III.D.2 | 4.2 | Puntaje y nivel bajo/medio/alto calculado sobre la ruta trazada | Prueba unitaria del cálculo con rutas sintéticas | 🟡 |
| RF-07 | Mapa interactivo con burbujas de riesgo por localidad y panel de resultados (distancia, tiempo, zonas cercanas) | III.D.3 | 4.3 | Mapa funcional con burbujas; carga inicial < 3 s | Lighthouse en el PR · revisión visual | 🟡 |
| RF-08 | Perfil de riesgo proactivo: alerta cuando cambia el riesgo de una ruta frecuente | IV.A | 4.4 | ≥ 50 % de los usuarios de prueba reciben una alerta antes de su consulta habitual | Prueba del detector con historial sintético + protocolo con usuarios | ❌ 🔀 |
| RF-09 | Cuentas de usuario opcionales | — (CR-001) | 4.4 | El análisis de ruta nunca exige sesión | Prueba: `POST /api/route/analyze` sin token responde 200 | 🔀 |
| RF-10 | Reportes ciudadanos de hurto, mostrados como no verificados | — (CR-001) | 3.4 | Con sesión, máx. 5 al día, 30 s para deshacer; la capa pública no expone datos personales | `npm run verify:rls` · `npm run verify:api` | 🔀 |
| RF-11 | Registro del historial de consultas para el perfil proactivo, con consentimiento | IV.C, IV.E (CR-001) | 4.4 | Solo con consentimiento registrado; el usuario puede borrarlo | Prueba del flujo de consentimiento | ❌ 🔀 |
| RF-12 | Registrar los indicadores: % rutas que evitan riesgo alto, tiempo de respuesta, % consultas con datos reales vs respaldo | III.F | 5.3 | Resumen consultable sin datos personales | Prueba del endpoint de métricas | ❌ |

## No funcionales

| ID | Requisito | Fuente | Criterio | Cómo se verifica | Estado |
|---|---|---|---|---|---|
| RNF-01 | Arquitectura desacoplada en tres capas | IV.C | Reglas R1-R3 del [ADR-001](arquitectura/adr/ADR-001-tres-capas.md) | `node tools/verificar-capas.js` en el CI | ✅ |
| RNF-02 | Continuidad ante fallas de la fuente principal | IV.C | = RF-02, y timeout en toda llamada externa | `Backend/test/respaldo.test.js` | 🟡 |
| RNF-03 | Diseño responsive multi-dispositivo | III.E, IV.C | Usable a 375 px sin scroll horizontal | Capturas a 375 y 1280 px en el PR | ❌ |
| RNF-04 | Replicable a otras ciudades sin cambiar la experiencia | IV.C | La ciudad y sus zonas salen de los datos, no del código | Revisión de código | 🟡 |
| RNF-05 | Licencia MIT del código | IV.E | `LICENSE` MIT y `license: MIT` en los `package.json` | Archivo en el repo | ✅ |
| RNF-06 | Atribución ODbL de OpenStreetMap visible en el mapa | IV.E | "© OpenStreetMap contributors" en cada mapa | Revisión visual + búsqueda en el código | ❌ |
| RNF-07 | Cifras citadas a la Secretaría de Seguridad y la Policía (SIEDCO) | IV.E | Fuente y fecha de corte visibles junto a la cifra | Revisión visual | 🟡 |
| RNF-08 | Aviso de que no reemplaza la Línea 123 ni a las autoridades | IV.E | Aviso permanente en la interfaz | `Frontend/src/components/Alert/ReportButton.jsx` | ✅ |
| RNF-09 | Tratamiento de datos personales conforme a la Ley 1581 / Decreto 1377 | IV.E | Política de privacidad, consentimiento y borrado | Revisión + prueba del flujo | 🔀 |
| RNF-10 | Infraestructura en capas gratuitas (Supabase, Vercel, Render, Nominatim) | VII.D | Costo mensual $0 durante el curso | Revisión de cuentas | ✅ |

## Fuera de alcance de esta versión (VII.B)

Integración en vivo con fuentes oficiales · desagregación por barrio o tramo de vía · alertas que
reemplacen la Línea 123 · aplicaciones móviles nativas · comercialización · cobertura fuera de
Bogotá. Las cuentas de usuario y los reportes ciudadanos estaban en esta lista y entran al
alcance por el cambio CR-001, como opcionales y con consentimiento
([ADR-005](arquitectura/adr/ADR-005-cuentas-opcionales-y-reportes.md)).
