"""Municipality centroids reference file (for the residence map)."""

from __future__ import annotations

import pytest

from pipeline.centroids import CentroidError, centroids_from_capitals, write_centroids

HEADER = ('"Municipi","Codi municipi INE","Longitud","Latitud"\n')


def _csv(tmp_path, rows: str):
    p = tmp_path / "capitals.csv"
    p.write_text(HEADER + rows, encoding="utf-8")
    return p


def test_reads_ine_code_and_coordinates(tmp_path):
    p = _csv(tmp_path, '"Sabadell","08187","2.108276488","41.54622002"\n')
    assert centroids_from_capitals(p) == [("08187", 41.54622, 2.108276)]


def test_names_with_commas_are_parsed(tmp_path):
    p = _csv(tmp_path, '"Hospitalet, l\'","08101","2.1","41.36"\n')
    assert centroids_from_capitals(p)[0][0] == "08101"


def test_short_codes_are_zero_padded(tmp_path):
    p = _csv(tmp_path, '"X","8187","2.1","41.5"\n')
    assert centroids_from_capitals(p)[0][0] == "08187"


def test_points_outside_catalonia_are_rejected(tmp_path):
    p = _csv(tmp_path, '"X","08187","-3.7","40.4"\n')
    with pytest.raises(CentroidError, match="outside"):
        centroids_from_capitals(p)


def test_duplicate_codes_are_rejected(tmp_path):
    p = _csv(tmp_path, '"X","08187","2.1","41.5"\n"Y","08187","2.2","41.6"\n')
    with pytest.raises(CentroidError, match="duplicate"):
        centroids_from_capitals(p)


def test_missing_columns_are_rejected(tmp_path):
    p = tmp_path / "bad.csv"
    p.write_text('"a","b"\n"1","2"\n', encoding="utf-8")
    with pytest.raises(CentroidError, match="column"):
        centroids_from_capitals(p)


def test_written_file_is_readable_by_the_export(tmp_path):
    from pipeline.export import load_centroids

    out = tmp_path / "c.csv"
    write_centroids(out, [("08187", 41.54622, 2.108276)])
    assert load_centroids(out) == {"08187": (41.54622, 2.108276)}


BARRIS_HEADER = (
    '"codi_districte","nom_districte","codi_barri","nom_barri","geometria_etrs89","geometria_wgs84"\n'
)
SQUARE = "POLYGON ((2.10 41.30, 2.20 41.30, 2.20 41.40, 2.10 41.40, 2.10 41.30))"


def _barris(tmp_path, rows: str):
    p = tmp_path / "barris.csv"
    p.write_text(BARRIS_HEADER + rows, encoding="utf-8")
    return p


def test_barri_centroid_of_a_polygon(tmp_path):
    from pipeline.centroids import barri_centroids

    p = _barris(tmp_path, f'"03","Sants-Montjuïc","18","Sants","x","{SQUARE}"\n')
    assert barri_centroids(p, {"080190308": "Sants"}) == [("080190308", "Sants", 41.35, 2.15)]


def test_barri_is_matched_by_name_and_district(tmp_path):
    from pipeline.centroids import barri_centroids

    rows = (f'"03","Sants-Montjuïc","18","Sants","x","{SQUARE}"\n'
            f'"09","Sant Andreu","63","Sant Andreu","x","{SQUARE}"\n')
    out = barri_centroids(_barris(tmp_path, rows), {"080190904": "Sant Andreu"})
    assert [c[0] for c in out] == ["080190904"]


def test_district_mismatch_is_rejected(tmp_path):
    from pipeline.centroids import barri_centroids

    p = _barris(tmp_path, f'"05","X","18","Sants","x","{SQUARE}"\n')
    with pytest.raises(CentroidError, match="district"):
        barri_centroids(p, {"080190308": "Sants"})


def test_missing_pilot_is_rejected(tmp_path):
    from pipeline.centroids import barri_centroids

    p = _barris(tmp_path, f'"03","Sants-Montjuïc","18","Sants","x","{SQUARE}"\n')
    with pytest.raises(CentroidError, match="not found"):
        barri_centroids(p, {"080190203": "la Dreta de l'Eixample"})


def test_centroid_outside_barcelona_is_rejected(tmp_path):
    from pipeline.centroids import barri_centroids

    far = "POLYGON ((0.5 41.0, 0.6 41.0, 0.6 41.1, 0.5 41.1, 0.5 41.0))"
    p = _barris(tmp_path, f'"03","Sants-Montjuïc","18","Sants","x","{far}"\n')
    with pytest.raises(CentroidError, match="Barcelona"):
        barri_centroids(p, {"080190308": "Sants"})


def test_pilot_centroids_file_roundtrip(tmp_path):
    from pipeline.centroids import load_pilot_centroids, write_pilot_centroids

    out = tmp_path / "p.csv"
    write_pilot_centroids(out, [("080190308", "Sants", 41.35, 2.15)])
    assert load_pilot_centroids(out) == {"080190308": (41.35, 2.15)}
    assert load_pilot_centroids(tmp_path / "missing.csv") == {}
