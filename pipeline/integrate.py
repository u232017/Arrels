"""Joins that never duplicate or drop rows (rule R4)."""

from __future__ import annotations

from collections.abc import Sequence

import duckdb

ALLOWED_HOW = {"left", "inner"}


class JoinIntegrityError(ValueError):
    """A join changed the row count or the measure total, or could have."""


def _totals(rel: duckdb.DuckDBPyRelation, measure: str) -> tuple[int, float | None]:
    return rel.aggregate(f"count(*), sum({measure})").fetchone()


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
    key_list = ", ".join(keys)
    dupes = right.aggregate(f"{key_list}, count(*) AS n", key_list).filter("n > 1").count("*")
    if dupes.fetchone()[0]:
        raise JoinIntegrityError(f"right table keys {list(keys)} are not unique")

    joined = left.join(right, key_list, how=how)
    before, after = _totals(left, measure), _totals(joined, measure)
    if before[0] != after[0]:
        raise JoinIntegrityError(f"join changed rows: {before[0]} -> {after[0]}")
    if before[1] != after[1]:
        raise JoinIntegrityError(f"join changed sum({measure}): {before[1]} -> {after[1]}")
    return joined
