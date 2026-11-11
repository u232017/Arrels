"""Tiny Parquet cache: a stage is skipped when its sources have not changed."""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path

Fingerprint = dict[str, list[int]]


def fingerprint(paths: Iterable[Path]) -> Fingerprint:
    """Size and modification time of each source file."""
    return {
        str(p): [p.stat().st_size, p.stat().st_mtime_ns] for p in sorted(paths)
    }


def manifest_path(output: Path) -> Path:
    return output.with_name(output.name + ".manifest.json")


def is_fresh(output: Path, current: Fingerprint) -> bool:
    manifest = manifest_path(output)
    if not (output.exists() and manifest.exists()):
        return False
    try:
        return json.loads(manifest.read_text(encoding="utf-8")) == current
    except json.JSONDecodeError:
        return False


def write_manifest(output: Path, current: Fingerprint) -> None:
    manifest_path(output).write_text(json.dumps(current, indent=1), encoding="utf-8")
CACHE_VERSION = None  # TDD RED
