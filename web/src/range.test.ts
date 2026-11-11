import { inRange, summarise } from "./range";
import type { BarriMonth, Value } from "./types";

const badge = (pub: number, sup = 0, abs = 100 - pub - sup, n?: number) => ({
  window: "w", pct_published: pub, pct_suppressed: sup, pct_absent: abs,
  ...(n === undefined ? {} : { n_routes: n }),
});
const v = (value: number | null, n?: number): Value =>
  value === null
    ? { value: null, state: "absent", badge: badge(0, 0, 100, n) }
    : { value, state: "published", badge: badge(n === undefined ? 100 : 60, n === undefined ? 0 : 30, undefined, n) };

const month = (m: string, visitors: number | null, yoy: number | null, we: number | null): BarriMonth => ({
  month: m, visitors: v(visitors), yoy: v(yoy), weekend_share: v(we, 100), holidays: [],
});

const months = [
  month("2024-01", 100, 0.1, 0.2),
  month("2024-02", 300, 0.2, 0.3),
  month("2024-03", null, null, null),
];

describe("inRange", () => {
  it("keeps months between from and to, inclusive", () =>
    expect(inRange(months, "2024-02", "2024-03").map((m) => m.month)).toEqual(["2024-02", "2024-03"]));
});

describe("summarise", () => {
  const s = summarise(months);

  it("uses the monthly mean of visitors, never the sum", () => expect(s.visitors.value).toBe(200));
  it("badge shows the share of months with a value", () => {
    expect(s.visitors.badge.pct_published).toBeCloseTo(66.7, 1);
    expect(s.visitors.badge.pct_absent).toBeCloseTo(33.3, 1);
    expect(s.visitors.badge.window).toBe("2024-01 – 2024-03");
  });
  it("averages the weekend share over published months", () => expect(s.weekendShare.value).toBeCloseTo(0.25));
  it("averages route-day shares and routes in the weekend badge", () => {
    expect(s.weekendShare.badge.n_routes).toBe(100);
    expect(s.weekendShare.badge.pct_suppressed).toBeCloseTo(20); // (30 + 30 + 0) / 3
  });
  it("is absent when no month has a value", () => {
    const empty = summarise([months[2]]);
    expect(empty.visitors.state).toBe("absent");
    expect(empty.visitors.value).toBeNull();
  });
});
