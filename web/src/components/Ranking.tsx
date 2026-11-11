import { useState } from "react";
import { formatInt, formatPct } from "../format";
import type { PeriodHome } from "../homes";
import { Tooltip } from "./ui/tooltip";

const TOP = 10;

/** Top home towns with inline teal bars and share of the total; expands in place to all. */
export function Ranking({ homes }: { homes: PeriodHome[] }) {
  const [all, setAll] = useState(false);
  if (homes.length === 0) return <p className="m-0 text-body text-text-2">No hi ha dades de residència per a aquest període.</p>;
  const shown = all ? homes : homes.slice(0, TOP);
  const max = homes[0].visitors;
  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Municipis de residència dels visitants" className="m-0 flex list-none flex-col gap-1.5 p-0">
        {shown.map((h, i) => (
          <li key={h.code} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 text-body">
            <span className="text-caption tabular-nums text-text-2">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-navy" title={h.name}>{h.name}</span>
                <span className="shrink-0 tabular-nums text-text-2">{formatInt(h.visitors)}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-surface">
                <div className="h-1.5 rounded-full bg-teal" style={{ width: `${(100 * h.visitors) / max}%` }} />
              </div>
            </div>
            <span className="flex w-16 items-center justify-end gap-1 tabular-nums text-navy">
              {h.monthsPublished < h.monthsTotal ? (
                <Tooltip content={`Publicat ${h.monthsPublished} de ${h.monthsTotal} mesos (la resta, <15)`}>
                  <button type="button" aria-label={`Publicat ${h.monthsPublished} de ${h.monthsTotal} mesos`}
                          className="size-2 rounded-full bg-partial" />
                </Tooltip>
              ) : null}
              {formatPct(h.share)}
            </span>
          </li>
        ))}
      </ol>
      {homes.length > TOP ? (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
                className="self-start rounded-md text-body font-medium text-teal-dark underline-offset-4 hover:underline">
          {all ? "Mostra'n menys" : `Veure tots (${homes.length})`}
        </button>
      ) : null}
    </div>
  );
}
