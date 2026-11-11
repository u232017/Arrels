"""Safe quoting for values that must be interpolated into DuckDB SQL."""

from __future__ import annotations

from pathlib import Path


def quote_literal(value: Path | str) -> str:
    """A SQL string literal ('it''s')."""
    return "'" + str(value).replace("'", "''") + "'"


def quote_ident(name: str) -> str:
    """A SQL identifier ("col")."""
    return '"' + name.replace('"', '""') + '"'
