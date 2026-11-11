"""Joins that never duplicate or drop rows (rule R4)."""

from __future__ import annotations

import math
from collections.abc import Sequence

import duckdb

from pipeline.sql import fetch_one, quote_ident

ALLOWED_HOW = {"left", "inner"}


class JoinIntegrityError(ValueError):
    """A join changed the row count or the measure total, or could have."""


def _totals(rel: duckdb.DuckDBPyRelation, measure: str) -> tuple[int, float | None]:
    n, total = fetch_one(rel.aggregate(f"count(*), sum({quote_ident(measure)})"))
    return n, total


def _same_total(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return a is b
    return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)


def assert_unique(rel: duckdb.DuckDBPyRelation, keys: Sequence[str], label: str) -> None:
    """Raise JoinIntegrityError if `keys` do not identify rows of `rel` uniquely."""
    key_list = ", ".join(quote_ident(k) for k in keys)
    dupes = rel.aggregate(f"{key_list}, count(*) AS n", key_list).filter("n > 1")
    if fetch_one(dupes.count("*"))[0]:
        raise JoinIntegrityError(f"{label} keys {list(keys)} are not unique")


def checked_join(
    left: duckdb.DuckDBPyRelation,
    right: duckdb.DuckDBPyRelation,
    keys: Sequence[str],
    measure: str,
    how: str = "left",
) -> duckdb.DuckDBPyRelation:
    """Join `right` onto `left` and assert row count and sum(measure) are unchanged."""
    if how not in ALLOWED_HOW:
        raise ValueError(f"how must be one of {sorted(ALLOWED_HOW)}")
    if measure not in left.columns:
        raise JoinIntegrityError(f"measure {measure!r} is not a column of the left table")
    for side, rel in (("left", left), ("right", right)):
        missing = [k for k in keys if k not in rel.columns]
        if missing:
            raise JoinIntegrityError(f"join key {missing} is not a column of the {side} table")
    assert_unique(right, keys, "right table")

    joined = left.join(right, ", ".join(quote_ident(k) for k in keys), how=how)
    before, after = _totals(left, measure), _totals(joined, measure)
    if before[0] != after[0]:
        raise JoinIntegrityError(f"join changed rows: {before[0]} -> {after[0]}")
    if not _same_total(before[1], after[1]):
        raise JoinIntegrityError(f"join changed sum({measure}): {before[1]} -> {after[1]}")
    return joined
