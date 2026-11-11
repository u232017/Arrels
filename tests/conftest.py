"""Synthetic fixtures in the Telefónica file layout. Never real data."""

from __future__ import annotations

import csv
from collections import defaultdict
from collections.abc import Iterable
from datetime import date, timedelta
from pathlib import Path

import duckdb
import pytest

DOW_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
PREFIX = {
    "barri_barri": "movilidad_barrios",
    "mun_barri": "movilidad_mun_barrios",
    "municipal": "movilidad_municipios",
}
BARRI_COLS = [
    "day", "day_of_week", "month", "origen",
    "municipio_origen", "municipio_origen_name", "barrio_origen", "barrio_origen_name",
    "municipio_destino", "municipio_destino_name", "barrio_destino", "barrio_destino_name",
    "viajes",
]
MUNICIPAL_COLS = [
    "day", "day_of_week", "month", "origen",
    "municipio_origen", "municipio_origen_name",
    "municipio_destino", "municipio_destino_name", "viajes",
]
T9_COLS = [
    "año", "mes", "cod_barrio", "cod_municipio", "desc_municipio", "tipo_visitante",
    "cod_municipio_residencia", "municipio_residencia", "visitantes",
]

BCN = "08019"
SABADELL = "08187"
BARRI_A = "080190101"
BARRI_B = "080190202"


def trip(
    day: date,
    viajes: int,
    *,
    origen: str = "Regional",
    mo: str = SABADELL,
    bo: str = "-",
    md: str = BCN,
    bd: str = BARRI_A,
) -> dict[str, str]:
    return {
        "day": day.isoformat(),
        "day_of_week": DOW_ES[day.weekday()],
        "month": f"{day.month:02d}",
        "origen": origen,
        "municipio_origen": mo,
        "municipio_origen_name": f"name_{mo}",
        "barrio_origen": bo,
        "barrio_origen_name": "-" if bo == "-" else f"name_{bo}",
        "municipio_destino": md,
        "municipio_destino_name": f"name_{md}",
        "barrio_destino": bd,
        "barrio_destino_name": "-" if bd == "-" else f"name_{bd}",
        "viajes": str(viajes),
    }


def write_mobility(root: Path, family: str, rows: Iterable[dict[str, str]]) -> None:
    cols = MUNICIPAL_COLS if family == "municipal" else BARRI_COLS
    by_month: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_month[row["day"][:7]].append(row)
    for month, month_rows in by_month.items():
        folder = root / month
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{PREFIX[family]}_{month}_origen.csv"
        with path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(month_rows)


def write_t9(root: Path, rows: Iterable[dict[str, str]]) -> None:
    by_month: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_month[row["mes"]].append(row)
    for yyyymm, month_rows in by_month.items():
        folder = root / yyyymm
        folder.mkdir(parents=True, exist_ok=True)
        with (folder / "visitantes_regionales_barrio_yearmon.csv").open(
            "w", newline="", encoding="utf-8"
        ) as fh:
            writer = csv.DictWriter(fh, fieldnames=T9_COLS, delimiter=";")
            writer.writeheader()
            writer.writerows(month_rows)


def t9_row(yyyymm: str, barri: str, home: str, visitantes: int) -> dict[str, str]:
    return {
        "año": yyyymm[:4], "mes": yyyymm, "cod_barrio": barri, "cod_municipio": BCN,
        "desc_municipio": "Barcelona", "tipo_visitante": "Excursionista",
        "cod_municipio_residencia": home, "municipio_residencia": f"name_{home}",
        "visitantes": str(visitantes),
    }


def days(start: date, end: date) -> list[date]:
    return [start + timedelta(n) for n in range((end - start).days + 1)]


FEB_START = date(2024, 2, 1)
FEB_END = date(2024, 2, 29)
MISSING_DAY = date(2024, 2, 11)        # no rows at all (R1)
PARTIAL_DAY = date(2024, 2, 12)        # next to the gap, low volume -> partial
LOW_NOT_ADJACENT = date(2024, 2, 20)   # low volume but not next to a gap -> ok


@pytest.fixture()
def con() -> duckdb.DuckDBPyConnection:
    return duckdb.connect()


@pytest.fixture()
def feb_mobility(tmp_path: Path) -> Path:
    """Feb 2024, mun_barri family.

    - Route Sabadell -> BARRI_A: row every day; 0 (suppressed) on even days.
    - Route Terrassa -> BARRI_A: rows on only 10 days (low coverage).
    - Background route keeps daily totals at 1000 except PARTIAL_DAY / LOW_NOT_ADJACENT (300).
    - MISSING_DAY has no rows in any route.
    """
    root = tmp_path / "mobility"
    rows: list[dict[str, str]] = []
    for d in days(FEB_START, FEB_END):
        if d == MISSING_DAY:
            continue
        sab = 0 if d.day % 2 == 0 else 20
        rows.append(trip(d, sab))
        if d.day <= 10:
            rows.append(trip(d, 30, mo="08279"))
        background = (300 if d in (PARTIAL_DAY, LOW_NOT_ADJACENT) else 1000) - sab
        background -= 30 if d.day <= 10 else 0
        rows.append(trip(d, background, mo="08101", bd=BARRI_B))
    write_mobility(root, "mun_barri", rows)
    return root
