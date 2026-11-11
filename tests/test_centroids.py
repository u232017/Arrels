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
