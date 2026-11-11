"""Interpretable indicators for the pilot barris (T10). No composite score.

Every value comes with the counts needed for its coverage badge.
Unique visitors are never summed across months (they would double count).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

import duckdb

from pipeline.quality import ABSENT, DAY_OK, PUBLISHED, sub
from pipeline.sql import quote_literal

# Decision D3.
PILOTS = {
    "080190203": "la Dreta de l'Eixample",
    "080190308": "Sants",
    "080190904": "Sant Andreu",
}
BASE_YEAR = 2023
UNKNOWN_HOME = "NA"
UNKNOWN_HOME_NAME = "Residència desconeguda"
WEEKEND_DAYS = 2
WEEKDAYS = 5


def _in_list(values: Sequence[str]) -> str:
    return "(" + ", ".join(quote_literal(v) for v in values) + ")"


def visitors_monthly(
    con: duckdb.DuckDBPyConnection,
    t9: duckdb.DuckDBPyRelation,
    barris: Sequence[str],
    start: date,
    end: date,
) -> duckdb.DuckDBPyRelation:
    """Regional unique visitors (Table 9) per barri and month, with the change vs 2023.

    Every month in [start, end] appears; months with no row are `absent` (NULL, not 0).
    """
    return con.sql(f"""
        WITH months AS (
          SELECT CAST(generate_series AS DATE) AS month
          FROM generate_series(DATE '{start}', DATE '{end}', INTERVAL 1 MONTH)),
        grid AS (
          SELECT b.barri, m.month FROM months m
          CROSS JOIN (SELECT unnest([{', '.join(quote_literal(b) for b in barris)}]) AS barri) b),
        t AS (
          SELECT cod_barrio AS barri, month, sum(visitantes) AS visitors,
                 count(*) FILTER (WHERE cod_municipio_residencia <> '{UNKNOWN_HOME}') AS n_homes
          FROM {sub(t9)} WHERE cod_barrio IN {_in_list(barris)} GROUP BY 1, 2),
        joined AS (
          SELECT g.barri, g.month, t.visitors, t.n_homes,
                 CASE WHEN t.visitors IS NULL THEN '{ABSENT}' ELSE '{PUBLISHED}' END AS state
          FROM grid g LEFT JOIN t USING (barri, month))
        SELECT j.*,
               base.visitors AS visitors_base,
               CASE WHEN year(j.month) > {BASE_YEAR}
                    THEN (j.visitors - base.visitors) / NULLIF(base.visitors, 0) END AS yoy
        FROM joined j
        LEFT JOIN joined base
          ON base.barri = j.barri
         AND year(base.month) = {BASE_YEAR}
         AND month(base.month) = month(j.month)
        ORDER BY j.barri, j.month""")


def visitors_by_home(
    con: duckdb.DuckDBPyConnection,
    t9: duckdb.DuckDBPyRelation,
    barris: Sequence[str],
) -> duckdb.DuckDBPyRelation:
    """Regional visitors per barri, month and home municipality (for the map and ranked list)."""
    return con.sql(f"""
        SELECT cod_barrio AS barri, month,
               cod_municipio_residencia AS home,
               CASE WHEN cod_municipio_residencia = '{UNKNOWN_HOME}'
                    THEN {quote_literal(UNKNOWN_HOME_NAME)}
                    ELSE municipio_residencia END AS home_name,
               visitantes AS visitors
        FROM {sub(t9)}
        WHERE cod_barrio IN {_in_list(barris)}
        ORDER BY barri, month, visitors DESC""")


def weekend_share(
    con: duckdb.DuckDBPyConnection,
    mobility: duckdb.DuckDBPyRelation,
    coverage: duckdb.DuckDBPyRelation,
    calendar: duckdb.DuckDBPyRelation,
    barris: Sequence[str],
) -> duckdb.DuckDBPyRelation:
    """Weekend share of regional town -> barri trips per barri and month (Table 3, R5, D1).

    Only routes with a row on >= 80% of the month's days (D1). Only valid days: not missing,
    not partial, not a holiday. Share of a typical week = 2*weekend mean / (2*weekend mean +
    5*weekday mean), so missing days do not tilt the result.
    """
    return con.sql(f"""
        WITH routes AS (
          SELECT month, dest_barri AS barri, origin_mun
          FROM {sub(coverage)}
          WHERE origen = 'Regional' AND meets_coverage AND dest_barri IN {_in_list(barris)}),
        valid_days AS (
          SELECT day, date_trunc('month', day)::DATE AS month, is_weekend
          FROM {sub(calendar)} WHERE day_status = '{DAY_OK}' AND NOT is_holiday),
        route_days AS (
          SELECT m.day, r.barri, r.origin_mun, sum(m.viajes) AS v
          FROM {sub(mobility)} m
          JOIN routes r
            ON r.month = date_trunc('month', m.day)::DATE
           AND r.origin_mun = m.municipio_origen AND r.barri = m.barrio_destino
          WHERE m.origen = 'Regional' AND m.barrio_origen IS NULL
          GROUP BY ALL),
        barri_month AS (
          SELECT DISTINCT b.barri, d.month
          FROM (SELECT unnest([{', '.join(quote_literal(b) for b in barris)}]) AS barri) b
          CROSS JOIN valid_days d),
        n_routes AS (SELECT barri, month, count(*) AS n FROM routes GROUP BY ALL),
        daily AS (
          SELECT bm.barri, d.month, d.day, d.is_weekend,
                 coalesce(sum(rd.v), 0) AS trips,
                 count(rd.v) FILTER (WHERE rd.v > 0) AS pub,
                 count(rd.v) FILTER (WHERE rd.v = 0) AS sup
          FROM barri_month bm
          JOIN valid_days d USING (month)
          LEFT JOIN route_days rd ON rd.day = d.day AND rd.barri = bm.barri
          GROUP BY ALL),
        means AS (
          SELECT barri, month,
                 avg(trips) FILTER (WHERE is_weekend) AS mean_weekend,
                 avg(trips) FILTER (WHERE NOT is_weekend) AS mean_weekday,
                 count(*) FILTER (WHERE is_weekend) AS valid_weekend_days,
                 count(*) FILTER (WHERE NOT is_weekend) AS valid_weekday_days,
                 sum(pub) AS route_days_published,
                 sum(sup) AS route_days_suppressed,
                 count(*) AS valid_days
          FROM daily GROUP BY ALL)
        SELECT m.barri, m.month,
               CASE WHEN coalesce(n.n, 0) > 0 THEN
                 {WEEKEND_DAYS} * m.mean_weekend / NULLIF(
                   {WEEKEND_DAYS} * m.mean_weekend + {WEEKDAYS} * m.mean_weekday, 0) END
                 AS weekend_share,
               m.mean_weekend, m.mean_weekday,
               coalesce(n.n, 0) AS n_routes,
               m.valid_weekend_days, m.valid_weekday_days,
               m.route_days_published, m.route_days_suppressed,
               coalesce(n.n, 0) * m.valid_days
                 - m.route_days_published - m.route_days_suppressed AS route_days_absent
        FROM means m LEFT JOIN n_routes n USING (barri, month)
        ORDER BY m.barri, m.month""")
