import { formatInt } from "../format";
import type { Home } from "../types";

export function HomesList({ homes }: { homes: Home[] }) {
  if (homes.length === 0) return <p>Sense dades de residència per a aquest mes.</p>;
  return (
    <ol className="homes" aria-label="Municipis de residència dels visitants">
      {homes.map((h) => (
        <li key={h.code}>
          <span>{h.name}</span>
          <span className="homes__n">{formatInt(h.visitors)}</span>
        </li>
      ))}
    </ol>
  );
}
