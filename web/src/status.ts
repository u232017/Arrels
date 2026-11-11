import type { Value } from "./types";

export type Tone = "ok" | "partial" | "none";
export interface Status { tone: Tone; label: string }

/** Coverage status for the dot: green published, amber partly <15 / partial, grey no data. */
export function statusOf(v: Value): Status {
  if (v.state === "absent" || v.value === null) return { tone: "none", label: "Sense dada" };
  if (v.state === "suppressed" || v.badge.pct_suppressed > 0) return { tone: "partial", label: "Parcialment <15" };
  if (v.badge.pct_absent > 0) return { tone: "partial", label: "Dades parcials" };
  return { tone: "ok", label: "Publicat" };
}

const pct = (n: number) => `${Math.round(n)} %`;

/** Full coverage details: only in tooltips and the data table, never as a line on screen. */
export function coverageText(v: Value): string {
  const b = v.badge;
  const routes = b.n_routes !== undefined ? ` · ${b.n_routes} rutes` : "";
  return `Finestra ${b.window} · ${pct(b.pct_published)} publicat · ${pct(b.pct_suppressed)} <15 · ${pct(b.pct_absent)} sense fila${routes}`;
}
