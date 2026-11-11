"""Safe quoting for values that must be interpolated into DuckDB SQL."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb


def quote_literal(value: Path | str) -> str:
    """A SQL string literal ('it''s')."""
    return "'" + str(value).replace("'", "''") + "'"


def quote_ident(name: str) -> str:
    """A SQL identifier ("col")."""
    return '"' + name.replace('"', '""') + '"'


def fetch_one(rel: duckdb.DuckDBPyRelation) -> tuple[Any, ...]:
    """First row of `rel`; raise instead of returning None so callers can index it safely."""
    row = rel.fetchone()
    if row is None:
        raise LookupError("query returned no rows")
    return row
