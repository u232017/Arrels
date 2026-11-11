import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { choose } from "./test-utils";

vi.mock("./components/HomesMap", () => ({ HomesMap: () => <div>mapa</div> }));

const sample = join(__dirname, "..", "public", "sample");
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const path = join(sample, url.replace(/^[^/]+\//, ""));
    return { ok: true, json: async () => JSON.parse(readFileSync(path, "utf8")) };
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("loads the first pilot barri with KPI cards, each with coverage info, and no empty card", async () => {
    render(<App dataDir="sample" />);
    expect(await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" })).toBeInTheDocument();
    const kpis = screen.getByRole("region", { name: "Indicadors" });
    const cards = within(kpis).getAllByRole("article");
    expect(cards.map((c) => c.querySelector("h3")?.textContent)).toEqual(
      ["Visitants regionals", "Canvi vs any anterior", "Quota de cap de setmana", "Lloguer €/m²"]);
    expect(within(kpis).getAllByTestId("coverage-badge")).toHaveLength(4);
    expect(kpis).not.toHaveTextContent("Sense dada");
    const context = screen.getByRole("region", { name: "Context del barri" });
    expect(within(context).getAllByRole("article")).toHaveLength(2);
    expect(context).toHaveTextContent("HUT per 1.000 residents");
  });

  it("switches barri", async () => {
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    await choose("Barri", "Barri de mostra B");
    expect(await screen.findByRole("heading", { level: 2, name: "Barri de mostra B" })).toBeInTheDocument();
  });

  it("changing the month range updates the badge window", async () => {
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    await choose("Des de", "gener 2025");
    const card = screen.getByRole("article", { name: /visitants regionals/i });
    await waitFor(() => expect(within(card).getByTestId("coverage-badge")).toHaveAccessibleName(/2025-01 – 2025-08/));
    expect(card).not.toHaveTextContent("Finestra"); // the long coverage line is never on screen
  });

  it("shows an error message when data cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    render(<App dataDir="sample" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/404/);
  });

  it("has a collapsed 'Mètode i limitacions' section that opens", async () => {
    render(<App dataDir="sample" />);
    const trigger = await screen.findByRole("button", { name: "Mètode i limitacions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    const panel = await screen.findByRole("region", { name: "Mètode i limitacions" });
    expect(panel).toHaveTextContent(/patrons, no causes/i);
  });
});
