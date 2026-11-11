import { formatInt, formatMonth, formatPct } from "../format";
import { coverageText } from "../status";
import type { BarriMonth } from "../types";

/** Accessible table of the selected months, with full coverage details. */
export function DataTable({ months, all, baseYear }: { months: BarriMonth[]; all: BarriMonth[]; baseYear: string }) {
  const base = new Map(all.filter((m) => m.month.startsWith(baseYear)).map((m) => [m.month.slice(5), m]));
  const num = (m: BarriMonth | undefined) =>
    m && m.visitors.state === "published" && m.visitors.value !== null ? formatInt(m.visitors.value) : "—";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-body">
        <caption className="sr-only">Dades mensuals del barri seleccionat</caption>
        <thead>
          <tr className="border-b border-line text-caption text-text-2">
            <th scope="col" className="py-2 pr-4 font-medium">Mes</th>
            <th scope="col" className="py-2 pr-4 font-medium">Visitants regionals</th>
            <th scope="col" className="py-2 pr-4 font-medium">Mateix mes, {baseYear}</th>
            <th scope="col" className="py-2 pr-4 font-medium">Quota de cap de setmana</th>
            <th scope="col" className="py-2 pr-4 font-medium">Festius</th>
            <th scope="col" className="py-2 font-medium">Cobertura</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month} className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-4 font-medium text-navy">{formatMonth(m.month)}</th>
              <td className="py-2 pr-4 tabular-nums">{m.visitors.value === null ? "Sense dada" : num(m)}</td>
              <td className="py-2 pr-4 tabular-nums">{num(base.get(m.month.slice(5)))}</td>
              <td className="py-2 pr-4 tabular-nums">{m.weekend_share.value === null ? "Sense dada" : formatPct(m.weekend_share.value)}</td>
              <td className="py-2 pr-4">{m.holidays.join(", ")}</td>
              <td className="py-2 text-caption text-text-2">
                <span className="block">Visitants: {coverageText(m.visitors)}</span>
                <span className="block">Cap de setmana: {coverageText(m.weekend_share)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
