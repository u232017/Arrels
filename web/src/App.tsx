import { BarriSelector } from "./components/BarriSelector";
import { BarriView } from "./components/BarriView";
import { MethodSection } from "./components/MethodSection";
import { MonthRange } from "./components/MonthRange";
import { DATA_DIR } from "./data";
import { useArrelsData } from "./useArrelsData";

export function App({ dataDir = DATA_DIR }: { dataDir?: string }) {
  const { meta, code, setCode, barri, range, setRange, error, loading } = useArrelsData(dataDir);
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
        {barri && range ? <BarriView barri={barri} range={range} baseYear={baseYear} /> : null}
        {meta ? <MethodSection meta={meta} /> : null}
      </main>
      <footer className="foot">
        <p>Barri Lab (201_F, UPF) · Telefónica Mobile Data Challenge 2026 · Dades agregades; cap valor per sota de 15.</p>
      </footer>
    </>
  );
}
