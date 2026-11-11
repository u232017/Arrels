"""Read Telefónica CSVs into typed DuckDB relations and cache them as Parquet.

Codes stay as text (leading zeros), `"-"` and empty fields become NULL, `viajes`
becomes BIGINT. Every read is checked against the provider's data contract.
"""

from __future__ import annotations

import logging
from pathlib import Path

import duckdb

from pipeline.cache import fingerprint, is_fresh, write_manifest
from pipeline.config import Settings
from pipeline.quality import PUBLISHED
from pipeline.sql import quote_literal

logger = logging.getLogger(__name__)

FAMILY_PREFIX = {
    "barri_barri": "movilidad_barrios",
    "mun_barri": "movilidad_mun_barrios",
    "municipal": "movilidad_municipios",
}
FAMILIES = tuple(FAMILY_PREFIX)
PROVIDER_THRESHOLD = 15
NO_BARRI = "-"
BARRI_COLUMNS = ("barrio_origen", "barrio_origen_name", "barrio_destino", "barrio_destino_name")


class DataContractError(ValueError):
    """The raw data does not look like the provider says it should."""


def mobility_files(mobility_dir: Path, family: str) -> list[Path]:
    """Sorted CSV files of one family (one per month folder)."""
    if family not in FAMILY_PREFIX:
        raise ValueError(f"Unknown family {family!r}; expected one of {FAMILIES}")
    files = sorted(Path(mobility_dir).glob(f"*/{FAMILY_PREFIX[family]}_*_origen.csv"))
    if not files:
        raise FileNotFoundError(f"No {family} CSV files under {mobility_dir}")
    return files


def _csv_source(files: list[Path], delim: str = ",") -> str:
    paths = ", ".join(quote_literal(f) for f in files)
    return f"read_csv([{paths}], delim={quote_literal(delim)}, all_varchar=true, header=true)"


def _typed_select(family: str, source: str) -> str:
    barri_cols = ""
    if family != "municipal":
        # '-' means "no barri"; an empty field is treated the same so the contract catches it.
        barri_cols = "".join(
            f"NULLIF(NULLIF(trim({c}), '{NO_BARRI}'), '') AS {c},\n" for c in BARRI_COLUMNS
        )
    return f"""
        SELECT
          TRY_CAST(day AS DATE) AS day,
          origen,
          municipio_origen, municipio_origen_name,
          municipio_destino, municipio_destino_name,
          {barri_cols}
          TRY_CAST(viajes AS BIGINT) AS viajes,
          '{family}' AS family
        FROM {source}"""


def validate_mobility(rel: duckdb.DuckDBPyRelation, family: str) -> None:
    """Raise DataContractError if a typed mobility relation breaks the provider contract."""
    barri_check = {
        "mun_barri": "(barrio_origen IS NULL)::INT + (barrio_destino IS NULL)::INT <> 1",
        "barri_barri": "barrio_origen IS NULL OR barrio_destino IS NULL",
        "municipal": "FALSE",
    }[family]
    bad_day, bad_viajes, bad_barri = rel.aggregate(f"""
        count(*) FILTER (WHERE day IS NULL),
        count(*) FILTER (WHERE viajes IS NULL OR viajes < 0
                         OR viajes BETWEEN 1 AND {PROVIDER_THRESHOLD - 1}),
        count(*) FILTER (WHERE {barri_check})""").fetchone()
    problems = []
    if bad_day:
        problems.append(f"{bad_day} rows with an invalid day")
    if bad_viajes:
        problems.append(
            f"{bad_viajes} rows with invalid viajes (must be 0 or >= {PROVIDER_THRESHOLD})"
        )
    if bad_barri:
        rule = "exactly one barri side" if family == "mun_barri" else "a barri code on both sides"
        problems.append(f"{bad_barri} rows without {rule}")
    if problems:
        raise DataContractError(f"{family}: " + "; ".join(problems))


def read_mobility(
    con: duckdb.DuckDBPyConnection, mobility_dir: Path, family: str
) -> duckdb.DuckDBPyRelation:
    """Typed relation for one granularity family straight from CSV (R3). Validated."""
    rel = con.sql(_typed_select(family, _csv_source(mobility_files(mobility_dir, family))))
    validate_mobility(rel, family)
    return rel


def read_tourism(
    con: duckdb.DuckDBPyConnection, tourism_dir: Path, table: str
) -> duckdb.DuckDBPyRelation:
    """Typed relation for one tourism table. Rows under the threshold are omitted upstream."""
    files = sorted(Path(tourism_dir).glob(f"*/{table}.csv"))
    if not files:
        raise FileNotFoundError(f"No {table}.csv files under {tourism_dir}")
    rel = con.sql(f"""
        SELECT
          TRY_CAST(strptime(mes, '%Y%m') AS DATE) AS month,
          * EXCLUDE ("año", mes, visitantes),
          TRY_CAST(visitantes AS BIGINT) AS visitantes,
          '{PUBLISHED}' AS state
        FROM {_csv_source(files, delim=";")}""")
    bad = rel.aggregate(
        f"count(*) FILTER (WHERE month IS NULL OR visitantes IS NULL "
        f"OR visitantes < {PROVIDER_THRESHOLD})"
    ).fetchone()[0]
    if bad:
        raise DataContractError(
            f"{table}: {bad} rows with an invalid month or visitantes < {PROVIDER_THRESHOLD}"
        )
    return rel


def mobility_cache_dir(settings: Settings, family: str) -> Path:
    """Folder with one Parquet file per month for one family."""
    return settings.cache_dir / "mobility" / family


def _month_of(csv_path: Path) -> str:
    return csv_path.parent.name  # folders are named YYYY-MM


def _ingest_month(con: duckdb.DuckDBPyConnection, src: Path, output: Path, family: str) -> None:
    tmp = output.with_suffix(".tmp.parquet")
    try:
        con.sql(
            f"COPY ({_typed_select(family, _csv_source([src]))}) TO {quote_literal(tmp)} "
            "(FORMAT parquet, COMPRESSION zstd)"
        )
        validate_mobility(con.read_parquet(str(tmp)), family)
        tmp.replace(output)
    finally:
        tmp.unlink(missing_ok=True)


def ingest_mobility(
    con: duckdb.DuckDBPyConnection, settings: Settings, family: str
) -> list[Path]:
    """Write one Parquet file per month, reading each CSV once.

    Months whose source file is unchanged are skipped. Working month by month
    keeps memory and temp disk bounded on a laptop.
    """
    files = mobility_files(settings.mobility_dir, family)
    out_dir = mobility_cache_dir(settings, family)
    out_dir.mkdir(parents=True, exist_ok=True)
    con.execute("SET preserve_insertion_order = false")
    outputs = []
    for src in files:
        output = out_dir / f"{_month_of(src)}.parquet"
        current = fingerprint([src])
        if settings.force_rebuild or not is_fresh(output, current):
            _ingest_month(con, src, output, family)
            write_manifest(output, current)
            logger.info("%s %s: written", family, _month_of(src))
        outputs.append(output)
    return outputs


def load_mobility(
    con: duckdb.DuckDBPyConnection, settings: Settings, family: str
) -> duckdb.DuckDBPyRelation:
    """Typed relation over all cached months of one family."""
    out_dir = mobility_cache_dir(settings, family)
    if not any(out_dir.glob("*.parquet")):
        raise FileNotFoundError(f"No cached {family} files in {out_dir}; run `make data` first")
    return con.read_parquet(str(out_dir / "[0-9]*.parquet"))
