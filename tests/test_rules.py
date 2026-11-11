"""Data-quality rules R1–R5 from the brief (§2). One section per rule."""

from __future__ import annotations

from datetime import date

import pytest

from pipeline.aggregate import monthly_route_coverage, trips_per_visitor
from pipeline.ingest import DataContractError, read_mobility, read_tourism
from pipeline.integrate import JoinIntegrityError, checked_join
from pipeline.quality import (
    ABSENT,
    PUBLISHED,
    SUPPRESSED,
    FamilyMixError,
    build_calendar,
    daily_totals,
    missing_days,
    with_state,
)
from tests.conftest import (
    BARRI_A,
    BARRI_B,
    BCN,
    FEB_END,
    FEB_START,
    LOW_NOT_ADJACENT,
    MISSING_DAY,
    PARTIAL_DAY,
    SABADELL,
    days,
    t9_row,
    trip,
    write_mobility,
    write_t9,
)

TERRASSA = "08279"


def _calendar(con, root):
    rel = read_mobility(con, root, "mun_barri")
    return rel, build_calendar(con, rel, FEB_START, FEB_END)


def _status(calendar, day: date) -> str:
    return calendar.filter(f"day = DATE '{day.isoformat()}'").fetchone()[1]


# ---------------------------------------------------------------- R1 missing days


class TestR1MissingDays:
    def test_detects_days_without_any_row(self, con, feb_mobility):
        _, calendar = _calendar(con, feb_mobility)
        assert missing_days(calendar) == [MISSING_DAY]

    def test_calendar_covers_every_day_in_range(self, con, feb_mobility):
        _, calendar = _calendar(con, feb_mobility)
        assert calendar.count("*").fetchone()[0] == len(days(FEB_START, FEB_END))

    def test_missing_day_total_is_null_not_zero(self, con, feb_mobility):
        rel, calendar = _calendar(con, feb_mobility)
        totals = daily_totals(con, rel, calendar)
        value = totals.filter(f"day = DATE '{MISSING_DAY}'").fetchone()[1]
        assert value is None

    def test_normal_day_total_is_kept(self, con, feb_mobility):
        rel, calendar = _calendar(con, feb_mobility)
        totals = daily_totals(con, rel, calendar)
        assert totals.filter("day = DATE '2024-02-01'").fetchone()[1] == 1000

    def test_low_day_next_to_gap_is_partial(self, con, feb_mobility):
        _, calendar = _calendar(con, feb_mobility)
        assert _status(calendar, PARTIAL_DAY) == "partial"

    def test_low_day_not_next_to_gap_stays_ok(self, con, feb_mobility):
        _, calendar = _calendar(con, feb_mobility)
        assert _status(calendar, LOW_NOT_ADJACENT) == "ok"

    def test_weekend_flag_uses_the_date_not_spanish_text(self, con, feb_mobility):
        _, calendar = _calendar(con, feb_mobility)
        row = calendar.filter("day = DATE '2024-02-10'").fetchone()  # Saturday
        assert row[2] is True


# ---------------------------------------------------------- R2 suppression states


class TestR2States:
    def test_zero_trips_is_suppressed_and_positive_is_published(self, con, feb_mobility):
        rel = with_state(read_mobility(con, feb_mobility, "mun_barri"))
        states = dict(
            rel.filter(f"municipio_origen = '{SABADELL}' AND day IN "
                       "(DATE '2024-02-01', DATE '2024-02-02')")
            .project("day::VARCHAR, state").fetchall()
        )
        assert states == {"2024-02-01": PUBLISHED, "2024-02-02": SUPPRESSED}

    def test_coverage_separates_published_suppressed_and_absent(self, con, feb_mobility):
        rel, calendar = _calendar(con, feb_mobility)
        cov = monthly_route_coverage(con, rel, calendar)
        row = cov.filter(f"origin_mun = '{TERRASSA}'").project(
            "days_in_month, days_missing, days_with_row, days_published, "
            "days_suppressed, days_absent"
        ).fetchone()
        assert row == (29, 1, 10, 10, 0, 18)

    def test_suppressed_days_are_not_counted_as_absent(self, con, feb_mobility):
        rel, calendar = _calendar(con, feb_mobility)
        cov = monthly_route_coverage(con, rel, calendar)
        row = cov.filter(f"origin_mun = '{SABADELL}'").project(
            "days_published, days_suppressed, days_absent, trips_published"
        ).fetchone()
        assert row == (14, 14, 0, 280)

    def test_tourism_rows_are_published_never_suppressed(self, con, tmp_path):
        write_t9(tmp_path, [t9_row("202402", BARRI_A, SABADELL, 15)])
        t9 = read_tourism(con, tmp_path, "visitantes_regionales_barrio_yearmon")
        assert {s for (s,) in t9.project("state").distinct().fetchall()} == {PUBLISHED}

    def test_state_constants_are_distinct(self):
        assert len({PUBLISHED, SUPPRESSED, ABSENT}) == 3

    def test_nonzero_trips_below_threshold_break_the_contract(self, con, tmp_path):
        write_mobility(tmp_path, "mun_barri", [trip(date(2024, 2, 1), 7)])
        with pytest.raises(DataContractError, match="viajes"):
            read_mobility(con, tmp_path, "mun_barri").fetchall()


# ------------------------------------------------------------ R3 family separation


class TestR3Families:
    def test_each_relation_is_tagged_with_its_family(self, con, feb_mobility):
        rel = read_mobility(con, feb_mobility, "mun_barri")
        assert rel.project("family").distinct().fetchall() == [("mun_barri",)]

    def test_mixing_families_is_rejected(self, con, feb_mobility, tmp_path):
        bb_root = tmp_path / "bb"
        write_mobility(bb_root, "barri_barri",
                       [trip(date(2024, 2, 1), 20, bo=BARRI_B, bd=BARRI_A)])
        mixed = read_mobility(con, feb_mobility, "mun_barri").union(
            read_mobility(con, bb_root, "barri_barri"))
        calendar = build_calendar(con, mixed, FEB_START, FEB_END)
        with pytest.raises(FamilyMixError):
            monthly_route_coverage(con, mixed, calendar)

    def test_route_coverage_only_accepts_the_mixed_family(self, con, tmp_path):
        write_mobility(tmp_path, "barri_barri",
                       [trip(date(2024, 2, 1), 20, bo=BARRI_B, bd=BARRI_A)])
        rel = read_mobility(con, tmp_path, "barri_barri")
        calendar = build_calendar(con, rel, FEB_START, FEB_END)
        with pytest.raises(FamilyMixError, match="mun_barri"):
            monthly_route_coverage(con, rel, calendar)

    def test_mixed_row_with_no_barri_side_breaks_the_contract(self, con, tmp_path):
        write_mobility(tmp_path, "mun_barri", [trip(date(2024, 2, 1), 20, bd="-")])
        with pytest.raises(DataContractError, match="exactly one"):
            read_mobility(con, tmp_path, "mun_barri").fetchall()

    def test_mixed_row_with_two_barri_sides_breaks_the_contract(self, con, tmp_path):
        write_mobility(tmp_path, "mun_barri", [trip(date(2024, 2, 1), 20, bo=BARRI_B)])
        with pytest.raises(DataContractError, match="exactly one"):
            read_mobility(con, tmp_path, "mun_barri").fetchall()

    def test_barri_family_row_without_barri_breaks_the_contract(self, con, tmp_path):
        write_mobility(tmp_path, "barri_barri", [trip(date(2024, 2, 1), 20)])
        with pytest.raises(DataContractError, match="barri"):
            read_mobility(con, tmp_path, "barri_barri").fetchall()

    def test_dash_becomes_null_and_codes_keep_leading_zeros(self, con, feb_mobility):
        row = read_mobility(con, feb_mobility, "mun_barri").project(
            "municipio_destino, barrio_destino, barrio_origen").limit(1).fetchone()
        assert row == (BCN, BARRI_A, None)

    def test_municipal_family_has_no_barri_columns(self, con, tmp_path):
        write_mobility(tmp_path, "municipal", [trip(date(2024, 2, 1), 20)])
        rel = read_mobility(con, tmp_path, "municipal")
        assert "barrio_origen" not in rel.columns

    def test_unknown_family_is_rejected(self, con, tmp_path):
        with pytest.raises(ValueError, match="family"):
            read_mobility(con, tmp_path, "provincial")


# ------------------------------------------------------------ R4 join integrity


class TestR4Joins:
    def _left(self, con):
        return con.sql("SELECT * FROM (VALUES ('a', 10), ('a', 5), ('b', 7)) t(k, viajes)")

    def test_join_keeps_rows_and_measure_total(self, con):
        right = con.sql("SELECT * FROM (VALUES ('a', 1.5), ('b', 2.0)) t(k, rent)")
        out = checked_join(self._left(con), right, keys=["k"], measure="viajes")
        assert out.count("*").fetchone()[0] == 3
        assert out.sum("viajes").fetchone()[0] == 22

    def test_left_join_keeps_unmatched_rows(self, con):
        right = con.sql("SELECT * FROM (VALUES ('a', 1.5)) t(k, rent)")
        out = checked_join(self._left(con), right, keys=["k"], measure="viajes")
        assert out.count("*").fetchone()[0] == 3

    def test_duplicate_right_key_is_rejected(self, con):
        right = con.sql("SELECT * FROM (VALUES ('a', 1.5), ('a', 9.9)) t(k, rent)")
        with pytest.raises(JoinIntegrityError, match="unique"):
            checked_join(self._left(con), right, keys=["k"], measure="viajes")

    def test_inner_join_that_drops_rows_is_rejected(self, con):
        right = con.sql("SELECT * FROM (VALUES ('a', 1.5)) t(k, rent)")
        with pytest.raises(JoinIntegrityError, match="rows"):
            checked_join(self._left(con), right, keys=["k"], measure="viajes", how="inner")

    def test_measure_can_be_visitors(self, con):
        left = con.sql("SELECT * FROM (VALUES ('a', 15), ('b', 20)) t(k, visitantes)")
        right = con.sql("SELECT * FROM (VALUES ('a', 1), ('b', 2)) t(k, flag)")
        out = checked_join(left, right, keys=["k"], measure="visitantes")
        assert out.sum("visitantes").fetchone()[0] == 35

    def test_many_to_one_month_to_quarter(self, con):
        left = con.sql(
            "SELECT * FROM (VALUES ('2024T1', 1, 10), ('2024T1', 2, 20), ('2024T1', 3, 30))"
            " t(quarter, m, viajes)")
        right = con.sql("SELECT * FROM (VALUES ('2024T1', 900.0)) t(quarter, rent)")
        out = checked_join(left, right, keys=["quarter"], measure="viajes")
        assert out.count("*").fetchone()[0] == 3

    def test_missing_measure_column_is_rejected(self, con):
        right = con.sql("SELECT * FROM (VALUES ('a', 1)) t(k, x)")
        with pytest.raises(JoinIntegrityError, match="measure"):
            checked_join(self._left(con), right, keys=["k"], measure="visitantes")


# ----------------------------------------------- R5 trips vs visitors (decision D1)


class TestR5TripsVsVisitors:
    def _ratios(self, con, feb_mobility, tmp_path):
        rel, calendar = _calendar(con, feb_mobility)
        cov = monthly_route_coverage(con, rel, calendar)
        tour = tmp_path / "tour"
        write_t9(tour, [t9_row("202402", BARRI_A, SABADELL, 100),
                        t9_row("202402", BARRI_A, TERRASSA, 50)])
        t9 = read_tourism(con, tour, "visitantes_regionales_barrio_yearmon")
        return trips_per_visitor(con, cov, t9)

    def test_ratio_is_computed_on_routes_with_rows_on_80pct_of_days(
            self, con, feb_mobility, tmp_path):
        out = self._ratios(con, feb_mobility, tmp_path)
        ratio = out.filter(f"origin_mun = '{SABADELL}'").project("ratio").fetchone()[0]
        assert ratio == pytest.approx(2.8)

    def test_ratio_is_null_below_80pct_coverage(self, con, feb_mobility, tmp_path):
        out = self._ratios(con, feb_mobility, tmp_path)
        ratio = out.filter(f"origin_mun = '{TERRASSA}'").project("ratio").fetchone()[0]
        assert ratio is None

    def test_suppressed_days_count_towards_coverage_d1(self, con, feb_mobility):
        rel, calendar = _calendar(con, feb_mobility)
        cov = monthly_route_coverage(con, rel, calendar)
        meets = cov.filter(f"origin_mun = '{SABADELL}'").project("meets_coverage").fetchone()
        assert meets == (True,)  # 28 of 29 days have a row; only 14 are published

    def test_tourism_month_parsed_from_yyyymm(self, con, tmp_path):
        write_t9(tmp_path, [t9_row("202402", BARRI_A, SABADELL, 15)])
        t9 = read_tourism(con, tmp_path, "visitantes_regionales_barrio_yearmon")
        assert t9.project("month").fetchone()[0] == date(2024, 2, 1)

    def test_tourism_unknown_home_is_kept_as_na_text(self, con, tmp_path):
        write_t9(tmp_path, [t9_row("202402", BARRI_A, "NA", 40)])
        t9 = read_tourism(con, tmp_path, "visitantes_regionales_barrio_yearmon")
        assert t9.project("cod_municipio_residencia").fetchone()[0] == "NA"
