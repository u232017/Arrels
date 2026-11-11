"""Read Telefónica CSVs into typed DuckDB relations.

Codes stay as text (leading zeros), `"-"` becomes NULL, `viajes` becomes BIGINT.
Every read is checked against the provider's data contract before it is returned.
"""

from __future__ import annotations

from pathlib import Path

import duckdb

from pipeline.quality import PUBLISHED

FAMILY_PREFIX = {
    "barri_barri": "movilidad_barrios",
    "mun_barri": "movilidad_mun_barrios",
    "municipal": "movilidad_municipios",
}
FAMILIES = tuple(FAMILY_PREFIX)
PROVIDER_THRESHOLD = 15
NO_BARRI = "-"


class DataContractError(ValueError):
    """The raw data does not look like the provider says it should."""


def _quote(path: Path | str) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def mobility_glob(mobility_dir: Path, family: str) -> str:
    if family not in FAMILY_PREFIX:
        raise ValueError(f"Unknown family {family!r}; expected one of {FAMILIES}")
    return str(Path(mobility_dir) / "*" / f"{FAMILY_PREFIX[family]}_*_origen.csv")


def _mobility_select(family: str, source: str) -> str:
    barri_cols = (
        f"""
        NULLIF(barrio_origen, '{NO_BARRI}') AS barrio_origen,
        NULLIF(barrio_origen_name, '{NO_BARRI}') AS barrio_origen_name,
        NULLIF(barrio_destino, '{NO_BARRI}') AS barrio_destino,
        NULLIF(barrio_destino_name, '{NO_BARRI}') AS barrio_destino_name,"""
        if family != "municipal"
        else ""
    )
    return f"""
        SELECT
          CAST(day AS DATE) AS day,
          origen,
          municipio_origen, municipio_origen_name,
          municipio_destino, municipio_destino_name,
          {barri_cols}
          CAST(viajes AS BIGINT) AS viajes,
          '{family}' AS family
        FROM {source}"""


def _contract_violations(con: duckdb.DuckDBPyConnection, family: str, source: str) -> list[str]:
    barri_check = {
        "mun_barri": f"""(barrio_origen = '{NO_BARRI}')::INT
                         + (barrio_destino = '{NO_BARRI}')::INT <> 1""",
        "barri_barri": f"barrio_origen = '{NO_BARRI}' OR barrio_destino = '{NO_BARRI}'",
        "municipal": "FALSE",
    }[family]
    bad_viajes, bad_barri = con.sql(f"""
        SELECT
          count(*) FILTER (WHERE TRY_CAST(viajes AS BIGINT) IS NULL
                           OR TRY_CAST(viajes AS BIGINT) < 0
                           OR TRY_CAST(viajes AS BIGINT) BETWEEN 1 AND {PROVIDER_THRESHOLD - 1}),
          count(*) FILTER (WHERE {barri_check})
        FROM {source}""").fetchone()
    problems = []
    if bad_viajes:
        problems.append(
            f"{bad_viajes} rows with invalid viajes (must be 0 or >= {PROVIDER_THRESHOLD})"
        )
    if bad_barri and family == "mun_barri":
        problems.append(f"{bad_barri} mun_barri rows without exactly one barri side")
    elif bad_barri:
        problems.append(f"{bad_barri} barri_barri rows without a barri code")
    return problems


def read_mobility(
    con: duckdb.DuckDBPyConnection, mobility_dir: Path, family: str
) -> duckdb.DuckDBPyRelation:
    """Typed relation for one granularity family (R3). Validates the contract first."""
    source = f"read_csv({_quote(mobility_glob(mobility_dir, family))}, all_varchar=true)"
    problems = _contract_violations(con, family, source)
    if problems:
        raise DataContractError(f"{family}: " + "; ".join(problems))
    return con.sql(_mobility_select(family, source))


def read_tourism(
    con: duckdb.DuckDBPyConnection, tourism_dir: Path, table: str
) -> duckdb.DuckDBPyRelation:
    """Typed relation for one tourism table. Rows under the threshold are omitted upstream."""
    path = Path(tourism_dir) / "*" / f"{table}.csv"
    source = f"read_csv({_quote(path)}, delim=';', all_varchar=true)"
    below = con.sql(
        f"SELECT count(*) FROM {source} "
        f"WHERE TRY_CAST(visitantes AS BIGINT) IS NULL "
        f"OR TRY_CAST(visitantes AS BIGINT) < {PROVIDER_THRESHOLD}"
    ).fetchone()[0]
    if below:
        raise DataContractError(
            f"{table}: {below} rows with visitantes missing or < {PROVIDER_THRESHOLD}"
        )
    return con.sql(f"""
        SELECT
          CAST(strptime(mes, '%Y%m') AS DATE) AS month,
          * EXCLUDE ("año", mes, visitantes),
          CAST(visitantes AS BIGINT) AS visitantes,
          '{PUBLISHED}' AS state
        FROM {source}""")
