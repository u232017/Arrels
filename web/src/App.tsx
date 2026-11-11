import { useEffect, useMemo, useState } from "react";
import { BarriSelector } from "./components/BarriSelector";
import { CoverageBadge } from "./components/CoverageBadge";
import { HomesList } from "./components/HomesList";
import { HomesMap } from "./components/HomesMap";
import { KpiCard } from "./components/KpiCard";
import { MethodSection } from "./components/MethodSection";
import { MonthRange } from "./components/MonthRange";
import { TimeSeries } from "./components/TimeSeries";
import { DATA_DIR, loadBarri, loadMeta } from "./data";
import { formatMonth } from "./format";
import { inRange, summarise } from "./range";
import type { Barri, Home, Meta } from "./types";

const DEFAULT_MONTHS_SHOWN = 12;
const NO_HOMES: Home[] = [];

type Range = { from: string; to: string };

/** Keep the current range if the barri has both months; otherwise show its last 12 months. */
function fitRange(current: Range | null, months: string[]): Range | null {
  if (months.length === 0) return null;
  if (current && months.includes(current.from) && months.includes(current.to)) return current;
  return { from: months[Math.max(0, months.length - DEFAULT_MONTHS_SHOWN)], to: months[months.length - 1] };
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export function App({ dataDir = DATA_DIR }: { dataDir?: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [code, setCode] = useState<string>("");
  const [barri, setBarri] = useState<Barri | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    loadMeta(dataDir, ctrl.signal)
      .then((m) => { setMeta(m); setCode(m.pilots[0]?.code ?? ""); })
      .catch((e: Error) => { if (!isAbort(e)) { setError(e.message); setLoading(false); } });
    return () => ctrl.abort();
  }, [dataDir]);

  useEffect(() => {
    if (!code) return;
    const ctrl = new AbortController();
    let cancelled = false; // ignore late responses for a barri that is no longer selected
    setLoading(true);
    setError(null);
    loadBarri(dataDir, code, ctrl.signal)
      .then((b) => {
        if (cancelled) return;
        setBarri(b);
        setRange((r) => fitRange(r, b.months.map((m) => m.month)));
      })
      .catch((e: Error) => { if (!cancelled && !isAbort(e)) { setBarri(null); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [dataDir, code]);

  const shown = useMemo(() => (barri && range ? inRange(barri.months, range.from, range.to) : []), [barri, range]);
  const summary = useMemo(() => summarise(shown), [shown]);
  const lastMonth = shown.length ? shown[shown.length - 1] : undefined;
  const yoyMonth = [...shown].reverse().find((m) => m.yoy.state === "published");
  const baseYear = meta?.window.start.slice(0, 4) ?? "";

  return (
    <>
      <header className="top">
        <h1>Arrels</h1>
        <p className="top__lead">Patrons de visitants regionals en tres barris de Barcelona, a partir de dades de mobilitat agregades.</p>
      </header>
      <main className="page">
        {loading ? <p role="status" className="status">Carregant dades…</p> : null}
        {error ? <p role="alert" className="error">{error}</p> : null}
        {meta ? (
          <section className="controls" aria-label="Filtres">
            <BarriSelector pilots={meta.pilots} value={code} onChange={setCode} />
            {barri && range ? (
              <MonthRange months={barri.months.map((m) => m.month)} from={range.from} to={range.to}
                          onChange={(from, to) => setRange({ from, to })} />
            ) : null}
          </section>
        ) : null}
        {meta && barri && range ? (
          <>
            <h2 className="barri-name">{barri.name}</h2>

            <section className="kpis" aria-labelledby="kpis-title">
              <h2 id="kpis-title" className="visually-hidden">Indicadors</h2>
              <KpiCard title="Visitants regionals únics" value={summary.visitors} format="int" note="Mitjana mensual del període" />
              <KpiCard title={`Canvi respecte al mateix mes de ${baseYear}`} value={summary.yoy} format="signedPct"
                       note={yoyMonth ? `Mes: ${formatMonth(yoyMonth.month)}` : "Cap mes amb dada"} />
              <KpiCard title="Quota de cap de setmana" value={summary.weekendShare} format="pct" note="Viatges regionals; setmana uniforme = 28,6 %" />
              <KpiCard title="Lloguer mitjà trimestral" value={barri.context.rent} format="int" note="Pendent d'integrar" />
              <KpiCard title="Residents" value={barri.context.residents} format="int" note="Pendent d'integrar" />
              <KpiCard title="HUT per 1.000 residents (2025T2)" value={barri.context.hut_per_1000} format="int" note="Pendent d'integrar" />
            </section>

            <section className="homes-panel" aria-labelledby="homes-title">
              <h2 id="homes-title">On viuen els visitants · {lastMonth ? formatMonth(lastMonth.month) : ""}</h2>
              <p className="hint">Visitants únics d'un sol mes (no es poden sumar mesos).</p>
              {lastMonth ? <CoverageBadge value={lastMonth.visitors} /> : null}
              <div className="homes-grid">
                <HomesMap homes={lastMonth?.homes ?? NO_HOMES} />
                <HomesList homes={lastMonth?.homes ?? NO_HOMES} />
              </div>
            </section>

            <section aria-labelledby="series-title">
              <h2 id="series-title">Evolució mensual</h2>
              <CoverageBadge value={summary.visitors} />
              <TimeSeries months={barri.months} from={range.from} to={range.to} baseYear={baseYear} />
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
