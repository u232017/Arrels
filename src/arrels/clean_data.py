"""Limpieza reproducible de CSV y JSON para Arrels."""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable


NULL_VALUES = {"", "na", "n/a", "nan", "null", "none", "-"}


def normalize_column_name(value: str) -> str:
    """Convierte una etiqueta en un nombre estable en snake_case."""
    normalized = unicodedata.normalize("NFKD", str(value))
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", normalized).strip("_").lower()
    return normalized or "columna"


def normalize_text(value: Any) -> Any:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value).replace("\u00a0", " ")).strip()
    return None if text.lower() in NULL_VALUES else text


def normalize_value(value: Any) -> Any:
    """Normaliza texto y convierte números con formatos europeos habituales."""
    value = normalize_text(value)
    if value is None:
        return None
    if re.fullmatch(r"[+-]?\d+", value):
        return int(value)
    numeric = value.replace("%", "").replace(".", "").replace(",", ".")
    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?", numeric):
        number = float(numeric)
        return int(number) if number.is_integer() else number
    return value


def unique_column_names(columns: Iterable[str]) -> list[str]:
    result: list[str] = []
    counts: dict[str, int] = {}
    for column in columns:
        base = normalize_column_name(column)
        counts[base] = counts.get(base, 0) + 1
        result.append(base if counts[base] == 1 else f"{base}_{counts[base]}")
    return result


def clean_rows(rows: Iterable[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    rows = list(rows)
    if not rows:
        return [], []
    columns = unique_column_names(rows[0].keys())
    source_columns = list(rows[0].keys())
    cleaned: list[dict[str, Any]] = []
    seen: set[tuple[tuple[str, Any], ...]] = set()
    for row in rows:
        clean = {
            column: normalize_value(row.get(source))
            for source, column in zip(source_columns, columns)
        }
        if not any(value is not None for value in clean.values()):
            continue
        fingerprint = tuple(clean.items())
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        cleaned.append(clean)
    return cleaned, columns


def read_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list) or not all(isinstance(item, dict) for item in payload):
            raise ValueError("El JSON debe ser una lista de objetos.")
        return payload
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(
            {column: "" if row[column] is None else row[column] for column in columns}
            for row in rows
        )


def clean_file(input_path: Path, output_path: Path, summary_path: Path | None = None) -> dict[str, Any]:
    source_rows = read_rows(input_path)
    rows, columns = clean_rows(source_rows)
    write_csv(output_path, rows, columns)
    summary = {
        "input": str(input_path),
        "output": str(output_path),
        "input_rows": len(source_rows),
        "output_rows": len(rows),
        "removed_rows": len(source_rows) - len(rows),
        "columns": columns,
        "missing_values": {
            column: sum(row[column] is None for row in rows) for column in columns
        },
    }
    if summary_path:
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summary", type=Path)
    args = parser.parse_args()
    output = args.output or Path("data/processed") / f"{args.input.stem}_clean.csv"
    summary = clean_file(args.input, output, args.summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
