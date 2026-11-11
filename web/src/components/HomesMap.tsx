import { useEffect, useMemo, useRef, useState } from "react";
import { formatInt, formatPct } from "../format";
import type { PeriodHome } from "../homes";
import { useMediaQuery } from "../useMediaQuery";
// MapLibre 6 runs its renderer in a separate worker file; let Vite bundle it with its imports.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Free basemap without API key (OpenFreeMap). Its own place labels are removed on load.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const CENTER: [number, number] = [2.1, 41.5];
const ZOOM = 8;
const MAX_RADIUS_PX = 24;
const LABELLED = 8;
const RAMP: [string, string] = ["#d5eeef", "#0b6e73"];

type Located = PeriodHome & { lat: number; lon: number };
const located = (homes: PeriodHome[]): Located[] =>
  homes.filter((h): h is Located => typeof h.lat === "number" && typeof h.lon === "number");

export interface Pilot { name: string; lat?: number; lon?: number }

function geojson(points: Located[]) {
  const max = Math.max(1, ...points.map((p) => p.visitors));
  return {
    type: "FeatureCollection" as const,
    features: points.map((p, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: {
        name: p.name, rank: i + 1, share: p.share, visitors: p.visitors,
        r: MAX_RADIUS_PX * Math.sqrt(p.visitors / max),
        tip: `${p.name} · ${formatInt(p.visitors)} visitants (${formatPct(p.share)})`,
      },
    })),
  };
}

/** Teal circles sized by sqrt(visitors), top 8 labelled, navy pin for the selected barri. */
export function HomesMap({ homes, pilot }: { homes: PeriodHome[]; pilot?: Pilot }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const points = useMemo(() => located(homes), [homes]);
  const data = useMemo(() => geojson(points), [points]);
  const max = points[0]?.visitors ?? 0;

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    let marker: import("maplibre-gl").Marker | undefined;
    import("maplibre-gl")
      .then(async ({ Map: MaplibreMap, Marker, Popup, setWorkerUrl }) => {
        setWorkerUrl(workerUrl);
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !ref.current) return;
        let loaded = false;
        const m = new MaplibreMap({ container: ref.current, style: STYLE_URL, center: CENTER, zoom: ZOOM,
                                    keyboard: false, attributionControl: { compact: true }, fadeDuration: reduced ? 0 : 300 });
        map = m;
        mapRef.current = m;
        m.getCanvas().tabIndex = -1; // the ranking is the keyboard-accessible view
        const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 8 });
        m.on("load", () => {
          loaded = true;
          for (const layer of m.getStyle().layers ?? []) {
            if (layer.type === "symbol") m.removeLayer(layer.id); // basemap without its own labels
          }
          m.addSource("homes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({ id: "homes", type: "circle", source: "homes", paint: {
            "circle-radius": ["get", "r"], "circle-opacity": 0.7,
            "circle-color": ["interpolate", ["linear"], ["sqrt", ["get", "share"]], 0, RAMP[0], 0.35, RAMP[1]],
            "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
          m.addLayer({ id: "home-labels", type: "symbol", source: "homes", filter: ["<=", ["get", "rank"], LABELLED],
            layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12,
                      "text-offset": [0, 1.2], "text-anchor": "top" },
            paint: { "text-color": "#0f1f38", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
          m.on("mousemove", "homes", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            m.getCanvas().style.cursor = "pointer";
            popup.setLngLat(e.lngLat).setText(String(f.properties?.tip ?? "")).addTo(m);
          });
          m.on("mouseleave", "homes", () => { m.getCanvas().style.cursor = ""; popup.remove(); });
          setReady(true);
        });
        m.on("error", () => { if (!loaded) setFailed(true); }); // ignore single tile errors
        if (pilot?.lat !== undefined && pilot.lon !== undefined) {
          const el = document.createElement("div");
          el.className = "flex items-center gap-1.5 pointer-events-none";
          const dot = document.createElement("span");
          dot.className = "block size-3.5 rounded-full border-2 border-white bg-navy shadow";
          const label = document.createElement("span");
          label.className = "rounded bg-navy px-1.5 py-0.5 text-caption font-semibold text-white";
          label.textContent = pilot.name;
          el.append(dot, label);
          el.dataset.testid = "barri-pin";
          marker = new Marker({ element: el, anchor: "left", offset: [-7, 0] }).setLngLat([pilot.lon, pilot.lat]).addTo(m);
        }
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; marker?.remove(); map?.remove(); mapRef.current = null; setReady(false); };
  }, [pilot, reduced]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const src = m.getSource("homes") as { setData?: (d: unknown) => void } | undefined;
    src?.setData?.(data);
  }, [data, ready]);

  if (failed) {
    return <p className="m-0 rounded-card bg-surface p-4 text-body text-text-2">Mapa no disponible en aquest navegador. Consulta la llista.</p>;
  }
  if (points.length === 0) {
    return <p className="m-0 rounded-card bg-surface p-4 text-body text-text-2">Mapa no disponible: falten les coordenades dels municipis. Consulta la llista.</p>;
  }
  const legend = [max, max / 4, max / 16].map((v) => Math.round(v / 100) * 100).filter((v) => v > 0);
  return (
    <div className="relative h-full min-h-[320px] lg:min-h-[480px]">
      <div ref={ref} className="absolute inset-0 overflow-hidden rounded-card border border-line" role="img"
           aria-label="Mapa dels municipis de residència dels visitants (mida = visitants). Vegeu la llista al costat." />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-line bg-white/95 px-2 py-1.5 text-caption text-text-2">
        <p className="m-0 mb-1">Visitants al mes</p>
        <div className="flex items-end gap-3">
          {legend.map((v) => {
            const d = 2 * MAX_RADIUS_PX * Math.sqrt(v / Math.max(1, max));
            return (
              <span key={v} className="flex flex-col items-center gap-0.5">
                <span aria-hidden="true" className="block rounded-full border border-white bg-teal/70" style={{ width: d, height: d }} />
                {formatInt(v)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
