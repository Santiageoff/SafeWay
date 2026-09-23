# Diseño de la interfaz — opción D, "Brutalista vivo"

Entregable del paquete **2.3 Diseño UX/UI** (el documento decía Figma; se hizo en Claude Design).
El equipo eligió esta opción el 2026-09-23 entre 7 propuestas.

- **Diseño completo:** https://claude.ai/artifact/AcyhiBXpLFoE9FqKu1on29 (fila **D**, más la fila
  del logo arriba de todo).
- **Pantallas diseñadas:** principal en computador (1440 px) y en celular (390 px), reportar un robo
  y entrar. Lo que no está dibujado (detalle de una localidad, recuperar la contraseña, alertas y
  consentimiento del perfil proactivo) se hace con estas mismas reglas.
- **Quién lo implementa:** Juan Camilo, en el issue #10 (responsive). #11 y #12 siguen las
  mismas reglas.

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--fondo` | `#FFF4DE` | Fondo de la página (crema) |
| `--superficie` | `#FFFFFF` | Tarjetas, campos, hojas |
| `--texto` | `#111111` | Texto, bordes y sombras |
| `--texto-tenue` | `#3A3A3A` | Texto secundario |
| `--barra` | `#FFC800` | Barra superior |
| `--acento` | `#2F5BFF` | Botón principal, opción elegida, ruta en el mapa |
| `--enlace` | `#1F45E0` | Enlaces |
| `--riesgo-bajo` | `#00B86B` | Relleno de nivel bajo |
| `--riesgo-medio` | `#FFC800` | Relleno de nivel medio |
| `--riesgo-alto` | `#FF3B30` | Relleno de nivel alto y botón de reportar |
| `--riesgo-bajo-texto` | `#00703F` | Palabra "Bajo" sobre blanco |
| `--riesgo-medio-texto` | `#7A5A00` | Palabra "Medio" sobre blanco |
| `--riesgo-alto-texto` | `#C21F14` | Palabra "Alto" sobre blanco |
| `--ok-fondo` / `--aviso-fondo` | `#C8F5DC` / `#FFD9D6` | Confirmaciones / avisos |
| `--borde` | `3px solid #111111` | Tarjetas, campos, botones, chips |
| `--sombra` | `5px 5px 0 #111111` | Tarjetas y botón principal (sombra dura, sin desenfoque) |
| `--sombra-chica` | `3px 3px 0 #111111` | Opción elegida, botones pequeños |
| Radios | tarjeta 14 px · botón 12 px · campo y chip 10 px · pastilla 999 px | |

**Regla de contraste:** sobre los colores de riesgo el texto va **siempre en negro** `#111111`
(el blanco no alcanza 4,5:1 sobre el rojo ni el amarillo).

## Tipografía

- **Archivo Black**: títulos, botones principales y rótulos en mayúscula (`RIESGO ALTO`,
  `REPORTAR UN ROBO`).
- **Archivo** 400 / 600 / 800: todo lo demás.

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
```

## Estructura

**Computador (≥ 768 px):**
- Barra superior amarilla de 84 px con el logo, `SAFEWAY`, la etiqueta "Riesgo por localidad ·
  Bogotá" y el botón Entrar.
- A la izquierda, una columna de 440 px con dos tarjetas:
  - "Planea tu ruta": Desde y Hasta en dos columnas, los 5 medios y el botón `¡ANALIZAR RUTA!`.
  - Resultado: placa del nivel (`RIESGO ALTO` sobre rojo), 3 cifras (km, minutos, % de
    inseguridad) y la lista de localidades del trayecto.
- A la derecha, el mapa dentro de una tarjeta con:
  - la leyenda como stickers (Bajo / Medio / Alto, girados −2°);
  - el botón `REPORTAR UN ROBO`;
  - el aviso de la Línea 123;
  - la atribución de OpenStreetMap.

**Celular (< 768 px):**
- La misma barra amarilla, compacta.
- Un botón con la ruta ("SUBA → KENNEDY" + medio) que abre el formulario.
- El mapa en su tarjeta.
- La tarjeta de resultado.
- El botón `REPORTAR` fijo abajo a la derecha, con el aviso del 123 al lado.

**Estados:** la opción elegida lleva fondo azul, texto blanco y sombra chica. Todo lo tocable
mide al menos 44 px. Foco visible: `outline: 3px solid #2F5BFF; outline-offset: 2px`.

**Mapa:**
- Fondo `#FBE3B2`, cerros `#EBD196`, río `#7FB8FF`, calles blancas.
- Burbujas con borde negro de 2,5 px (4 px si están en la ruta) y relleno al 55 % (90 % en la
  ruta).
- La ruta en azul de 5 px sobre un borde negro de 11 px.

## Logo

El logo del equipo, redibujado en vector y adaptado a este estilo: las 5 barras en escalón y el
pin, como bloques de color plano con contorno negro.

| Archivo | Para qué |
|---|---|
| `logo/icono-d.svg` | Ícono de la app y favicon: placa blanca, borde negro y sombra dura |
| `logo/simbolo-d.svg` | El símbolo solo, junto al nombre `SAFEWAY` en Archivo Black |
| `logo/simbolo-original.svg` | La versión original en verdes, para el documento y la presentación |
