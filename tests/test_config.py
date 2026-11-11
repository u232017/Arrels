from pathlib import Path

import pytest

from pipeline.config import ConfigError, Settings, connect, load_settings


def _env(tmp_path: Path, **overrides: str) -> dict[str, str]:
    mob = tmp_path / "mob"
    tour = tmp_path / "tour"
    mob.mkdir()
    tour.mkdir()
    env = {"MOBILITY_DIR": str(mob), "TOURISM_DIR": str(tour), "CACHE_DIR": str(tmp_path / "c")}
    env.update(overrides)
    return env


def test_load_settings_reads_paths_from_env(tmp_path):
    settings = load_settings(_env(tmp_path))
    assert settings.mobility_dir == tmp_path / "mob"
    assert settings.cache_dir == tmp_path / "c"
    assert settings.rent_file is None
    assert settings.force_rebuild is False


def test_load_settings_fails_when_required_dir_missing(tmp_path):
    env = _env(tmp_path, MOBILITY_DIR=str(tmp_path / "nope"))
    with pytest.raises(ConfigError, match="MOBILITY_DIR"):
        load_settings(env)


def test_load_settings_fails_when_required_var_unset(tmp_path):
    env = _env(tmp_path)
    del env["TOURISM_DIR"]
    with pytest.raises(ConfigError, match="TOURISM_DIR"):
        load_settings(env)


def test_optional_file_must_exist_when_given(tmp_path):
    env = _env(tmp_path, RENT_FILE=str(tmp_path / "missing.csv"))
    with pytest.raises(ConfigError, match="RENT_FILE"):
        load_settings(env)


def test_migration_none_is_treated_as_absent(tmp_path):
    assert load_settings(_env(tmp_path, MIGRATION_FILE="none")).migration_file is None


def test_force_rebuild_flag(tmp_path):
    assert load_settings(_env(tmp_path, FORCE_REBUILD="1")).force_rebuild is True


def test_settings_are_immutable(tmp_path):
    settings = load_settings(_env(tmp_path))
    with pytest.raises(AttributeError):
        settings.cache_dir = tmp_path  # type: ignore[misc]


def test_connect_applies_memory_limit(tmp_path):
    settings = load_settings(_env(tmp_path, DUCKDB_MEMORY_LIMIT="1GB"))
    con = connect(settings)
    limit = con.sql("SELECT current_setting('memory_limit')").fetchone()[0]
    assert "953" in limit or limit.upper().startswith("1")
    assert isinstance(settings, Settings)
