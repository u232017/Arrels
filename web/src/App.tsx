import { useEffect, useMemo, useState } from "react";
import { BarriSelector } from "./components/BarriSelector";
import { HomesList } from "./components/HomesList";
import { HomesMap } from "./components/HomesMap";
import { KpiCard } from "./components/KpiCard";
import { MethodSection } from "./components/MethodSection";
import { MonthRange } from "./components/MonthRange";
import { TimeSeries } from "./components/TimeSeries";
import { DATA_DIR, loadBarri, loadMeta } from "./data";
import { formatMonth } from "./format";
import { inRange, summarise } from "./range";
import type { Barri, Meta } from "./types";

const DEFAULT_MONTHS_SHOWN = 12;

export function App({ dataDir = DATA_DIR }: { dataDir?: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [code, setCode] = useState<string>("");
  const [barri, setBarri] = useState<Barri | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMeta(dataDir)
      .then((m) => { setMeta(m); setCode(m.pilots[0]?.code ?? ""); })
      .catch((e: Error) => setError(e.message));
  }, [dataDir]);

  useEffect(() => {
    if (!code) return;
    loadBarri(dataDir, code)
      .then((b) => {
        setBarri(b);
        setRange((r) => {
          if (r) return r;
          const months = b.months.map((m) => m.month);
          return { from: months[Math.max(0, months.length - DEFAULT_MONTHS_SHOWN)], to: months[months.length - 1] };
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [dataDir, code]);

  const shown = useMemo(() => (barri && range ? inRange(barri.months, range.from, range.to) : []), [barri, range]);
  const summary = useMemo(() => summarise(shown), [shown]);
  const lastMonth = shown[shown.length - 1];

  return (
    <>
      <header className="top">
        <h1>Arrels</h1>
        <p className="top__lead">Patrons de visitants regionals en tres barris de Barcelona, a partir de dades de mobilitat agregades.</p>
      </header>
      <main className="page">
        {error ? <p role="alert" className="error">{error}</p> : null}
        {meta && barri && range ? (
          <>
            <section className="controls" aria-label="Filtres">
              <BarriSelector pilots={meta.pilots} value={code} onChange={setCode} />
              <MonthRange months={barri.months.map((m) => m.month)} from={range.from} to={range.to}
                          onChange={(from, to) => setRange({ from, to })} />
            </section>

            <h2 className="barri-name">{barri.name}</h2>

            <section className="kpis" aria-labelledby="kpis-title">
              <h2 id="kpis-title" className="visually-hidden">Indicadors</h2>
              <KpiCard title="Visitants regionals únics" value={summary.visitors} format="int" note="Mitjana mensual del període" />
              <KpiCard title="Canvi respecte al mateix mes de 2023" value={summary.yoy} format="signedPct" note="Últim mes amb dada" />
              <KpiCard title="Quota de cap de setmana" value={summary.weekendShare} format="pct" note="Viatges regionals; setmana uniforme = 28,6 %" />
              <KpiCard title="Lloguer mitjà trimestral" value={barri.context.rent} format="int" note="Pendent d'integrar" />
              <KpiCard title="Residents" value={barri.context.residents} format="int" note="Pendent d'integrar" />
              <KpiCard title="HUT per 1.000 residents (2025T2)" value={barri.context.hut_per_1000} format="int" note="Pendent d'integrar" />
            </section>

            <section className="homes-panel" aria-labelledby="homes-title">
              <h2 id="homes-title">On viuen els visitants · {lastMonth ? formatMonth(lastMonth.month) : ""}</h2>
              <p className="hint">Visitants únics d'un sol mes (no es poden sumar mesos).</p>
              <div className="homes-grid">
                <HomesMap homes={lastMonth?.homes ?? []} />
                <HomesList homes={lastMonth?.homes ?? []} />
              </div>
            </section>

            <section aria-labelledby="series-title">
              <h2 id="series-title">Evolució mensual</h2>
              <TimeSeries months={barri.months} from={range.from} to={range.to} />
              <p className="hint">Lloguer: pendent d'integrar (sense dades encara).</p>
            </section>
          </>
        ) : null}
        {meta ? <MethodSection meta={meta} /> : null}
      </main>
      <footer className="foot">
        <p>Barri Lab (201_F, UPF) · Telefónica Mobile Data Challenge 2026 · Dades agregades; cap valor per sota de 15.</p>
      </footer>
    </>
  );
}
