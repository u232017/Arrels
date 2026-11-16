"""Build the public reference data for the map from the frozen 1C/phase 2 outputs."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
QUARTERS = [f"{y}Q{q}" for y in (2023, 2024, 2025) for q in range(1, 5) if (y, q) <= (2025, 3)]
YEARS = {"2023", "2024", "2025"}
TOP_ORIGINS = 5
EXPANDED_ZONES = {"11": "Parc Montjuïc", "12": "Zona Franca"}


def records(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def rings(text):
    """Flatten polygon rings; SVG's even-odd fill rule handles holes and islands."""
    return [
        [[round(float(v), 5) for v in pair.split()] for pair in ring.split(",")]
        for ring in re.findall(r"\(([^()]+)\)", text)
    ]


def normalize(name):
    letters = unicodedata.normalize("NFKD", name.casefold())
    return "".join(c for c in letters if c.isalnum())


def positive(value):
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    return round(number, 2) if math.isfinite(number) and number > 0 else None


def expanded_scope(code, source_name, area_name):
    zone = EXPANDED_ZONES.get(code)
    if zone and normalize(source_name) in {
        normalize(f"{area_name} {zone}"),
        normalize(f"{area_name} AEI {zone}"),
    }:
        return f"{area_name} – {zone}"
    return None


def sale_prices(paths, neighborhoods):
    prices = {}
    expanded = {}
    for path in paths:
        with ZipFile(path) as book:
            strings = [
                "".join(item.itertext())
                for item in ET.fromstring(book.read("xl/sharedStrings.xml"))
            ]
            workbook = ET.fromstring(book.read("xl/workbook.xml"))
            targets = {
                r.attrib["Id"]: r.attrib["Target"]
                for r in ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
            }
            for sheet in workbook.findall(".//{*}sheet"):
                match = re.fullmatch(r"([1-4])t(23|24|25)", sheet.attrib["name"])
                if match is None:
                    continue
                quarter, year = match.groups()
                period = f"20{year}Q{quarter}"
                if period not in QUARTERS:
                    continue
                target = targets[
                    sheet.attrib[
                        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                    ]
                ]
                member = target.lstrip("/") if target.startswith("/") else f"xl/{target}"
                in_neighborhoods = False
                seen = set()
                for row in ET.fromstring(book.read(member)).findall(".//{*}sheetData/{*}row"):
                    cells = {}
                    for cell in row.findall("{*}c"):
                        value = cell.findtext("{*}v")
                        if value is not None:
                            col = re.sub(r"\d", "", cell.attrib["r"])
                            cells[col] = strings[int(value)] if cell.get("t") == "s" else value
                    if cells.get("B", "").strip().startswith("Barris"):
                        in_neighborhoods = True
                        continue
                    code = cells.get("A", "").zfill(2)
                    if not in_neighborhoods or code not in neighborhoods or code in seen:
                        continue
                    seen.add(code)
                    source_name = cells.get("B", "")
                    area_name = neighborhoods[code]["name"]
                    value = positive(cells.get("S")) if int(cells.get("F") or 0) >= 3 else None
                    if normalize(source_name) == normalize(area_name):
                        prices[code, period] = value
                    elif scope := expanded_scope(code, source_name, area_name):
                        expanded[code, period] = (scope, value)
                if seen != neighborhoods.keys():
                    raise ValueError(f"{path.name} {period}: incomplete neighborhood table")
    return prices, expanded


def departures(path):
    totals = defaultdict(lambda: defaultdict(lambda: {"published": 0, "suppressed": 0}))
    for row in records(path):
        if row["Any"] not in ("2023", "2024") or not 1 <= int(row["Codi_Districte"]) <= 10:
            continue
        entry = totals[row["Codi_Districte"].zfill(2)][row["Any"]]
        if row["censurado_menor_5"] == "True":
            entry["suppressed"] += 1
        elif row["valor_publicado"]:
            entry["published"] += int(float(row["valor_publicado"]))
        else:
            raise ValueError("Unclassified residential-departure value")
    return totals


def residential_moves(path, dimensions_path, areas):
    """Annual inbound moves between distinct barrios, using the padrón destination IDs."""
    dimensions = {}
    for row in records(dimensions_path):
        if row["Desc_Dimensio"] != "CODI_BARRI_DEST":
            continue
        code = row["Codi_Valor"].zfill(2)
        if code in dimensions:
            raise ValueError(f"Repeated padrón destination ID {code}")
        dimensions[code] = normalize(row["Desc_Valor_CA"])
    if dimensions != {code: normalize(area["name"]) for code, area in areas.items()}:
        raise ValueError("Padrón destination IDs differ from the map's neighborhood catalog")

    by_year = defaultdict(lambda: defaultdict(dict))
    for row in records(path):
        year = row["Any"]
        if year not in YEARS:
            continue
        source = row["Codi_Barri"].zfill(2)
        destination = row["CODI_BARRI_DEST"].zfill(2)
        if (
            destination not in dimensions
            or source not in dimensions
            or dimensions[source] != normalize(row["Nom_Barri"])
        ):
            raise ValueError(f"Unknown padrón origin or destination {source} → {destination}")
        incoming = by_year[year][destination]
        if source in incoming:
            raise ValueError(f"Repeated padrón observation {year} {source} → {destination}")
        amount = row["Valor"]
        incoming[source] = None if amount == ".." else int(amount)

    if set(by_year) != YEARS or any(
        set(destinations) != areas.keys() for destinations in by_year.values()
    ):
        raise ValueError("Expected padrón observations for all 73 destinations in 2023–2025")

    result = defaultdict(dict)
    for year, destinations in sorted(by_year.items()):
        for destination, incoming in sorted(destinations.items()):
            between = {
                source: amount for source, amount in incoming.items() if source != destination
            }
            published = [
                (source, amount) for source, amount in between.items() if amount is not None
            ]
            published.sort(key=lambda item: (-item[1], item[0]))
            result[destination][year] = {
                "total": sum(amount for _, amount in published),
                "top": [
                    (source, amount) for source, amount in published[:TOP_ORIGINS] if amount > 0
                ],
                "suppressed": len(between) - len(published),
                "missing": len(areas) - 1 - len(between),
            }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepared", type=Path, required=True, help="1C resultados directory")
    parser.add_argument(
        "--integrated", type=Path, required=True, help="Phases 2–3 resultados directory"
    )
    parser.add_argument(
        "--sales", type=Path, nargs=3, required=True, help="Official quarterly workbooks, 2023–2025"
    )
    parser.add_argument("--pad-dimensions", type=Path, help="Official pad_dimensions.csv")
    args = parser.parse_args()
    crosswalk = {
        r["codi_barri"]: r for r in records(args.prepared / "correspondencia_barrios_validada.csv")
    }
    districts = {}
    areas = {}
    for geo in records(args.prepared / "barrios_oficiales_con_geometria.csv"):
        code, district = geo["codi_barri"].zfill(2), geo["codi_districte"].zfill(2)
        match = crosswalk[code]
        if district != match["codi_districte"] or normalize(geo["nom_barri"]) != normalize(
            match["nom_barri"]
        ):
            raise ValueError(f"Geography differs from validated crosswalk for {code}")
        districts[district] = geo["nom_districte"]
        areas[code] = {
            "id": code,
            "provider": match["codigo_telefonica"],
            "name": geo["nom_barri"],
            "district": district,
            "rings": rings(geo["geometria_wgs84"]),
        }
    if len(areas) != 73 or len({a["provider"] for a in areas.values()}) != len(areas):
        raise ValueError("Expected a one-to-one crosswalk for all 73 Barcelona neighborhoods")
    rent = {
        (r["codi_barri"], r["periodo"]): positive(r["precio_eur_m2_mes"])
        for r in records(args.integrated / "panel_alquiler_movilidad_barrio_trimestre.csv")
        if r["estado_atributo"] == "utilizable"
    }
    expanded_rent = {}
    rent_source = args.prepared / "alquiler_trimestral_2023_2025_completo_fuente.csv"
    for row in records(rent_source):
        code, period = row["codi_barri"], row["periodo"]
        if period not in QUARTERS:
            continue
        value = positive(row["precio_eur_m2_mes"])
        if row["ambito_equivalente_a_barrio"] == "True":
            if period == "2025Q3":
                rent[code, period] = value
        elif scope := expanded_scope(code, row["nombre_fuente"], areas[code]["name"]):
            expanded_rent[code, period] = (scope, value)

    sales, expanded_sales = sale_prices(args.sales, areas)
    for code, area in areas.items():
        area["rent"] = [rent.get((code, period)) for period in QUARTERS]
        area["sale"] = [sales.get((code, period)) for period in QUARTERS]
        for metric, expanded in (("rent", expanded_rent), ("sale", expanded_sales)):
            observations = [expanded.get((code, period)) for period in QUARTERS]
            scope = next((item[0] for item in observations if item is not None), None)
            if scope:
                area.setdefault("expandedPrices", {})[metric] = {
                    "scope": scope,
                    "values": {index: item[1] for index, item in enumerate(observations) if item},
                }

    reference = {
        "quarters": QUARTERS,
        "districts": districts,
        "areas": [areas[code] for code in sorted(areas)],
        "departures": departures(args.prepared / "emigracion_anual_publicado.csv"),
        "moves": residential_moves(
            args.prepared / "cambios_domicilio_anual_publicado.csv",
            args.pad_dimensions or args.prepared.parent / "fuentes_originales/pad_dimensions.csv",
            areas,
        ),
    }
    output = ROOT / "web/public/reference/map.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(
        json.dumps(reference, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    sale_count = sum(value is not None for value in sales.values())
    rent_count = sum(value is not None for value in rent.values())
    print(f"{len(areas)} polygons, {rent_count} exact rent and {sale_count} exact sale values")


if __name__ == "__main__":
    main()
