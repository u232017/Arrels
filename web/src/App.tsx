import { BarriView } from "./components/BarriView";
import { Footer } from "./components/Footer";
import { TopBar } from "./components/TopBar";
import { Skeleton } from "./components/ui/skeleton";
import { TooltipProvider } from "./components/ui/tooltip";
import { DATA_DIR } from "./data";
import { useArrelsData } from "./useArrelsData";

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Carregant dades…" className="flex flex-col gap-6">
      <span className="sr-only">Carregant dades…</span>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-14 w-full max-w-[880px]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
      </div>
      <Skeleton className="h-[480px]" />
      <Skeleton className="h-[320px]" />
    </div>
  );
}

export function App({ dataDir = DATA_DIR }: { dataDir?: string }) {
  const { meta, code, setCode, barri, range, setRange, error, loading } = useArrelsData(dataDir);
  const baseYear = meta?.window.start.slice(0, 4) ?? "";

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-white text-body text-navy">
        <TopBar meta={meta} code={code} onCode={setCode} months={barri?.months.map((m) => m.month) ?? []}
                range={range} onRange={setRange} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {error ? <p role="alert" className="mb-6 rounded-card border border-line bg-surface p-4 text-body text-navy">{error}</p> : null}
          {loading ? <LoadingSkeleton /> : null}
          {!loading && meta && barri && range ? <BarriView barri={barri} meta={meta} range={range} baseYear={baseYear} /> : null}
        </main>
        <Footer meta={meta} />
      </div>
    </TooltipProvider>
  );
}
