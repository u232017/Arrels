import type { Meta } from "../types";

/** "Mètode i limitacions" content (shown inside a collapsed accordion). */
export function MethodSection({ meta }: { meta: Meta }) {
  return (
    <div className="flex flex-col gap-3 text-body text-navy">
      <p className="m-0"><strong>Patrons, no causes.</strong> Arrels descriu com es mouen els visitants regionals; no explica per què.</p>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
        <li><strong>R1 · Dies sense dades.</strong> Falten {meta.missing_days.join(", ")}. Es deixen buits, mai com a zero.
          Dies parcials (no es fan servir en mitjanes diàries): {meta.partial_days.join(", ")}.</li>
        <li><strong>R2 · Tres estats.</strong> Publicat (15 o més), &lt;15 (valor amagat pel proveïdor) i sense fila.</li>
        <li><strong>R3 · Famílies separades.</strong> Les dades municipals, de barri a barri i mixtes no se sumen mai entre elles.</li>
        <li><strong>R4 · Unions segures.</strong> Cap unió de dades canvia el nombre de files ni el total de viatges.</li>
        <li><strong>R5 · Viatges i visitants no són el mateix.</strong> Els visitants venen de la Taula 9; els viatges només es comparen en rutes amb dades almenys el 80 % dels dies.</li>
      </ul>
      <h3 className="m-0 text-body font-semibold">Com llegir els números</h3>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
        <li>"Visitants regionals" són residents d'altres municipis de la província de Barcelona que no hi passen la nit: inclou desplaçaments per feina o estudis.</li>
        <li>Els visitants únics d'un període són la <strong>mitjana mensual</strong>: sumar mesos comptaria la mateixa persona diverses vegades. El mapa i la llista fan la mitjana per municipi dels mesos en què està publicat.</li>
        <li>El canvi compara la mitjana dels mesos triats amb la dels mateixos mesos de l'any anterior.</li>
        <li>La quota de cap de setmana fa servir mitjanes per dia vàlid (sense dies que falten, parcials ni festius). Si tots els dies tinguessin els mateixos viatges seria 28,6 %.</li>
        <li>El punt de color indica la cobertura: verd publicat, taronja parcialment &lt;15, gris sense dada. El detall és al requadre emergent i a la taula.</li>
        <li>Lloguer, residents i habitatges d'ús turístic: encara no disponibles; les targetes s'amaguen fins que hi hagi dades.</li>
      </ul>
      <p className="m-0 text-caption text-text-2">Finestra de dades: {meta.window.start} – {meta.window.end}. Llindar del proveïdor: {meta.threshold}.</p>
    </div>
  );
}
