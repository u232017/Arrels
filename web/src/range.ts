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
  yoy: Value;
  weekendShare: Value;
}

/** KPI values for a month range. Unique visitors are averaged per month, never summed. */
export function summarise(months: BarriMonth[]): Summary {
  const window = windowOf(months);
  const visitors = months.map((m) => m.visitors);
  const vis = published(visitors);

  const lastYoy = [...months].reverse().find((m) => m.yoy.state === "published" && m.yoy.value !== null);

  const weekend = months.map((m) => m.weekend_share);
  const we = published(weekend);

  return {
    visitors: valueOrAbsent(vis.length ? mean(vis) : null, monthShareBadge(visitors, window)),
    yoy: lastYoy ? lastYoy.yoy : valueOrAbsent(null, monthShareBadge([], window)),
    weekendShare: valueOrAbsent(we.length ? mean(we) : null, meanBadge(weekend, window)),
  };
}
