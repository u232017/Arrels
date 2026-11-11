"""Phase 3: score every barri from the cached pipeline output and print the evidence."""

from __future__ import annotations

from pipeline.config import connect, load_settings
from pipeline.ingest import load_mobility, read_tourism
from pipeline.pilot import COMPONENTS, barri_sufficiency

LABELS = {
    "s_published": "% publicat",
    "s_routes": "rutes útils",
    "s_t9_months": "mesos T9",
    "s_homes": "municipis T9",
    "s_stability": "estabilitat",
}


def main() -> None:
    settings = load_settings()
    con = connect(settings)
    coverage = con.read_parquet(str(settings.cache_dir / "route_coverage.parquet"))
    t9 = read_tourism(con, settings.tourism_dir, "visitantes_regionales_barrio_yearmon")
    n_months = coverage.project("month").distinct().count("*").fetchone()[0]
    scored = barri_sufficiency(con, coverage, t9, n_months)
    names = load_mobility(con, settings, "mun_barri").filter(
        "barrio_destino IS NOT NULL").aggregate(
        "barrio_destino AS barri, any_value(barrio_destino_name) AS name", "barrio_destino")
    table = scored.join(names, "barri", how="left").order("score DESC, barri")
    rows = table.project(
        "barri, name, round(score, 3), " + ", ".join(f"round({c}, 2)" for c in COMPONENTS)
        + ", round(avg_routes, 1), t9_months, round(avg_homes, 1), round(avg_visitors), "
        "stable_months").fetchall()
    print(f"n_months={n_months} barris={len(rows)}")
    header = ["#", "codi", "barri", "score", *LABELS.values(),
              "rutes/mes", "mesos T9", "municipis/mes", "visitants/mes", "mesos estables"]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for i, r in enumerate(rows, 1):
        print("| " + " | ".join([str(i), *(str(x) for x in r)]) + " |")


if __name__ == "__main__":
    main()
