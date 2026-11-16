"""Export aggregate mobility for the local Arrels map. Requires the existing pipeline cache."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from tempfile import NamedTemporaryFile

from pipeline.config import connect, load_settings
from pipeline.export import load_centroids
from pipeline.indicators import visitors_monthly
from pipeline.ingest import load_mobility, read_tourism
from pipeline.integrate import assert_unique

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web/public"
SEGMENTS = ["Residente", "Regional", "Nacional", "Internacional"]
TOP = 5


def display_town(name: str) -> str:
    name, separator, article = name.rpartition(", ")
    if separator and article in {"El", "La", "Les", "Els", "L'"}:
        space = "" if article == "L'" else " "
        return f"{article}{space}{name}"
    return f"{name}{separator}{article}"


def main() -> None:
    settings = load_settings()
    reference = json.loads((PUBLIC / "reference/map.json").read_text(encoding="utf-8"))
    ids = {area["provider"]: area["id"] for area in reference["areas"]}
    towns = load_centroids()
    hubs = {}
    observations = defaultdict(dict)
    yearly = defaultdict(dict)
    trips_by_destination = defaultdict(dict)

    with connect(settings) as con:
        t9 = read_tourism(con, settings.tourism_dir, "visitantes_regionales_barrio_yearmon")
        assert_unique(t9, ["month", "cod_barrio", "cod_municipio_residencia"], "Table 9")
        # Known external residences only. Keep the same universe for totals, changes and shares.
        t9 = t9.filter(
            "regexp_full_match(cod_municipio_residencia, '08[0-9]{3}') "
            "AND cod_municipio_residencia <> '08019'"
        )
        start, end = t9.aggregate("min(month), max(month)").fetchone()
        counts = visitors_monthly(con, t9, list(ids), start, end)
        for code, month, visitors in counts.project("barri, month, visitors").fetchall():
            if visitors is not None:
                observations[ids[code]][month.strftime("%Y-%m")] = {
                    "visitors": visitors,
                    "homes": [],
                }

        con.register("regional", t9)
        for code, month, town, name, n in con.sql(f"""
            SELECT cod_barrio, month, cod_municipio_residencia, municipio_residencia, visitantes
            FROM regional
            QUALIFY row_number() OVER (
                PARTITION BY cod_barrio, month ORDER BY visitantes DESC, cod_municipio_residencia
            ) <= {TOP}
        """).fetchall():
            observations[ids[code]][month.strftime("%Y-%m")]["homes"].append([town, n])
            latlon = towns.get(town)
            hubs[town] = {
                "name": display_town(name),
                "point": list(reversed(latlon)) if latlon else None,
            }
        for series in observations.values():
            for month in series.values():
                month["homes"].sort(key=lambda item: (-item[1], item[0]))

        for code, year, town_name, n, months in con.sql("""
            SELECT cod_barrio, year(month) AS year, max(municipio_residencia), sum(visitantes) AS n,
                   count(*) AS months
            FROM regional
            GROUP BY cod_barrio, year, cod_municipio_residencia
            QUALIFY row_number() OVER (
                PARTITION BY cod_barrio, year ORDER BY n DESC, cod_municipio_residencia
            ) = 1
        """).fetchall():
            yearly[ids[code]][str(year)] = {
                "town": display_town(town_name),
                "appearances": n,
                "months": months,
            }

        # Same family and published volumes as the integration notebook, partitioned by segment.
        con.register("barri_trips", load_mobility(con, settings, "barri_barri"))
        con.execute("""
            CREATE TEMP TABLE monthly_routes AS
            SELECT barrio_origen AS source, barrio_destino AS destination,
                   strftime(day, '%Y-%m') AS month, origen AS segment, sum(viajes) AS trips
            FROM barri_trips
            WHERE day >= DATE '2023-01-01' AND day < DATE '2025-09-01'
            GROUP BY ALL
        """)
        mix = defaultdict(dict)
        for code, month, segment, trips in con.sql("""
            SELECT destination, month, segment, sum(trips)
            FROM monthly_routes GROUP BY ALL
        """).fetchall():
            mix[(ids[code], month)][segment] = trips
        for (code, month), segments in mix.items():
            if (
                month in observations[code]
                and set(segments) == set(SEGMENTS)
                and sum(segments.values())
            ):
                total = sum(segments.values())
                observations[code][month]["mix"] = [round(segments[s] / total, 6) for s in SEGMENTS]

        for destination, month, source, trips, total in con.sql(f"""
            WITH incoming AS (
                SELECT destination, month, source, sum(trips) AS trips
                FROM monthly_routes WHERE source <> destination
                GROUP BY ALL HAVING sum(trips) > 0
            )
            SELECT destination, month, source, trips,
                   sum(trips) OVER (PARTITION BY destination, month) AS total
            FROM incoming
            QUALIFY row_number() OVER (
                PARTITION BY destination, month ORDER BY trips DESC, source
            ) <= {TOP}
            ORDER BY destination, month, trips DESC, source
        """).fetchall():
            entry = trips_by_destination[ids[destination]].setdefault(
                month, {"total": total, "top": []}
            )
            entry["top"].append([ids[source], trips])

    payload = {
        "start": start.strftime("%Y-%m"),
        "end": end.strftime("%Y-%m"),
        "areas": observations,
        "towns": hubs,
        "wrapped": yearly,
        "trips": trips_by_destination,
    }
    output = PUBLIC / "data/map.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            json.dump(payload, stream, ensure_ascii=False, separators=(",", ":"))
            stream.close()
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
    month_count = sum(map(len, observations.values()))
    print(f"{len(observations)} neighborhoods, {month_count} observed neighborhood-months")


if __name__ == "__main__":
    main()
