// Regression tests for typescript-reviewer findings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { KpiCard } from "./components/KpiCard";
import { TimeSeries } from "./components/TimeSeries";
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
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000002");
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000001");
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000003");
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
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000002");
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra B" });
    expect(screen.getByLabelText("Fins a")).toHaveValue("2023-06");
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
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000002");
    await screen.findByRole("alert");
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000003");
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra C" });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows a coverage badge for the residence list and the series", async () => {
    stub(async (url) => ok(read(url.replace(/^[^/]+\//, ""))));
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    for (const name of [/on viuen els visitants/i, /evolució mensual/i]) {
      const section = screen.getByRole("region", { name });
      expect(section.querySelector("[data-testid='coverage-badge']")).not.toBeNull();
    }
  });

  it("labels the change as the selected months vs the same months a year earlier", async () => {
    stub(async (url) => ok(read(url.replace(/^[^/]+\//, ""))));
    render(<App dataDir="sample" />);
    const card = await screen.findByRole("article", { name: /canvi vs any anterior/i });
    expect(card).toHaveTextContent("vs mateixos mesos de l'any anterior");
    expect(card).toHaveTextContent("2024-09 – 2025-08 vs 2023-09 – 2024-08");
  });

  it("hides the change when the previous-year months do not exist", async () => {
    stub(async (url) => ok(read(url.replace(/^[^/]+\//, ""))));
    render(<App dataDir="sample" />);
    await screen.findByRole("article", { name: /canvi vs any anterior/i });
    await userEvent.selectOptions(screen.getByLabelText("Des de"), "2023-01");
    await userEvent.selectOptions(screen.getByLabelText("Fins a"), "2023-12");
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

describe("TimeSeries base year", () => {
  it("uses the base year it is given", () => {
    const badge = { window: "w", pct_published: 100, pct_suppressed: 0, pct_absent: 0 };
    const m = (month: string, n: number): BarriMonth => ({
      month, visitors: { value: n, state: "published", badge }, yoy: { value: 0, state: "published", badge },
      weekend_share: { value: 0, state: "published", badge }, holidays: [] });
    render(<TimeSeries months={[m("2024-01", 50), m("2025-01", 80)]} from="2025-01" to="2025-01" baseYear="2024" />);
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("50");
    expect(screen.getByRole("columnheader", { name: /2024/ })).toBeInTheDocument();
  });
});
