import { formatInt, formatPct, monthPhrase, periodPhrase } from "./format";
import { periodHomes } from "./homes";
import { summarise } from "./range";
import type { BarriMonth } from "./types";

const MAIN_TOWNS = 2;

/** One neutral sentence describing the selected period, generated from the data. */
export function summarySentence(barri: string, months: BarriMonth[], from: string, to: string): string {
  const single = from === to;
  const visitors = summarise(months).visitors;
  if (visitors.value === null) {
    return `No hi ha dades de visitants regionals per a aquest ${single ? "mes" : "període"}.`;
  }
  const n = formatInt(visitors.value);
  const first = single
    ? `${monthPhrase(from)}, ${barri} va rebre ${n} visitants regionals únics.`
    : `${periodPhrase(from, to)}, ${barri} va rebre de mitjana ${n} visitants regionals únics al mes.`;
  const towns = periodHomes(months).filter((h) => h.code !== "NA" && h.code !== "ALTRES").slice(0, MAIN_TOWNS);
  if (towns.length < MAIN_TOWNS) return first;
  const [a, b] = towns.map((t) => `${t.name} (${formatPct(t.share)})`);
  return `${first} Els principals municipis d'origen són ${a} i ${b}.`;
}
