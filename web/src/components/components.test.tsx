import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { choose } from "../test-utils";
import type { PeriodHome } from "../homes";
import type { Badge, BarriMonth, Meta, Value } from "../types";
import { TooltipProvider } from "./ui/tooltip";
import { DataTable } from "./DataTable";
import { chartRows, EvolutionChart } from "./EvolutionChart";
import { Footer } from "./Footer";
import { KpiCard } from "./KpiCard";
import { MethodSection } from "./MethodSection";
import { Ranking } from "./Ranking";
import { StatusDot } from "./StatusDot";
import { TopBar } from "./TopBar";

const badge: Badge = { window: "2024-02", pct_published: 50, pct_suppressed: 30, pct_absent: 20, n_routes: 12 };
const full: Badge = { window: "2024-02", pct_published: 100, pct_suppressed: 0, pct_absent: 0 };
const pub = (value: number, b: Badge = badge): Value => ({ value, state: "published", badge: b });
const withTips = (ui: ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

const meta: Meta = {
  generated: "x", window: { start: "2023-01", end: "2025-08" }, threshold: 15,
  pilots: [{ code: "1", name: "A" }, { code: "2", name: "B" }],
  missing_days: ["2024-02-11"], partial_days: ["2025-04-12"],
};

describe("StatusDot", () => {
  it("shows a short label, not the long coverage line", () => {
    withTips(<StatusDot value={pub(1)} />);
    const dot = screen.getByTestId("coverage-badge");
    expect(dot).toHaveTextContent("Parcialment <15");
    expect(dot).not.toHaveTextContent("Finestra");
  });
  it("reveals the full details in a tooltip on keyboard focus", async () => {
    withTips(<StatusDot value={pub(1)} />);
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Finestra 2024-02 · 50 % publicat · 30 % <15 · 20 % sense fila · 12 rutes");
  });
});

describe("KpiCard", () => {
  it("shows label, Catalan-formatted value, context and status", () => {
    withTips(<KpiCard title="Visitants regionals" value={pub(471527, full)} format="int" note="Mitjana" />);
    const card = screen.getByRole("article", { name: "Visitants regionals" });
    expect(card).toHaveTextContent("471.527");
    expect(card).toHaveTextContent("Mitjana");
    expect(within(card).getByTestId("coverage-badge")).toHaveTextContent("Publicat");
  });
  it("formats shares and signed changes", () => {
    withTips(<><KpiCard title="Q" value={pub(0.178, full)} format="pct" /><KpiCard title="C" value={pub(-0.028, full)} format="signedPct" /></>);
    expect(screen.getByRole("article", { name: "Q" })).toHaveTextContent("17,8 %");
    expect(screen.getByRole("article", { name: "C" })).toHaveTextContent("−2,8 %");
  });
});

describe("TopBar", () => {
  const months = ["2024-01", "2024-02", "2024-03"];
  it("has three labelled selects in one group", () => {
    withTips(<TopBar meta={meta} code="1" onCode={() => {}} months={months} range={{ from: "2024-01", to: "2024-03" }} onRange={() => {}} />);
    const group = screen.getByRole("group", { name: "Filtres" });
    expect(within(group).getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByRole("combobox", { name: "Des de" })).toHaveTextContent("gener 2024");
  });
  it("reports the chosen barri", async () => {
    const onCode = vi.fn();
    withTips(<TopBar meta={meta} code="1" onCode={onCode} months={months} range={{ from: "2024-01", to: "2024-03" }} onRange={() => {}} />);
    await choose("Barri", "B");
    expect(onCode).toHaveBeenCalledWith("2");
  });
  it("never lets 'Des de' go past 'Fins a'", async () => {
    const onRange = vi.fn();
    withTips(<TopBar meta={meta} code="1" onCode={() => {}} months={months} range={{ from: "2024-01", to: "2024-02" }} onRange={onRange} />);
    await choose("Des de", "març 2024");
    expect(onRange).toHaveBeenCalledWith({ from: "2024-03", to: "2024-03" });
  });
});

const homes: PeriodHome[] = Array.from({ length: 12 }, (_, i) => ({
  code: `0810${i}`, name: `Municipi ${i + 1}`, visitors: 1200 - i * 100, share: (1200 - i * 100) / 10000,
  lat: 41.4, lon: 2.1, monthsPublished: i === 1 ? 10 : 12, monthsTotal: 12,
}));

describe("Ranking", () => {
  it("shows the top 10 with share of the total", () => {
    withTips(<Ranking homes={homes} />);
    const items = within(screen.getByRole("list", { name: /municipis de residència/i })).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    expect(items[0]).toHaveTextContent("Municipi 1");
    expect(items[0]).toHaveTextContent("1.200");
    expect(items[0]).toHaveTextContent("12,0 %");
  });
  it("expands to every town with 'Veure tots (N)'", async () => {
    withTips(<Ranking homes={homes} />);
    await userEvent.click(screen.getByRole("button", { name: "Veure tots (12)" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Mostra'n menys" })).toHaveAttribute("aria-expanded", "true");
  });
  it("marks towns that are not published in every month", () => {
    withTips(<Ranking homes={homes} />);
    expect(screen.getByRole("button", { name: "Publicat 10 de 12 mesos" })).toBeInTheDocument();
  });
});

const month = (m: string, n: number | null, holidays: string[] = []): BarriMonth => ({
  month: m, visitors: n === null ? { value: null, state: "absent", badge: { ...full, pct_published: 0, pct_absent: 100 } } : pub(n, full),
  yoy: pub(0, full), weekend_share: pub(0.18, badge), holidays,
});
const series = [month("2023-01", 100), month("2023-02", 90), month("2024-01", 120, ["Cap d'Any", "Reis"]), month("2024-02", null)];

describe("chartRows", () => {
  const rows = chartRows(series, "2024-01", "2024-02", "2023");
  it("pairs each month with the same month of the base year", () => {
    expect(rows.map((r) => [r.month, r.visitors, r.base])).toEqual([["2024-01", 120, 100], ["2024-02", null, 90]]);
  });
  it("adds a background band only for months with holidays", () => {
    expect(rows.map((r) => r.holiday !== null)).toEqual([true, false]);
  });
});

describe("EvolutionChart", () => {
  it("has the legend above the chart and an accessible description", () => {
    render(<EvolutionChart all={series} from="2024-01" to="2024-02" baseYear="2023" />);
    expect(screen.getByText("Mateix mes, 2023 (referència)")).toBeInTheDocument();
    expect(screen.getByText("Mes amb festius")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /visitants regionals per mes/i })).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  it("lists the months with the full coverage details", () => {
    render(<DataTable months={series.slice(2)} all={series} baseYear="2023" />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("gener 2024");
    expect(rows[1]).toHaveTextContent("120");
    expect(rows[1]).toHaveTextContent("Finestra 2024-02 · 100 % publicat");
    expect(rows[2]).toHaveTextContent("Sense dada");
  });
});

describe("MethodSection", () => {
  it("explains R1–R5, the gaps, the province definition and 'patrons, no causes'", () => {
    render(<MethodSection meta={meta} />);
    const text = document.body.textContent ?? "";
    for (const s of ["R1", "R2", "R3", "R4", "R5", "2024-02-11", "2025-04-12", "província de Barcelona"]) expect(text).toContain(s);
    expect(text).toMatch(/patrons, no causes/i);
    expect(text).not.toMatch(/de Catalunya/);
  });
});

describe("Footer", () => {
  it("names the team, the data window and the sources", () => {
    render(<Footer meta={meta} />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Barri Lab (201_F, UPF)");
    expect(footer).toHaveTextContent("2023-01 – 2025-08");
    expect(footer).toHaveTextContent("Open Data BCN");
  });
});
