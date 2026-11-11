"""Pilot barri data-sufficiency score (T8). Transparent: every part is 0–1 and shown."""

from __future__ import annotations

import pytest

from pipeline.pilot import COMPONENTS, barri_sufficiency, top_barris

A, B, C = "080190101", "080190202", "080190303"


def _coverage(con, rows):
    """rows: (month, barri, origin_mun, days_with_row, days_published, meets_coverage)."""
    values = ", ".join(
        f"(DATE '{m}', 'Regional', '{o}', '{b}', {w}, {p}, {w - p}, {str(c).upper()})"
        for m, b, o, w, p, c in rows)
    return con.sql(f"SELECT * FROM (VALUES {values}) t(month, origen, origin_mun, dest_barri, "
                   "days_with_row, days_published, days_suppressed, meets_coverage)")


def _t9(con, rows):
    """rows: (month, barri, home, visitantes)."""
    values = ", ".join(f"(DATE '{m}', '{b}', '{h}', {v})" for m, b, h, v in rows)
    return con.sql(f"SELECT * FROM (VALUES {values}) "
                   "t(month, cod_barrio, cod_municipio_residencia, visitantes)")


@pytest.fixture()
def scored(con):
    cov = _coverage(con, [
        # A: two covered routes per month, all days published
        ("2024-01-01", A, "08187", 31, 31, True), ("2024-01-01", A, "08279", 30, 30, True),
        ("2024-02-01", A, "08187", 29, 29, True), ("2024-02-01", A, "08279", 29, 29, True),
        # B: one route, half suppressed, not covered in Feb
        ("2024-01-01", B, "08187", 31, 15, True), ("2024-02-01", B, "08187", 10, 5, False),
        # C: only appears in January
        ("2024-01-01", C, "08187", 5, 5, False),
    ])
    t9 = _t9(con, [
        ("2024-01-01", A, "08187", 100), ("2024-01-01", A, "08279", 100),
        ("2024-02-01", A, "08187", 110), ("2024-02-01", A, "08279", 90),
        ("2024-01-01", B, "08187", 100), ("2024-02-01", B, "08187", 500),
        ("2024-01-01", C, "08187", 20),
    ])
    return barri_sufficiency(con, cov, t9, n_months=2)


def _row(rel, barri):
    cols = rel.columns
    return dict(zip(cols, rel.filter(f"barri = '{barri}'").fetchone(), strict=True))


def test_every_component_is_between_0_and_1(scored):
    for barri in (A, B, C):
        row = _row(scored, barri)
        assert all(0 <= row[c] <= 1 for c in (*COMPONENTS, "score"))


def test_score_is_the_plain_mean_of_components(scored):
    row = _row(scored, B)
    assert row["score"] == pytest.approx(sum(row[c] for c in COMPONENTS) / len(COMPONENTS))


def test_published_share_counts_published_over_days_with_a_row(scored):
    assert _row(scored, B)["s_published"] == pytest.approx(20 / 41)


def test_usable_routes_are_normalised_to_the_best_barri(scored):
    assert _row(scored, A)["s_routes"] == 1.0
    assert _row(scored, B)["s_routes"] == pytest.approx(0.25)  # 0.5 vs 2 routes per month


def test_t9_months_share_uses_the_full_window(scored):
    assert _row(scored, C)["s_t9_months"] == pytest.approx(0.5)


def test_home_towns_are_normalised_to_the_best_barri(scored):
    assert _row(scored, A)["s_homes"] == 1.0
    assert _row(scored, B)["s_homes"] == pytest.approx(0.5)


def test_stability_is_share_of_months_within_half_and_double_the_median(scored):
    assert _row(scored, A)["s_stability"] == 1.0
    assert _row(scored, B)["s_stability"] == pytest.approx(0.5)  # 100 vs 500, median 300


def test_evidence_columns_are_kept_next_to_the_score(scored):
    row = _row(scored, A)
    assert row["avg_routes"] == 2.0
    assert row["t9_months"] == 2
    assert row["avg_homes"] == 2.0


def test_top_barris_ranks_by_score_then_code(scored):
    assert [b for (b,) in top_barris(scored, n=2).project("barri").fetchall()] == [A, B]


def test_window_must_be_positive(con):
    cov = _coverage(con, [("2024-01-01", A, "08187", 31, 31, True)])
    t9 = _t9(con, [("2024-01-01", A, "08187", 100)])
    with pytest.raises(ValueError, match="n_months"):
        barri_sufficiency(con, cov, t9, n_months=0)
