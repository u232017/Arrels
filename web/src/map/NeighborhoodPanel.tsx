import { ArrowRight, X } from "lucide-react";
import { formatInt, formatMonth, formatPct, formatSignedPct } from "../format";
import { Housing } from "./Housing";
import { Series } from "./Series";
import { BASE_MONTH, FLOW_SOURCES, MONTHS, PRICE, priceAt, priceInQuarter, priceLabel, quarter, titleCase, visitorChange, type Area, type FlowSource, type InboundRanking, type Mobility, type Price, type Reference } from "./model";

interface PanelProps {
  area: Area;
  reference: Reference;
  mobility: Mobility | null;
  month: string;
  price: Price;
  flowSource: FlowSource;
  inbound: InboundRanking | null;
  onClose: () => void;
  onCompare: () => void;
  onHighlight: (town: string | null) => void;
}

export function NeighborhoodPanel({
  area, reference, mobility, month, price, flowSource, inbound, onClose, onCompare, onHighlight,
}: PanelProps) {
  const series = mobility?.areas[area.id];
  const current = series?.[month];
  const change = visitorChange(series, month);
  const propertyPrice = priceAt(area, reference.quarters, month, price);
  const baselinePrice = priceAt(area, reference.quarters, BASE_MONTH, price);
  const priceChange = propertyPrice.value != null && baselinePrice.value && propertyPrice.scope === baselinePrice.scope
    ? propertyPrice.value / baselinePrice.value - 1 : null;
  const baseline = month === BASE_MONTH;
  const ranking = inbound?.ranked ?? [];
  const rest = inbound ? inbound.total - ranking.reduce((sum, item) => sum + item.n, 0) : 0;
  const highest = ranking[0]?.share ?? 0;
  const flow = FLOW_SOURCES[flowSource];
  const municipal = flowSource === "municipalities";
  const annual = flowSource === "moves";
  const period = annual ? month.slice(0, 4) : formatMonth(month);
  const type = PRICE[price];
  const q = quarter(month);
  const formattedPrice = (n: number) => `${priceLabel(n, price)} €`;
  return <aside className="atlas-panel" aria-label="Fitxa de barri">
    <header className="atlas-panel-head">
      <div><h1>{titleCase(area.name)}</h1><p>{reference.districts[area.district]} · <time dateTime={month}>{formatMonth(month)}</time></p></div>
      <button type="button" className="atlas-icon" aria-label="Tanca la fitxa" onClick={onClose}><X size={19} /></button>
    </header>
    <div className="atlas-kpis">
      <article><h2>Canvi de visitants</h2><strong>{change != null ? formatSignedPct(change) : "—"}</strong>
        <p>{baseline ? "Període de referència" : "Respecte al gener del 2023"}</p></article>
      <article><h2>{type.label} / m²</h2><strong>{propertyPrice.value != null ? formattedPrice(propertyPrice.value) : "—"}</strong>
        <p>{propertyPrice.value == null ? `${q.replace("Q", " T")} · Sense dada` : !baseline && priceChange != null
          ? `${formatSignedPct(priceChange)} vs. 2023 T1` : q.replace("Q", " T")}</p>
        {propertyPrice.scope && <p>Àmbit ampliat</p>}</article>
      <article><h2>Visitants regionals</h2><strong>{current ? formatInt(current.visitors) : "—"}</strong>
        <p>Residència coneguda, fora de Barcelona</p></article>
    </div>
    <Series title="Evolució dels visitants" note="Respecte al gener del 2023"
      source={MONTHS.slice(1).map((m) => ({ label: m, value: visitorChange(series, m) }))}
      active={month} format={formatSignedPct} color="#bd362b" zero />
    <Series title={`${type.label} per m²`} note={`${type.unit} · trimestral`}
      source={reference.quarters.map((period, i) => ({ label: period, ...priceInQuarter(area, i, price) }))}
      active={q} format={formattedPrice} color="#575a53" />
    {propertyPrice.scope && <p className="atlas-muted">Àmbit de la font: {propertyPrice.scope}.</p>}
    <section aria-label={municipal ? "Procedència dels visitants" : flow.heading}>
      <div className="atlas-section-title">
        <h3>{flow.heading}</h3>
        <span>{municipal ? "Quota de visitants" : `${annual ? "Padró" : "Telefónica"} · ${period}`}</span>
      </div>
      {ranking.length ? <ul className="atlas-ranking">
        {ranking.map((origin) => <li key={origin.id}>
          <button type="button" title={`${formatInt(origin.n)} ${flow.unit} publicats`}
            onFocus={() => onHighlight(origin.id)} onBlur={() => onHighlight(null)}
            onPointerEnter={() => onHighlight(origin.id)} onPointerLeave={() => onHighlight(null)}
            onClick={() => onHighlight(origin.id)}>
            <span>{origin.name}{!municipal && <small className="atlas-origin-count"> · {formatInt(origin.n)}</small>}</span>
            <span className="atlas-rank-bar" aria-hidden="true"><i style={{ width: `${origin.share / highest * 100}%` }} /></span>
            <strong>{formatPct(origin.share)}</strong>
          </button>
        </li>)}
        {inbound && rest > 0 && <li className="atlas-rank-rest">
          <span>{flow.others}{!municipal && <small className="atlas-origin-count"> · {formatInt(rest)}</small>}</span><span aria-hidden="true" />
          <strong>{formatPct(rest / inbound.total)}</strong>
        </li>}
      </ul> : <p className="atlas-muted">Sense procedències publicades per a {period}.</p>}
      {!municipal && inbound && <p className="atlas-muted">
        {formatInt(inbound.total)} {flow.unit} publicats des d’altres barris.
        {annual && ` ${inbound.suppressed ?? 0} orígens censurats (<5) i ${inbound.missing ?? 0} sense registre.`}
      </p>}
    </section>
    <Housing />
    <button className="atlas-primary" type="button" onClick={onCompare}>Compara lloguers <ArrowRight size={17} aria-hidden="true" /></button>
  </aside>;
}
