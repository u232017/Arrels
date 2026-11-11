import { periodRent, periodResidents } from "./range";
import type { BarriMonth, Value } from "./types";

const badge = (w: string) => ({ window: w, pct_published: 100, pct_suppressed: 0, pct_absent: 0 });
const v = (value: number | null, w: string): Value =>
  value === null ? { value: null, state: "absent", badge: { ...badge(w), pct_published: 0, pct_absent: 100 } }
                 : { value, state: "published", badge: badge(w) };
const m = (month: string, rent: number | null, residents: number | null, q: string): BarriMonth => ({
  month, visitors: v(1, month), yoy: v(null, ""), weekend_share: v(null, ""), holidays: [],
  rent: v(rent, q), residents: v(residents, `padró 1 gen. ${month.slice(0, 4)}`),
});
const months = [m("2024-11", 16, 1000, "2024T4"), m("2024-12", 16, 1000, "2024T4"), m("2025-01", 19, 1100, "2025T1")];

describe("periodRent", () => {
  it("is the mean €/m² over the selected months, with the quarters as window", () => {
    const r = periodRent(months);
    expect(r.value).toBeCloseTo(17);
    expect(r.badge.window).toBe("2024T4 – 2025T1");
  });
  it("is partial when some months have no rent", () => {
    const r = periodRent([...months, m("2025-02", null, 1100, "2025T1")]);
    expect(r.badge.pct_absent).toBeCloseTo(25);
  });
  it("is absent when no month has rent", () => {
    expect(periodRent([m("2025-02", null, 1, "2025T1")]).state).toBe("absent");
  });
  it("is absent for data without rent at all", () => {
    expect(periodRent([{ ...months[0], rent: undefined }]).state).toBe("absent");
  });
});

describe("periodResidents", () => {
  it("takes the padró of the last selected month's year", () => {
    const r = periodResidents(months);
    expect(r.value).toBe(1100);
    expect(r.badge.window).toBe("padró 1 gen. 2025");
  });
});
