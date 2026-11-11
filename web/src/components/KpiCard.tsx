import { useId } from "react";
import { formatInt, formatPct, formatSignedPct } from "../format";
import type { Value } from "../types";
import { StatusDot } from "./StatusDot";
import { Card } from "./ui/card";

export type KpiFormat = "int" | "pct" | "signedPct" | "euro";

const FORMATTERS: Record<KpiFormat, (n: number) => string> = {
  int: formatInt,
  pct: formatPct,
  signedPct: formatSignedPct,
  euro: (n) => `${n.toFixed(1).replace(".", ",")} €`,
};

interface Props {
  title: string;
  value: Value;
  format: KpiFormat;
  note?: string;
}

/** Label, value, one short line of context and a coverage status dot. */
export function KpiCard({ title, value, format, note }: Props) {
  const id = useId();
  const shown =
    value.state === "published" && value.value !== null
      ? FORMATTERS[format](value.value)
      : value.state === "suppressed" ? "<15" : "Sense dada";
  return (
    <Card aria-labelledby={id} className="flex flex-col gap-1">
      <h3 id={id} className="m-0 text-body font-medium text-text-2">{title}</h3>
      <p className="m-0 text-kpi font-semibold tabular-nums text-navy">{shown}</p>
      {note ? <p className="m-0 text-caption text-text-2">{note}</p> : null}
      <div className="mt-1"><StatusDot value={value} /></div>
    </Card>
  );
}
