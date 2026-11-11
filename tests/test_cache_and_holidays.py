"""Parquet cache (T3) and holiday flags (T6/T7a)."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pytest

from pipeline.config import load_settings
from pipeline.holidays import load_holidays, with_holiday_flags
from pipeline.ingest import DataContractError, ingest_mobility, load_mobility, read_mobility
from pipeline.quality import build_calendar


def _settings(tmp_path: Path, mobility: Path, **extra: str):
    tour = tmp_path / "tour"
    tour.mkdir(exist_ok=True)
    env = {"MOBILITY_DIR": str(mobility), "TOURISM_DIR": str(tour),
           "CACHE_DIR": str(tmp_path / "cache")}
    env.update(extra)
    return load_settings(env)


class TestParquetCache:
    """One Parquet file per family and month, so memory stays bounded and changes are local."""

    def _mtimes(self, paths):
        return [p.stat().st_mtime_ns for p in paths]

    def test_ingest_writes_one_parquet_per_month_with_same_rows(
            self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        paths = ingest_mobility(con, settings, "mun_barri")
        assert [p.name for p in paths] == ["2024-02.parquet"]
        cached = load_mobility(con, settings, "mun_barri")
        raw = read_mobility(con, feb_mobility, "mun_barri")
        assert cached.aggregate("count(*), sum(viajes)").fetchone() == \
            raw.aggregate("count(*), sum(viajes)").fetchone()

    def test_second_ingest_reuses_the_cache(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        first = self._mtimes(ingest_mobility(con, settings, "mun_barri"))
        assert self._mtimes(ingest_mobility(con, settings, "mun_barri")) == first

    def test_changed_source_rebuilds_only_that_month(self, con, tmp_path, feb_mobility):
        from tests.conftest import trip, write_mobility
        write_mobility(feb_mobility, "mun_barri", [trip(date(2024, 3, 1), 20)])
        settings = _settings(tmp_path, feb_mobility)
        feb, mar = self._mtimes(ingest_mobility(con, settings, "mun_barri"))
        src = next(feb_mobility.glob("2024-03/*.csv"))
        os.utime(src, ns=(src.stat().st_atime_ns, src.stat().st_mtime_ns + 10**9))
        feb2, mar2 = self._mtimes(ingest_mobility(con, settings, "mun_barri"))
        assert feb2 == feb
        assert mar2 != mar

    def test_force_rebuild_ignores_the_cache(self, con, tmp_path, feb_mobility):
        settings = _settings(tmp_path, feb_mobility)
        first = self._mtimes(ingest_mobility(con, settings, "mun_barri"))
        forced = _settings(tmp_path, feb_mobility, FORCE_REBUILD="1")
        assert self._mtimes(ingest_mobility(con, forced, "mun_barri")) != first

    def test_bad_month_leaves_no_parquet_behind(self, con, tmp_path):
        from tests.conftest import trip, write_mobility
        root = tmp_path / "bad"
        write_mobility(root, "mun_barri", [trip(date(2024, 2, 1), 7)])
        settings = _settings(tmp_path, root)
        with pytest.raises(DataContractError):
            ingest_mobility(con, settings, "mun_barri")
        assert list((tmp_path / "cache").rglob("*.parquet")) == []

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
        n_rows = hol.count("*").fetchone()[0]
        assert n_rows == hol.project("day").distinct().count("*").fetchone()[0]

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
