"""Monthly aggregates per family (R2, R3, R5 and decision D1)."""

from __future__ import annotations

import duckdb

from pipeline.integrate import assert_unique
from pipeline.quality import DAY_MISSING, assert_family, sub

ROUTE_FAMILY = "mun_barri"
# D1: a route is covered when it has a row (published or suppressed)
# on at least this share of the days of the month.
COVERAGE_THRESHOLD = 0.8


def monthly_route_coverage(
    con: duckdb.DuckDBPyConnection,
    rel: duckdb.DuckDBPyRelation,
    calendar: duckdb.DuckDBPyRelation,
    threshold: float = COVERAGE_THRESHOLD,
) -> duckdb.DuckDBPyRelation:
    """Town -> barri routes per month with day counts by state.

    `days_absent` is derived (days in month - missing days - days with a row),
    so no route x day grid is ever built.
    """
    assert_family(rel, ROUTE_FAMILY)
    return con.sql(f"""
        WITH months AS (
          SELECT date_trunc('month', day)::DATE AS month,
                 count(*) AS days_in_month,
                 count(*) FILTER (WHERE day_status = '{DAY_MISSING}') AS days_missing
          FROM {sub(calendar)} GROUP BY 1),
        route_days AS (
          SELECT day, origen, municipio_origen AS origin_mun, barrio_destino AS dest_barri,
                 sum(viajes) AS v
          FROM {sub(rel)}
          WHERE barrio_origen IS NULL AND barrio_destino IS NOT NULL
          GROUP BY ALL),
        routes AS (
          SELECT date_trunc('month', day)::DATE AS month, origen, origin_mun, dest_barri,
                 count(*) AS days_with_row,
                 count(*) FILTER (WHERE v > 0) AS days_published,
                 count(*) FILTER (WHERE v = 0) AS days_suppressed,
                 sum(v) AS trips_published
          FROM route_days
          GROUP BY ALL)
        SELECT r.month, r.origen, r.origin_mun, r.dest_barri,
               m.days_in_month, m.days_missing,
               r.days_with_row, r.days_published, r.days_suppressed,
               m.days_in_month - m.days_missing - r.days_with_row AS days_absent,
               r.trips_published,
               r.days_with_row >= {threshold} * m.days_in_month AS meets_coverage
        FROM routes r JOIN months m USING (month)""")


def trips_per_visitor(
    con: duckdb.DuckDBPyConnection,
    coverage: duckdb.DuckDBPyRelation,
    visitors: duckdb.DuckDBPyRelation,
) -> duckdb.DuckDBPyRelation:
    """Regional trips / Table 9 unique visitors, only on covered routes (R5)."""
    assert_unique(visitors, ["month", "cod_municipio_residencia", "cod_barrio"], "visitors")
    return con.sql(f"""
        SELECT c.month, c.origin_mun, c.dest_barri, c.trips_published AS trips,
               v.visitantes AS visitors, c.meets_coverage,
               CASE WHEN c.meets_coverage
                    THEN c.trips_published / NULLIF(v.visitantes, 0) END AS ratio
        FROM {sub(coverage)} c
        JOIN {sub(visitors)} v
          ON v.month = c.month
         AND v.cod_municipio_residencia = c.origin_mun
         AND v.cod_barrio = c.dest_barri
        WHERE c.origen = 'Regional'""")
