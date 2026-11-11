import { formatMonth } from "../format";
import type { Meta } from "../types";
import type { Range } from "../useArrelsData";
import { LabelledSelect } from "./ui/select";

interface Props {
  meta: Meta | null;
  code: string;
  onCode: (code: string) => void;
  months: string[];
  range: Range | null;
  onRange: (range: Range) => void;
}

/** Sticky top bar: title + subtitle, then the three aligned controls. */
export function TopBar({ meta, code, onCode, months, range, onRange }: Props) {
  const monthOptions = months.map((m) => ({ value: m, label: formatMonth(m) }));
  return (
    <header className="z-40 border-b border-line bg-white/95 backdrop-blur lg:sticky lg:top-0">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-3 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <p className="m-0 text-section font-semibold text-navy">Arrels</p>
          <p className="m-0 text-caption text-text-2">Visitants regionals a tres barris de Barcelona · patrons, no causes</p>
        </div>
        {meta ? (
          <div role="group" aria-label="Filtres" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:gap-3">
            <LabelledSelect className="col-span-2 sm:col-span-1" label="Barri" value={code} onChange={onCode}
                            options={meta.pilots.map((p) => ({ value: p.code, label: p.name }))} />
            {range ? (
              <>
                <LabelledSelect label="Des de" value={range.from} options={monthOptions}
                                onChange={(from) => onRange({ from, to: from > range.to ? from : range.to })} />
                <LabelledSelect label="Fins a" value={range.to} options={monthOptions}
                                onChange={(to) => onRange({ from: to < range.from ? to : range.from, to })} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
