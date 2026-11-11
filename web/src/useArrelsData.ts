import { useEffect, useState } from "react";
import { loadBarri, loadMeta } from "./data";
import type { Barri, Meta } from "./types";

const DEFAULT_MONTHS_SHOWN = 12;

export type Range = { from: string; to: string };

/** Keep the current range if the barri has both months; otherwise show its last 12 months. */
export function fitRange(current: Range | null, months: string[]): Range | null {
  if (months.length === 0) return null;
  if (current && months.includes(current.from) && months.includes(current.to)) return current;
  return { from: months[Math.max(0, months.length - DEFAULT_MONTHS_SHOWN)], to: months[months.length - 1] };
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** Loads meta and the selected barri; ignores late responses for a barri no longer selected. */
export function useArrelsData(dataDir: string) {
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
    let cancelled = false;
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

  return { meta, code, setCode, barri, range, setRange, error, loading };
}
