"""Interpretable indicators per pilot barri and month (T10)."""

from __future__ import annotations

from datetime import date

import pytest

from pipeline.aggregate import monthly_route_coverage
from pipeline.holidays import load_holidays, with_holiday_flags
from pipeline.indicators import (
    PILOTS,
    UNKNOWN_HOME_NAME,
    visitors_by_home,
    visitors_monthly,
    weekend_share,
)
from pipeline.ingest import read_mobility, read_tourism
from pipeline.quality import ABSENT, PUBLISHED, build_calendar
from tests.conftest import (
    BARRI_A,
    BARRI_B,
    FEB_END,
    FEB_START,
    days,
    t9_row,
    trip,
    write_mobility,
    write_t9,
)

MISSING_SUNDAY = date(2024, 2, 11)
MATARO = "08121"
TERRASSA = "08279"


def _t9(con, tmp_path):
    write_t9(tmp_path, [
        t9_row("202302", BARRI_A, "08187", 100), t9_row("202302", BARRI_A, "NA", 20),
        t9_row("202402", BARRI_A, "08187", 150), t9_row("202402", BARRI_A, "NA", 30),
        t9_row("202402", BARRI_B, "08187", 999),
    ])
    return read_tourism(con, tmp_path, "visitantes_regionales_barrio_yearmon")


class TestVisitorsMonthly:
    def _monthly(self, con, tmp_path):
        return visitors_monthly(con, _t9(con, tmp_path), [BARRI_A],
                                date(2023, 2, 1), date(2024, 3, 1))

    def _row(self, rel, month: str):
        cols = rel.columns
        return dict(zip(cols, rel.filter(f"month = DATE '{month}'").fetchone(), strict=True))

    def test_total_sums_home_towns_within_the_month(self, con, tmp_path):
        assert self._row(self._monthly(con, tmp_path), "2024-02-01")["visitors"] == 180

    def test_months_without_rows_are_absent_not_zero(self, con, tmp_path):
        row = self._row(self._monthly(con, tmp_path), "2024-03-01")
        assert (row["visitors"], row["state"]) == (None, ABSENT)

    def test_published_month_has_published_state(self, con, tmp_path):
        assert self._row(self._monthly(con, tmp_path), "2024-02-01")["state"] == PUBLISHED

    def test_change_vs_same_month_2023(self, con, tmp_path):
        assert self._row(self._monthly(con, tmp_path), "2024-02-01")["yoy"] == pytest.approx(0.5)

    def test_change_is_null_for_the_base_year(self, con, tmp_path):
        assert self._row(self._monthly(con, tmp_path), "2023-02-01")["yoy"] is None

    def test_change_is_null_when_base_month_is_absent(self, con, tmp_path):
        assert self._row(self._monthly(con, tmp_path), "2024-03-01")["yoy"] is None

    def test_known_home_towns_exclude_unknown(self, con, tmp_path):
        assert self._row(self._monthly(con, tmp_path), "2024-02-01")["n_homes"] == 1

    def test_only_requested_barris(self, con, tmp_path):
        rel = self._monthly(con, tmp_path)
        assert {b for (b,) in rel.project("barri").distinct().fetchall()} == {BARRI_A}

    def test_every_month_of_the_window_is_present(self, con, tmp_path):
        assert self._monthly(con, tmp_path).count("*").fetchone()[0] == 14


class TestVisitorsByHome:
    def test_unknown_home_gets_a_readable_name(self, con, tmp_path):
        rel = visitors_by_home(con, _t9(con, tmp_path), [BARRI_A])
        names = dict(rel.filter("month = DATE '2024-02-01'").project("home, home_name").fetchall())
        assert names["NA"] == UNKNOWN_HOME_NAME

    def test_values_are_never_summed_across_months(self, con, tmp_path):
        rel = visitors_by_home(con, _t9(con, tmp_path), [BARRI_A])
        assert "month" in rel.columns
        assert rel.filter("home = '08187'").count("*").fetchone()[0] == 2


@pytest.fixture()
def weekend_inputs(con, tmp_path):
    """Feb 2024. Sabadell->A covered: 100/weekday, 50/weekend day. Mataró->A covered but always
    suppressed (0). Terrassa->A on 5 days only (not covered, must not count). Feb 11 missing."""
    rows = []
    for d in days(FEB_START, FEB_END):
        if d == MISSING_SUNDAY:
            continue
        rows.append(trip(d, 50 if d.weekday() >= 5 else 100))
        rows.append(trip(d, 0, mo=MATARO))
        if d.day <= 5:
            rows.append(trip(d, 999, mo=TERRASSA))
    write_mobility(tmp_path / "mob", "mun_barri", rows)
    rel = read_mobility(con, tmp_path / "mob", "mun_barri")
    cal = with_holiday_flags(con, build_calendar(con, rel, FEB_START, FEB_END), load_holidays(con))
    cov = monthly_route_coverage(con, rel, cal)
    return weekend_share(con, rel, cov, cal, [BARRI_A])


def _first(rel):
    return dict(zip(rel.columns, rel.fetchone(), strict=True))


class TestWeekendShare:
    def test_share_of_a_typical_week_from_daily_means(self, weekend_inputs):
        assert _first(weekend_inputs)["weekend_share"] == pytest.approx(100 / 600)

    def test_missing_day_is_excluded_from_the_weekend_mean(self, weekend_inputs):
        row = _first(weekend_inputs)
        assert (row["valid_weekend_days"], row["valid_weekday_days"]) == (7, 21)

    def test_only_covered_routes_count(self, weekend_inputs):
        assert _first(weekend_inputs)["n_routes"] == 2

    def test_badge_counts_route_days_by_state(self, weekend_inputs):
        row = _first(weekend_inputs)
        assert (row["route_days_published"], row["route_days_suppressed"],
                row["route_days_absent"]) == (28, 28, 0)

    def test_holidays_are_excluded(self, con, tmp_path):
        rows = [trip(d, 100) for d in days(date(2024, 12, 1), date(2024, 12, 31))]
        write_mobility(tmp_path / "dec", "mun_barri", rows)
        rel = read_mobility(con, tmp_path / "dec", "mun_barri")
        cal = with_holiday_flags(con, build_calendar(con, rel, date(2024, 12, 1),
                                                     date(2024, 12, 31)), load_holidays(con))
        out = _first(weekend_share(con, rel, monthly_route_coverage(con, rel, cal), cal,
                                   [BARRI_A]))
        # Dec 2024: 31 days, holidays 6, 8 (Sun), 25, 26 -> 3 weekday holidays, 1 weekend
        assert (out["valid_weekday_days"], out["valid_weekend_days"]) == (19, 8)

    def test_no_covered_routes_gives_null_share(self, con, tmp_path):
        write_mobility(tmp_path / "few", "mun_barri", [trip(date(2024, 2, 1), 20)])
        rel = read_mobility(con, tmp_path / "few", "mun_barri")
        cal = with_holiday_flags(con, build_calendar(con, rel, FEB_START, FEB_END),
                                 load_holidays(con))
        out = weekend_share(con, rel, monthly_route_coverage(con, rel, cal), cal, [BARRI_A])
        row = _first(out)
        assert (row["weekend_share"], row["n_routes"]) == (None, 0)


def test_pilots_match_decision_d3():
    assert set(PILOTS) == {"080190203", "080190308", "080190904"}
