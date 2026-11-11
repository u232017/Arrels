import { useMemo } from "react";
import { periodHomes } from "../homes";
import { inRange, periodChange, periodRent, periodResidents, summarise } from "../range";
import { summarySentence } from "../summary";
import type { Barri, Meta } from "../types";
import type { Range } from "../useArrelsData";
import { DataTable } from "./DataTable";
import { EvolutionChart } from "./EvolutionChart";
import { HomesMap } from "./HomesMap";
import { KpiCard } from "./KpiCard";
import { MethodSection } from "./MethodSection";
import { Ranking } from "./Ranking";
import { StatusDot } from "./StatusDot";
import { AccordionSection } from "./ui/accordion";
import { Card } from "./ui/card";

const UNIFORM_WEEKEND = "Si fos uniforme seria 28,6 %";

interface Props { barri: Barri; meta: Meta; range: Range; baseYear: string }

/** Summary, KPI row, map + ranking, chart, data table and method for one barri and period. */
export function BarriView({ barri, meta, range, baseYear }: Props) {
  const shown = useMemo(() => inRange(barri.months, range.from, range.to), [barri, range]);
  const summary = useMemo(() => summarise(shown), [shown]);
  const change = useMemo(() => periodChange(barri.months, range.from, range.to), [barri, range]);
  const homes = useMemo(() => periodHomes(shown), [shown]);
  const pilot = useMemo(() => meta.pilots.find((p) => p.code === barri.code), [meta, barri]);
  const rent = useMemo(() => periodRent(shown), [shown]);
  const residents = useMemo(() => periodResidents(shown), [shown]);
  const single = range.from === range.to;
  const noData = summary.visitors.state === "absent";

  const cards = [
    <KpiCard key="v" title="Visitants regionals" value={summary.visitors} format="int"
             note={single ? "Visitants únics del mes" : "Mitjana mensual de visitants únics"} />,
    change.state !== "absent"
      ? <KpiCard key="c" title="Canvi vs any anterior" value={change} format="signedPct" note="vs mateixos mesos de l'any anterior" />
      : null,
    summary.weekendShare.state !== "absent"
      ? <KpiCard key="w" title="Quota de cap de setmana" value={summary.weekendShare} format="pct" note={UNIFORM_WEEKEND} />
      : null,
    rent.state !== "absent"
      ? <KpiCard key="r" title="Lloguer €/m²" value={rent} format="euroM2" note="Mitjana del període (fiances, trimestral)" />
      : null,
  ].filter(Boolean);
  const contextCards = [
    residents.state !== "absent"
      ? <KpiCard key="res" title="Residents" value={residents} format="int" note="Padró municipal a 1 de gener" />
      : null,
    barri.context.hut_per_1000.state !== "absent"
      ? <KpiCard key="hut" title="HUT per 1.000 residents" value={barri.context.hut_per_1000} format="dec1"
                 note="Habitatges d'ús turístic, 2025T2" />
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="barri-title" className="flex flex-col gap-2">
        <h2 id="barri-title" className="m-0 text-title font-semibold text-navy">{barri.name}</h2>
        <p className="m-0 max-w-[880px] text-section font-normal text-navy">{summarySentence(barri.name, shown, range.from, range.to)}</p>
      </section>

      {noData ? (
        <Card role="status" className="bg-surface text-body text-text-2">
          No hi ha dades per a {single ? "aquest mes" : "aquest període"}. Prova un altre període.
        </Card>
      ) : (
        <>
          <section aria-labelledby="kpis-title">
            <h2 id="kpis-title" className="sr-only">Indicadors</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
                 style={{ ["--n" as string]: cards.length }}>
              {cards}
            </div>
          </section>

          {contextCards.length ? (
            <section aria-labelledby="context-title" className="flex flex-col gap-3">
              <h2 id="context-title" className="m-0 text-section font-semibold text-navy">Context del barri</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{contextCards}</div>
            </section>
          ) : null}

          <section aria-labelledby="homes-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="homes-title" className="m-0 text-section font-semibold text-navy">On viuen els visitants</h2>
                <p className="m-0 text-caption text-text-2">Mitjana mensual del període per municipi de residència (no es sumen mesos).</p>
              </div>
              <StatusDot value={summary.visitors} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr] lg:items-stretch">
              <HomesMap homes={homes} pilot={pilot} />
              <Card className="h-full">
                <h3 className="m-0 mb-3 text-body font-semibold text-navy">Principals municipis</h3>
                <Ranking homes={homes} />
              </Card>
            </div>
          </section>

          <section aria-labelledby="series-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="series-title" className="m-0 text-section font-semibold text-navy">Evolució mensual</h2>
              <StatusDot value={summary.visitors} />
            </div>
            <Card><EvolutionChart all={barri.months} from={range.from} to={range.to} baseYear={baseYear} /></Card>
          </section>
        </>
      )}

      <div className="flex flex-col gap-3">
        <AccordionSection value="data" title="Veure les dades">
          <DataTable months={shown} all={barri.months} baseYear={baseYear} />
        </AccordionSection>
        <AccordionSection value="method" title="Mètode i limitacions">
          <MethodSection meta={meta} />
        </AccordionSection>
      </div>
    </div>
  );
}
