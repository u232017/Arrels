import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPinned, Pause, Play, Search } from "lucide-react";
import { DATA_DIR } from "../data";
import { formatMonth } from "../format";
import { AtlasMap } from "./AtlasMap";
import { Compare, Method, Wrapped } from "./Explore";
import { Housing } from "./Housing";
import { NeighborhoodPanel } from "./NeighborhoodPanel";
import { CityTrend } from "./Series";
import { BASE_MONTH, DEFAULT_INDEX, MONTHS, inboundRanking, sampleMobility, searchKey, titleCase, visitorChange, type Area, type FlowSource, type Layer, type Mobility, type Price, type Reference } from "./model";
import "./map.css";

const NAV = {
  map: "Mapa",
  match: "Barri Match",
  wrapped: "Barri Wrapped",
  housing: "Habitatge i ajuts",
  method: "Metodologia",
};
type View = keyof typeof NAV;

async function readMap<T>(file: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function AreaSearch({ reference, onSelect }: { reference: Reference | null; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [focus, setFocus] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const matches = reference?.areas.filter((area) => searchKey(area.name).includes(searchKey(query))).slice(0, 8) ?? [];
  const opened = expanded && query.trim() !== "";
  const selected = (area: Area) => {
    onSelect(area.id);
    setQuery("");
    setExpanded(false);
    setFocus(-1);
    input.current?.blur();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim() && matches[focus < 0 ? 0 : focus]) selected(matches[focus < 0 ? 0 : focus]);
  };
  return <form className="atlas-search" role="search" onSubmit={submit} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
  }}>
    <Search size={16} aria-hidden="true" />
    <input ref={input} type="search" placeholder="Cerca un barri…" aria-label="Cerca un barri" role="combobox"
      aria-autocomplete="list" aria-expanded={opened} aria-controls={opened ? "atlas-search-results" : undefined}
      aria-activedescendant={opened && matches[focus] ? `atlas-search-${matches[focus].id}` : undefined}
      value={query} onChange={(event) => { setQuery(event.target.value); setExpanded(true); setFocus(-1); }}
      onFocus={() => setExpanded(true)} onKeyDown={(event) => {
        if (event.key === "Escape") { setExpanded(false); setFocus(-1); }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length && query.trim()) {
          event.preventDefault();
          setExpanded(true);
          setFocus((index) => event.key === "ArrowDown" ? (index + 1) % matches.length
            : index <= 0 ? matches.length - 1 : index - 1);
        }
      }} />
    {opened && <div className="atlas-search-results" id="atlas-search-results" role="listbox" aria-label="Barris">
      {matches.map((area, index) => <button type="button" key={area.id} role="option" aria-selected={index === focus}
        id={`atlas-search-${area.id}`} onClick={() => selected(area)}>{titleCase(area.name)}</button>)}
      {!matches.length && <p role="status">Cap barri coincideix.</p>}
    </div>}
  </form>;
}

function Timeline({ index, setMonth, playing, onPlay, mobility }: {
  index: number; setMonth: (index: number) => void; playing: boolean; onPlay: () => void; mobility: Mobility | null;
}) {
  return <section className="atlas-timeline" aria-label="Cronologia mensual">
    <button className="atlas-play" type="button" onClick={onPlay} aria-label={playing ? "Pausa la cronologia" : "Reprodueix la cronologia"}>
      {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
    </button>
    <div>
      <CityTrend mobility={mobility} index={index} />
      <div className="atlas-slider-line" style={{ "--progress": `${index * 100 / (MONTHS.length - 1)}%` } as React.CSSProperties}>
        <output htmlFor="atlas-month">{formatMonth(MONTHS[index])}</output>
        <input id="atlas-month" type="range" min="0" max={MONTHS.length - 1} step="1" value={index} aria-label="Mes del mapa"
          aria-valuetext={formatMonth(MONTHS[index])} onChange={(event) => setMonth(Number(event.target.value))} />
      </div>
      <div className="atlas-timeline-ticks" aria-hidden="true">
        <span>2023</span><span>2024</span><span>2025</span><span>Ag.</span>
      </div>
    </div>
  </section>;
}

export function MapApp({ dataDir = DATA_DIR }: { dataDir?: string }) {
  const [reference, setReference] = useState<Reference | null>(null);
  const [mobility, setMobility] = useState<Mobility | null>(null);
  const [referenceError, setReferenceError] = useState(false);
  const [mobilityState, setMobilityState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [view, setView] = useState<View>("map");
  const [areaId, setAreaId] = useState("31");
  const [index, setIndex] = useState(DEFAULT_INDEX);
  const [layer, setLayer] = useState<Layer>("change");
  const [price, setPrice] = useState<Price>("rent");
  const [flows, setFlows] = useState(true);
  const [flowSource, setFlowSource] = useState<FlowSource>("municipalities");
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const demo = dataDir === "sample" || new URLSearchParams(window.location.search).has("demo");
  const selected = reference?.areas.find((a) => a.id === areaId);
  const month = MONTHS[index];
  const inbound = reference && selected ? inboundRanking(reference, mobility, selected.id, month, flowSource) : null;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    readMap<Reference>("reference/map.json", signal).then((data) => {
      if (!signal.aborted) setReference(data);
    }).catch(() => { if (!signal.aborted) setReferenceError(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!reference) return;
    if (demo) {
      setMobility(sampleMobility(reference));
      setMobilityState("ready");
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    setMobility(null);
    setMobilityState("loading");
    readMap<Mobility>(`${dataDir}/map.json`, signal).then((data) => {
      if (!signal.aborted && data.areas && data.towns && data.start && data.end) {
        setMobility(data);
        setMobilityState("ready");
      } else if (!signal.aborted) {
        setMobilityState("unavailable");
      }
    }).catch(() => { if (!signal.aborted) setMobilityState("unavailable"); });
    return () => controller.abort();
  }, [reference, dataDir, demo]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = Math.min(MONTHS.length - 1, index + 1);
      setIndex(next);
      setHighlight(null);
      if (next === MONTHS.length - 1) setPlaying(false);
    }, 675);
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  function navigate(next: View) {
    setPlaying(false);
    setView(next);
    if (next === "map") setPanel(true);
  }
  function selectArea(id: string) {
    setAreaId(id);
    setHighlight(null);
    setPanel(true);
    if (view !== "map") setView("map");
  }
  function setMonth(next: number) {
    setIndex(next);
    setHighlight(null);
    setPlaying(false);
  }
  function play() {
    if (!playing && index === MONTHS.length - 1) setIndex(0);
    setPlaying(!playing);
  }
  function selectLayer(next: Layer) {
    setLayer(next);
    if (next === "rent" || next === "sale") setPrice(next);
  }
  const coverage = reference?.areas.filter((area) => {
    const series = mobility?.areas[area.id];
    return month === BASE_MONTH ? series?.[month] != null : visitorChange(series, month) != null;
  }).length;
  const explore = reference && selected ? { area: selected, reference, mobility, month } : null;

  return <div className="atlas-app">
    <header className="atlas-top">
      <a className="atlas-brand" href="./" onClick={(event) => { event.preventDefault(); navigate("map"); }}>
        <span className="atlas-brand-mark" aria-hidden="true" /><span>Arrels</span>
      </a>
      <nav aria-label="Navegació principal">
        {(Object.keys(NAV) as View[]).map((id) => <button key={id} type="button" aria-current={view === id ? "page" : undefined}
          onClick={() => navigate(id)}>{NAV[id]}</button>)}
      </nav>
      <AreaSearch reference={reference} onSelect={selectArea} />
      <span className={`atlas-badge ${demo ? "atlas-badge-demo" : ""}`}>
        {demo ? "Mobilitat simulada" : mobilityState === "ready" ? "Dades agregades" : mobilityState === "unavailable" ? "Dades públiques" : "Carregant…"}
      </span>
    </header>
    {referenceError && <p className="atlas-empty" role="alert">No s’ha pogut carregar la cartografia. Recarrega la pàgina per tornar-ho a intentar.</p>}
    {!reference && !referenceError && <p className="atlas-empty" role="status">Carregant el mapa…</p>}
    {view === "map" && reference && <main className={`atlas-grid ${panel ? "" : "atlas-grid-wide"}`}>
      <div className="atlas-left">
        <div className="atlas-map-column">
          <AtlasMap reference={reference} mobility={mobility} month={month} selected={selected} onSelect={selectArea}
            layer={layer} onLayer={selectLayer} flows={flows} onFlows={setFlows} highlighted={highlight}
            flowSource={flowSource} inbound={inbound} onFlowSource={(source) => {
              setFlowSource(source);
              setHighlight(null);
              setFlows(true);
            }} />
          {mobilityState === "unavailable" && <div className="atlas-data-notice">Exportació de mobilitat no disponible. <a href="?demo=1">Prova la demostració</a></div>}
        </div>
        <Timeline index={index} setMonth={setMonth} playing={playing} onPlay={play} mobility={mobility} />
        <div className="atlas-map-note">
          {coverage ? <span>{coverage}/{reference.areas.length} barris amb dades de mobilitat</span> : <span>{reference.areas.length} barris cartografiats</span>}
          <span>Variació de visites agregades</span>
        </div>
      </div>
      {panel && selected && <NeighborhoodPanel area={selected} reference={reference} mobility={mobility} month={month}
        price={price} flowSource={flowSource} inbound={inbound}
        onClose={() => setPanel(false)} onCompare={() => navigate("match")} onHighlight={setHighlight} />}
      {!panel && <button className="atlas-reopen" type="button" onClick={() => setPanel(true)}><MapPinned size={17} aria-hidden="true" /> Obre la fitxa</button>}
    </main>}
    {view !== "map" && <main className="atlas-page-wrap">
      {view === "housing" && <div className="atlas-page"><Housing full /><button className="atlas-primary" type="button" onClick={() => navigate("match")}>Compara lloguers</button></div>}
      {view === "match" && explore && <Compare {...explore} onSelect={selectArea} />}
      {view === "wrapped" && explore && <Wrapped key={selected?.id} {...explore} />}
      {view === "method" && reference && <Method reference={reference} mobility={demo ? null : mobility} />}
    </main>}
    <footer className="atlas-footer"><span>Arrels · Barri Lab</span><button type="button" onClick={() => navigate("method")}>Fonts i metodologia</button></footer>
  </div>;
}
