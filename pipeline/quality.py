"""Data-quality states and the day calendar (rules R1–R3)."""

from __future__ import annotations

from datetime import date

import duckdb

# R2: three explicit states.
PUBLISHED = "published"
SUPPRESSED = "suppressed"  # mobility row with viajes = 0, meaning < 15 trips
ABSENT = "absent"  # no row at all

# R1: day status in the calendar.
DAY_OK = "ok"
DAY_MISSING = "missing"
DAY_PARTIAL = "partial"

# A day next to a missing day is "partial" when its total is below this share
# of the median total for the same weekday.
PARTIAL_RATIO = 0.5


class FamilyMixError(ValueError):
    """Raised when rows from different granularity families meet (R3)."""


def sub(rel: duckdb.DuckDBPyRelation) -> str:
    """A relation as a SQL subquery."""
    return f"({rel.sql_query()})"


def families_of(rel: duckdb.DuckDBPyRelation) -> set[str]:
    return {f for (f,) in rel.project("family").distinct().fetchall()}


def assert_family(rel: duckdb.DuckDBPyRelation, expected: str) -> None:
    found = families_of(rel)
    if len(found) > 1:
        raise FamilyMixError(f"Families must never be mixed (R3); found {sorted(found)}")
    if found and found != {expected}:
        raise FamilyMixError(f"Expected family {expected}, found {sorted(found)}")


def with_state(rel: duckdb.DuckDBPyRelation) -> duckdb.DuckDBPyRelation:
    """Add the R2 state of each mobility row."""
    return rel.project(
        f"*, CASE WHEN viajes = 0 THEN '{SUPPRESSED}' ELSE '{PUBLISHED}' END AS state"
    )


def build_calendar(
    con: duckdb.DuckDBPyConnection,
    rel: duckdb.DuckDBPyRelation,
    start: date,
    end: date,
) -> duckdb.DuckDBPyRelation:
    """One row per day in [start, end]: (day, day_status, is_weekend, total_viajes)."""
    return con.sql(f"""
        WITH cal AS (
          SELECT CAST(generate_series AS DATE) AS day
          FROM generate_series(DATE '{start}', DATE '{end}', INTERVAL 1 DAY)),
        totals AS (SELECT day, sum(viajes) AS total FROM {sub(rel)} GROUP BY day),
        joined AS (
          SELECT cal.day, totals.total,
                 isodow(cal.day) AS dow,
                 lag(totals.total IS NULL) OVER w AS prev_missing,
                 lead(totals.total IS NULL) OVER w AS next_missing
          FROM cal LEFT JOIN totals USING (day)
          WINDOW w AS (ORDER BY cal.day)),
        medians AS (
          SELECT dow, median(total) AS med FROM joined WHERE total IS NOT NULL GROUP BY dow)
        SELECT day,
          CASE
            WHEN total IS NULL THEN '{DAY_MISSING}'
            WHEN (prev_missing OR next_missing) AND total < {PARTIAL_RATIO} * med
              THEN '{DAY_PARTIAL}'
            ELSE '{DAY_OK}'
          END AS day_status,
          dow IN (6, 7) AS is_weekend,
          total AS total_viajes
        FROM joined LEFT JOIN medians USING (dow)
        ORDER BY day""")


def missing_days(calendar: duckdb.DuckDBPyRelation) -> list[date]:
    rows = calendar.filter(f"day_status = '{DAY_MISSING}'").project("day").order("day")
    return [d for (d,) in rows.fetchall()]


def daily_totals(
    con: duckdb.DuckDBPyConnection,
    rel: duckdb.DuckDBPyRelation,
    calendar: duckdb.DuckDBPyRelation,
) -> duckdb.DuckDBPyRelation:
    """Daily sum of viajes; NULL (never 0) on missing days (R1)."""
    return con.sql(f"""
        SELECT c.day,
               CASE WHEN c.day_status = '{DAY_MISSING}' THEN NULL ELSE t.viajes END AS viajes,
               c.day_status
        FROM {sub(calendar)} c
        LEFT JOIN (SELECT day, sum(viajes) AS viajes FROM {sub(rel)} GROUP BY day) t
          USING (day)
        ORDER BY c.day""")
