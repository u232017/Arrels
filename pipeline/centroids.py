"""Municipality centroids for the residence map.

Source: Generalitat de Catalunya, "Capitals de municipi georeferenciades"
(analisi.transparenciacatalunya.cat, dataset wpyq-we8x; ICGC Base municipal 1:5.000).
Only the INE code and the capital's coordinates are kept.
"""

from __future__ import annotations

import csv
from pathlib import Path

CODE_COL = "Codi municipi INE"
LAT_COL = "Latitud"
LON_COL = "Longitud"
INE_CODE_LENGTH = 5
DECIMALS = 6  # ~10 cm; more than enough for a map dot
# Generous bounding box around Catalonia.
LAT_RANGE = (40.4, 42.95)
LON_RANGE = (0.1, 3.4)

Centroid = tuple[str, float, float]


class CentroidError(ValueError):
    """The coordinates file is not what we expect."""


def centroids_from_capitals(path: Path) -> list[Centroid]:
    """(code, lat, lon) per municipality, validated and sorted by code."""
    with Path(path).open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        missing = {CODE_COL, LAT_COL, LON_COL} - set(reader.fieldnames or [])
        if missing:
            raise CentroidError(f"missing column(s) {sorted(missing)} in {path}")
        out: dict[str, Centroid] = {}
        for row in reader:
            code = row[CODE_COL].strip().zfill(INE_CODE_LENGTH)
            lat, lon = round(float(row[LAT_COL]), DECIMALS), round(float(row[LON_COL]), DECIMALS)
            if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
                raise CentroidError(f"{code}: point ({lat}, {lon}) is outside Catalonia")
            if code in out:
                raise CentroidError(f"duplicate municipality code {code}")
            out[code] = (code, lat, lon)
    return [out[c] for c in sorted(out)]


def write_centroids(path: Path, centroids: list[Centroid]) -> None:
    """Write the small reference file read by pipeline.export.load_centroids."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["code", "lat", "lon"])
        writer.writerows(centroids)


# ---------------------------------------------------------------- pilot barri centroids
# Source: Ajuntament de Barcelona, Open Data BCN, "Districtes i barris"
# (BarcelonaCiutat_Barris.csv, CC-BY 4.0). Only the pilot barris' centroids are kept.

BCN_LAT_RANGE = (41.31, 41.47)
BCN_LON_RANGE = (2.05, 2.24)
BARRI_DECIMALS = 5  # ~1 m


def _ring(wkt: str) -> list[tuple[float, float]]:
    """Outer ring of a WKT POLYGON (or the first polygon of a MULTIPOLYGON) as (lon, lat)."""
    body = wkt[wkt.index("((") :].lstrip("(").split(")")[0]
    return [(float(x), float(y)) for x, y in (pt.split() for pt in body.split(","))]


def _polygon_centroid(ring: list[tuple[float, float]]) -> tuple[float, float]:
    """Area-weighted centroid (lat, lon); planar maths is fine at barri scale."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:], strict=False):
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    a /= 2
    return cy / (6 * a), cx / (6 * a)


def barri_centroids(path: Path, pilots: dict[str, str]) -> list[tuple[str, str, float, float]]:
    """(code, name, lat, lon) for each pilot, matched by name and checked against the district."""
    with Path(path).open(encoding="utf-8-sig", newline="") as fh:
        by_name = {r["nom_barri"]: r for r in csv.DictReader(fh)}
    out = []
    for code, name in pilots.items():
        row = by_name.get(name)
        if row is None:
            raise CentroidError(f"barri {name!r} not found in {path}")
        if row["codi_districte"] != code[5:7]:
            raise CentroidError(f"{name}: district {row['codi_districte']} does not match {code}")
        lat, lon = _polygon_centroid(_ring(row["geometria_wgs84"]))
        lat, lon = round(lat, BARRI_DECIMALS), round(lon, BARRI_DECIMALS)
        in_lat = BCN_LAT_RANGE[0] <= lat <= BCN_LAT_RANGE[1]
        in_lon = BCN_LON_RANGE[0] <= lon <= BCN_LON_RANGE[1]
        if not (in_lat and in_lon):
            raise CentroidError(f"{name}: centroid ({lat}, {lon}) is outside Barcelona")
        out.append((code, name, lat, lon))
    return out


def write_pilot_centroids(path: Path, rows: list[tuple[str, str, float, float]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["code", "name", "lat", "lon"])
        writer.writerows(rows)


def load_pilot_centroids(path: Path) -> dict[str, tuple[float, float]]:
    """Pilot barri code -> (lat, lon). Empty when the file is not there."""
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as fh:
        return {r["code"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(fh)}


if __name__ == "__main__":
    import logging
    import sys

    from pipeline.export import CENTROIDS_FILE

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    rows = centroids_from_capitals(Path(sys.argv[1]))
    write_centroids(CENTROIDS_FILE, rows)
    logging.getLogger(__name__).info("%d municipalities -> %s", len(rows), CENTROIDS_FILE)
