import { render, screen, waitFor } from "@testing-library/react";
import type { PeriodHome } from "../homes";
import { HomesMap } from "./HomesMap";

type Handler = (e?: unknown) => void;
const created: FakeMap[] = [];
const markers: FakeMarker[] = [];

class FakeSource { data: unknown; setData(d: unknown) { this.data = d; } }
class FakeMap {
  handlers: Record<string, Handler[]> = {};
  layers: { id: string; type: string; filter?: unknown; paint?: Record<string, unknown> }[] =
    [{ id: "place_city", type: "symbol" }, { id: "water", type: "fill" }];
  sources: Record<string, FakeSource> = {};
  canvas = document.createElement("canvas");
  removed = false;
  constructor(public options: Record<string, unknown>) { created.push(this); }
  on(event: string, a: string | Handler, b?: Handler) {
    const key = typeof a === "string" ? `${event}:${a}` : event;
    (this.handlers[key] ??= []).push((typeof a === "string" ? b : a) as Handler);
  }
  emit(key: string, e?: unknown) { (this.handlers[key] ?? []).forEach((fn) => fn(e)); }
  getCanvas() { return this.canvas; }
  getStyle() { return { layers: this.layers }; }
  removeLayer(id: string) { this.layers = this.layers.filter((l) => l.id !== id); }
  addSource(id: string) { this.sources[id] = new FakeSource(); }
  getSource(id: string) { return this.sources[id]; }
  addLayer(l: { id: string; type: string }) { this.layers.push(l); }
  remove() { this.removed = true; }
}
class FakeMarker {
  lngLat: unknown;
  constructor(public options: { element: HTMLElement }) { markers.push(this); }
  setLngLat(ll: unknown) { this.lngLat = ll; return this; }
  addTo() { document.body.append(this.options.element); return this; }
  remove() { this.options.element.remove(); }
}
class FakePopup {
  static last: FakePopup | undefined;
  text = "";
  constructor() { FakePopup.last = this; }
  setLngLat() { return this; }
  setText(t: string) { this.text = t; return this; }
  addTo() { return this; }
  remove() {}
}

const setWorkerUrl = vi.fn();
vi.mock("maplibre-gl", () => ({ Map: FakeMap, Marker: FakeMarker, Popup: FakePopup, setWorkerUrl }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({ default: "/worker.js" }));

const home = (code: string, name: string, visitors: number, located = true): PeriodHome => ({
  code, name, visitors, share: visitors / 1000, monthsPublished: 1, monthsTotal: 1,
  lat: located ? 41.5 : null, lon: located ? 2.1 : null,
});
const homes = [home("08187", "Sabadell", 400), home("08015", "Badalona", 100), home("NA", "Residència desconeguda", 50, false)];
const pilot = { name: "Sants", lat: 41.377, lon: 2.136 };

async function mounted(props: Partial<Parameters<typeof HomesMap>[0]> = {}) {
  const utils = render(<HomesMap homes={homes} pilot={pilot} {...props} />);
  await waitFor(() => expect(created).toHaveLength(1));
  return { ...utils, map: created[0] };
}

beforeEach(() => { created.length = 0; markers.length = 0; setWorkerUrl.mockClear(); document.body.innerHTML = ""; });

describe("HomesMap", () => {
  it("sets the worker URL, compact attribution, and keeps the canvas out of the tab order", async () => {
    const { map } = await mounted();
    expect(setWorkerUrl).toHaveBeenCalledWith("/worker.js");
    expect(map.options.attributionControl).toEqual({ compact: true });
    expect(map.canvas.tabIndex).toBe(-1);
  });

  it("removes the basemap's own place labels on load", async () => {
    const { map } = await mounted();
    map.emit("load");
    expect(map.layers.find((l) => l.id === "place_city")).toBeUndefined();
    expect(map.layers.find((l) => l.id === "water")).toBeDefined();
  });

  it("draws circles sized by sqrt(visitors), 70 % opacity, white outline, top 8 labelled", async () => {
    const { map } = await mounted();
    map.emit("load");
    await waitFor(() => expect(map.sources.homes.data).toBeDefined());
    const fc = map.sources.homes.data as { features: { properties: { r: number; tip: string } }[] };
    expect(fc.features).toHaveLength(2); // the unknown residence has no point
    expect(fc.features[0].properties.r / fc.features[1].properties.r).toBeCloseTo(2);
    const circles = map.layers.find((l) => l.id === "homes");
    expect(circles?.paint).toMatchObject({ "circle-opacity": 0.7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 });
    expect(map.layers.find((l) => l.id === "home-labels")?.filter).toEqual(["<=", ["get", "rank"], 8]);
  });

  it("hover tooltip reads 'town · N visitants (share)'", async () => {
    const { map } = await mounted();
    map.emit("load");
    map.emit("mousemove:homes", { lngLat: [2.1, 41.5], features: [{ properties: { tip: "Badalona · 28.772 visitants (6,1 %)" } }] });
    expect(FakePopup.last?.text).toBe("Badalona · 28.772 visitants (6,1 %)");
  });

  it("marks the selected barri with a labelled navy pin", async () => {
    await mounted();
    const pin = await screen.findByText("Sants");
    expect(pin.closest("[data-testid='barri-pin']")).not.toBeNull();
    expect(markers[0].lngLat).toEqual([2.136, 41.377]);
  });

  it("shows a size legend", async () => {
    await mounted();
    expect(screen.getByText("Visitants al mes")).toBeInTheDocument();
  });

  it("falls back when the map fails before loading, but not for later tile errors", async () => {
    const first = await mounted();
    first.map.emit("load");
    first.map.emit("error");
    expect(screen.queryByText(/mapa no disponible/i)).not.toBeInTheDocument();
    first.unmount();
    created.length = 0;
    const second = await mounted();
    second.map.emit("error");
    expect(await screen.findByText(/mapa no disponible en aquest navegador/i)).toBeInTheDocument();
  });

  it("falls back to a message when no town has coordinates", () => {
    render(<HomesMap homes={[homes[2]]} />);
    expect(screen.getByText(/falten les coordenades/i)).toBeInTheDocument();
  });

  it("removes the map and pin on unmount", async () => {
    const { map, unmount } = await mounted();
    unmount();
    expect(map.removed).toBe(true);
    expect(screen.queryByTestId("barri-pin")).toBeNull();
  });
});
