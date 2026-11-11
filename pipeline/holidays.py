"""Official holidays (Spain, Catalonia, Barcelona) as daily and monthly flags (T6/T7a)."""

from __future__ import annotations

from pathlib import Path

import duckdb

from pipeline.integrate import checked_join
from pipeline.quality import sub

HOLIDAYS_FILE = Path(__file__).parent / "reference" / "holidays.csv"


def load_holidays(
    con: duckdb.DuckDBPyConnection, path: Path = HOLIDAYS_FILE
) -> duckdb.DuckDBPyRelation:
    """One row per holiday date: (day, scope, name_ca, source)."""
    return con.read_csv(str(path), header=True, dtype={"day": "DATE"})


def with_holiday_flags(
    con: duckdb.DuckDBPyConnection,
    calendar: duckdb.DuckDBPyRelation,
    holidays: duckdb.DuckDBPyRelation,
) -> duckdb.DuckDBPyRelation:
    """Add is_holiday, holiday_scope, holiday_name and month_has_holiday to the calendar."""
    hol = holidays.project("day, scope AS holiday_scope, name_ca AS holiday_name")
    joined = checked_join(calendar, hol, keys=["day"], measure="total_viajes")
    return con.sql(f"""
        SELECT *,
          holiday_scope IS NOT NULL AS is_holiday,
          bool_or(holiday_scope IS NOT NULL)
            OVER (PARTITION BY date_trunc('month', day)) AS month_has_holiday
        FROM {sub(joined)}
        ORDER BY day""")
