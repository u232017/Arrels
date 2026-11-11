"""Settings for the Arrels pipeline.

All paths come from environment variables (usually a local `.env` file).
Nothing in the code base hardcodes a data path.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

import duckdb
from dotenv import load_dotenv

DEFAULT_CACHE_DIR = "data/cache"
DEFAULT_MEMORY_LIMIT = "6GB"
DEFAULT_THREADS = 8
NONE_VALUES = {"", "none"}


class ConfigError(ValueError):
    """Raised when the environment does not describe a usable setup."""


@dataclass(frozen=True)
class Settings:
    mobility_dir: Path
    tourism_dir: Path
    cache_dir: Path
    rent_file: Path | None
    population_file: Path | None
    hut_file: Path | None
    migration_file: Path | None
    duckdb_memory_limit: str
    duckdb_temp_dir: Path
    force_rebuild: bool


def _required_dir(env: Mapping[str, str], name: str) -> Path:
    raw = env.get(name, "").strip()
    if not raw:
        raise ConfigError(f"{name} is not set. Copy .env.example to .env and fill it in.")
    path = Path(raw).expanduser()
    if not path.is_dir():
        raise ConfigError(f"{name} points to a folder that does not exist: {path}")
    return path


def _optional_file(env: Mapping[str, str], name: str) -> Path | None:
    raw = env.get(name, "").strip()
    if raw.lower() in NONE_VALUES:
        return None
    path = Path(raw).expanduser()
    if not path.is_file():
        raise ConfigError(f"{name} points to a file that does not exist: {path}")
    return path


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Build Settings from `env` (defaults to os.environ after loading `.env`)."""
    if env is None:
        load_dotenv()
        env = os.environ
    cache_dir = Path(env.get("CACHE_DIR", DEFAULT_CACHE_DIR)).expanduser()
    return Settings(
        mobility_dir=_required_dir(env, "MOBILITY_DIR"),
        tourism_dir=_required_dir(env, "TOURISM_DIR"),
        cache_dir=cache_dir,
        rent_file=_optional_file(env, "RENT_FILE"),
        population_file=_optional_file(env, "POPULATION_FILE"),
        hut_file=_optional_file(env, "HUT_FILE"),
        migration_file=_optional_file(env, "MIGRATION_FILE"),
        duckdb_memory_limit=env.get("DUCKDB_MEMORY_LIMIT", DEFAULT_MEMORY_LIMIT),
        duckdb_temp_dir=Path(env.get("DUCKDB_TEMP_DIR", str(cache_dir / "duckdb_tmp"))),
        force_rebuild=env.get("FORCE_REBUILD", "0").strip() == "1",
    )


def connect(settings: Settings) -> duckdb.DuckDBPyConnection:
    """Open an in-memory DuckDB connection with the configured resource limits."""
    settings.duckdb_temp_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("SET memory_limit = ?", [settings.duckdb_memory_limit])
    con.execute("SET temp_directory = ?", [str(settings.duckdb_temp_dir)])
    con.execute(f"SET threads = {DEFAULT_THREADS}")
    return con
