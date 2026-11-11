"""Parquet cache (T3) and holiday flags (T6/T7a)."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pytest

from pipeline.config import load_settings
from pipeline.holidays import load_holidays, with_holiday_flags
from pipeline.ingest import ingest_mobility, load_mobility, read_mobility
from pipeline.quality import build_calendar


def _settings(tmp_path: Path, mobility: Path, **extra: str):
    tour = tmp_path / "tour"
    tour.mkdir(exist_ok=True)
    env = {"MOBILITY_DIR": str(mobility), "TOURISM_DIR": str(tour),
           "CACHE_DIR": str(tmp_path / "cache")}
    env.update(extra)
    return load_settings(env)


class TestParquetCache:
    def test_ingest_writes_parquet_with_same_rows(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        path = ingest_mobility(con, settings, "mun_barri")
        assert path.exists()
        cached = load_mobility(con, settings, "mun_barri")
        raw = read_mobility(con, feb_mobility, "mun_barri")
        assert cached.aggregate("count(*), sum(viajes)").fetchone() == \
            raw.aggregate("count(*), sum(viajes)").fetchone()

    def test_second_ingest_reuses_the_cache(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        first = ingest_mobility(con, settings, "mun_barri").stat().st_mtime_ns
        second = ingest_mobility(con, settings, "mun_barri").stat().st_mtime_ns
        assert first == second

    def test_changed_source_triggers_rebuild(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        first = ingest_mobility(con, settings, "mun_barri").stat().st_mtime_ns
        src = next(feb_mobility.glob("*/*.csv"))
        os.utime(src, ns=(src.stat().st_atime_ns, src.stat().st_mtime_ns + 10**9))
        assert ingest_mobility(con, settings, "mun_barri").stat().st_mtime_ns != first

    def test_force_rebuild_ignores_the_cache(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        first = ingest_mobility(con, settings, "mun_barri").stat().st_mtime_ns
        forced = _settings(tmp_path, feb_mobility, FORCE_REBUILD="1")
        assert ingest_mobility(con, forced, "mun_barri").stat().st_mtime_ns != first

    def test_load_without_ingest_fails_clearly(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        with pytest.raises(FileNotFoundError, match="make data"):
            load_mobility(con, settings, "mun_barri")

    def test_ingest_with_no_source_files_fails_clearly(self, con, tmp_path):
        empty = tmp_path / "empty"
        empty.mkdir()
        settings = _settings(tmp_path, empty)
        with pytest.raises(FileNotFoundError, match="mun_barri"):
            ingest_mobility(con, settings, "mun_barri")


class TestHolidays:
    def test_one_row_per_date(self, con):
        hol = load_holidays(con)
        assert hol.count("*").fetchone()[0] == hol.project("day").distinct().count("*").fetchone()[0]

    @pytest.mark.parametrize("day, scope", [
        (date(2024, 12, 25), "ES"),
        (date(2024, 6, 24), "CAT"),
        (date(2024, 9, 24), "BCN"),
        (date(2025, 4, 21), "CAT"),
        (date(2023, 5, 29), "BCN"),
    ])
    def test_known_holidays_and_scope(self, con, day, scope):
        row = load_holidays(con).filter(f"day = DATE '{day}'").project("scope").fetchone()
        assert row == (scope,)

    @pytest.mark.parametrize("year", [2023, 2024, 2025])
    def test_each_year_has_the_full_official_list(self, con, year):
        n = load_holidays(con).filter(f"year(day) = {year}").count("*").fetchone()[0]
        assert n >= 15  # 13–14 regional/national + 2 Barcelona local days

    def test_flags_are_added_without_changing_the_calendar(self, con, feb_mobility):
        rel = read_mobility(con, feb_mobility, "mun_barri")
        cal = build_calendar(con, rel, date(2024, 2, 1), date(2024, 2, 29))
        flagged = with_holiday_flags(con, cal, load_holidays(con))
        assert flagged.count("*").fetchone()[0] == 29
        assert {"is_holiday", "holiday_scope", "month_has_holiday"} <= set(flagged.columns)

    def test_month_flag_marks_every_day_of_a_month_with_a_holiday(self, con, tmp_path):
        from tests.conftest import trip, write_mobility
        write_mobility(tmp_path, "mun_barri",
                       [trip(date(2024, 9, d), 20) for d in range(1, 31)])
        rel = read_mobility(con, tmp_path, "mun_barri")
        cal = build_calendar(con, rel, date(2024, 9, 1), date(2024, 9, 30))
        flagged = with_holiday_flags(con, cal, load_holidays(con))
        day1 = flagged.filter("day = DATE '2024-09-01'").project(
            "is_holiday, month_has_holiday").fetchone()
        merce = flagged.filter("day = DATE '2024-09-24'").project("is_holiday").fetchone()
        assert day1 == (False, True)
        assert merce == (True,)
