// Regression tests for typescript-reviewer findings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";
import { choose } from "./test-utils";
import { KpiCard } from "./components/KpiCard";
import { chartRows } from "./components/EvolutionChart";
import type { Barri, BarriMonth, Value } from "./types";

vi.mock("./components/HomesMap", () => ({ HomesMap: () => <div>mapa</div> }));

const sample = join(__dirname, "..", "public", "sample");
const read = (rel: string) => JSON.parse(readFileSync(join(sample, rel), "utf8"));

type Responder = (url: string) => Promise<{ ok: boolean; status?: number; json?: () => Promise<unknown> }>;
const stub = (fn: Responder) => vi.stubGlobal("fetch", vi.fn(fn));
const ok = (body: unknown) => ({ ok: true, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

describe("App robustness", () => {
  it("ignores a late response for a barri that is no longer selected", async () => {
    let releaseA: (() => void) | undefined;
    stub(async (url) => {
      if (url.endsWith("meta.json")) return ok(read("meta.json"));
      if (url.includes("000000001")) {
        if (!releaseA) return ok(read("barri/000000001.json")); // first load
        await new Promise<void>((r) => (releaseA = r));
      }
      return ok(read(url.replace(/^[^/]+\//, "")));
    });
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    releaseA = () => {};
    await choose("Barri", "Barri de mostra B");
    await choose("Barri", "Barri de mostra A");
    await choose("Barri", "Barri de mostra C");
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra C" });
    releaseA?.();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole("heading", { level: 2, name: "Barri de mostra C" })).toBeInTheDocument();
  });

  it("resets the range when the new barri does not have those months", async () => {
    const b: Barri = read("barri/000000002.json");
    stub(async (url) => {
      if (url.endsWith("meta.json")) return ok(read("meta.json"));
      if (url.includes("000000002")) return ok({ ...b, months: b.months.slice(0, 6) });
      return ok(read(url.replace(/^[^/]+\//, "")));
    });
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    await choose("Barri", "Barri de mostra B");
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra B" });
    expect(screen.getByRole("combobox", { name: "Fins a" })).toHaveTextContent("juny 2023");
  });

  it("shows an error instead of crashing on a file that breaks the contract", async () => {
    stub(async (url) => (url.endsWith("meta.json") ? ok(read("meta.json")) : ok({ code: "x" })));
    render(<App dataDir="sample" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/format/i);
  });

  it("shows a loading status while data arrives", async () => {
    stub(() => new Promise(() => {}));
    render(<App dataDir="sample" />);
    expect(screen.getByRole("status")).toHaveTextContent(/carregant/i);
  });

  it("clears the error after a later successful load", async () => {
    stub(async (url) => {
      if (url.endsWith("meta.json")) return ok(read("meta.json"));
      if (url.includes("000000002")) return { ok: false, status: 500 };
      return ok(read(url.replace(/^[^/]+\//, "")));
    });
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    await choose("Barri", "Barri de mostra B");
    await screen.findByRole("alert");
    await choose("Barri", "Barri de mostra C");
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra C" });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows a coverage badge for the residence list and the series", async () => {
    stub(async (url) => ok(read(url.replace(/^[^/]+\//, ""))));
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    for (const name of [/on viuen els visitants/i, /evolució mensual/i]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getAllByTestId("coverage-badge").length).toBeGreaterThan(0);
    }
  });

  it("labels the change as the selected months vs the same months a year earlier", async () => {
    stub(async (url) => ok(read(url.replace(/^[^/]+\//, ""))));
    render(<App dataDir="sample" />);
    const card = await screen.findByRole("article", { name: /canvi vs any anterior/i });
    expect(card).toHaveTextContent("vs mateixos mesos de l'any anterior");
    expect(within(card).getByTestId("coverage-badge")).toHaveAccessibleName(/2024-09 – 2025-08 vs 2023-09 – 2024-08/);
  });

  it("hides the change when the previous-year months do not exist", async () => {
    stub(async (url) => ok(read(url.replace(/^[^/]+\//, ""))));
    render(<App dataDir="sample" />);
    await screen.findByRole("article", { name: /canvi vs any anterior/i });
    await choose("Des de", "gener 2023");
    await choose("Fins a", "desembre 2023");
    await waitFor(() => expect(screen.queryByRole("article", { name: /canvi vs any anterior/i })).not.toBeInTheDocument());
  });
});

describe("KpiCard", () => {
  it("shows '<15' for a suppressed value", () => {
    const v: Value = { value: null, state: "suppressed",
      badge: { window: "w", pct_published: 0, pct_suppressed: 100, pct_absent: 0 } };
    render(<KpiCard title="X" value={v} format="int" />);
    expect(screen.getByRole("article", { name: "X" })).toHaveTextContent("<15");
  });
});

describe("chart base year", () => {
  it("uses the base year it is given", () => {
    const badge = { window: "w", pct_published: 100, pct_suppressed: 0, pct_absent: 0 };
    const m = (month: string, n: number): BarriMonth => ({
      month, visitors: { value: n, state: "published", badge }, yoy: { value: 0, state: "published", badge },
      weekend_share: { value: 0, state: "published", badge }, holidays: [] });
    const rows = chartRows([m("2024-01", 50), m("2025-01", 80)], "2025-01", "2025-01", "2024");
    expect(rows[0]).toMatchObject({ visitors: 80, base: 50 });
  });
});
