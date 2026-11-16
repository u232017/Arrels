import { useState } from "react";
import { ArrowRight, Share2 } from "lucide-react";
import { formatInt, formatMonth, formatPct, formatSignedPct } from "../format";
import { MONTHS, districtChange, latestRentQuarter, priceLabel, titleCase, type Area, type Mobility, type Reference } from "./model";

interface ExploreProps {
  area: Area;
  reference: Reference;
  mobility: Mobility | null;
  month: string;
}

export function Compare({ area, reference, mobility, month, onSelect }: ExploreProps & { onSelect: (code: string) => void }) {
  const [surface, setSurface] = useState("50");
  const [budget, setBudget] = useState("1000");
  const [aid, setAid] = useState("0");
  const quarter = latestRentQuarter(reference, month);
  const i = reference.quarters.indexOf(quarter);
  const mix = mobility?.areas[area.id]?.[month]?.mix;
  const rent = area.rent[i];
  const valid = surface !== "" && Number(surface) > 0 && budget !== "" && Number(budget) > 0 && Number(aid) >= 0;
  const candidates = valid ? reference.areas.flatMap((candidate) => {
    const price = candidate.rent[i];
    if (candidate.id === area.id || price == null || (rent !== null && price >= rent)) return [];
    const net = Math.max(0, price * Number(surface) - Number(aid));
    if (net > Number(budget)) return [];
    const profile = mobility?.areas[candidate.id]?.[month]?.mix;
    const similarity = mix && profile ? 1 - mix.reduce((diff, value, j) => diff + Math.abs(value - profile[j]), 0) / 2 : null;
    return [{ candidate, price, net, similarity }];
  }).sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1) || a.net - b.net) : [];
  return <section className="atlas-page">
    <h1>Barri Match</h1>
    <p>Compara el cost del lloguer i el perfil dels viatges amb {area.name}.</p>
    <div className="atlas-inputs">
      <label>Superfície (m²)<input type="number" min="1" step="1" value={surface} onChange={(e) => setSurface(e.target.value)} /></label>
      <label>Pressupost mensual (€)<input type="number" min="1" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
      <label>Ajut mensual hipotètic (€)<input type="number" min="0" step="1" value={aid} onChange={(e) => setAid(e.target.value)} /></label>
    </div>
    <p className="atlas-muted">Estimació amb preus contractuals de {quarter.replace("Q", " T")}. Cost mensual estimat = preu per m² × superfície − ajut introduït. Consulta l’elegibilitat al portal oficial.</p>
    <p className="atlas-muted">La similitud compara les proporcions de viatges interns de Barcelona per segment (resident, regional, nacional i internacional) en el mes seleccionat.</p>
    {rent === null && <p className="atlas-muted">El barri de referència no té un preu comparable en aquest trimestre. Es mostren els barris dins del pressupost.</p>}
    {candidates.length ? <ul className="atlas-candidates">
      {candidates.slice(0, 12).map(({ candidate, similarity, price, net }) => <li key={candidate.id}>
        <button type="button" onClick={() => onSelect(candidate.id)}>
          <span><strong>{titleCase(candidate.name)}</strong><small>{reference.districts[candidate.district]}</small></span>
          <span>{priceLabel(price, "rent")} €/m²<small>{similarity === null ? "Perfil sense dades" : `${formatPct(similarity)} de similitud`}</small></span>
          <strong>≈ {formatInt(net)} €/mes</strong><ArrowRight size={18} aria-hidden="true" />
        </button>
      </li>)}
    </ul> : <p className="atlas-empty">{valid ? "Cap barri amb un preu publicat dins d’aquests filtres." : "Introdueix una superfície i un pressupost positius."}</p>}
  </section>;
}

export function Wrapped({ area, reference, mobility }: ExploreProps) {
  const [year, setYear] = useState("2024");
  const [status, setStatus] = useState("");
  const months = MONTHS.filter((month) => month.startsWith(year));
  const observations = months.flatMap((month) => {
    const item = mobility?.areas[area.id]?.[month];
    return item ? [{ month, ...item }] : [];
  });
  const peak = [...observations].sort((a, b) => b.visitors - a.visitors)[0];
  const annual = mobility?.wrapped?.[area.id]?.[year];
  const average = observations.length ? observations.reduce((sum, item) => sum + item.visitors, 0) / observations.length : null;
  const publishedRent = reference.quarters.flatMap((q, i) => q.startsWith(year) && area.rent[i] != null ? [{ q, value: area.rent[i] }] : []);
  const first = publishedRent[0];
  const last = publishedRent.at(-1);
  const change = first && last && first !== last ? last.value / first.value - 1 : null;
  const heading = annual ? `La procedència més habitual va ser ${annual.town}` : `La mobilitat a ${area.name}`;
  const report = `Arrels · ${titleCase(area.name)} · ${year}\n${heading}\n${observations.length}/${months.length} mesos amb dada\n${average == null ? "Sense dades de visitants" : `${formatInt(average)} visitants regionals al mes de mitjana`}`;
  async function share() {
    try {
      await navigator.clipboard.writeText(report);
      setStatus("Resum copiat");
    } catch {
      setStatus("No s’ha pogut copiar el resum.");
    }
  }
  return <section className="atlas-page">
    <h1>Barri Wrapped</h1>
    <label className="atlas-year">Any <select value={year} onChange={(e) => { setYear(e.target.value); setStatus(""); }}>
      <option>2023</option><option>2024</option><option>2025</option>
    </select></label>
    <article className="atlas-wrapped">
      <p>{titleCase(area.name)} · {year}{year === "2025" ? " · Gener a agost" : ""}</p>
      <h2>{heading}</h2>
      {annual && <p>{formatInt(annual.appearances)} aparicions mensuals sumades en {annual.months} mesos amb registre.</p>}
      <dl>
        <div><dt>Mitjana mensual de visitants regionals</dt><dd>{average === null ? "—" : formatInt(average)}</dd></div>
        <div><dt>Mes amb més visitants</dt><dd>{peak ? formatMonth(peak.month) : "—"}</dd></div>
        <div><dt>Canvi del lloguer entre trimestres publicats</dt><dd>{change === null ? "—" : formatSignedPct(change)}</dd></div>
      </dl>
      <button type="button" onClick={() => void share()} disabled={!observations.length}><Share2 size={16} aria-hidden="true" /> Copia el resum</button>
      <span role="status">{status}</span>
    </article>
    <p className="atlas-muted">La mateixa persona pot aparèixer en més d’un mes. Cobertura de visitants {observations.length}/{months.length} mesos.</p>
  </section>;
}

export function Method({ reference, mobility }: { reference: Reference; mobility: Mobility | null }) {
  const total = (district: string, year: string) => {
    const item = reference.departures[district]?.[year];
    if (!item) return "—";
    const n = formatInt(item.published);
    return item.suppressed ? `${n}–${formatInt(item.published + 4 * item.suppressed)}` : n;
  };
  return <section className="atlas-page atlas-method">
    <h1>Metodologia</h1>
    <h2>Visitants i procedència</h2>
    <p>La capa vermella mostra el canvi percentual dels visitants regionals publicats a la Taula 9 respecte al gener del 2023. Les variacions es mostren des del febrer del 2023 i inclouen l’efecte de l’estacionalitat. El recompte considera les residències conegudes en altres municipis de la província de Barcelona.</p>
    <p>Amb Municipis de residència, les fletxes apunten cap al barri visitat. El gruix és el pes sobre el total mensual publicat del barri. Les files de menys de 15 visitants s’ometen a l’origen.</p>
    <p>Les dades agregades descriuen visites. Les mudances, els motius de visita i els efectes causals del preu de l’habitatge queden fora de l’abast de l’indicador. La mesura de freqüència de visita queda pendent de validar el gra de la Taula 3.</p>
    <h2>Procedència entre barris</h2>
    <p>Viatges entre barris suma els recomptes diaris publicats per Telefónica per a cada origen i destí, de gener del 2023 a agost del 2025. Cada fletxa apunta del barri d’origen al barri de destí i el gruix indica la quota de viatges publicats.</p>
    <p>Canvis de domicili mostra els trasllats registrats al padró des d’altres barris de Barcelona per a l’any seleccionat. La quota es calcula sobre els canvis publicats. Les cel·les censurades de menys de cinc casos i les combinacions sense registre queden excloses del càlcul.</p>
    <ul>
      <li><a href="https://opendata-ajuntament.barcelona.cat/data/ca/dataset/pad_cdo_b_barri-des" target="_blank" rel="noreferrer">Canvis de domicili per barri de baixa i d’alta · Open Data BCN (CC BY 4.0)</a></li>
      <li><a href="https://opendata-ajuntament.barcelona.cat/data/es/dataset/pad-dimensions/resource/b00be3f8-9328-4175-8689-24a25bc0907c" target="_blank" rel="noreferrer">Diccionari de codis del padró municipal</a></li>
    </ul>
    <h2>Contrast amb el padró</h2>
    <p>Les baixes anuals per emigració tenen una cobertura territorial diferent de les visites regionals. El rang de baixes conserva de 0 a 4 casos possibles per cel·la censurada. El canvi de visitants és la mediana dels canvis per barri entre els dotze mesos de 2023 i 2024, amb els dos anys complets. La comparació és descriptiva i la font de baixes no inclou el municipi de destí.</p>
    <div className="atlas-table-scroll"><table>
      <caption>Baixes anuals i canvi de visitants per districte</caption>
      <thead><tr><th scope="col">Districte</th><th scope="col">Baixes 2023</th><th scope="col">Baixes 2024</th><th scope="col">Canvi visitants</th><th scope="col">Barris</th></tr></thead>
      <tbody>{Object.entries(reference.districts).sort(([a], [b]) => a.localeCompare(b)).map(([code, name]) => {
        const { change, n } = districtChange(reference, mobility, code);
        return <tr key={code}><th scope="row">{name}</th><td>{total(code, "2023")}</td><td>{total(code, "2024")}</td>
          <td>{change === null ? "—" : formatSignedPct(change)}</td><td>{n}</td></tr>;
      })}</tbody>
    </table></div>
    <h2>Preu de l’habitatge</h2>
    <p>El lloguer fa servir contractes publicats per l’Incasòl i la compravenda usa el preu mitjà per m² construït del total d’operacions registrades. Els preus corresponen al trimestre complet, de 2023 T1 a 2025 T3. Quan la font publica un àmbit ampliat, la fitxa n’indica el nom i el mapa fa servir un ratllat de color. El ratllat gris identifica els preus sense valor publicat.</p>
    <ul>
      <li><a href="https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/mercat_de_lloguer/lloguers-barcelona-per-districtes-i-barris/index.html" target="_blank" rel="noreferrer">Estadístiques de lloguer de la Generalitat</a></li>
      <li><a href="https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Barcelona/" target="_blank" rel="noreferrer">Estadístiques de compravenda de la Generalitat</a></li>
      <li><a href="https://datos.gob.es/ca/catalogo/l01080193-personas-emigrantes" target="_blank" rel="noreferrer">Baixes per emigració del padró de Barcelona</a></li>
      <li><a href="?view=detail">Obre el visor anterior dels tres barris pilot</a></li>
    </ul>
  </section>;
}
