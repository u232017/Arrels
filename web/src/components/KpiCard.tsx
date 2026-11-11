import { useId } from "react";
import { formatInt, formatPct, formatSignedPct } from "../format";
import type { Value } from "../types";
import { CoverageBadge } from "./CoverageBadge";

export type KpiFormat = "int" | "pct" | "signedPct";

const FORMATTERS: Record<KpiFormat, (n: number) => string> = {
  int: formatInt,
  pct: formatPct,
  signedPct: formatSignedPct,
};

interface Props {
  title: string;
  value: Value;
  format: KpiFormat;
  note?: string;
}

export function KpiCard({ title, value, format, note }: Props) {
  const id = useId();
  const shown =
    value.state === "published" && value.value !== null
      ? FORMATTERS[format](value.value)
      : value.state === "suppressed" ? "<15" : "Sense dada";
  return (
    <article className="kpi" aria-labelledby={id}>
      <h3 id={id} className="kpi__title">{title}</h3>
      <p className="kpi__value">{shown}</p>
      {note ? <p className="kpi__note">{note}</p> : null}
      <CoverageBadge value={value} />
    </article>
  );
}
