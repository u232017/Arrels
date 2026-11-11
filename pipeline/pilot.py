"""Pilot barri selection (T8): a transparent data-sufficiency score.

Five parts, each between 0 and 1, all shown next to the evidence behind them.
The score is their plain average. No hidden weights.
"""

from __future__ import annotations

import duckdb

from pipeline.quality import sub

COMPONENTS = ("s_published", "s_routes", "s_t9_months", "s_homes", "s_stability")
UNKNOWN_HOME = "NA"
# A month is "stable" when its total is within [LOW, HIGH] x the barri's median month.
STABLE_LOW = 0.5
STABLE_HIGH = 2.0


def barri_sufficiency(
    con: duckdb.DuckDBPyConnection,
    coverage: duckdb.DuckDBPyRelation,
    t9: duckdb.DuckDBPyRelation,
    n_months: int,
) -> duckdb.DuckDBPyRelation:
    """One row per barri with the five score parts, the score and the evidence.

    - s_published: published days / days with a row (regional town -> barri routes)
    - s_routes: covered routes per month (D1), divided by the best barri
    - s_t9_months: months with Table 9 data / months in the window
    - s_homes: known home towns per month in Table 9, divided by the best barri
    - s_stability: months within 0.5x–2x of the median month / months in the window
    """
    if n_months < 1:
        raise ValueError("n_months must be at least 1")
    return con.sql(f"""
        WITH cov AS (
          SELECT dest_barri AS barri,
                 sum(days_published) AS days_published,
                 sum(days_with_row) AS days_with_row,
                 count(*) FILTER (WHERE meets_coverage) / {n_months}::DOUBLE AS avg_routes
          FROM {sub(coverage)} WHERE origen = 'Regional' GROUP BY 1),
        t9_month AS (
          SELECT cod_barrio AS barri, month, sum(visitantes) AS visitors,
                 count(*) FILTER (WHERE cod_municipio_residencia <> '{UNKNOWN_HOME}') AS homes
          FROM {sub(t9)} GROUP BY 1, 2),
        t9_med AS (SELECT barri, median(visitors) AS med FROM t9_month GROUP BY 1),
        t9 AS (
          SELECT barri, count(*) AS t9_months,
                 sum(homes) / {n_months}::DOUBLE AS avg_homes,
                 avg(visitors) AS avg_visitors,
                 count(*) FILTER (WHERE visitors BETWEEN {STABLE_LOW} * med
                                                     AND {STABLE_HIGH} * med) AS stable_months
          FROM t9_month JOIN t9_med USING (barri) GROUP BY 1),
        evidence AS (
          SELECT barri,
                 coalesce(days_published, 0) AS days_published,
                 coalesce(days_with_row, 0) AS days_with_row,
                 coalesce(avg_routes, 0) AS avg_routes,
                 coalesce(t9_months, 0) AS t9_months,
                 coalesce(avg_homes, 0) AS avg_homes,
                 avg_visitors,
                 coalesce(stable_months, 0) AS stable_months
          FROM cov FULL OUTER JOIN t9 USING (barri)),
        parts AS (
          SELECT *,
            coalesce(days_published / NULLIF(days_with_row, 0), 0) AS s_published,
            coalesce(avg_routes / NULLIF(max(avg_routes) OVER (), 0), 0) AS s_routes,
            least(t9_months / {n_months}::DOUBLE, 1) AS s_t9_months,
            coalesce(avg_homes / NULLIF(max(avg_homes) OVER (), 0), 0) AS s_homes,
            least(stable_months / {n_months}::DOUBLE, 1) AS s_stability
          FROM evidence)
        SELECT *, ({' + '.join(COMPONENTS)}) / {len(COMPONENTS)} AS score
        FROM parts""")


def top_barris(rel: duckdb.DuckDBPyRelation, n: int = 5) -> duckdb.DuckDBPyRelation:
    """The `n` best barris by score (ties broken by code, so the order is reproducible)."""
    return rel.order("score DESC, barri").limit(n)
