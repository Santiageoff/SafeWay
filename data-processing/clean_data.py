"""Descarga y limpia las fuentes de datos complementarias (issue #4).

Fuente: capa publica "Delitos Alto Impacto Localidad" de la Secretaria
Distrital de Seguridad, Convivencia y Justicia (SDSCJ), servicio ArcGIS en
oaiee.scj.gov.co. Es la unica fuente pública encontrada que desglosa hurto a
vehiculos y a residencias POR LOCALIDAD: los datasets nacionales de
datos.gov.co (HURTO-A-VEH-CULOS, HURTO-A-RESIDENCIAS) solo llegan a nivel de
municipio, y Bogota entera cuenta ahi como un solo municipio.

No hay fuente oficial para "hurto en transporte publico" desglosada por
localidad (ni en la SDSCJ ni en datos.gov.co): esa fuente se resuelve en la
base de datos con una vista sobre los reportes ciudadanos
(supabase/migrations/20260927230000_fuentes_complementarias.sql), no aqui.

Uso:
    python clean_data.py

Escribe data-processing/output/hurto_por_localidad.csv. No necesita
librerias externas (solo la libreria estandar), para no depender de un
`pip install` en la maquina de quien lo corra.
"""

import csv
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

CAPA_URL = (
    "https://oaiee.scj.gov.co/agc/rest/services/Tematicos_Pub/CifrasSCJ/"
    "MapServer/0/query"
)

# Un registro por localidad, con el acumulado del año en curso para las tres
# categorias que nos interesan. Los nombres de columna (CMIULOCAL, CMHA26CONT,
# ...) son los que expone la capa; se documentan en
# https://oaiee.scj.gov.co/Documentos/DiccionarioDatosSDSCJ.pdf
CAMPOS = [
    "CMIULOCAL",   # codigo de localidad, "01".."20" (o "99" = sin localizar)
    "CMNOMLOCAL",  # nombre de la localidad
    "CMMES",       # periodo del corte, p. ej. "Ene-Ago (2025vs2026)"
    "CMHA26CONT",  # hurto automotores, acumulado año actual
    "CMHM26CONT",  # hurto motocicletas, acumulado año actual
    "CMHR26CONT",  # hurto residencias, acumulado año actual
]

# La app numera las localidades 1-20 (Backend/src/data/localities.js); son
# los mismos codigos oficiales que usa la SDSCJ, asi que el codigo de
# localidad de la capa es directamente el locality_id.
LOCALIDAD_SIN_LOCALIZAR = "99"

SALIDA = Path(__file__).parent / "output" / "hurto_por_localidad.csv"


def descargar_filas():
    """Pide a la capa las filas ya filtradas y sin geometria (mas liviano)."""
    params = "&".join([
        "where=1%3D1",
        f"outFields={','.join(CAMPOS)}",
        "returnGeometry=false",
        "f=json",
    ])
    url = f"{CAPA_URL}?{params}"

    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError) as err:
        raise RuntimeError(f"No se pudo descargar la capa de la SDSCJ: {err}") from err

    if "error" in payload:
        raise RuntimeError(f"La capa respondio un error: {payload['error']}")

    return [f["attributes"] for f in payload.get("features", [])]


def limpiar(filas):
    """De 21 filas (20 localidades + 'sin localizar') a los registros que
    va a consumir generate_risk_zones.py: uno por (localidad, categoria)."""
    limpias = []

    for fila in filas:
        codigo = str(fila.get("CMIULOCAL", "")).strip()
        if codigo == LOCALIDAD_SIN_LOCALIZAR or not codigo:
            continue

        try:
            locality_id = int(codigo)
        except ValueError:
            print(f"  atencion: codigo de localidad raro, se ignora: {codigo!r}", file=sys.stderr)
            continue

        if not (1 <= locality_id <= 20):
            print(f"  atencion: localidad fuera de 1-20, se ignora: {locality_id}", file=sys.stderr)
            continue

        nombre = (fila.get("CMNOMLOCAL") or "").strip()
        periodo = (fila.get("CMMES") or "").strip()

        categorias = {
            "hurto_automotores": fila.get("CMHA26CONT"),
            "hurto_motocicletas": fila.get("CMHM26CONT"),
            "hurto_residencias": fila.get("CMHR26CONT"),
        }

        for tipo, cantidad in categorias.items():
            if cantidad is None:
                print(f"  atencion: {nombre} sin dato de {tipo}, se ignora esa fila", file=sys.stderr)
                continue
            limpias.append({
                "locality_id": locality_id,
                "locality_name": nombre,
                "source_type": tipo,
                "period": normalizar_periodo(periodo),
                "count": int(cantidad),
                "source": "SDSCJ - Delito de Alto Impacto (oaiee.scj.gov.co)",
            })

    return limpias


def normalizar_periodo(periodo_crudo):
    """"Ene-Ago (2025vs2026)" -> "2026-ene-ago": mas facil de ordenar y de
    usar como parte de la llave unica en la base de datos."""
    if "2026" in periodo_crudo and "Ene-Ago" in periodo_crudo:
        return "2026-ene-ago"
    # Formato inesperado (la SDSCJ cambio el periodo del corte): se guarda
    # crudo en vez de adivinar, para no inventar una fecha que no es.
    return periodo_crudo or "sin-periodo"


def escribir_csv(registros):
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    columnas = ["locality_id", "locality_name", "source_type", "period", "count", "source"]

    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columnas)
        writer.writeheader()
        writer.writerows(registros)


def main():
    print("Descargando la capa de la SDSCJ...")
    filas = descargar_filas()
    print(f"  {len(filas)} filas recibidas (localidades + 'sin localizar')")

    registros = limpiar(filas)
    if not registros:
        raise RuntimeError("La limpieza no dejo ningun registro: revisa si la capa cambio de forma")

    escribir_csv(registros)
    print(f"Listo: {len(registros)} registros en {SALIDA}")
    print("Siguiente paso: python generate_risk_zones.py")


if __name__ == "__main__":
    main()
