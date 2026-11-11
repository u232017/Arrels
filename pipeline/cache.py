"""Tiny Parquet cache: a stage is skipped when its sources and the code version are unchanged."""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path

# Bump when the meaning of a cached file changes (columns, contract, rules).
CACHE_VERSION = 2

Fingerprint = dict[str, list[int]]


def fingerprint(paths: Iterable[Path]) -> Fingerprint:
    """Size and modification time of each source file."""
    result: Fingerprint = {}
    for p in sorted(paths):
        st = p.stat()
        result[str(p)] = [st.st_size, st.st_mtime_ns]
    return result


def manifest_path(output: Path) -> Path:
    """Where the manifest for `output` lives."""
    return output.with_name(output.name + ".manifest.json")


def _manifest(current: Fingerprint) -> dict[str, object]:
    return {"version": CACHE_VERSION, "files": current}


def is_fresh(output: Path, current: Fingerprint) -> bool:
    manifest = manifest_path(output)
    if not (output.exists() and manifest.exists()):
        return False
    try:
        return json.loads(manifest.read_text(encoding="utf-8")) == _manifest(current)
    except (OSError, ValueError):  # unreadable or corrupt manifest -> rebuild
        return False


def write_manifest(output: Path, current: Fingerprint) -> None:
    manifest_path(output).write_text(json.dumps(_manifest(current), indent=1), encoding="utf-8")
