"""`make data`: run the pipeline stages that exist so far and cache them as Parquet."""

from __future__ import annotations

import logging
import time
from pathlib import Path

import duckdb

from pipeline.aggregate import monthly_route_coverage
from pipeline.config import Settings, connect, load_settings
from pipeline.holidays import load_holidays, with_holiday_flags
from pipeline.ingest import FAMILIES, ingest_mobility, load_mobility
from pipeline.quality import DAY_PARTIAL, build_calendar, missing_days

logger = logging.getLogger("pipeline")
CALENDAR_FAMILY = "barri_barri"  # smallest family; all three share the same missing days


def _write(con: duckdb.DuckDBPyConnection, rel: duckdb.DuckDBPyRelation, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    con.sql(f"COPY ({rel.sql_query()}) TO '{path}' (FORMAT parquet)")
    return path


def _calendar(con: duckdb.DuckDBPyConnection, settings: Settings, family: str):
    rel = load_mobility(con, settings, family)
    start, end = rel.aggregate("min(day), max(day)").fetchone()
    return build_calendar(con, rel, start, end)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    con = connect(settings)
    t0 = time.time()

    for family in FAMILIES:
        ingest_mobility(con, settings, family)
    logger.info("ingest done in %.0fs", time.time() - t0)

    gaps = {f: missing_days(_calendar(con, settings, f)) for f in FAMILIES}
    if len({tuple(v) for v in gaps.values()}) != 1:
        logger.warning("families disagree on missing days: %s", gaps)

    calendar = with_holiday_flags(
        con, _calendar(con, settings, CALENDAR_FAMILY), load_holidays(con)
    )
    cal_path = _write(con, calendar, settings.cache_dir / "calendar.parquet")
    calendar = con.read_parquet(str(cal_path))
    partial = [d for (d,) in calendar.filter(f"day_status = '{DAY_PARTIAL}'")
               .project("day").fetchall()]
    logger.info("R1 missing days: %s", [str(d) for d in gaps[CALENDAR_FAMILY]])
    logger.info("R1 partial days: %s", [str(d) for d in partial])

    coverage = monthly_route_coverage(con, load_mobility(con, settings, "mun_barri"), calendar)
    cov_path = _write(con, coverage, settings.cache_dir / "route_coverage.parquet")
    logger.info("route coverage written to %s", cov_path)
    logger.info("pipeline finished in %.0fs", time.time() - t0)


if __name__ == "__main__":
    main()
