"""Context per pilot barri (T7b): rent €/m² (quarterly), residents (padró) and HUT.

Sources (all CC-BY 4.0, Ajuntament de Barcelona):
- Rent: Portal de Dades "Preu mitjà per superfície (€/m²) del lloguer d'habitatges"
  (Incasòl rental deposits), quarterly, copied for the pilot barris into
  pipeline/reference/rent_pilot_quarters.csv.
- Residents: Open Data BCN `pad_mdbas` (padró on 1 January), per census section.
- HUT: Open Data BCN `habitatges-us-turistic`, 2025 Q2 register.
Every join uses checked_join (rule R4).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path

import duckdb

from pipeline.integrate import assert_unique, checked_join
from pipeline.quality import sub
from pipeline.sql import fetch_one, quote_literal

HIDDEN = ".."  # padró cells under 5 people


class ContextError(ValueError):
    """A context file does not look like its source says it should."""


def _pilot_keys(pilots: Mapping[str, str]) -> str:
    """VALUES table (barri, name, district) for the pilots; district comes from our code."""
    rows = ", ".join(
        f"({quote_literal(code)}, {quote_literal(name)}, {int(code[5:7])})"
        for code, name in pilots.items()
    )
    return f"(VALUES {rows}) p(barri, name, district)"


def load_rent(con: duckdb.DuckDBPyConnection, path: Path) -> duckdb.DuckDBPyRelation:
    """(barri, quarter 'YYYYQn', rent_eur_m2), unique per barri and quarter."""
    rel = con.sql(f"""
        SELECT code AS barri, quarter, CAST(eur_m2 AS DOUBLE) AS rent_eur_m2
        FROM read_csv({quote_literal(path)}, header = true, all_varchar = true)""")
    invalid = "count(*) FILTER (WHERE rent_eur_m2 IS NULL OR rent_eur_m2 <= 0)"
    bad = fetch_one(rel.aggregate(invalid))[0]
    if bad:
        raise ContextError(f"{path.name}: {bad} rows with invalid eur_m2")
    assert_unique(rel, ["barri", "quarter"], "rent")
    return rel


def load_population(
    con: duckdb.DuckDBPyConnection, files: Sequence[Path], pilots: Mapping[str, str]
) -> duckdb.DuckDBPyRelation:
    """(barri, year, residents, hidden_sections). Residents are NULL if any section is hidden."""
    paths = ", ".join(quote_literal(f) for f in files)
    rel = con.sql(f"""
        SELECT p.barri, year(CAST(d.Data_Referencia AS DATE)) AS year,
               CASE WHEN count(*) FILTER (WHERE d.Valor = '{HIDDEN}') = 0
                    THEN sum(TRY_CAST(d.Valor AS BIGINT)) END AS residents,
               count(*) FILTER (WHERE d.Valor = '{HIDDEN}') AS hidden_sections
        FROM read_csv([{paths}], header = true, all_varchar = true) d
        JOIN {_pilot_keys(pilots)}
          ON d.Nom_Barri = p.name AND CAST(d.Codi_Districte AS INT) = p.district
        GROUP BY 1, 2""")
    assert_unique(rel, ["barri", "year"], "population")
    return rel


def load_hut(
    con: duckdb.DuckDBPyConnection, path: Path, pilots: Mapping[str, str]
) -> duckdb.DuckDBPyRelation:
    """(barri, hut): licensed tourist-use dwellings in the register snapshot."""
    rel = con.sql(f"""
        SELECT p.barri, count(*) AS hut
        FROM read_csv({quote_literal(path)}, header = true, all_varchar = true) h
        JOIN {_pilot_keys(pilots)}
          ON h.NOM_BARRI = p.name AND CAST(h.CODI_DISTRICTE AS INT) = p.district
        GROUP BY 1""")
    assert_unique(rel, ["barri"], "hut")
    return rel


def with_context(
    con: duckdb.DuckDBPyConnection,
    monthly: duckdb.DuckDBPyRelation,
    rent: duckdb.DuckDBPyRelation,
    population: duckdb.DuckDBPyRelation,
    hut: duckdb.DuckDBPyRelation,
    hut_year: int = 2025,
) -> duckdb.DuckDBPyRelation:
    """Add rent (by quarter), residents (by year) and HUT per 1,000 residents to each month (R4)."""
    keyed = con.sql(f"""SELECT *, strftime(month, '%Y') || 'Q' || quarter(month) AS quarter,
                                  year(month) AS year FROM {sub(monthly)}""")
    step = checked_join(keyed, rent, keys=["barri", "quarter"], measure="visitors")
    step = checked_join(step, population.project("barri, year, residents"),
                        keys=["barri", "year"], measure="visitors")
    hut_rate = con.sql(f"""
        SELECT h.barri, h.hut, 1000.0 * h.hut / NULLIF(p.residents, 0) AS hut_per_1000
        FROM {sub(hut)} h
        LEFT JOIN {sub(population)} p ON p.barri = h.barri AND p.year = {int(hut_year)}""")
    return checked_join(step, hut_rate, keys=["barri"], measure="visitors")
