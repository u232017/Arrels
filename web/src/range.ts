import type { Badge, BarriMonth, Value } from "./types";

export function inRange(months: BarriMonth[], from: string, to: string): BarriMonth[] {
  return months.filter((m) => m.month >= from && m.month <= to);
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
type PublishedValue = Value & { value: number };
const isPublished = (v: Value): v is PublishedValue => v.state === "published" && v.value !== null;
const published = (vs: Value[]): number[] => vs.filter(isPublished).map((v) => v.value);

function windowOf(months: BarriMonth[]): string {
  if (months.length === 0) return "";
  return `${months[0].month} – ${months[months.length - 1].month}`;
}

function monthShareBadge(values: Value[], window: string): Badge {
  const n = values.length || 1;
  const pub = (100 * published(values).length) / n;
  return { window, pct_published: pub, pct_suppressed: 0, pct_absent: 100 - pub };
}

function meanBadge(values: Value[], window: string): Badge {
  const pick = (k: "pct_published" | "pct_suppressed" | "pct_absent") => mean(values.map((v) => v.badge[k]));
  const routes = values.map((v) => v.badge.n_routes).filter((n): n is number => n !== undefined);
  return {
    window,
    pct_published: values.length ? pick("pct_published") : 0,
    pct_suppressed: values.length ? pick("pct_suppressed") : 0,
    pct_absent: values.length ? pick("pct_absent") : 100,
    ...(routes.length ? { n_routes: Math.round(mean(routes)) } : {}),
  };
}

function valueOrAbsent(value: number | null, badge: Badge): Value {
  return value === null ? { value: null, state: "absent", badge } : { value, state: "published", badge };
}

export interface Summary {
  visitors: Value;
  weekendShare: Value;
}

/** "2025-01" shifted by `years` whole years. */
export function shiftYear(ym: string, years: number): string {
  return `${Number(ym.slice(0, 4)) + years}${ym.slice(4)}`;
}

const absentWith = (window: string): Value => ({
  value: null, state: "absent", badge: { window, pct_published: 0, pct_suppressed: 0, pct_absent: 100 },
});

/**
 * Change of the period's mean monthly visitors vs the mean of the same calendar months one year
 * earlier. Absent unless every selected and every previous-year month has a published value.
 */
export function periodChange(all: BarriMonth[], from: string, to: string): Value {
  const prevFrom = shiftYear(from, -1);
  const prevTo = shiftYear(to, -1);
  const window = `${from} – ${to} vs ${prevFrom} – ${prevTo}`;
  const current = inRange(all, from, to).map((m) => m.visitors);
  const byMonth = new Map(all.map((m) => [m.month, m.visitors]));
  const previous = inRange(all, from, to).map((m) => byMonth.get(shiftYear(m.month, -1)));
  const complete = (vs: (Value | undefined)[]): vs is PublishedValue[] =>
    vs.length > 0 && vs.every((x) => x !== undefined && isPublished(x));
  if (!complete(current) || !complete(previous)) return absentWith(window);
  const base = mean(previous.map((x) => x.value));
  if (base === 0) return absentWith(window);
  const value = mean(current.map((x) => x.value)) / base - 1;
  return { value, state: "published", badge: { window, pct_published: 100, pct_suppressed: 0, pct_absent: 0 } };
}

/** KPI values for a month range. Unique visitors are averaged per month, never summed. */
export function summarise(months: BarriMonth[]): Summary {
  const window = windowOf(months);
  const visitors = months.map((m) => m.visitors);
  const vis = published(visitors);
  const weekend = months.map((m) => m.weekend_share);
  const we = published(weekend);
  return {
    visitors: valueOrAbsent(vis.length ? mean(vis) : null, monthShareBadge(visitors, window)),
    weekendShare: valueOrAbsent(we.length ? mean(we) : null, meanBadge(weekend, window)),
  };
}
