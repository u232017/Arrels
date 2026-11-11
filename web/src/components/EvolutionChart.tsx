import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatInt, formatMonth, formatMonthShort } from "../format";
import type { BarriMonth } from "../types";
import { useMediaQuery } from "../useMediaQuery";

const TEAL = "#0e8c92";
const REF = "#94a3b8";
const HOLIDAY = "rgba(15, 31, 56, 0.06)";
const GRID = "#e2e8f0";
const TEXT_2 = "#4a5568";

export interface ChartRow {
  month: string;
  visitors: number | null;
  base: number | null;
  holiday: number | null; // full-height band for months with holidays
  holidays: string[];
}

const published = (m: BarriMonth | undefined) =>
  m && m.visitors.state === "published" ? m.visitors.value : null;

/** One row per selected month, with the same month of the base year as reference. */
export function chartRows(all: BarriMonth[], from: string, to: string, baseYear: string): ChartRow[] {
  const base = new Map(all.filter((m) => m.month.startsWith(baseYear)).map((m) => [m.month.slice(5), m]));
  const rows = all.filter((m) => m.month >= from && m.month <= to).map((m) => ({
    month: m.month,
    visitors: published(m),
    base: published(base.get(m.month.slice(5))),
    holidays: m.holidays,
  }));
  const top = Math.max(1, ...rows.flatMap((r) => [r.visitors ?? 0, r.base ?? 0]));
  return rows.map((r) => ({ ...r, holiday: r.holidays.length ? top * 1.05 : null }));
}

function ChartTooltip({ active, payload, baseYear }: { active?: boolean; payload?: { payload: ChartRow }[]; baseYear: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-caption text-navy shadow-sm">
      <p className="m-0 font-semibold">{formatMonth(r.month)}</p>
      <p className="m-0"><span className="text-teal-dark">●</span> Visitants: {r.visitors === null ? "sense dada" : formatInt(r.visitors)}</p>
      <p className="m-0"><span className="text-text-2">◌</span> Mateix mes, {baseYear}: {r.base === null ? "—" : formatInt(r.base)}</p>
      {r.holidays.length ? <p className="m-0 text-text-2">Festius: {r.holidays.join(", ")}</p> : null}
    </div>
  );
}

export function EvolutionChart({ all, from, to, baseYear }: { all: BarriMonth[]; from: string; to: string; baseYear: string }) {
  const narrow = useMediaQuery("(max-width: 640px)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rows = chartRows(all, from, to, baseYear);
  const height = narrow ? 260 : 320;
  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-2">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-5 bg-teal" />Visitants regionals</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-ref" />Mateix mes, {baseYear} (referència)</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-4 rounded-sm bg-navy/[0.06]" />Mes amb festius</span>
      </figcaption>
      <div role="img" aria-label={`Visitants regionals per mes, comparat amb el mateix mes de ${baseYear}. Les dades són a la taula "Veure les dades".`}>
        <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 800, height }}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={0}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tick={{ fill: TEXT_2, fontSize: 12 }}
                   tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: TEXT_2, fontSize: 12 }} tickLine={false}
                   axisLine={false} tickCount={5} width={64} domain={[0, "auto"]} />
            <Tooltip content={<ChartTooltip baseYear={baseYear} />} cursor={{ stroke: "#0f1f38", strokeOpacity: 0.3 }} />
            <Bar dataKey="holiday" fill={HOLIDAY} isAnimationActive={false} />
            <Line type="monotone" dataKey="base" stroke={REF} strokeWidth={2} strokeDasharray="6 4" dot={false}
                  connectNulls={false} isAnimationActive={!reduced} />
            <Line type="monotone" dataKey="visitors" stroke={TEAL} strokeWidth={2} dot={false}
                  activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={!reduced} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
