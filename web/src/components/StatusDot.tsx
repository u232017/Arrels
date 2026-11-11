import { coverageText, statusOf, type Tone } from "../status";
import type { Value } from "../types";
import { Tooltip } from "./ui/tooltip";

const DOT: Record<Tone, string> = { ok: "bg-ok", partial: "bg-partial", none: "bg-none" };

/** Small coverage status: coloured dot + short label; full details in a tooltip (keyboard too). */
export function StatusDot({ value }: { value: Value }) {
  const s = statusOf(value);
  return (
    <Tooltip content={coverageText(value)}>
      <button type="button" data-testid="coverage-badge"
              className="inline-flex items-center gap-1.5 rounded-md text-caption text-text-2 hover:text-navy"
              aria-label={`${s.label}. ${coverageText(value)}`}>
        <span aria-hidden="true" className={`size-2 rounded-full ${DOT[s.tone]}`} />
        {s.label}
      </button>
    </Tooltip>
  );
}
