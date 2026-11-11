import { useEffect, useMemo, useRef, useState } from "react";
import type { Home } from "../types";

// Free basemap without API key (OpenFreeMap). If it fails, the ranked list still works.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const CENTER: [number, number] = [2.05, 41.5];
const ZOOM = 8;
const MAX_RADIUS_PX = 22;

type Located = Home & { lat: number; lon: number };
const located = (homes: Home[]): Located[] =>
  homes.filter((h): h is Located => typeof h.lat === "number" && typeof h.lon === "number");

export function HomesMap({ homes }: { homes: Home[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const points = useMemo(() => located(homes), [homes]);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    let map: { remove: () => void } | undefined;
    let cancelled = false;
    import("maplibre-gl")
      .then(async ({ Map: MaplibreMap }) => {
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !ref.current) return;
        const max = Math.max(...points.map((p) => p.visitors));
        const m = new MaplibreMap({ container: ref.current, style: STYLE_URL, center: CENTER, zoom: ZOOM,
                                     keyboard: false });
        map = m;
        let loaded = false;
        m.getCanvas().tabIndex = -1; // the ranked list is the keyboard-accessible view
        m.on("load", () => {
          loaded = true;
          m.addSource("homes", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: points.map((p) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [p.lon, p.lat] },
                properties: { name: p.name, r: MAX_RADIUS_PX * Math.sqrt(p.visitors / max) },
              })),
            },
          });
          m.addLayer({
            id: "homes", type: "circle", source: "homes",
            paint: { "circle-radius": ["get", "r"], "circle-color": "#1f6f8b", "circle-opacity": 0.6,
                     "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 },
          });
        });
        m.on("error", () => { if (!loaded) setFailed(true); }); // ignore single tile errors
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; map?.remove(); };
  }, [points]);

  if (points.length === 0) {
    return <p className="map-fallback">Mapa no disponible: falten les coordenades dels municipis. Consulta la llista.</p>;
  }
  return (
    <>
      <div ref={ref} className="map" role="img" aria-label="Mapa dels municipis de residència dels visitants (mida = visitants). Vegeu la llista al costat." />
      {failed ? <p className="map-fallback">Mapa no disponible en aquest navegador. Consulta la llista.</p> : null}
    </>
  );
}
