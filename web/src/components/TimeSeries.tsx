import { formatInt, formatMonth } from "../format";
import { inRange } from "../range";
import type { BarriMonth } from "../types";

const W = 640;
const H = 220;
const PAD = { left: 56, right: 12, top: 12, bottom: 28 };
const DEFAULT_BASE_YEAR = "2023";

interface Props {
  months: BarriMonth[];
  from: string;
  to: string;
  baseYear?: string;
}

const val = (m: BarriMonth | undefined) =>
  m && m.visitors.state === "published" ? m.visitors.value : null;

export function TimeSeries({ months, from, to, baseYear = DEFAULT_BASE_YEAR }: Props) {
  const shown = inRange(months, from, to);
  const base = new Map(months.filter((m) => m.month.startsWith(baseYear)).map((m) => [m.month.slice(5), m]));
  const rows = shown.map((m) => ({ m, v: val(m), b: val(base.get(m.month.slice(5))) }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.v ?? 0, r.b ?? 0]));
  const x = (i: number) => PAD.left + (rows.length <= 1 ? 0 : (i * (W - PAD.left - PAD.right)) / (rows.length - 1));
  const y = (n: number) => H - PAD.bottom - (n / max) * (H - PAD.top - PAD.bottom);
  const path = (key: "v" | "b") =>
    rows
      .map((r, i) => { const n = r[key]; return n === null ? null : `${x(i)},${y(n)}`; })
      .filter((p): p is string => p !== null)
      .join(" ");

  return (
    <figure className="series">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`Visitants regionals per mes, comparat amb el mateix mes de ${baseYear}, amb marques de festius`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="axis" />
        <text x={PAD.left - 6} y={y(max)} className="tick" textAnchor="end">{formatInt(max)}</text>
        <text x={PAD.left - 6} y={H - PAD.bottom} className="tick" textAnchor="end">0</text>
        {rows.map((r, i) =>
          r.m.holidays.length ? (
            <g key={`h${r.m.month}`} data-testid="holiday-marker">
              <title>{`Festius ${formatMonth(r.m.month)}: ${r.m.holidays.join(", ")}`}</title>
              <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={H - PAD.bottom} className="holiday" />
            </g>
          ) : null,
        )}
        <polyline points={path("b")} className="line line--base" />
        <polyline points={path("v")} className="line line--main" />
        {rows.length ? (
          <>
            <text x={x(0)} y={H - 8} className="tick">{rows[0].m.month}</text>
            <text x={x(rows.length - 1)} y={H - 8} className="tick" textAnchor="end">{rows[rows.length - 1].m.month}</text>
          </>
        ) : null}
      </svg>
      <figcaption>
        <span className="legend legend--main">Visitants regionals</span>
        <span className="legend legend--base">Mateix mes de {baseYear}</span>
        <span className="legend legend--holiday">Mes amb festius</span>
      </figcaption>
      <details>
        <summary>Veure les dades</summary>
        <table>
          <thead>
            <tr><th scope="col">Mes</th><th scope="col">Visitants</th><th scope="col">Mateix mes {baseYear}</th><th scope="col">Festius</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m.month}>
                <th scope="row">{formatMonth(r.m.month)}</th>
                <td>{r.v === null ? "Sense dada" : formatInt(r.v)}</td>
                <td>{r.b === null ? "—" : formatInt(r.b)}</td>
                <td>{r.m.holidays.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
