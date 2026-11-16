import { formatInt } from "../format";

export type Point = [number, number];
export type Price = "rent" | "sale";
export type Layer = "change" | Price | "none";
export type FlowSource = "municipalities" | "trips" | "moves";
export interface Area {
  id: string;
  name: string;
  district: string;
  rings: Point[][];
  rent: (number | null)[];
  sale: (number | null)[];
  expandedPrices?: Partial<Record<Price, { scope: string; values: Partial<Record<number, number | null>> }>>;
}
export interface Departure {
  published: number;
  suppressed: number;
}
export interface Reference {
  areas: Area[];
  quarters: string[];
  districts: Record<string, string>;
  departures: Record<string, Record<string, Departure>>;
  moves?: Record<string, Record<string, InboundCounts>>;
}
export interface Observation {
  visitors: number;
  homes: [string, number][];
  mix?: number[];
}
export interface Town {
  name: string;
  point: Point | null;
}
export interface AnnualOrigin {
  town: string;
  appearances: number;
  months: number;
}
export interface Mobility {
  start: string;
  end: string;
  areas: Record<string, Record<string, Observation>>;
  towns: Record<string, Town>;
  wrapped?: Record<string, Record<string, AnnualOrigin>>;
  trips?: Record<string, Record<string, InboundCounts>>;
}

export interface InboundCounts {
  total: number;
  top: [string, number][];
  suppressed?: number;
  missing?: number;
}

interface RankedOrigin {
  id: string;
  name: string;
  point: Point | null;
  n: number;
  share: number;
}

export interface InboundRanking {
  total: number;
  ranked: RankedOrigin[];
  suppressed?: number;
  missing?: number;
}

export const FLOW_SOURCES = {
  municipalities: {
    label: "Municipis de residència", heading: "D’on venen", unit: "visitants", others: "Altres municipis",
  },
  trips: {
    label: "Viatges entre barris", heading: "Barris d’origen dels viatges", unit: "viatges", others: "Altres barris",
  },
  moves: {
    label: "Canvis de domicili", heading: "Barris d’origen dels canvis de domicili", unit: "canvis", others: "Altres barris",
  },
};

export const BASE_MONTH = "2023-01";
export const MONTHS = Array.from({ length: 32 }, (_, i) =>
  `${2023 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`);
export const DEFAULT_INDEX = MONTHS.indexOf("2025-03");
export const PRICE = {
  rent: { label: "Lloguer", unit: "€/m² al mes", limits: [8, 12, 15, 18, 21], color: "#286f70" },
  sale: { label: "Compravenda", unit: "€/m² construït", limits: [2000, 3250, 4500, 5750, 7000], color: "#286f70" },
};

const decimal = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const priceLabel = (value: number, price: Price) => price === "rent" ? decimal.format(value) : formatInt(value);

export function quarter(month: string) {
  return `${month.slice(0, 4)}Q${Math.ceil(Number(month.slice(-2)) / 3)}`;
}

export function priceAt(area: Area, quarters: string[], month: string, price: Price) {
  return priceInQuarter(area, quarters.indexOf(quarter(month)), price);
}

export function priceInQuarter(area: Area, index: number, price: Price) {
  const exact = area[price][index];
  if (exact != null) return { value: exact, scope: null };
  const expanded = area.expandedPrices?.[price];
  if (expanded && Object.hasOwn(expanded.values, index)) {
    return { value: expanded.values[index] ?? null, scope: expanded.scope };
  }
  return { value: null, scope: null };
}

export function visitorChange(series: Record<string, Observation> | undefined, month: string) {
  if (month === BASE_MONTH) return null;
  const baseline = series?.[BASE_MONTH]?.visitors;
  const current = series?.[month]?.visitors;
  return baseline && current != null ? (current - baseline) / baseline : null;
}

export function latestRentQuarter(reference: Reference, month: string) {
  return reference.quarters.filter((period) => period <= quarter(month)).at(-1) ?? reference.quarters[0];
}

export function inboundRanking(
  reference: Reference, mobility: Mobility | null, areaId: string, month: string, source: FlowSource,
): InboundRanking | null {
  if (source === "municipalities") {
    const observation = mobility?.areas[areaId]?.[month];
    if (!mobility || !observation || observation.visitors <= 0) return null;
    return { total: observation.visitors, ranked: observation.homes.flatMap(([id, n]) => {
      const town = mobility.towns[id];
      return town ? [{ ...town, id, n, share: n / observation.visitors }] : [];
    }) };
  }

  const counts = source === "moves" ? reference.moves?.[areaId]?.[month.slice(0, 4)] : mobility?.trips?.[areaId]?.[month];
  if (!counts) return null;
  const names = new Map(reference.areas.map((area) => [area.id, area.name]));
  return {
    total: counts.total,
    suppressed: counts.suppressed,
    missing: counts.missing,
    ranked: counts.total > 0 ? counts.top.flatMap(([id, n]) => {
      const name = names.get(id);
      return name ? [{ id, name: titleCase(name), n, share: n / counts.total, point: null }] : [];
    }) : [],
  };
}

export function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}

export function districtChange(reference: Reference, mobility: Mobility | null, district: string) {
  if (!mobility) return { change: null, n: 0 };
  const values = [];
  for (const area of reference.areas.filter((item) => item.district === district)) {
    const yearly = ["2023", "2024"].map((y) => MONTHS.filter((month) => month.startsWith(y))
      .map((month) => mobility.areas[area.id]?.[month]?.visitors));
    if (yearly.every((year) => year.every((n) => n !== undefined))) {
      const [base, current] = yearly.map((values) => values.reduce<number>((sum, n) => sum + n, 0));
      if (base > 0) values.push(current / base - 1);
    }
  }
  return { change: median(values), n: values.length };
}

export const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
export const searchKey = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("ca").replace(/[^\p{L}\p{N}]/gu, "");

export function sampleMobility(reference: Reference): Mobility {
  const towns: Mobility["towns"] = {
    badalona: { name: "Badalona", point: [2.2474, 41.4501] },
    hospitalet: { name: "L’Hospitalet", point: [2.099, 41.359] },
    sabadell: { name: "Sabadell", point: [2.108, 41.546] },
    mataró: { name: "Mataró", point: [2.445, 41.539] },
    santcugat: { name: "Sant Cugat", point: [2.084, 41.473] },
  };
  return {
    start: MONTHS[0], end: MONTHS[31], towns,
    trips: Object.fromEntries(reference.areas.map((area, index) => {
      const nearby = reference.areas.slice(index + 1).concat(reference.areas.slice(0, index)).slice(0, 5);
      return [area.id, Object.fromEntries(MONTHS.map((month, k) => {
        const top = nearby.map((neighbor, rank): [string, number] => [neighbor.id, (5 - rank) * 600 + k * 10]);
        return [month, { total: top.reduce((sum, [, n]) => sum + n, 3000), top }];
      }))];
    })),
    areas: Object.fromEntries(reference.areas.map((area, i) => [area.id, Object.fromEntries(MONTHS.map((month, k) => {
      const trend = ((i * 7) % 17 - 2) / 25;
      const base = 2900 + i * 27 + 400 * Math.sin(k % 12 / 2);
      const visitors = Math.round(base * (1 + trend * Math.max(0, k - 11) / 20));
      const shares = [0.23 + 0.015 * Math.sin(k), 0.18, 0.13, 0.09, 0.075];
      const regional = 0.2 + i % 9 / 45;
      return [month, {
        visitors,
        homes: Object.keys(towns).map((id, j) => [id, Math.round(visitors * shares[j])]),
        mix: [0.67 - regional, regional, 0.1, 0.23],
      }];
    }))])),
  };
}
