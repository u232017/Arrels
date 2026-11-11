# Decisiones — Arrels MVP

Registro de decisiones del equipo. Cada entrada: fecha, decisión, motivo, impacto.

## D1 — Definición de cobertura para R5 (2026-11-09)

- **Decisión:** una ruta tiene "datos en ≥80 % de los días" si tiene **fila** en ≥80 % de los días
  del mes, contando también las filas suprimidas (`viajes = 0`, <15).
- **Motivo:** es la definición con la que el equipo obtuvo el 62 % de marzo 2025 (verificado: 62,5 %).
  Con "días publicados ≥15" solo pasaría el 14,5 % de las rutas.
- **Impacto:** en marzo 2025 pasan el filtro el 49,4 % de las rutas municipio→barrio regionales.
  En las rutas filtradas, los días suprimidos cuentan como `<15` (no como 0) y se informa de su
  proporción en la insignia de cobertura.

## D2 — Días parciales (2026-11-11, propuesta por defecto aplicada; confirmar en la reunión)

- **Decisión:** un día es `partial` si está junto a un día faltante y su total de viajes es
  < 50 % de la mediana de su mismo día de la semana. Se excluyen de los indicadores diarios.
- **Resultado con datos reales:** 2025-04-12, 2025-05-19, 2025-05-21 (los festivos con volumen
  bajo, como 15-ago o 25-dic, no se marcan porque no están junto a un hueco).

## D3 — Barris piloto (2026-11-11)

- **Decisión:** la Dreta de l'Eixample (080190203), Sants (080190308), Sant Andreu (080190904).
- **Motivo:** puntuación de suficiencia #1, #2 y #7 (0,923 / 0,858 / 0,837; ver
  `docs/PILOT_CANDIDATES.md`). Se prefiere Sant Andreu a la Marina del Prat Vermell (#3) por ser
  residencial y más interpretable (la Marina incluye la Zona Franca y tiene pocos residentes),
  con una pérdida de puntuación de solo 0,02. Combina perfiles central y residencial.
- **Impacto:** indicadores, notebook y web solo para estos tres barris.

## D4 — Indicadores del periodo elegido (2026-11-11)

- **Cambio:** media de los meses elegidos vs media de los mismos meses un año antes; se oculta si
  falta algún mes. Sustituye al cambio "último mes vs mismo mes de 2023".
- **Mapa y ranking:** media mensual por municipio en el periodo elegido; los meses en que un
  municipio no aparece (<15) cuentan como desconocidos, no como 0.
- **Tarjetas sin datos:** se ocultan (nunca una tarjeta vacía).

## D5 — Exportar todos los municipios de residencia (2026-11-11)

- **Decisión:** el JSON incluye todos los municipios publicados (≥15) por barri y mes, no solo los
  40 primeros. Export real: ~2,0 MB (límite 5 MB).

## D6 — Fuentes públicas para lloguer, padró y HUT (2026-11-11)

- **Decisión:** como los ficheros validados por el equipo no estaban en este portátil, se usan las
  fuentes públicas del Ajuntament (CC-BY 4.0): Barcelona Dades (lloguer €/m², Incasòl, trimestral),
  Open Data BCN `pad_mdbas` (padró anual a 1 de enero) y `habitatges-us-turistic` (HUT 2025T2).
- **Impacto:** el padró es anual (el plan decía mensual). El lloguer se copió de la tabla trimestral
  de Barcelona Dades para los 3 barris piloto (la API requiere usuario). Comprobado contra la media
  anual de la misma página.

## Pendientes

- `cod_municipio_residencia = "NA"` en Tabla 9. Propuesta por defecto: mostrar como
  "residència desconeguda" en la lista, sin punto en el mapa.
- Festes majors de los barris piloto (T9, BR): fechas exactas 2023–2025 por verificar.
