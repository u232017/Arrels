import { ArrowUpRight, BadgePercent, Building2, Euro } from "lucide-react";

const links = [
  { icon: Euro, label: "Bo Lloguer Jove", description: "Consulta els imports, requisits i terminis de la convocatòria.",
    url: "https://tramits.gencat.cat/ca/tramits/tramits-temes/22866_Bo_lloguer_joves?moda=1" },
  { icon: Building2, label: "Habitatge protegit", description: "Registre de sol·licitants i processos d’adjudicació a Barcelona.",
    url: "https://www.consorcihabitatge.barcelona/ca/acces-lhabitatge/registre-de-sollicitants" },
  { icon: BadgePercent, label: "Límit del lloguer", description: "Consulta l’interval de referència per a un habitatge concret.",
    url: "https://serpavi.mivau.gob.es/" },
];

export function Housing({ full = false }: { full?: boolean }) {
  return <section className="atlas-housing" aria-label="Recursos oficials d’habitatge">
    {full ? <h1>Habitatge i ajuts</h1> : <div className="atlas-section-title"><h3>Habitatge i ajuts</h3><span>Fonts oficials</span></div>}
    {full && <p className="atlas-muted">Enllaços revisats el 16 de novembre de 2026. Consulta les convocatòries i condicions vigents als portals oficials.</p>}
    {links.map(({ icon: Icon, ...link }) => <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="atlas-resource">
      <div className="atlas-resource-icon"><Icon size={16} aria-hidden="true" /></div>
      <div><strong>{link.label}</strong><p>{link.description}</p></div>
      <ArrowUpRight className="atlas-resource-arrow" size={15} aria-hidden="true" />
    </a>)}
  </section>;
}
