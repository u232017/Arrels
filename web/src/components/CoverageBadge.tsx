import type { Value } from "../types";

const STATE_LABEL: Record<Value["state"], string> = {
  published: "Publicat",
  suppressed: "<15",
  absent: "Sense dada",
};

export function CoverageBadge({ value }: { value: Value }) {
  const b = value.badge;
  const pct = (n: number) => `${Math.round(n)} %`;
  return (
    <p className={`badge badge--${value.state}`} data-testid="coverage-badge">
      <span className="badge__state">{STATE_LABEL[value.state]}</span>{" "}
      <span>
        Finestra {b.window} · {pct(b.pct_published)} publicat · {pct(b.pct_suppressed)} &lt;15 ·{" "}
        {pct(b.pct_absent)} sense fila
        {b.n_routes !== undefined ? ` · ${b.n_routes} rutes` : ""}
      </span>
    </p>
  );
}
