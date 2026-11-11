"""JSON export for the web (T11) against contract/arrels.schema.json."""

from __future__ import annotations

from datetime import date

import pytest

from pipeline.export import (
    OTHER_HOMES_CODE,
    SizeLimitError,
    ThresholdError,
    assert_threshold,
    barri_payload,
    check_size,
    sample_payloads,
    validate,
)

CODE = "080190308"


def _payload(**overrides):
    args = dict(
        code=CODE, name="Sants",
        visitors_rows=[
            {"month": date(2023, 2, 1), "visitors": 120, "state": "published", "yoy": None},
            {"month": date(2024, 2, 1), "visitors": 180, "state": "published", "yoy": 0.5},
            {"month": date(2024, 3, 1), "visitors": None, "state": "absent", "yoy": None},
        ],
        weekend_rows=[
            {"month": date(2024, 2, 1), "weekend_share": 0.1667, "n_routes": 2,
             "route_days_published": 28, "route_days_suppressed": 28, "route_days_absent": 0},
        ],
        home_rows=[
            {"month": date(2024, 2, 1), "home": "08187", "home_name": "Sabadell", "visitors": 100},
            {"month": date(2024, 2, 1), "home": "08279", "home_name": "Terrassa", "visitors": 50},
            {"month": date(2024, 2, 1), "home": "08121", "home_name": "Mataró", "visitors": 20},
            {"month": date(2024, 2, 1), "home": "NA", "home_name": "Residència desconeguda",
             "visitors": 16},
        ],
        holidays_by_month={"2024-02": []},
        centroids={"08187": (41.55, 2.11)},
        top_homes=2,
    )
    args.update(overrides)
    return barri_payload(**args)


def _month(payload, month):
    return next(m for m in payload["months"] if m["month"] == month)


def test_payload_matches_the_schema():
    validate(_payload(), "barri")


def test_absent_month_is_null_with_absent_state():
    v = _month(_payload(), "2024-03")["visitors"]
    assert (v["value"], v["state"], v["badge"]["pct_absent"]) == (None, "absent", 100)


def test_yoy_absent_in_base_year():
    assert _month(_payload(), "2023-02")["yoy"]["state"] == "absent"


def test_weekend_badge_has_route_day_shares_and_routes():
    badge = _month(_payload(), "2024-02")["weekend_share"]["badge"]
    assert (badge["pct_published"], badge["pct_suppressed"], badge["n_routes"]) == (50, 50, 2)


def test_month_without_weekend_row_is_absent():
    assert _month(_payload(), "2024-03")["weekend_share"]["state"] == "absent"


def test_homes_keep_top_n_and_group_the_rest():
    homes = _month(_payload(), "2024-02")["homes"]
    assert [h["code"] for h in homes] == ["08187", "08279", OTHER_HOMES_CODE]
    assert homes[-1]["visitors"] == 36


def test_homes_carry_centroids_when_known():
    homes = {h["code"]: h for h in _month(_payload(), "2024-02")["homes"]}
    assert (homes["08187"]["lat"], homes["08279"]["lat"]) == (41.55, None)


def test_context_is_absent_until_files_arrive():
    ctx = _payload()["context"]
    assert {k: v["state"] for k, v in ctx.items()} == {
        "rent": "absent", "residents": "absent", "hut_per_1000": "absent"}


def test_published_count_below_threshold_is_rejected():
    rows = [{"month": date(2024, 2, 1), "visitors": 9, "state": "published", "yoy": None}]
    with pytest.raises(ThresholdError):
        assert_threshold(_payload(visitors_rows=rows, home_rows=[]))


def test_threshold_passes_for_valid_payload():
    assert_threshold(_payload())


def test_schema_rejects_a_bare_number_value():
    payload = _payload()
    payload["months"][0]["visitors"] = 120
    with pytest.raises(ValueError, match="schema"):
        validate(payload, "barri")


def test_size_limit(tmp_path):
    (tmp_path / "big.json").write_bytes(b"x" * 2000)
    with pytest.raises(SizeLimitError):
        check_size(tmp_path, limit_bytes=1000)
    check_size(tmp_path, limit_bytes=5000)


def test_sample_payloads_are_valid_and_synthetic():
    meta, barris = sample_payloads()
    validate(meta, "meta")
    for b in barris:
        validate(b, "barri")
        assert_threshold(b)
    assert len(barris) == 3


def test_write_all_writes_meta_and_one_file_per_barri(tmp_path):
    from pipeline.export import write_all

    meta, barris = sample_payloads()
    size = write_all(tmp_path, meta, barris)
    assert (tmp_path / "meta.json").exists()
    assert len(list((tmp_path / "barri").glob("*.json"))) == 3
    assert 0 < size < 5 * 1024 * 1024


def test_write_all_refuses_counts_below_threshold(tmp_path):
    from pipeline.export import write_all

    meta, barris = sample_payloads()
    barris[0]["months"][0]["visitors"]["value"] = 3
    with pytest.raises(ThresholdError):
        write_all(tmp_path, meta, barris)
    assert not (tmp_path / "meta.json").exists()


def test_missing_centroid_file_gives_empty_mapping(tmp_path):
    from pipeline.export import load_centroids

    assert load_centroids(tmp_path / "nope.csv") == {}


def test_holidays_are_grouped_by_month_in_date_order(con, tmp_path):
    from pipeline.export import _holidays_by_month

    path = tmp_path / "cal.parquet"
    con.sql(f"""COPY (SELECT * FROM (VALUES
        (DATE '2024-12-26', true, 'Sant Esteve'), (DATE '2024-12-25', true, 'Nadal'),
        (DATE '2024-12-27', false, NULL)) t(day, is_holiday, holiday_name))
        TO '{path}' (FORMAT parquet)""")
    assert _holidays_by_month(con, path) == {"2024-12": ["Nadal", "Sant Esteve"]}
