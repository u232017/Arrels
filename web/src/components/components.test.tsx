import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarriSelector } from "./BarriSelector";
import { CoverageBadge } from "./CoverageBadge";
import { HomesList } from "./HomesList";
import { HomesMap } from "./HomesMap";
import { KpiCard } from "./KpiCard";
import { MethodSection } from "./MethodSection";
import { MonthRange } from "./MonthRange";
import { TimeSeries } from "./TimeSeries";
import type { BarriMonth, Meta, Value } from "../types";

const badge = { window: "2024-02", pct_published: 50, pct_suppressed: 30, pct_absent: 20, n_routes: 12 };
const pub = (value: number): Value => ({ value, state: "published", badge });
const absent: Value = { value: null, state: "absent", badge: { ...badge, pct_published: 0, pct_absent: 100 } };

describe("CoverageBadge", () => {
  it("shows window and the three states", () => {
    render(<CoverageBadge value={pub(1)} />);
    const el = screen.getByTestId("coverage-badge");
    expect(el).toHaveTextContent("2024-02");
    expect(el).toHaveTextContent("50 % publicat");
    expect(el).toHaveTextContent("30 % <15");
    expect(el).toHaveTextContent("20 % sense fila");
    expect(el).toHaveTextContent("12 rutes");
  });
});

describe("KpiCard", () => {
  it("shows the formatted value and its badge", () => {
    render(<KpiCard title="Visitants" value={pub(472794)} format="int" />);
    expect(screen.getByRole("article", { name: "Visitants" })).toHaveTextContent("472.794");
    expect(screen.getByTestId("coverage-badge")).toBeInTheDocument();
  });
  it("shows 'Sense dada' instead of a number when absent", () => {
    render(<KpiCard title="Lloguer" value={absent} format="int" />);
    expect(screen.getByRole("article", { name: "Lloguer" })).toHaveTextContent("Sense dada");
  });
});

describe("BarriSelector", () => {
  it("is labelled and reports the chosen barri", async () => {
    const onChange = vi.fn();
    render(<BarriSelector pilots={[{ code: "1", name: "A" }, { code: "2", name: "B" }]} value="1" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "2");
    expect(onChange).toHaveBeenCalledWith("2");
  });
});

describe("MonthRange", () => {
  const months = ["2024-01", "2024-02", "2024-03"];
  it("has labelled from/to selects", () => {
    render(<MonthRange months={months} from="2024-01" to="2024-03" onChange={() => {}} />);
    expect(screen.getByLabelText("Des de")).toHaveValue("2024-01");
    expect(screen.getByLabelText("Fins a")).toHaveValue("2024-03");
  });
  it("never lets 'from' go past 'to'", async () => {
    const onChange = vi.fn();
    render(<MonthRange months={months} from="2024-01" to="2024-02" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Des de"), "2024-03");
    expect(onChange).toHaveBeenCalledWith("2024-03", "2024-03");
  });
});

const homes = [
  { code: "08187", name: "Sabadell", visitors: 100, lat: 41.5, lon: 2.1 },
  { code: "ALTRES", name: "Altres municipis", visitors: 40, lat: null, lon: null },
];

describe("HomesList", () => {
  it("ranks home towns with visitors", () => {
    render(<HomesList homes={homes} />);
    const items = within(screen.getByRole("list", { name: /municipis de residència/i })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sabadell");
    expect(items[0]).toHaveTextContent("100");
  });
});

describe("HomesMap", () => {
  it("falls back to a message when no home town has coordinates", () => {
    render(<HomesMap homes={[homes[1]]} />);
    expect(screen.getByText(/mapa no disponible/i)).toBeInTheDocument();
  });
});

const series: BarriMonth[] = ["2023-01", "2023-02", "2024-01", "2024-02"].map((m, i) => ({
  month: m, visitors: pub(100 + i * 10), yoy: pub(0.1), weekend_share: pub(0.2),
  holidays: m === "2024-01" ? ["Cap d'Any", "Reis"] : [],
}));

describe("TimeSeries", () => {
  it("is an accessible image with a data table fallback", () => {
    render(<TimeSeries months={series} from="2024-01" to="2024-02" />);
    expect(screen.getByRole("img", { name: /visitants regionals/i })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("marks months with holidays", () => {
    render(<TimeSeries months={series} from="2024-01" to="2024-02" />);
    expect(screen.getAllByTestId("holiday-marker")).toHaveLength(1);
  });
  it("shows the same month of 2023 next to each month", () => {
    render(<TimeSeries months={series} from="2024-01" to="2024-02" />);
    const row = screen.getAllByRole("row")[1];
    expect(row).toHaveTextContent("120"); // 2024-01
    expect(row).toHaveTextContent("100"); // 2023-01
  });
});

describe("MethodSection", () => {
  const meta: Meta = {
    generated: "x", window: { start: "2023-01", end: "2025-08" }, threshold: 15, pilots: [],
    missing_days: ["2024-02-11"], partial_days: ["2025-04-12"],
  };
  it("explains rules, gaps and that these are patterns, not causes", () => {
    render(<MethodSection meta={meta} />);
    const section = screen.getByRole("region", { name: "Mètode i limitacions" });
    expect(section).toHaveTextContent("2024-02-11");
    expect(section).toHaveTextContent("2025-04-12");
    expect(section).toHaveTextContent(/patrons, no causes/i);
    for (const rule of ["R1", "R2", "R3", "R4", "R5"]) expect(section).toHaveTextContent(rule);
  });
});
