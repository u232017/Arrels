import { render, screen, waitFor } from "@testing-library/react";
import { HomesMap } from "./HomesMap";

type Handler = () => void;
const created: FakeMap[] = [];

class FakeMap {
  handlers: Record<string, Handler[]> = {};
  sources: Record<string, unknown> = {};
  layers: { id: string; paint: Record<string, unknown> }[] = [];
  canvas = document.createElement("canvas");
  removed = false;
  constructor(public options: Record<string, unknown>) { created.push(this); }
  on(event: string, fn: Handler) { (this.handlers[event] ??= []).push(fn); }
  emit(event: string) { (this.handlers[event] ?? []).forEach((fn) => fn()); }
  getCanvas() { return this.canvas; }
  addSource(id: string, s: unknown) { this.sources[id] = s; }
  addLayer(l: { id: string; paint: Record<string, unknown> }) { this.layers.push(l); }
  remove() { this.removed = true; }
}

const setWorkerUrl = vi.fn();
vi.mock("maplibre-gl", () => ({ Map: FakeMap, setWorkerUrl }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({ default: "/worker.js" }));

const homes = [
  { code: "08187", name: "Sabadell", visitors: 400, lat: 41.5, lon: 2.1 },
  { code: "08101", name: "L'Hospitalet", visitors: 100, lat: 41.36, lon: 2.1 },
  { code: "ALTRES", name: "Altres municipis", visitors: 50, lat: null, lon: null },
];

beforeEach(() => { created.length = 0; setWorkerUrl.mockClear(); });

describe("HomesMap with MapLibre", () => {
  it("sets the worker URL and keeps the canvas out of the tab order", async () => {
    render(<HomesMap homes={homes} />);
    await waitFor(() => expect(created).toHaveLength(1));
    expect(setWorkerUrl).toHaveBeenCalledWith("/worker.js");
    expect(created[0].canvas.tabIndex).toBe(-1);
    expect(created[0].options.keyboard).toBe(false);
  });

  it("draws one circle per located home town, sized by the square root of visitors", async () => {
    render(<HomesMap homes={homes} />);
    await waitFor(() => expect(created).toHaveLength(1));
    created[0].emit("load");
    const data = created[0].sources.homes as { data: { features: { properties: { r: number } }[] } };
    const radii = data.data.features.map((f) => f.properties.r);
    expect(radii).toHaveLength(2); // "Altres municipis" has no point
    expect(radii[0] / radii[1]).toBeCloseTo(2); // sqrt(400 / 100)
    expect(created[0].layers[0].id).toBe("homes");
  });

  it("shows the fallback when the map fails before loading", async () => {
    render(<HomesMap homes={homes} />);
    await waitFor(() => expect(created).toHaveLength(1));
    created[0].emit("error");
    expect(await screen.findByText(/mapa no disponible en aquest navegador/i)).toBeInTheDocument();
  });

  it("ignores errors after the map has loaded (e.g. one missing tile)", async () => {
    render(<HomesMap homes={homes} />);
    await waitFor(() => expect(created).toHaveLength(1));
    created[0].emit("load");
    created[0].emit("error");
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/mapa no disponible/i)).not.toBeInTheDocument();
  });

  it("removes the map on unmount", async () => {
    const { unmount } = render(<HomesMap homes={homes} />);
    await waitFor(() => expect(created).toHaveLength(1));
    unmount();
    expect(created[0].removed).toBe(true);
  });
});
