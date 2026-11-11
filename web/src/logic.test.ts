import { formatCompact, formatMonthShort, monthPhrase, periodPhrase } from "./format";
import { periodHomes } from "./homes";
import { statusOf } from "./status";
import { summarySentence } from "./summary";
import type { BarriMonth, Home, Value } from "./types";

const badge = (pub: number, sup = 0, abs = 100 - pub - sup) => ({ window: "w", pct_published: pub, pct_suppressed: sup, pct_absent: abs });
const val = (value: number | null, b = badge(100)): Value =>
  value === null ? { value: null, state: "absent", badge: badge(0) } : { value, state: "published", badge: b };
const month = (m: string, visitors: number | null, homes: Home[] = []): BarriMonth => ({
  month: m, visitors: val(visitors), yoy: val(null), weekend_share: val(null), holidays: [], homes,
});
const home = (code: string, name: string, visitors: number): Home => ({ code, name, visitors, lat: 41.4, lon: 2.1 });

describe("Catalan month labels", () => {
  it("short month for chart ticks, with the year on January", () => {
    expect(formatMonthShort("2024-09")).toBe("set.");
    expect(formatMonthShort("2025-01")).toBe("gen. 2025");
  });
  it("phrase with article for a single month", () => {
    expect(monthPhrase("2025-08")).toBe("A l'agost de 2025");
    expect(monthPhrase("2025-09")).toBe("Al setembre de 2025");
    expect(monthPhrase("2025-04")).toBe("A l'abril de 2025");
  });
  it("phrase for a period", () => expect(periodPhrase("2024-09", "2025-08")).toBe("Entre setembre de 2024 i agost de 2025"));
  it("compact axis numbers", () => {
    expect(formatCompact(300000)).toBe("300.000");
    expect(formatCompact(1200)).toBe("1.200");
  });
});

describe("statusOf", () => {
  it("is ok when everything is published", () => expect(statusOf(val(1)).tone).toBe("ok"));
  it("is partial when part is <15", () => expect(statusOf(val(1, badge(70, 28, 2)))).toEqual({ tone: "partial", label: "Parcialment <15" }));
  it("is partial when only some rows are missing", () => expect(statusOf(val(1, badge(80, 0, 20))).label).toBe("Dades parcials"));
  it("is none without data", () => expect(statusOf(val(null))).toEqual({ tone: "none", label: "Sense dada" }));
});

describe("periodHomes: monthly average per home town over the period", () => {
  const months = [
    month("2024-01", 1000, [home("A", "Alfa", 300), home("B", "Beta", 100)]),
    month("2024-02", 1000, [home("A", "Alfa", 500)]), // Beta <15 this month: unknown, not 0
  ];
  const homes = periodHomes(months);

  it("averages only the months where the town is published", () => {
    expect(homes.map((h) => [h.code, h.visitors])).toEqual([["A", 400], ["B", 100]]);
  });
  it("records in how many months the town was published", () => {
    expect(homes.find((h) => h.code === "B")).toMatchObject({ monthsPublished: 1, monthsTotal: 2 });
  });
  it("shares are relative to the mean monthly visitors of the barri", () => {
    expect(homes[0].share).toBeCloseTo(0.4);
  });
  it("never sums months", () => {
    expect(homes[0].visitors).toBeLessThan(800);
  });
});

describe("summarySentence", () => {
  const months = [month("2025-08", 362767, [home("1", "L'Hospitalet de Llobregat", 31165), home("2", "Badalona", 28772)])];
  it("describes a single month with the top two towns and their shares", () => {
    expect(summarySentence("la Dreta de l'Eixample", months, "2025-08", "2025-08")).toBe(
      "A l'agost de 2025, la Dreta de l'Eixample va rebre 362.767 visitants regionals únics. " +
      "Els principals municipis d'origen són L'Hospitalet de Llobregat (8,6 %) i Badalona (7,9 %).");
  });
  it("describes a period as a monthly average", () => {
    const two = [month("2025-07", 300000, []), month("2025-08", 400000, [])];
    expect(summarySentence("Sants", two, "2025-07", "2025-08")).toBe(
      "Entre juliol de 2025 i agost de 2025, Sants va rebre de mitjana 350.000 visitants regionals únics al mes.");
  });
  it("says so when there is no data", () => {
    expect(summarySentence("Sants", [month("2025-08", null)], "2025-08", "2025-08")).toBe(
      "No hi ha dades de visitants regionals per a aquest mes.");
  });
});
