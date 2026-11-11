import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

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
  it("loads the first pilot barri with KPI cards and badges", async () => {
    render(<App dataDir="sample" />);
    expect(await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" })).toBeInTheDocument();
    const kpis = screen.getByRole("region", { name: "Indicadors" });
    expect(within(kpis).getAllByTestId("coverage-badge").length).toBeGreaterThanOrEqual(6);
  });

  it("switches barri", async () => {
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    await userEvent.selectOptions(screen.getByLabelText("Barri"), "000000002");
    expect(await screen.findByRole("heading", { level: 2, name: "Barri de mostra B" })).toBeInTheDocument();
  });

  it("changing the month range updates the badge window", async () => {
    render(<App dataDir="sample" />);
    await screen.findByRole("heading", { level: 2, name: "Barri de mostra A" });
    await userEvent.selectOptions(screen.getByLabelText("Des de"), "2025-01");
    const card = screen.getByRole("article", { name: /visitants regionals/i });
    await waitFor(() => expect(card).toHaveTextContent("2025-01 – 2025-08"));
  });

  it("shows an error message when data cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    render(<App dataDir="sample" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/404/);
  });

  it("always shows the limitations section", async () => {
    render(<App dataDir="sample" />);
    expect(await screen.findByRole("region", { name: "Mètode i limitacions" })).toBeVisible();
  });
});
