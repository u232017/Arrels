"""`make data`: run the pipeline stages that exist so far and cache them as Parquet."""

from __future__ import annotations

import logging
import time
from pathlib import Path

import duckdb

from pipeline.aggregate import monthly_route_coverage
from pipeline.config import Settings, connect, load_settings
from pipeline.holidays import load_holidays, with_holiday_flags
from pipeline.ingest import FAMILIES, DataContractError, ingest_mobility, load_mobility
from pipeline.quality import DAY_PARTIAL, build_calendar, missing_days
from pipeline.sql import quote_literal

logger = logging.getLogger("pipeline")
CALENDAR_FAMILY = "barri_barri"  # smallest family; run() checks all three agree on gaps


def write_parquet(
    con: duckdb.DuckDBPyConnection, rel: duckdb.DuckDBPyRelation, path: Path
) -> duckdb.DuckDBPyRelation:
    """Write `rel` atomically and return a relation over the written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.parquet")
    try:
        con.sql(f"COPY ({rel.sql_query()}) TO {quote_literal(tmp)} (FORMAT parquet)")
        tmp.replace(path)
    finally:
        tmp.unlink(missing_ok=True)
    return con.read_parquet(str(path))


def daily_totals_table(
    con: duckdb.DuckDBPyConnection, settings: Settings, family: str
) -> duckdb.DuckDBPyRelation:
    """Materialise one small (day, viajes) table per family: one scan of the Parquet file."""
    name = f"daily_{family}"
    con.sql(f"""CREATE OR REPLACE TABLE {name} AS
                SELECT day, sum(viajes) AS viajes
                FROM {'(' + load_mobility(con, settings, family).sql_query() + ')'}
                GROUP BY day""")
    return con.table(name)


def calendar_from(
    con: duckdb.DuckDBPyConnection, daily: duckdb.DuckDBPyRelation
) -> duckdb.DuckDBPyRelation:
    start, end = daily.aggregate("min(day), max(day)").fetchone()
    return build_calendar(con, daily, start, end)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    con = connect(settings)
    t0 = time.time()

    for family in FAMILIES:
        ingest_mobility(con, settings, family)
    logger.info("ingest done in %.0fs", time.time() - t0)

    calendars = {f: calendar_from(con, daily_totals_table(con, settings, f)) for f in FAMILIES}
    gaps = {f: missing_days(cal) for f, cal in calendars.items()}
    if len({tuple(v) for v in gaps.values()}) != 1:
        raise DataContractError(f"families disagree on missing days (R1): {gaps}")

    calendar = write_parquet(
        con,
        with_holiday_flags(con, calendars[CALENDAR_FAMILY], load_holidays(con)),
        settings.cache_dir / "calendar.parquet",
    )
    partial = calendar.filter(f"day_status = '{DAY_PARTIAL}'").project("day").fetchall()
    logger.info("R1 missing days: %s", [str(d) for d in gaps[CALENDAR_FAMILY]])
    logger.info("R1 partial days: %s", [str(d) for (d,) in partial])

    coverage = write_parquet(
        con,
        monthly_route_coverage(con, load_mobility(con, settings, "mun_barri"), calendar),
        settings.cache_dir / "route_coverage.parquet",
    )
    negative = coverage.filter("days_absent < 0").count("*").fetchone()[0]
    if negative:
        raise DataContractError(f"{negative} routes with negative days_absent")
    logger.info("route coverage: %s rows", coverage.count("*").fetchone()[0])
    logger.info("pipeline finished in %.0fs", time.time() - t0)


if __name__ == "__main__":
    main()
