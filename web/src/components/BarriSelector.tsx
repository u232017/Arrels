interface Props {
  pilots: { code: string; name: string }[];
  value: string;
  onChange: (code: string) => void;
}

export function BarriSelector({ pilots, value, onChange }: Props) {
  return (
    <label className="field">
      <span>Barri</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {pilots.map((p) => (
          <option key={p.code} value={p.code}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}
