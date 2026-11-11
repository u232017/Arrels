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


if __name__ == "__main__":
    import logging
    import sys

    from pipeline.export import CENTROIDS_FILE

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    rows = centroids_from_capitals(Path(sys.argv[1]))
    write_centroids(CENTROIDS_FILE, rows)
    logging.getLogger(__name__).info("%d municipalities -> %s", len(rows), CENTROIDS_FILE)
