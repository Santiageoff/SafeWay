"""Genera el SQL para refrescar `locality_crime_sources` (issue #4).

Lee data-processing/output/hurto_por_localidad.csv (generado por
clean_data.py) y escribe un UPSERT idempotente: correrlo de nuevo con datos
mas recientes actualiza los conteos en vez de duplicar filas, gracias a la
llave unica (locality_id, source_type, period) de la tabla.

La carga inicial de esta tabla vive versionada en
supabase/migrations/20260927230000_fuentes_complementarias.sql (con el
snapshot del 2026-09-27); este script es para refrescarla mas adelante, no
para la carga inicial.

Uso:
    python clean_data.py
    python generate_risk_zones.py
    # revisar data-processing/output/upsert_locality_crime_sources.sql y
    # correrlo contra Supabase (SQL editor, o psql con la cadena de conexion)
"""

import csv
from pathlib import Path

ENTRADA = Path(__file__).parent / "output" / "hurto_por_localidad.csv"
SALIDA = Path(__file__).parent / "output" / "upsert_locality_crime_sources.sql"

TIPOS_VALIDOS = {"hurto_automotores", "hurto_motocicletas", "hurto_residencias"}


def leer_registros():
    if not ENTRADA.exists():
        raise FileNotFoundError(
            f"No existe {ENTRADA}. Corre primero: python clean_data.py"
        )

    with open(ENTRADA, newline="", encoding="utf-8") as f:
        registros = list(csv.DictReader(f))

    if not registros:
        raise ValueError(f"{ENTRADA} esta vacio")

    return registros


def validar(registros):
    """Antes de generar SQL: nada que rompa la restricción de la tabla
    (source_type fuera de la lista, count negativo, locality_id fuera de rango)."""
    errores = []

    for i, r in enumerate(registros, start=2):  # +1 encabezado, +1 base 1
        if r["source_type"] not in TIPOS_VALIDOS:
            errores.append(f"  fila {i}: source_type invalido {r['source_type']!r}")
        try:
            locality_id = int(r["locality_id"])
            if not (1 <= locality_id <= 20):
                errores.append(f"  fila {i}: locality_id fuera de 1-20: {locality_id}")
        except ValueError:
            errores.append(f"  fila {i}: locality_id no es un entero: {r['locality_id']!r}")
        try:
            if int(r["count"]) < 0:
                errores.append(f"  fila {i}: count negativo: {r['count']}")
        except ValueError:
            errores.append(f"  fila {i}: count no es un entero: {r['count']!r}")

    if errores:
        raise ValueError("Registros invalidos, no se genera SQL:\n" + "\n".join(errores))


def escapar_literal(texto):
    """Comilla simple de SQL: 'no se puede' -> 'no se puede'''."""
    return texto.replace("'", "''")


def generar_sql(registros):
    valores = ",\n".join(
        "    ({locality_id}, '{source_type}', '{period}', {count})".format(
            locality_id=int(r["locality_id"]),
            source_type=escapar_literal(r["source_type"]),
            period=escapar_literal(r["period"]),
            count=int(r["count"]),
        )
        for r in registros
    )

    return f"""\
-- Generado por data-processing/generate_risk_zones.py — no editar a mano.
-- Fuente de cada fila: la columna `source` de hurto_por_localidad.csv.
insert into public.locality_crime_sources (locality_id, source_type, period, count)
values
{valores}
on conflict (locality_id, source_type, period) do update set
    count      = excluded.count,
    updated_at = now();
"""


def main():
    registros = leer_registros()
    print(f"{len(registros)} registros leidos de {ENTRADA}")

    validar(registros)

    sql = generar_sql(registros)
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(sql, encoding="utf-8")

    print(f"Listo: {SALIDA}")
    print("Siguiente paso: revisar el archivo y correrlo contra Supabase.")


if __name__ == "__main__":
    main()
