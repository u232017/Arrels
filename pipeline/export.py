"""Static JSON export for the web page (T11), validated against contract/arrels.schema.json.

Every number goes out as {value, state, badge}. Counts must respect the provider
threshold (>= 15) and the whole export must stay under 5 MB.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import date
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from pipeline.ingest import PROVIDER_THRESHOLD
from pipeline.quality import ABSENT, PUBLISHED
from pipeline.sql import fetch_one

logger = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "contract" / "arrels.schema.json"
SIZE_LIMIT_BYTES = 5 * 1024 * 1024
TOP_HOMES: int | None = None  # None = every published home town (each already >= 15)
OTHER_HOMES_CODE = "ALTRES"
OTHER_HOMES_NAME = "Altres municipis"
PENDING_WINDOW = "pendent"
BASE_YEAR = 2023

Row = Mapping[str, Any]
Json = dict[str, Any]


class ThresholdError(ValueError):
    """A published count is below the provider threshold."""


class SizeLimitError(ValueError):
    """The export is larger than the web budget."""


# ------------------------------------------------------------------ value helpers


def _badge(window: str, published: float, suppressed: float, absent: float,
           n_routes: int | None = None) -> Json:
    badge: Json = {
        "window": window,
        "pct_published": round(published, 1),
        "pct_suppressed": round(suppressed, 1),
        "pct_absent": round(absent, 1),
    }
    if n_routes is not None:
        badge["n_routes"] = int(n_routes)
    return badge


def _absent(window: str, n_routes: int | None = None) -> Json:
    return {"value": None, "state": ABSENT, "badge": _badge(window, 0, 0, 100, n_routes)}


def _published(value: float, window: str) -> Json:
    return {"value": value, "state": PUBLISHED, "badge": _badge(window, 100, 0, 0)}


def _ym(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


# ------------------------------------------------------------------ indicator values


def _visitors_value(row: Row) -> Json:
    window = _ym(row["month"])
    if row["state"] != PUBLISHED or row["visitors"] is None:
        return _absent(window)
    return _published(int(row["visitors"]), window)


def _yoy_value(row: Row) -> Json:
    month = row["month"]
    window = f"{_ym(month)} vs {BASE_YEAR}-{month.month:02d}"
    if row.get("yoy") is None:
        return _absent(window)
    return _published(round(float(row["yoy"]), 4), window)


def _weekend_value(month: date, row: Row | None) -> Json:
    window = f"{_ym(month)} (dies vàlids)"
    if row is None:
        return _absent(window, n_routes=0)
    pub, sup, absn = (row["route_days_published"], row["route_days_suppressed"],
                      row["route_days_absent"])
    total = pub + sup + absn
    if row["weekend_share"] is None or total == 0:
        return _absent(window, n_routes=row["n_routes"])
    return {
        "value": round(float(row["weekend_share"]), 4),
        "state": PUBLISHED,
        "badge": _badge(window, 100 * pub / total, 100 * sup / total, 100 * absn / total,
                        n_routes=row["n_routes"]),
    }


ARTICLES = ("L'", "El", "La", "Els", "Les")


def display_name(name: str) -> str:
    """Move a trailing article to the front: "Prat de Llobregat, El" -> "El Prat de Llobregat"."""
    base, sep, article = name.rpartition(", ")
    if not sep or article not in ARTICLES:
        return name
    return f"{article}{base}" if article.endswith("'") else f"{article} {base}"


def _homes(
    rows: list[Row], centroids: Mapping[str, tuple[float, float]], top: int | None
) -> list[Json]:
    ranked = sorted(rows, key=lambda r: (-r["visitors"], r["home"]))
    head, rest = (ranked, []) if top is None else (ranked[:top], ranked[top:])

    def home(code: str, name: str, visitors: int) -> Json:
        lat, lon = centroids.get(code, (None, None))
        return {"code": code, "name": name, "visitors": int(visitors), "lat": lat, "lon": lon}

    homes = [home(r["home"], display_name(r["home_name"]), r["visitors"]) for r in head]
    if rest:
        homes.append(home(OTHER_HOMES_CODE, OTHER_HOMES_NAME, sum(r["visitors"] for r in rest)))
    return homes


def _context() -> Json:
    return {
        "rent": _absent(PENDING_WINDOW),
        "residents": _absent(PENDING_WINDOW),
        "hut_per_1000": _absent(PENDING_WINDOW),
    }


def barri_payload(
    code: str,
    name: str,
    visitors_rows: Iterable[Row],
    weekend_rows: Iterable[Row],
    home_rows: Iterable[Row],
    holidays_by_month: Mapping[str, list[str]],
    centroids: Mapping[str, tuple[float, float]] | None = None,
    top_homes: int | None = TOP_HOMES,
) -> Json:
    """The JSON document for one pilot barri."""
    weekend = {r["month"]: r for r in weekend_rows}
    homes_by_month: dict[date, list[Row]] = defaultdict(list)
    for r in home_rows:
        homes_by_month[r["month"]].append(r)
    months = []
    for row in sorted(visitors_rows, key=lambda r: r["month"]):
        month = row["month"]
        months.append({
            "month": _ym(month),
            "visitors": _visitors_value(row),
            "yoy": _yoy_value(row),
            "weekend_share": _weekend_value(month, weekend.get(month)),
            "holidays": list(holidays_by_month.get(_ym(month), [])),
            "homes": _homes(homes_by_month.get(month, []), centroids or {}, top_homes),
        })
    return {"code": code, "name": name, "months": months, "context": _context()}


# ------------------------------------------------------------------ checks


@cache
def _schema() -> Json:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def validate(doc: Json, kind: str) -> None:
    """Raise ValueError if `doc` does not match the `kind` definition ('barri' or 'meta')."""
    schema = {**_schema(), "$ref": f"#/$defs/{kind}"}
    errors = sorted(Draft202012Validator(schema).iter_errors(doc), key=lambda e: e.path)
    if errors:
        first = errors[0]
        raise ValueError(f"{kind} does not match the schema at {list(first.path)}: {first.message}")


def assert_threshold(payload: Json, threshold: int = PROVIDER_THRESHOLD) -> None:
    """Every published count (visitors, home visitors, residents) must be >= threshold."""
    counts: list[tuple[str, Any]] = []
    for m in payload["months"]:
        if m["visitors"]["state"] == PUBLISHED:
            counts.append((f"{m['month']} visitors", m["visitors"]["value"]))
        counts.extend((f"{m['month']} home {h['code']}", h["visitors"]) for h in m.get("homes", []))
    residents = payload["context"]["residents"]
    if residents["state"] == PUBLISHED:
        counts.append(("residents", residents["value"]))
    low = [label for label, v in counts if v is None or v < threshold]
    if low:
        raise ThresholdError(f"{payload['code']}: {len(low)} counts below {threshold}: {low[:5]}")


def check_size(folder: Path, limit_bytes: int = SIZE_LIMIT_BYTES) -> int:
    """Total size of the JSON files in `folder`; raise if over the limit."""
    total = sum(p.stat().st_size for p in Path(folder).rglob("*.json"))
    if total > limit_bytes:
        raise SizeLimitError(f"export is {total} bytes, over the {limit_bytes} byte limit")
    return total


def write_json(path: Path, doc: Json) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


# ------------------------------------------------------------------ synthetic sample


SAMPLE_PILOTS = (("000000001", "Barri de mostra A"), ("000000002", "Barri de mostra B"),
                 ("000000003", "Barri de mostra C"))
SAMPLE_HOMES = (("00001", "Municipi U", 41.55, 2.11), ("00002", "Municipi D", 41.45, 2.25),
                ("00003", "Municipi T", 41.36, 2.10))


def sample_payloads() -> tuple[Json, list[Json]]:
    """Deterministic synthetic data in the real contract, for frontend work and e2e tests."""
    months = [date(2023 + (i // 12), i % 12 + 1, 1) for i in range(32)]
    centroids = {code: (lat, lon) for code, _, lat, lon in SAMPLE_HOMES}
    barris = []
    for k, (code, name) in enumerate(SAMPLE_PILOTS):
        base = 1000 * (k + 1)
        counts: dict[date, int | None] = {
            m: None if (k == 2 and i == 5)  # one absent month to exercise the UI
            else base + 37 * i + (200 if m.month in (7, 8) else 0)
            for i, m in enumerate(months)
        }

        def yoy(m: date, v: int | None) -> float | None:
            prev = counts.get(date(BASE_YEAR, m.month, 1))  # noqa: B023 (used inside the loop)
            return (v - prev) / prev if m.year > BASE_YEAR and v and prev else None

        visitors: list[Row] = [
            {"month": m, "visitors": v, "state": PUBLISHED if v is not None else ABSENT,
             "yoy": yoy(m, v)}
            for m, v in counts.items()
        ]
        weekend: list[Row] = [
            {"month": m, "weekend_share": 0.17 + 0.01 * k + (0.03 if m.month == 8 else 0),
             "n_routes": 100 + k, "route_days_published": 70,
             "route_days_suppressed": 28, "route_days_absent": 2}
            for m in months
        ]
        homes: list[Row] = [{"month": m, "home": c, "home_name": n, "visitors": 100 * (3 - j) + k}
                 for m in months for j, (c, n, _, _) in enumerate(SAMPLE_HOMES)]
        holidays = {"2023-09": ["La Mercè"], "2024-09": ["La Mercè"], "2024-12": ["Nadal"]}
        barris.append(barri_payload(code, name, visitors, weekend, homes, holidays, centroids))
    meta = {
        "generated": "sample",
        "window": {"start": "2023-01", "end": "2025-08"},
        "threshold": PROVIDER_THRESHOLD,
        "pilots": [{"code": c, "name": n} for c, n in SAMPLE_PILOTS],
        "missing_days": ["2024-02-11"],
        "partial_days": ["2025-04-12"],
    }
    return meta, barris


# ------------------------------------------------------------------ glue: cache -> JSON

CENTROIDS_FILE = Path(__file__).parent / "reference" / "municipality_centroids.csv"
WEB_DATA_DIR = Path("web/public/data")
WEB_SAMPLE_DIR = Path("web/public/sample")


def load_centroids(path: Path = CENTROIDS_FILE) -> dict[str, tuple[float, float]]:
    """INE code -> (lat, lon). Empty when the reference file is not there yet."""
    if not path.exists():
        logger.warning("%s not found: the map will fall back to the ranked list", path)
        return {}
    import csv

    with path.open(encoding="utf-8") as fh:
        return {r["code"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(fh)}


def _rows(con: Any, path: Path, barri: str) -> list[dict[str, Any]]:
    rel = con.read_parquet(str(path)).filter(f"barri = '{barri}'")
    return [dict(zip(rel.columns, r, strict=True)) for r in rel.fetchall()]


def _holidays_by_month(con: Any, calendar_path: Path) -> dict[str, list[str]]:
    rows = con.read_parquet(str(calendar_path)).filter("is_holiday").order("day").project(
        "strftime(day, '%Y-%m'), holiday_name").fetchall()
    out: dict[str, list[str]] = defaultdict(list)
    for month, name in rows:
        out[month].append(name)
    return dict(out)


def write_all(out_dir: Path, meta: Json, barris: list[Json]) -> int:
    """Validate, check the threshold, write meta.json + barri/<code>.json, check total size."""
    validate(meta, "meta")
    for b in barris:
        validate(b, "barri")
        assert_threshold(b)
    write_json(out_dir / "meta.json", meta)
    for b in barris:
        write_json(out_dir / "barri" / f"{b['code']}.json", b)
    return check_size(out_dir)


def export_real(con: Any, cache_dir: Path, out_dir: Path = WEB_DATA_DIR) -> int:
    from pipeline.indicators import PILOTS

    ind = cache_dir / "indicators"
    calendar = cache_dir / "calendar.parquet"
    centroids = load_centroids()
    holidays = _holidays_by_month(con, calendar)
    barris = [
        barri_payload(code, name,
                      _rows(con, ind / "visitors_monthly.parquet", code),
                      _rows(con, ind / "weekend_share.parquet", code),
                      _rows(con, ind / "visitors_by_home.parquet", code),
                      holidays, centroids)
        for code, name in PILOTS.items()
    ]
    cal = con.read_parquet(str(calendar))
    start, end = fetch_one(cal.aggregate(
        "strftime(min(day), '%Y-%m'), strftime(max(day), '%Y-%m')"))

    def days(status: str) -> list[str]:
        rel = cal.filter(f"day_status = '{status}'").project("day").order("day")
        return [str(d) for (d,) in rel.fetchall()]

    meta = {
        "generated": date.today().isoformat(),
        "window": {"start": start, "end": end},
        "threshold": PROVIDER_THRESHOLD,
        "pilots": [{"code": c, "name": n} for c, n in PILOTS.items()],
        "missing_days": days("missing"),
        "partial_days": days("partial"),
    }
    return write_all(out_dir, meta, barris)


def main() -> None:
    import duckdb

    from pipeline.config import load_settings

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    meta, barris = sample_payloads()
    logger.info("sample: %d bytes -> %s", write_all(WEB_SAMPLE_DIR, meta, barris), WEB_SAMPLE_DIR)
    settings = load_settings()
    size = export_real(duckdb.connect(), settings.cache_dir)
    logger.info("real export: %d bytes -> %s", size, WEB_DATA_DIR)


if __name__ == "__main__":
    main()
