# Contexto (C4 · nivel 1)

**Para quién:** el docente, un evaluador o cualquiera que llegue sin saber nada. Sin tecnologías:
qué es SafeWay, quién lo usa y de qué depende. El detalle técnico está en
[contenedores.md](contenedores.md).

```mermaid
flowchart TB
    ciudadano["👤 Ciudadano que se moviliza por Bogotá<br/><i>peatón, ciclista, motociclista,<br/>conductor, domiciliario</i>"]
    equipo["👥 Equipo SafeWay<br/><i>carga y actualiza las cifras</i>"]

    safeway["<b>SafeWay</b><br/>Muestra el riesgo por localidad y<br/>analiza qué tan riesgosa es una ruta<br/>según el medio de transporte"]

    oficiales["🏛️ Fuentes oficiales de seguridad<br/><i>Secretaría Distrital de Seguridad ·<br/>Policía Metropolitana (SIEDCO)</i>"]
    rutas["🗺️ Servicio de rutas"]
    geo["📍 Servicio de geocodificación"]
    mapas["🧭 Servicio de mapas base<br/><i>datos de OpenStreetMap</i>"]

    ciudadano -- "consulta el mapa y<br/>analiza su ruta en" --> safeway
    equipo -- "carga las cifras de" --> oficiales
    equipo -- "publica las cifras en" --> safeway
    safeway -- "pide el trayecto a" --> rutas
    safeway -- "convierte direcciones en puntos con" --> geo
    safeway -- "dibuja el mapa con" --> mapas

    classDef sistema fill:#1168bd,stroke:#0b4884,color:#fff
    classDef externo fill:#999,stroke:#6b6b6b,color:#fff
    classDef persona fill:#08427b,stroke:#052e56,color:#fff
    class safeway sistema
    class oficiales,rutas,geo,mapas externo
    class ciudadano,equipo persona
```

## Qué dice este diagrama

- **SafeWay no se conecta en vivo a las fuentes oficiales.** El equipo las descarga, las limpia y
  las carga (la integración en vivo está fuera del alcance de esta versión). Por eso el dato tiene
  fecha de corte y la app la muestra.
- **Depende de tres servicios externos gratuitos** (rutas, geocodificación y mapas). Ninguno
  tiene garantía de servicio; cuando el de rutas falla, SafeWay usa la línea recta y lo dice
  ([ADR-004](adr/ADR-004-servicios-publicos-osm.md)).
- **No es un canal de emergencia**: no se conecta con la Línea 123 ni con la Policía.

## Fuera de este diagrama (fuera de alcance)

Integración en vivo con fuentes oficiales · detalle por barrio o por tramo de vía · aplicaciones
móviles nativas · cobertura fuera de Bogotá.
