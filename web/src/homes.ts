import type { BarriMonth, Home } from "./types";

export interface PeriodHome extends Home {
  /** Mean monthly visitors over the months where the town is published (>= 15). */
  visitors: number;
  /** Share of the barri's mean monthly visitors. */
  share: number;
  monthsPublished: number;
  monthsTotal: number;
}

/**
 * Monthly average per home town over the selected months. A month where a town is missing
 * (<15 in Table 9) is unknown, not zero, so it is left out of that town's average.
 */
export function periodHomes(months: BarriMonth[]): PeriodHome[] {
  const totals = months.filter((m) => m.visitors.state === "published" && m.visitors.value !== null)
    .map((m) => m.visitors.value as number);
  const meanTotal = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const byCode = new Map<string, { home: Home; values: number[] }>();
  for (const m of months) {
    for (const h of m.homes ?? []) {
      const entry = byCode.get(h.code) ?? { home: h, values: [] };
      byCode.set(h.code, { home: entry.home, values: [...entry.values, h.visitors] });
    }
  }
  return [...byCode.values()]
    .map(({ home, values }) => {
      const visitors = values.reduce((a, b) => a + b, 0) / values.length;
      return { ...home, visitors, share: meanTotal ? visitors / meanTotal : 0,
               monthsPublished: values.length, monthsTotal: months.length };
    })
    .sort((a, b) => b.visitors - a.visitors || a.name.localeCompare(b.name, "ca"));
}
