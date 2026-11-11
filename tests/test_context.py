# ruff: noqa: E501  (synthetic CSV fixtures read better on one line)
"""Context data per pilot barri: rent (€/m², quarterly), residents (padró), HUT (T7b)."""

from __future__ import annotations

from datetime import date

import pytest

from pipeline.context import (
    ContextError,
    load_hut,
    load_population,
    load_rent,
    with_context,
)
from pipeline.integrate import JoinIntegrityError

PILOTS = {"080190308": "Sants", "080190904": "Sant Andreu"}


@pytest.fixture()
def rent_csv(tmp_path):
    p = tmp_path / "rent.csv"
    p.write_text("code,name,quarter,eur_m2\n"
                 "080190308,Sants,2024Q1,17.2\n080190308,Sants,2024Q2,15.4\n"
                 "080190904,Sant Andreu,2024Q1,14.4\n", encoding="utf-8")
    return p


@pytest.fixture()
def pad_files(tmp_path):
    header = "Data_Referencia,Codi_Districte,Nom_Districte,Codi_Barri,Nom_Barri,AEB,Seccio_Censal,Valor\n"
    out = []
    for year, (a, b, c) in {2024: (1000, 500, 800), 2025: (1100, 520, "..")}.items():
        p = tmp_path / f"{year}_pad_mdbas.csv"
        p.write_text(header
                     + f"{year}-01-01,3,Sants-Montjuïc,18,Sants,1,3001,{a}\n"
                     + f"{year}-01-01,3,Sants-Montjuïc,18,Sants,1,3002,{b}\n"
                     + f"{year}-01-01,9,Sant Andreu,60,Sant Andreu,1,9001,{c}\n"
                     + f"{year}-01-01,5,X,18,Sants,1,5001,9999\n", encoding="utf-8")  # same name, other district
        out.append(p)
    return out


@pytest.fixture()
def hut_csv(tmp_path):
    p = tmp_path / "hut.csv"
    rows = ["N_EXPEDIENT,CODI_DISTRICTE,NOM_DISTRICTE,CODI_BARRI,NOM_BARRI,NUMERO_PLACES"]
    rows += [f"E{i},3,Sants-Montjuïc,18,Sants,4" for i in range(30)]
    rows += [f"F{i},9,Sant Andreu,60,Sant Andreu,2" for i in range(5)]
    p.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return p


class TestRent:
    def test_quarterly_rent_per_barri(self, con, rent_csv):
        rows = load_rent(con, rent_csv).order("barri, quarter").fetchall()
        assert rows[0] == ("080190308", "2024Q1", 17.2)

    def test_duplicate_quarter_is_rejected(self, con, tmp_path):
        p = tmp_path / "r.csv"
        p.write_text("code,name,quarter,eur_m2\n1,a,2024Q1,10\n1,a,2024Q1,11\n", encoding="utf-8")
        with pytest.raises(JoinIntegrityError, match="unique"):
            load_rent(con, p)

    def test_non_positive_rent_is_rejected(self, con, tmp_path):
        p = tmp_path / "r.csv"
        p.write_text("code,name,quarter,eur_m2\n1,a,2024Q1,0\n", encoding="utf-8")
        with pytest.raises(ContextError, match="eur_m2"):
            load_rent(con, p)


class TestPopulation:
    def test_residents_are_summed_over_census_sections(self, con, pad_files):
        rows = dict(((b, y), r) for b, y, r, _ in load_population(con, pad_files, PILOTS).fetchall())
        assert rows[("080190308", 2024)] == 1500

    def test_same_name_in_another_district_is_ignored(self, con, pad_files):
        rows = dict(((b, y), r) for b, y, r, _ in load_population(con, pad_files, PILOTS).fetchall())
        assert rows[("080190308", 2025)] == 1620

    def test_hidden_values_are_counted_not_summed(self, con, pad_files):
        rows = {(b, y): (r, h) for b, y, r, h in load_population(con, pad_files, PILOTS).fetchall()}
        assert rows[("080190904", 2025)] == (None, 1)


class TestHut:
    def test_licences_counted_per_pilot_barri(self, con, hut_csv):
        assert dict(load_hut(con, hut_csv, PILOTS).fetchall()) == {"080190308": 30, "080190904": 5}


class TestWithContext:
    def _monthly(self, con):
        return con.sql("""SELECT * FROM (VALUES
            ('080190308', DATE '2024-01-01', 100), ('080190308', DATE '2024-02-01', 110),
            ('080190308', DATE '2024-04-01', 120), ('080190308', DATE '2025-01-01', 130),
            ('080190904', DATE '2024-01-01', 50)) t(barri, month, visitors)""")

    def test_keeps_rows_and_visitor_total_r4(self, con, rent_csv, pad_files, hut_csv):
        out = with_context(con, self._monthly(con), load_rent(con, rent_csv),
                           load_population(con, pad_files, PILOTS), load_hut(con, hut_csv, PILOTS))
        assert out.aggregate("count(*), sum(visitors)").fetchone() == (5, 510)

    def test_month_takes_its_quarter_rent_and_january_residents(self, con, rent_csv, pad_files, hut_csv):
        out = with_context(con, self._monthly(con), load_rent(con, rent_csv),
                           load_population(con, pad_files, PILOTS), load_hut(con, hut_csv, PILOTS))
        rows = {(b, m): (r, res) for b, m, r, res in out.project("barri, month, rent_eur_m2, residents").fetchall()}
        assert rows[("080190308", date(2024, 2, 1))] == (17.2, 1500)
        assert rows[("080190308", date(2024, 4, 1))] == (15.4, 1500)
        assert rows[("080190308", date(2025, 1, 1))] == (None, 1620)  # no 2025Q1 rent in fixture

    def test_hut_per_1000_uses_the_snapshot_year_population(self, con, rent_csv, pad_files, hut_csv):
        out = with_context(con, self._monthly(con), load_rent(con, rent_csv),
                           load_population(con, pad_files, PILOTS), load_hut(con, hut_csv, PILOTS),
                           hut_year=2025)
        value = out.filter("barri = '080190308'").project("hut_per_1000").fetchone()[0]
        assert value == pytest.approx(30 / 1620 * 1000)
