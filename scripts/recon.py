"""Phase 0 recon: aggregate-only profiling of the Telefónica data.

Writes small summary Parquet files to data/processed/recon/ (git-ignored)
and prints aggregate findings. Never prints row-level data.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import duckdb
from dotenv import load_dotenv

load_dotenv()
MOBILITY_DIR = Path(os.environ["MOBILITY_DIR"])
TOURISM_DIR = Path(os.environ["TOURISM_DIR"])
OUT = Path("data/processed/recon")
OUT.mkdir(parents=True, exist_ok=True)

FAMILIES = {
    "barri_barri": "movilidad_barrios_*_origen.csv",
    "mun_barri": "movilidad_mun_barrios_*_origen.csv",
    "municipal": "movilidad_municipios_*_origen.csv",
}

con = duckdb.connect()
con.sql("SET threads TO 8")


def mobility_csv(pattern: str) -> str:
    return (
        f"read_csv('{MOBILITY_DIR}/*/{pattern}', all_varchar=true, header=true, "
        f"filename=true)"
    )


def profile_family(name: str, pattern: str) -> None:
    has_barri = name != "municipal"
    barri_cols = (
        """,
        count(*) FILTER (WHERE barrio_origen = '-') AS rows_bo_dash,
        count(*) FILTER (WHERE barrio_destino = '-') AS rows_bd_dash,
        min(length(barrio_origen)) FILTER (WHERE barrio_origen <> '-') AS bo_len_min,
        max(length(barrio_origen)) FILTER (WHERE barrio_origen <> '-') AS bo_len_max"""
        if has_barri
        else ""
    )
    sql = f"""
    COPY (
      SELECT day, day_of_week, month, origen,
        regexp_extract(filename, '(\\d{{4}}-\\d{{2}})', 1) AS file_month,
        count(*) AS rows,
        count(*) FILTER (WHERE viajes = '0') AS rows_zero,
        count(*) FILTER (WHERE TRY_CAST(viajes AS DOUBLE) IS NULL) AS rows_bad_viajes,
        sum(TRY_CAST(viajes AS DOUBLE)) AS viajes_sum,
        min(TRY_CAST(viajes AS DOUBLE)) FILTER (WHERE viajes <> '0') AS min_nonzero,
        count(*) FILTER (WHERE TRY_CAST(viajes AS DOUBLE) % 1 <> 0) AS rows_fractional,
        min(length(municipio_origen)) AS mo_len_min,
        max(length(municipio_origen)) AS mo_len_max
        {barri_cols}
      FROM {mobility_csv(pattern)}
      GROUP BY ALL
    ) TO '{OUT}/daily_{name}.parquet' (FORMAT parquet)
    """
    t0 = time.time()
    con.sql(sql)
    print(f"[{name}] profiled in {time.time() - t0:.0f}s", flush=True)


def r5_march_2025() -> None:
    """Town -> barri regional routes in 2025-03: trips vs Table 9 visitors."""
    mob = (
        f"read_csv('{MOBILITY_DIR}/2025-03/movilidad_mun_barrios_2025-03_origen.csv', "
        f"all_varchar=true)"
    )
    t9 = (
        f"read_csv('{TOURISM_DIR}/202503/visitantes_regionales_barrio_yearmon.csv', "
        f"delim=';', all_varchar=true)"
    )
    con.sql(f"""
    COPY (
      WITH trips AS (
        SELECT municipio_origen AS mun_res, barrio_destino AS barri,
          sum(TRY_CAST(viajes AS DOUBLE)) AS trips,
          count(DISTINCT day) AS days_present,
          count(DISTINCT day) FILTER (WHERE viajes <> '0') AS days_published
        FROM {mob}
        WHERE origen = 'Regional' AND barrio_origen = '-' AND barrio_destino <> '-'
        GROUP BY ALL),
      vis AS (
        SELECT cod_municipio_residencia AS mun_res, cod_barrio AS barri,
          sum(TRY_CAST(visitantes AS DOUBLE)) AS visitors
        FROM {t9} GROUP BY ALL)
      SELECT * FROM trips JOIN vis USING (mun_res, barri)
    ) TO '{OUT}/r5_2025_03.parquet' (FORMAT parquet)
    """)
    print("[r5] done", flush=True)


def tourism() -> None:
    for f in sorted({p.name for p in TOURISM_DIR.glob("*/*.csv")}):
        src = f"read_csv('{TOURISM_DIR}/*/{f}', delim=';', all_varchar=true, union_by_name=true)"
        con.sql(f"""
        COPY (SELECT '{f}' AS file, año, mes, count(*) AS rows,
                 min(TRY_CAST(visitantes AS DOUBLE)) AS min_vis,
                 sum(TRY_CAST(visitantes AS DOUBLE)) AS sum_vis,
                 count(*) FILTER (WHERE TRY_CAST(visitantes AS DOUBLE) IS NULL) AS bad_vis
              FROM {src} GROUP BY ALL)
        TO '{OUT}/tourism_{f.removesuffix('.csv')}.parquet' (FORMAT parquet)""")
    t9 = f"read_csv('{TOURISM_DIR}/*/visitantes_regionales_barrio_yearmon.csv', delim=';', all_varchar=true)"
    con.sql(f"""COPY (SELECT tipo_visitante, count(*) AS n_rows, count(DISTINCT cod_barrio) AS barris,
        count(DISTINCT cod_municipio_residencia) home_muns,
        min(length(cod_barrio)) bl_min, max(length(cod_barrio)) bl_max,
        min(length(cod_municipio_residencia)) ml_min, max(length(cod_municipio_residencia)) ml_max
        FROM {t9} GROUP BY ALL) TO '{OUT}/t9_profile.parquet' (FORMAT parquet)""")
    print("[tourism] done", flush=True)


if __name__ == "__main__":
    tourism()
    r5_march_2025()
    for fam, pat in FAMILIES.items():
        profile_family(fam, pat)
