import type { Meta } from "../types";

export function MethodSection({ meta }: { meta: Meta }) {
  return (
    <section className="method" aria-labelledby="method-title">
      <h2 id="method-title">Mètode i limitacions</h2>
      <p><strong>Patrons, no causes.</strong> Arrels descriu com es mouen els visitants regionals; no explica per què.</p>
      <ul>
        <li><strong>R1 · Dies sense dades.</strong> Falten {meta.missing_days.join(", ")}. Es deixen buits, mai com a zero.
          Dies parcials (no es fan servir en mitjanes diàries): {meta.partial_days.join(", ")}.</li>
        <li><strong>R2 · Tres estats.</strong> Publicat (15 o més), &lt;15 (valor amagat pel proveïdor) i sense fila.</li>
        <li><strong>R3 · Famílies separades.</strong> Les dades municipals, de barri a barri i mixtes no se sumen mai entre elles.</li>
        <li><strong>R4 · Unions segures.</strong> Cap unió de dades canvia el nombre de files ni el total de viatges.</li>
        <li><strong>R5 · Viatges i visitants no són el mateix.</strong> Els visitants venen de la Taula 9; els viatges només es comparen en rutes amb dades almenys el 80 % dels dies.</li>
      </ul>
      <h3>Com llegir els números</h3>
      <ul>
        <li>Cada valor porta la seva <strong>finestra</strong> i el percentatge publicat, &lt;15 i sense fila.</li>
        <li>Els visitants únics d'un període són la <strong>mitjana mensual</strong>: sumar mesos comptaria la mateixa persona diverses vegades.</li>
        <li>La quota de cap de setmana fa servir mitjanes per dia vàlid (sense dies que falten, parcials ni festius).</li>
        <li>"Visitants regionals" són residents d'altres municipis de la província de Barcelona que no hi passen la nit: inclou desplaçaments per feina o estudis.</li>
        <li>Lloguer, residents i habitatges d'ús turístic: encara no disponibles; les targetes s'amaguen fins que hi hagi dades.</li>
      </ul>
      <p className="method__window">Finestra de dades: {meta.window.start} – {meta.window.end}. Llindar del proveïdor: {meta.threshold}.</p>
    </section>
  );
}
