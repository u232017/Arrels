import type { Meta } from "../types";

export function Footer({ meta }: { meta: Meta | null }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-4 py-6 text-caption text-text-2 lg:px-8">
        <p className="m-0">
          Barri Lab (201_F, UPF) · Telefónica Mobile Data Challenge 2026
          {meta ? ` · Dades ${meta.window.start} – ${meta.window.end}` : ""} · Dades agregades; cap valor per sota de 15.
        </p>
        <p className="m-0 mt-1">
          Fonts: Telefónica (mobilitat i turisme) · Generalitat de Catalunya, ICGC (municipis) ·
          Ajuntament de Barcelona, Open Data BCN (barris, CC-BY 4.0) · OpenFreeMap, © OpenStreetMap (mapa base).
        </p>
      </div>
    </footer>
  );
}
