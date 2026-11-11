import { formatMonth } from "../format";

interface Props {
  months: string[];
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export function MonthRange({ months, from, to, onChange }: Props) {
  const options = months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>);
  return (
    <fieldset className="range">
      <legend>Període</legend>
      <label className="field">
        <span>Des de</span>
        <select value={from} onChange={(e) => { const f = e.target.value; onChange(f, f > to ? f : to); }}>
          {options}
        </select>
      </label>
      <label className="field">
        <span>Fins a</span>
        <select value={to} onChange={(e) => { const t = e.target.value; onChange(t < from ? t : from, t); }}>
          {options}
        </select>
      </label>
    </fieldset>
  );
}
