import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth, formatSignedPct } from "../format";
import { BASE_MONTH, MONTHS, median, visitorChange, type Mobility } from "./model";

export interface Datum {
  label: string;
  value: number | null;
  scope?: string | null;
}

const normalLabel = (label: string) => label.includes("Q") ? label.replace("Q", " T") : formatMonth(label);
const neighborhoodValue = (item: Datum) => item.scope ? null : item.value;
const expandedValue = (item: Datum) => item.scope ? item.value : null;

export function Series({ title, note, source, active, format, color, zero }: {
  title: string;
  note: string;
  source: Datum[];
  active: string;
  format: (n: number) => string;
  color: string;
  zero?: boolean;
}) {
  const current = source.find((item) => item.label === active);
  const ticks = [source[0]?.label, source[Math.floor(source.length / 2)]?.label, source.at(-1)?.label].filter((label): label is string => label !== undefined);
  return (
    <section className="atlas-series" aria-label={title}>
      <div className="atlas-section-title"><h3>{title}</h3><span>{note}</span></div>
      {source.some((item) => item.value !== null) &&
        <div className="atlas-chart" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: 112 }}>
            <AreaChart data={source} margin={{ left: -4, right: 12, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e4e1da" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} ticks={ticks}
                tick={{ fontSize: 10, fill: "#706f67" }} tickFormatter={(value: string) => value.includes("Q")
                  ? normalLabel(value) : `${normalLabel(value).slice(0, 3)} ${value.slice(2, 4)}`} />
              <YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#706f67" }}
                tickCount={3} tickFormatter={format} domain={zero ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ["auto", "auto"]} />
              {zero && <ReferenceLine y={0} stroke="#a39b92" strokeDasharray="3 3" />}
              <Tooltip labelFormatter={(value) => normalLabel(String(value))}
                formatter={(value, name) => [value == null ? "Sense dades" : format(Number(value)), name]} />
              <Area type="linear" dataKey={neighborhoodValue} name={title} stroke={color} fill={color} fillOpacity={zero ? 0.12 : 0.04}
                strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              {source.some((item) => item.scope) && <Area type="linear" dataKey={expandedValue} name="Àmbit ampliat"
                stroke={color} strokeDasharray="4 3" fill="none" dot={{ r: 2 }} isAnimationActive={false} connectNulls={false} />}
              {current?.value != null && <ReferenceDot x={active} y={current.value} r={4} stroke="#fff" fill={color} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>}
      <details className="atlas-chart-values">
        <summary>Veure valors</summary>
        <dl>{source.map((item) => <div key={item.label}><dt>{normalLabel(item.label)}</dt>
          <dd>{item.value === null ? "Sense dada publicada" : format(item.value)}
            {item.scope && <small>{item.scope}</small>}</dd></div>)}</dl>
      </details>
    </section>
  );
}

export function CityTrend({ mobility, index }: { mobility: Mobility | null; index: number }) {
  const values = MONTHS.map((month) => median(Object.values(mobility?.areas ?? {})
    .flatMap((area) => {
      const change = visitorChange(area, month);
      return change == null ? [] : [change];
    })));
  const limit = Math.max(0.1, ...values.map((v) => Math.abs(v ?? 0)));
  const coordinate = (i: number, v: number) => [i * 310 / (MONTHS.length - 1), 16 - 13 * v / limit];
  const paths: string[] = [];
  let part: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (part.length) paths.push(part.join(" "));
      part = [];
    } else {
      part.push(`${part.length ? "L" : "M"}${coordinate(i, v).join(",")}`);
    }
  });
  if (part.length) paths.push(part.join(" "));
  const active = values[index];
  return (
    <div className="atlas-trend">
      <div className="atlas-trend-label">Canvi medià dels barris · base gener del 2023 <strong>{active != null ? formatSignedPct(active) : MONTHS[index] === BASE_MONTH ? "Referència" : "—"}</strong></div>
      <svg viewBox="0 0 310 32" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 16H310" stroke="#ccc6ba" strokeDasharray="3 3" />
        {paths.map((d) => <path key={d} d={d} stroke="#be3c31" fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />)}
        {active !== null && <circle cx={coordinate(index, active)[0]} cy={coordinate(index, active)[1]} r="2.7" fill="#b53529" />}
      </svg>
    </div>
  );
}
