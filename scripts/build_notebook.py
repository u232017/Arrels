"""Generate notebooks/arrels_mvp.ipynb (kept without outputs in Git)."""

from __future__ import annotations

from pathlib import Path

import nbformat as nbf

CELLS: list[tuple[str, str]] = [
    ("md", """# Arrels MVP — notebook reproducible

Barri Lab (201_F, UPF) · Telefónica Mobile Data Challenge 2026.

Este notebook llama al paquete `pipeline` de principio a fin. Solo muestra **agregados**
(datos bajo NDA: ninguna fila individual). Rutas de datos en `.env` (ver `.env.example`).

- Desde datos brutos: `FORCE_REBUILD=1` → objetivo < 30 min.
- Desde la caché Parquet (`data/cache/`) → objetivo < 2 min.

Método y limitaciones: `docs/METHOD.md`. Decisiones: `docs/DECISIONS.md`."""),
    ("code", """import os
import time

import duckdb
import pandas as pd

from pipeline import run
from pipeline.config import load_settings
from pipeline.indicators import PILOTS

os.chdir(os.environ.get("ARRELS_ROOT", ".."))  # notebook lives in notebooks/
pd.set_option("display.max_columns", 20)
t_start = time.time()
settings = load_settings()
print("cache:", settings.cache_dir, "| force rebuild:", settings.force_rebuild)"""),
    ("md", "## 1. Pipeline: ingesta → calidad (R1–R5) → agregados → indicadores"),
    ("code", """t0 = time.time()
run.main()
print(f"pipeline: {time.time() - t0:.0f} s")"""),
    ("md", """## 2. Calidad de datos

**R1** días sin datos (NULL, nunca 0) y días parciales (D2). **R4** las filas y la suma de
`viajes` de la caché coinciden con los CSV originales."""),
    ("code", """con = duckdb.connect()
C = settings.cache_dir
calendar = con.read_parquet(str(C / "calendar.parquet"))
display(calendar.filter("day_status <> 'ok'").project("day, day_status").df())
display(con.sql(f\"\"\"
  SELECT family, count(*) AS filas, sum(viajes) AS viajes,
         round(100 * avg((viajes = 0)::INT), 1) AS pct_suprimidas
  FROM read_parquet('{C}/mobility/*/*.parquet', union_by_name = true)
  GROUP BY 1 ORDER BY 1\"\"\").df())"""),
    ("md", "## 3. Barris piloto (Fase 3, decisión D3)"),
    ("code", """from pipeline.ingest import read_tourism
from pipeline.pilot import barri_sufficiency, top_barris

coverage = con.read_parquet(str(C / "route_coverage.parquet"))
t9 = read_tourism(con, settings.tourism_dir, "visitantes_regionales_barrio_yearmon")
scores = barri_sufficiency(con, coverage, t9, n_months=32)
display(top_barris(scores, n=10).project(
    "barri, round(score, 3) AS score, round(s_published, 2) AS pct_publicat, "
    "round(s_routes, 2) AS rutes, round(s_homes, 2) AS municipis, "
    "round(s_stability, 2) AS estabilitat").df())
print("Pilots:", PILOTS)"""),
    ("md", """## 4. Indicadores por barri piloto

- **Visitants regionals únics** (Tabla 9): por mes, nunca sumados entre meses; cambio vs el
  mismo mes de 2023.
- **Quota de cap de setmana** (Tabla 3): solo rutas con fila ≥80 % de los días (D1) y días válidos.

Son **patrones**, no causas."""),
    ("code", """I = C / "indicators"
names = pd.DataFrame({"barri": list(PILOTS), "nom": list(PILOTS.values())})
vis = con.read_parquet(str(I / "visitors_monthly.parquet")).df().merge(names)
display(vis.groupby("nom").agg(
    mesos=("month", "count"), absents=("state", lambda s: (s == "absent").sum()),
    visitants_mes_mitja=("visitors", "mean"), canvi_vs_2023_mitja=("yoy", "mean")).round(3))
display(vis.pivot(index="month", columns="nom", values="visitors").tail(12))"""),
    ("code", """we = con.read_parquet(str(I / "weekend_share.parquet")).df().merge(names)
total = we.route_days_published + we.route_days_suppressed + we.route_days_absent
we = we.assign(pct_suprimit=(100 * we.route_days_suppressed / total).round(1),
               pct_absent=(100 * we.route_days_absent / total).round(1))
display(we.groupby("nom").agg(
    quota_mediana=("weekend_share", "median"), rutes_mitja=("n_routes", "mean"),
    pct_suprimit=("pct_suprimit", "mean"), pct_absent=("pct_absent", "mean")).round(3))"""),
    ("code", """homes = con.read_parquet(str(I / "visitors_by_home.parquet")).df().merge(names)
last = homes[homes.month == homes.month.max()]
display(last.sort_values("visitors", ascending=False).groupby("nom").head(5)
        [["nom", "home_name", "visitors"]])
assert (homes.visitors >= 15).all(), "provider threshold (>= 15) violated"
"""),
    ("md", "## 5. Tiempo total"),
    ("code", """print(f"notebook: {time.time() - t_start:.0f} s")"""),
]


def build(path: Path) -> None:
    nb = nbf.v4.new_notebook()
    nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3"}
    nb.cells = [
        nbf.v4.new_markdown_cell(src) if kind == "md" else nbf.v4.new_code_cell(src)
        for kind, src in CELLS
    ]
    nbf.write(nb, path)


if __name__ == "__main__":
    build(Path("notebooks/arrels_mvp.ipynb"))
