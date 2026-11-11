"""Regression tests for issues found by python-reviewer and database-reviewer."""

from __future__ import annotations

from datetime import date

import pytest

from pipeline.aggregate import monthly_route_coverage, trips_per_visitor
from pipeline.cache import CACHE_VERSION, fingerprint, is_fresh, manifest_path, write_manifest
from pipeline.holidays import load_holidays
from pipeline.ingest import DataContractError, read_mobility
from pipeline.integrate import JoinIntegrityError, checked_join
from pipeline.quality import build_calendar, missing_days
from pipeline.sql import quote_ident, quote_literal
from tests.conftest import BARRI_A, SABADELL, trip, write_mobility


class TestSqlQuoting:
    def test_literal_escapes_single_quotes(self):
        assert quote_literal("/tmp/it's/x.parquet") == "'/tmp/it''s/x.parquet'"

    def test_ident_escapes_double_quotes(self):
        assert quote_ident('we"ird') == '"we""ird"'


class TestJoinHardening:
    def test_multi_key_join(self, con):
        left = con.sql("SELECT * FROM (VALUES ('a', 1, 10), ('a', 2, 5), ('b', 1, 7))"
                       " t(k1, k2, viajes)")
        right = con.sql("SELECT * FROM (VALUES ('a', 1, 'x'), ('a', 2, 'y')) t(k1, k2, tag)")
        out = checked_join(left, right, keys=["k1", "k2"], measure="viajes")
        assert sorted(out.project("k1, k2, tag").fetchall()) == [
            ("a", 1, "x"), ("a", 2, "y"), ("b", 1, None)]

    def test_key_missing_on_right_is_rejected(self, con):
        left = con.sql("SELECT * FROM (VALUES ('a', 10)) t(k, viajes)")
        right = con.sql("SELECT * FROM (VALUES ('a', 1)) t(other, x)")
        with pytest.raises(JoinIntegrityError, match="key"):
            checked_join(left, right, keys=["k"], measure="viajes")

    def test_float_measure_tolerates_rounding(self, con):
        left = con.sql("SELECT k, v::DOUBLE / 10 AS m FROM (VALUES ('a', 1), ('b', 2), "
                       "('c', 3)) t(k, v)")
        right = con.sql("SELECT * FROM (VALUES ('a', 1), ('b', 1), ('c', 1)) t(k, x)")
        assert checked_join(left, right, keys=["k"], measure="m").count("*").fetchone()[0] == 3

    def test_all_null_measure_is_allowed(self, con):
        left = con.sql("SELECT * FROM (VALUES ('a', NULL::BIGINT)) t(k, viajes)")
        right = con.sql("SELECT * FROM (VALUES ('a', 1)) t(k, x)")
        assert checked_join(left, right, keys=["k"], measure="viajes").count("*").fetchone()[0] == 1


class TestCalendarEdges:
    def _cal(self, con, tmp_path, present: list[int]):
        write_mobility(tmp_path, "mun_barri", [trip(date(2024, 3, d), 20) for d in present])
        rel = read_mobility(con, tmp_path, "mun_barri")
        return build_calendar(con, rel, date(2024, 3, 1), date(2024, 3, 10))

    def test_gaps_on_first_and_last_day(self, con, tmp_path):
        assert missing_days(self._cal(con, tmp_path, list(range(2, 10)))) == [
            date(2024, 3, 1), date(2024, 3, 10)]

    def test_two_adjacent_missing_days(self, con, tmp_path):
        cal = self._cal(con, tmp_path, [1, 2, 3, 6, 7, 8, 9, 10])
        assert missing_days(cal) == [date(2024, 3, 4), date(2024, 3, 5)]


class TestContractEdges:
    def test_empty_barri_fields_break_the_mixed_contract(self, con, tmp_path):
        write_mobility(tmp_path, "mun_barri", [trip(date(2024, 2, 1), 20, bd="")])
        with pytest.raises(DataContractError, match="exactly one"):
            read_mobility(con, tmp_path, "mun_barri")

    def test_municipal_contract_message_names_the_family(self, con, tmp_path):
        write_mobility(tmp_path, "municipal", [trip(date(2024, 2, 1), 3)])
        with pytest.raises(DataContractError, match="municipal"):
            read_mobility(con, tmp_path, "municipal")


class TestCoverageEdges:
    def test_day_with_zero_and_positive_rows_counts_once(self, con, tmp_path):
        d = date(2024, 2, 1)
        write_mobility(tmp_path, "mun_barri", [trip(d, 0), trip(d, 20)])
        rel = read_mobility(con, tmp_path, "mun_barri")
        cal = build_calendar(con, rel, d, d)
        row = monthly_route_coverage(con, rel, cal).project(
            "days_with_row, days_published, days_suppressed").fetchone()
        assert row == (1, 1, 0)

    def test_duplicate_visitor_keys_are_rejected(self, con, tmp_path):
        d = date(2024, 2, 1)
        write_mobility(tmp_path, "mun_barri", [trip(d, 20)])
        rel = read_mobility(con, tmp_path, "mun_barri")
        cov = monthly_route_coverage(con, rel, build_calendar(con, rel, d, d))
        visitors = con.sql(
            f"SELECT DATE '2024-02-01' AS month, '{BARRI_A}' AS cod_barrio, "
            f"'{SABADELL}' AS cod_municipio_residencia, 15::BIGINT AS visitantes "
            "FROM range(2)")
        with pytest.raises(JoinIntegrityError, match="unique"):
            trips_per_visitor(con, cov, visitors).fetchall()


class TestCacheHardening:
    def test_manifest_records_code_version(self, tmp_path):
        out = tmp_path / "x.parquet"
        out.write_bytes(b"x")
        write_manifest(out, fingerprint([out]))
        assert str(CACHE_VERSION) in manifest_path(out).read_text()

    def test_corrupt_manifest_means_stale(self, tmp_path):
        out = tmp_path / "x.parquet"
        out.write_bytes(b"x")
        manifest_path(out).write_bytes(b"\xff\xfe not json")
        assert is_fresh(out, fingerprint([out])) is False


class TestHolidayFile:
    def test_duplicate_dates_fail_with_a_clear_message(self, con, tmp_path):
        bad = tmp_path / "h.csv"
        bad.write_text("day,scope,name_ca,source\n2024-01-01,ES,a,s\n2024-01-01,CAT,b,s\n")
        with pytest.raises(ValueError, match="duplicate"):
            load_holidays(con, bad)
