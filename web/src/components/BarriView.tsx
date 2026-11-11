import { useMemo } from "react";
import { formatMonth } from "../format";
import { inRange, periodChange, summarise } from "../range";
import type { Barri, Home } from "../types";
import type { Range } from "../useArrelsData";
import { CoverageBadge } from "./CoverageBadge";
import { HomesList } from "./HomesList";
import { HomesMap } from "./HomesMap";
import { KpiCard } from "./KpiCard";
import { TimeSeries } from "./TimeSeries";

const NO_HOMES: Home[] = [];

/** KPIs, residence panel and monthly series for one barri and month range. */
export function BarriView({ barri, range, baseYear }: { barri: Barri; range: Range; baseYear: string }) {
  const shown = useMemo(() => inRange(barri.months, range.from, range.to), [barri, range]);
  const summary = useMemo(() => summarise(shown), [shown]);
  const lastMonth = shown.length ? shown[shown.length - 1] : undefined;
  const change = useMemo(() => periodChange(barri.months, range.from, range.to), [barri, range]);
  const context = [
    { title: "Lloguer mitjà trimestral", value: barri.context.rent },
    { title: "Residents", value: barri.context.residents },
    { title: "HUT per 1.000 residents (2025T2)", value: barri.context.hut_per_1000 },
  ].filter((c) => c.value.state !== "absent"); // never show an empty card
  const homes = lastMonth?.homes ?? NO_HOMES;

  return (
    <>
      <h2 className="barri-name">{barri.name}</h2>

      <section className="kpis" aria-labelledby="kpis-title">
        <h2 id="kpis-title" className="visually-hidden">Indicadors</h2>
        <KpiCard title="Visitants regionals únics" value={summary.visitors} format="int" note="Mitjana mensual del període" />
        {change.state !== "absent" ? (
          <KpiCard title="Canvi vs any anterior" value={change} format="signedPct" note="vs mateixos mesos de l'any anterior" />
        ) : null}
        <KpiCard title="Quota de cap de setmana" value={summary.weekendShare} format="pct" note="Viatges regionals; setmana uniforme = 28,6 %" />
        {context.map((c) => <KpiCard key={c.title} title={c.title} value={c.value} format="int" />)}
      </section>

      <section className="homes-panel" aria-labelledby="homes-title">
        <h2 id="homes-title">On viuen els visitants · {lastMonth ? formatMonth(lastMonth.month) : ""}</h2>
        <p className="hint">Visitants únics d'un sol mes (no es poden sumar mesos).</p>
        {lastMonth ? <CoverageBadge value={lastMonth.visitors} /> : null}
        <div className="homes-grid">
          <HomesMap homes={homes} />
          <HomesList homes={homes} />
        </div>
      </section>

      <section aria-labelledby="series-title">
        <h2 id="series-title">Evolució mensual</h2>
        <CoverageBadge value={summary.visitors} />
        <TimeSeries months={barri.months} from={range.from} to={range.to} baseYear={baseYear} />
      </section>
    </>
  );
}
