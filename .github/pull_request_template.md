## Qué cambia

<!-- Una o dos frases. -->

Closes #

## Paquete EDT y criterio de aceptación

- **Paquete EDT:** <!-- ej. 4.1 Motor de geolocalización y cálculo de rutas -->
- **Criterio que cumple:** <!-- copia el texto del issue o de docs/requisitos.md -->
- **Cómo se demuestra:** <!-- la prueba (archivo y nombre del test), o captura / informe adjunto -->

## Checklist

- [ ] `cd Backend && npm test` pasa en local
- [ ] `cd Frontend && npm run lint && npm run build` pasa en local
- [ ] `node tools/verificar-capas.js` pasa
- [ ] Si cambié un endpoint, actualicé `docs/api.md`
- [ ] Si cambié la base de datos, es una migración nueva con RLS
- [ ] No hay `.env`, llaves ni tokens en el diff
- [ ] Si toca la interfaz: capturas a 375 px y a 1280 px
