import { periodChange, shiftYear } from "./range";
import type { BarriMonth, Value } from "./types";

const badge = { window: "w", pct_published: 100, pct_suppressed: 0, pct_absent: 0 };
const v = (value: number | null): Value =>
  value === null ? { value: null, state: "absent", badge: { ...badge, pct_published: 0, pct_absent: 100 } }
                 : { value, state: "published", badge };
const m = (month: string, visitors: number | null): BarriMonth => ({
  month, visitors: v(visitors), yoy: v(null), weekend_share: v(null), holidays: [],
});

// 2023-09..2024-02 at 100; 2024-09..2025-02 at 110 except one month at 140
const months: BarriMonth[] = [
  ...["2023-09", "2023-10", "2023-11", "2023-12", "2024-01", "2024-02"].map((x) => m(x, 100)),
  ...["2024-09", "2024-10", "2024-11", "2024-12", "2025-01"].map((x) => m(x, 110)),
  m("2025-02", 140),
];

describe("shiftYear", () => {
  it("moves a YYYY-MM string by whole years", () => {
    expect(shiftYear("2025-01", -1)).toBe("2024-01");
    expect(shiftYear("2024-12", -1)).toBe("2023-12");
  });
});

describe("periodChange: selected months vs the same months one year earlier", () => {
  it("compares the mean of the period with the mean of the previous year's same months", () => {
    const c = periodChange(months, "2024-09", "2025-02");
    expect(c.state).toBe("published");
    expect(c.value).toBeCloseTo((115 - 100) / 100); // mean(110×5, 140) = 115
  });

  it("names both windows in the badge", () => {
    expect(periodChange(months, "2024-09", "2025-02").badge.window).toBe("2024-09 – 2025-02 vs 2023-09 – 2024-02");
  });

  it("works for a single month", () => {
    expect(periodChange(months, "2025-02", "2025-02").value).toBeCloseTo(0.4);
  });

  it("is absent when the previous-year months do not exist", () => {
    expect(periodChange(months, "2023-09", "2023-12").state).toBe("absent");
  });

  it("is absent when any previous-year month has no data", () => {
    const gap = months.map((x) => (x.month === "2023-10" ? m("2023-10", null) : x));
    expect(periodChange(gap, "2024-09", "2025-02").state).toBe("absent");
  });

  it("is absent when a selected month has no data", () => {
    const gap = months.map((x) => (x.month === "2024-10" ? m("2024-10", null) : x));
    expect(periodChange(gap, "2024-09", "2025-02").state).toBe("absent");
  });
});
