# Cómo trabajamos en SafeWay

## La regla

**Nadie escribe directo en `main`.** Todo cambio entra por pull request, con el CI en verde y la
revisión del director del proyecto. `main` es lo que se muestra en la sustentación: tiene que
funcionar siempre.

## El flujo

1. **Toma un issue** (o pide que se cree uno). Cada issue dice qué paquete de la EDT cubre, qué
   hacer y **cómo se verifica**.
2. **Crea una rama** desde `main` actualizado:
   ```bash
   git switch main && git pull
   git switch -c feat/12-geocodificacion-nominatim
   ```
   Prefijos: `feat/` funcionalidad · `fix/` corrección · `docs/` documentación ·
   `test/` pruebas · `chore/` mantenimiento. Incluye el número del issue.
3. **Commits pequeños** con [Conventional Commits](https://www.conventionalcommits.org/es/),
   en español:
   ```
   feat(rutas): geocodificar origen y destino con Nominatim
   fix(datos): timeout en la lectura de localidades
   ```
4. **Antes de abrir el PR**, en local:
   ```bash
   cd Backend && npm test
   cd Frontend && npm run lint && npm run build
   node tools/verificar-capas.js
   ```
5. **Abre el PR** hacia `main` y llena la plantilla: qué paquete EDT cierra, qué criterio de
   aceptación cumple y **qué prueba lo demuestra**. Pon `Closes #<issue>`.
6. **Revisión**: el director revisa contra el criterio del issue. Si pide cambios, se hacen en la
   misma rama.
7. **Fusiona el autor** (squash) cuando haya aprobación y CI verde. Luego borra la rama.

Si algo ya fusionado rompe `main`: `git revert`, nunca `git reset` ni `push --force`.

## Dónde va cada cosa (tres capas, [ADR-001](docs/arquitectura/adr/ADR-001-tres-capas.md))

- `Backend/src/routes/`: solo HTTP — validar la entrada, llamar a un servicio, responder.
- `Backend/src/services/`: la lógica y el acceso a datos. Aquí se habla con Supabase y OSRM.
  No importa Express.
- `Frontend/`: la interfaz. Pide los datos **a la API**; a Supabase solo le habla para la sesión.
- Cambios a la base de datos: **siempre** como migración nueva en `supabase/migrations/`, con RLS.

`node tools/verificar-capas.js` revisa esto automáticamente en el CI.

## Pruebas

- Backend: `node:test` en `Backend/test/`. Si tu PR cierra un criterio de aceptación, trae la
  prueba que lo demuestra. Una prueba tiene que **poder fallar**: revierte tu cambio y mira que
  se ponga roja.
- Frontend: lint + build en el CI; para criterios visuales (responsive, carga < 3 s), capturas o
  el informe de Lighthouse en el PR.

## Lo que nunca se sube

- `.env` de ninguna carpeta, ni llaves, ni tokens. Si ves un `.env` en `git status`, detente.
- `node_modules/`, `dist/`.
- Configuración personal de tu editor o de tus herramientas.

## Alcance

Lo que se construye está en el documento del proyecto (Acta, EDT y criterios de aceptación) y
en [docs/requisitos.md](docs/requisitos.md). Si quieres agregar algo que no está ahí, primero
se propone como cambio de alcance al director; no se mete de una en un PR.
