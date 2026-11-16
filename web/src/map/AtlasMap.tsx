import { useMemo, useState } from "react";
import { formatPct, formatSignedPct } from "../format";
import { BASE_MONTH, FLOW_SOURCES, PRICE, priceAt, priceLabel, titleCase, visitorChange, type Area, type FlowSource, type InboundRanking, type Layer, type Mobility, type Point, type Reference } from "./model";

const WIDTH = 920;
const HEIGHT = 780;
const project = ([lon, lat]: Point): Point => [460 + (lon - 2.145) * 3800, 386 - (lat - 41.393) * 5070];
const pathPoint = (point: Point) => project(point).map((v) => v.toFixed(1)).join(",");
const reds = ["#fbeae6", "#f9d4cc", "#f4a99b", "#ec8071", "#da594a", "#bf372e", "#92251f"];
const teals = ["#e7f0eb", "#cee5dc", "#a7cfc4", "#76aca4", "#408984", "#246962"];
const CHANGE_LIMITS = [0, 0.05, 0.1, 0.2, 0.35, 0.5];

function fillFor(layer: Layer, value: number | null, scope: string | null) {
  if (layer === "none") return "#e8e3d9";
  if (value === null) return "url(#atlas-unavailable)";
  const limits = layer === "change" ? CHANGE_LIMITS : PRICE[layer].limits;
  const stops = layer === "change" ? reds : teals;
  const index = limits.findIndex((limit) => value < limit);
  const band = index < 0 ? stops.length - 1 : index;
  return scope ? `url(#atlas-expanded-${band})` : stops[band];
}

function ringCenter(ring: Point[]): Point {
  const origin = ring[0];
  let x = 0, y = 0, area = 0;
  for (let i = 1; i < ring.length; i++) {
    const [u, v] = ring[i - 1].map((p, k) => p - origin[k]);
    const [s, t] = ring[i].map((p, k) => p - origin[k]);
    const cross = u * t - s * v;
    area += cross;
    x += (u + s) * cross;
    y += (v + t) * cross;
  }
  return project(area ? [origin[0] + x / (3 * area), origin[1] + y / (3 * area)] : origin);
}

function viewEndpoint(center: Point, town: Point) {
  const [x, y] = town;
  const [dx, dy] = [x - center[0], y - center[1]];
  const scale = Math.min(1,
    dx < 0 ? (35 - center[0]) / dx : dx > 0 ? (WIDTH - 35 - center[0]) / dx : 1,
    dy < 0 ? (82 - center[1]) / dy : dy > 0 ? (HEIGHT - 55 - center[1]) / dy : 1);
  return { point: [center[0] + dx * scale, center[1] + dy * scale] as Point, outside: scale < 1 };
}

function MapLegend({ layer, flow, base }: { layer: Layer; flow: string | null; base: boolean }) {
  const isPrice = layer === "rent" || layer === "sale";
  if (layer === "none" && !flow) return null;
  const limits = isPrice ? PRICE[layer].limits.map((n) => priceLabel(n, layer)) : ["0 %", "5 %", "10 %", "20 %", "35 %", "50 %"];
  return <div className="atlas-legend">
    {layer !== "none" && <>
      <strong>{isPrice ? `${PRICE[layer].label} · ${PRICE[layer].unit}` : "Canvi de visitants"}</strong>
      <div className="atlas-ramp" aria-label="Llindars de l’escala de color">
        {(isPrice ? teals : reds).map((color, index) => <span key={color} style={{ background: color }}
          title={index === 0 ? `< ${limits[0]}` : index === limits.length ? `≥ ${limits.at(-1)}` : `${limits[index - 1]} a menys de ${limits[index]}`} />)}
      </div>
      <div className="atlas-legend-range"><span>&lt; {limits[0]}</span><span>≥ {limits.at(-1)}</span></div>
      <div className="atlas-legend-key"><i className="atlas-hatch" />{base && !isPrice ? "Gener de 2023 · referència" : "Sense dada publicada"}</div>
      {isPrice && <div className="atlas-legend-key"><i className="atlas-expanded-key" />Preu d’un àmbit ampliat</div>}
    </>}
    {flow && <div className="atlas-legend-key"><i />Gruix = quota de {flow}</div>}
  </div>;
}

interface Props {
  reference: Reference;
  mobility: Mobility | null;
  month: string;
  selected: Area | undefined;
  onSelect: (id: string) => void;
  layer: Layer;
  onLayer: (layer: Layer) => void;
  flows: boolean;
  onFlows: (enabled: boolean) => void;
  flowSource: FlowSource;
  onFlowSource: (source: FlowSource) => void;
  inbound: InboundRanking | null;
  highlighted: string | null;
}
export function AtlasMap({
  reference, mobility, month, selected, onSelect, layer, onLayer, flows, onFlows, highlighted,
  flowSource, onFlowSource, inbound,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const shapes = useMemo(() => reference.areas.map((area) => ({
    area, center: ringCenter(area.rings[0]), d: area.rings.map((ring) => `M${ring.map(pathPoint).join("L")}Z`).join(""),
  })), [reference]);
  const current = shapes.find(({ area }) => area.id === selected?.id);
  const value = (area: Area) => layer === "rent" || layer === "sale"
    ? priceAt(area, reference.quarters, month, layer)
    : { value: visitorChange(mobility?.areas[area.id], month), scope: null };
  const active = shapes.find(({ area }) => area.id === hover && area.id !== selected?.id);
  const links = current && flows ? (inbound?.ranked ?? []).flatMap((origin) => {
    if (flowSource === "municipalities") {
      return origin.point ? [{ ...origin, ...viewEndpoint(current.center, project(origin.point)) }] : [];
    }
    const shape = shapes.find(({ area }) => area.id === origin.id);
    return shape ? [{ ...origin, point: shape.center, outside: false }] : [];
  }) : [];
  const labels: { x: number; y: number; width: number }[] = [];
  return (
    <div className="atlas-map">
      <div className="atlas-layers" aria-label="Capes del mapa">
        <button className="atlas-toggle" type="button" aria-pressed={layer === "change"} onClick={() => onLayer(layer === "change" ? "none" : "change")}>
          <i aria-hidden="true" />Canvi de visitants
        </button>
        <button className="atlas-toggle" type="button" aria-pressed={flows} onClick={() => onFlows(!flows)}>
          <i aria-hidden="true" />Procedències
        </button>
        <label className="atlas-price-control">
          <select aria-label="Tipus de procedència" value={flowSource}
            onChange={(event) => onFlowSource(event.target.value as FlowSource)}>
            {Object.entries(FLOW_SOURCES).map(([source, description]) =>
              <option key={source} value={source}>{description.label}</option>)}
          </select>
        </label>
        {(["rent", "sale"] as const).map((price) => <button key={price} className="atlas-toggle"
          type="button" aria-pressed={layer === price} onClick={() => onLayer(layer === price ? "change" : price)}>
          <i aria-hidden="true" />{PRICE[price].label} €/m²
        </button>)}
      </div>
      <svg className="atlas-geometry" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group"
        aria-label="Mapa dels 73 barris de Barcelona. També pots seleccionar un barri amb el cercador.">
        <defs>
          <pattern id="atlas-unavailable" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#e8e5dd" /><path d="M-2 2L2 -2M0 6L6 0M4 8L8 4" stroke="#d2ccc2" strokeWidth="1" />
          </pattern>
          {teals.map((color, index) => <pattern key={color} id={`atlas-expanded-${index}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={color} /><path d="M-2 2L2 -2M0 6L6 0M4 8L8 4" stroke="#163d3b" strokeWidth="1" opacity=".48" />
          </pattern>)}
          <marker id="atlas-arrow" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto">
            <path d="M0 0L4 2L0 4Z" fill="#182635" />
          </marker>
        </defs>
        <path d="M1800 -580L920 216L825 302L756 364L715 420L666 461L623 507L583 564L568 610L537 647L489 696L469 752L433 1000H1800Z" fill="#e4edf1" stroke="#d9e3e7" />
        <text x="151" y="295" className="atlas-terrain-label">Collserola</text>
        <text x="731" y="650" className="atlas-sea-label">Mar Mediterrani</text>
        {shapes.map(({ area, d }) => {
          const observation = value(area);
          return <path key={area.id} d={d} fill={fillFor(layer, observation.value, observation.scope)}
          className="atlas-boundary" fillRule="evenodd" data-selected={selected?.id === area.id}
          role="button" aria-label={titleCase(area.name)} aria-pressed={selected?.id === area.id}
          tabIndex={selected?.id === area.id ? 0 : -1} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(area.id); }
          }} onClick={() => onSelect(area.id)} onPointerEnter={() => setHover(area.id)} onPointerLeave={() => setHover(null)} />;
        })}
        {current && <path d={current.d} className="atlas-outline" fill="none" />}
        {current && <g className="atlas-flows" aria-hidden="true">
          {links.map((town, i) => {
            const [x, y] = town.point;
            const [cx, cy] = current.center;
            const dx = cx - x, dy = cy - y;
            const endpoint = [cx - dx * 0.05, cy - dy * 0.05];
            const bend = [x + dx * 0.52 - dy * (0.10 + i * 0.01), y + dy * 0.52 + dx * (0.10 + i * 0.01)];
            return <g key={town.id} opacity={highlighted && highlighted !== town.id ? 0.22 : 1}>
              <path d={`M${x} ${y}Q${bend.join(" ")} ${endpoint.join(" ")}`} fill="none"
                stroke="#182635" strokeWidth={1.2 + town.share * 24} markerEnd="url(#atlas-arrow)" />
              <circle cx={x} cy={y} r="4.5" fill="#182635" stroke="white" strokeWidth="1.8" />
            </g>;
          })}
          {links.map((town) => {
            const text = `${town.name} · ${formatPct(town.share)}${town.outside ? " ↗" : ""}`;
            const width = Math.min(270, text.length * 7.5 + 20);
            const x = Math.max(10, Math.min(WIDTH - width - 10, town.point[0] - width / 2));
            let y = Math.max(73, town.point[1] - 29);
            while (labels.some((label) => Math.abs(label.y - y) < 24 && label.x < x + width && x < label.x + label.width)) y += 25;
            labels.push({ x, y, width });
            return <g key={town.id} opacity={highlighted && highlighted !== town.id ? 0.3 : 1}>
              <rect x={x} y={y} width={width} height="22" rx="11" fill="#161c23" />
              <text x={x + width / 2} y={y + 15} textAnchor="middle" className="atlas-town-label">{text}</text>
            </g>;
          })}
        </g>}
        {current && <g className="atlas-flows" aria-hidden="true">
          <circle cx={current.center[0]} cy={current.center[1]} r="5" fill="#ad3226" stroke="white" strokeWidth="2" />
          <text className="atlas-area-label" x={current.center[0]} y={current.center[1] + 24} textAnchor="middle">{titleCase(current.area.name)}</text>
        </g>}
        {active && <g transform={`translate(${Math.max(8, Math.min(WIDTH - 285, active.center[0] + 12))}, ${Math.max(72, active.center[1] - 58)})`} className="atlas-flows" aria-hidden="true">
          <rect width="275" height="50" rx="8" fill="#fff" stroke="#d6d1c8" />
          <text x="12" y="20" className="atlas-tip-title">{titleCase(active.area.name)}</text>
          <text x="12" y="38" className="atlas-tip-value">{tooltipValue(layer, value(active.area), month)}</text>
        </g>}
      </svg>
      <MapLegend layer={layer} flow={links.length ? `${FLOW_SOURCES[flowSource].unit}${flowSource === "moves" ? ` · ${month.slice(0, 4)}` : ""}` : null}
        base={month === BASE_MONTH} />
      <a className="atlas-map-credit" href="https://opendata-ajuntament.barcelona.cat/data/ca/dataset/20170706-districtes-barris" target="_blank" rel="noreferrer">Cartografia © Open Data BCN</a>
    </div>
  );
}

function tooltipValue(layer: Layer, observation: { value: number | null; scope: string | null }, month: string) {
  const { value, scope } = observation;
  if (layer === "none") return "Obre la fitxa del barri";
  if (layer === "change" && month === BASE_MONTH) return "Període de referència";
  if (value === null) return "Sense dada publicada";
  return layer === "change" ? formatSignedPct(value)
    : `${priceLabel(value, layer)} ${PRICE[layer].unit}${scope ? " · àmbit ampliat" : ""}`;
}
