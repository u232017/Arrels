# Plan — Arrels MVP

**Fuente:** `arrels_mvp_prompt.md` §3–§6 · Fase 0: `docs/DATA_DICTIONARY.md` · Decisiones: `docs/DECISIONS.md`
**Fecha:** 2026-11-09 · **Entrega:** 2026-12-04 · **Complejidad:** Alta (15 GB de datos, 3 entregables)
**Estado:** v2 — incorpora la revisión del agente `architect` (§9). Pendiente de aprobación del equipo ⛔

## 1. Requisitos (resumen)

- **Pipeline** Python 3.12 + DuckDB + Parquet: ingesta → estados de calidad (R1–R5) → agregados
  mensuales por familia → uniones (alquiler, población, HUT, festivos) → JSON para la web.
- **Festivos:** España, Cataluña, Barcelona + festes majors de los barris piloto (flags diario/mensual).
- **Selección de 2–3 barris piloto** con una puntuación de suficiencia de datos transparente.
- **Indicadores interpretables** por barri piloto y mes, cada uno con insignia de cobertura.
- **Notebook reproducible**: <30 min desde datos brutos, <2 min desde caché Parquet.
- **Una página web** (Vite + React + TS, JSON estático <5 MB, en catalán).
- **Restricciones:** neutralidad (sin causas), NDA (nada de datos en Git, valores exportados ≥15),
  rutas solo vía `.env`/`config.py`, `make data|test|web`.

## 2. Calendario e iteraciones

Supuesto: reuniones con el mentor cada dos semanas. **Confirmar fechas exactas.**

| Incremento | Fechas | Demo al mentor |
|---|---|---|
| **I3a** | 09-11 → 16-11 | Pipeline de ingesta + tests R1–R5 en verde; top 5 barris candidatos |
| **I3b** | 16-11 → 23-11 (reunión) | Indicadores de los barris elegidos + notebook ejecutable |
| **I4a** | 23-11 → 30-11 | Web con datos reales (selector, KPIs, serie temporal, mapa) |
| **I4b** | 30-11 → 04-12 (entrega) | Verificación, clon limpio, documentación final |

## 3. Arquitectura

```
.env / config.py ─┐
                  ▼
raw CSV ──► ingest ──► quality ──► aggregate ──► integrate ──► indicators ──► export ──► web/public/data/*.json
 (15 GB)   (Parquet    (R1–R5     (mensual por   (alquiler,    (por barri     (≥15,       (Vite + React)
            tipado)     estados)   familia)       pobl., HUT,   piloto)        <5 MB)
                                                  festivos)
                         └── tests/ (pytest, fixtures sintéticos — nunca datos reales)
```

- **Paquete:** `pipeline/` en la raíz (como pide el enunciado), con `config.py`, `ingest.py`,
  `quality.py`, `aggregate.py`, `integrate.py`, `holidays.py`, `pilot.py`, `indicators.py`,
  `export.py`. `pyproject.toml` pasa a `requires-python >=3.12` e incluye `pipeline` (hoy solo
  busca en `src/`, así que el notebook no podría importarlo).
- **Caché:** cada etapa lee/escribe Parquet en `data/cache/` (git-ignorado) y se salta si su
  salida ya existe (manifiesto con tamaño/fecha de los ficheros fuente; `FORCE_REBUILD=1` para
  rehacer). Así el notebook baja de 2 min desde caché. `memory_limit` y `temp_directory` de DuckDB
  se fijan en `config.py` para que la ejecución en bruto quepa en un portátil.
- **Estado `absent` (R2) sin rejilla completa:** no se materializa ruta × día (la familia mixta
  explotaría). Se calcula al agregar: `days_absent = días_del_mes − días_faltantes − días_con_fila`,
  junto a `days_published` y `days_suppressed`. `quality` añade columnas/vistas y una tabla
  pequeña `calendar` (día → ok / missing / partial + festivos); no reescribe los 167 M de filas.
- **Alcance de agregados:** se ingieren las 3 familias (tests R3 y puntuación piloto), pero solo
  se agregan en detalle la mixta `Regional` y la cobertura por barri. Nada de agregados
  municipales que no use un indicador.
- **El limpiador antiguo `src/arrels/clean_data.py` NO se usa** con datos Telefónica: convierte
  `-`/`NA` en null y `08019` en el número 8019. Se archiva o elimina (decisión en T1).
- **Familias separadas (R3):** tablas distintas por familia; ninguna función acepta dos familias.
- **Uniones (R4):** un único helper `checked_join(left, right, keys, measure)` que afirma igual
  nº de filas, igual suma de `measure` (`viajes` o `visitantes`) y **clave única en la tabla
  derecha** (alquiler es trimestral: la unión mes → trimestre es muchos-a-uno).
- **Web:** sin backend; lee `web/public/data/{meta,pilots,<barri>}.json`.
- **Contrato JSON (fijado en la semana 1, T11a):** JSON Schema + ejemplo sintético. Cada valor es
  `{value: number|null, state: "published"|"suppressed"|"absent"}` (nunca el string `"<15"`
  mezclado con números) y lleva una `badge` `{window, pct_published, pct_suppressed, pct_absent,
  n_routes}`. El schema marca qué campos son recuentos (para el test ≥15). Los tipos TS se generan
  del schema y el export de Python se valida contra él.
- **Mapa:** puntos en los centroides de los municipios (pequeño, sin geometrías ni licencias de
  polígonos), sobre un estilo de mapa base sin clave; lista ordenada como respaldo.

## 4. Tareas

Leyenda responsables: **JV** Joan Vicente (datos/mates) · **DP** Davi Paiva (pipeline) ·
**PP** Pau Puig, **AP** Alejandro Poole (frontend) · **BR** Blanca Rodríguez, **AI** Alex Izquierdo (docs/QA).
WBS: **DM** modelo de datos · **NB** notebook · **WEB** web · **PM** gestión/docs.

| ID | Tarea | Horas | Depende de | Resp. | WBS | Inc. |
|---|---|---:|---|---|---|---|
| T0 | Conseguir ficheros de alquiler, población y HUT; rutas en `.env` | 1 | — | JV | DM | I3a |
| T1 | Esqueleto: `pipeline/`, `config.py` (DuckDB memory/temp), `Makefile`, `pyproject` (≥3.12, deps fijadas + lock), retirar `clean_data.py` | 3 | — | DP | DM | I3a |
| T2 | **Tests R1–R5 primero** con fixtures sintéticos (RED) | 5 | T1 | AI (revisa DP) | DM | I3a |
| T3 | `ingest`: CSV → Parquet tipado por familia (códigos como texto), particionado por mes, caché con manifiesto | 5 | T1 | DP | DM | I3a |
| T4 | `quality`: tabla `calendar` (R1 missing, `partial`, festivos), columnas de estado R2, separación R3 | 4 | T2, T3 | DP | DM | I3a |
| T5 | `aggregate`: mixta `Regional` mensual por ruta con `days_published/suppressed/absent` (D1) + cobertura por barri | 5 | T4 | DP | DM | I3a |
| T6 | `holidays`: festivos ES/CAT/BCN 2023–2025 (fuente oficial citada) | 3 | T1 | JV | DM | I3a |
| T7a | Unir festivos al calendario con `checked_join(measure=…)` + tests R4 | 2 | T5, T6 | JV | DM | I3a |
| T8 | `pilot`: puntuación de suficiencia (Telefónica + festivos) + top 5 con evidencias | 4 | T5, T7a | JV | DM | I3a |
| ⛔ | **El equipo elige 2–3 barris → `DECISIONS.md`** (objetivo 13–14 nov) | 1 | T8 | todos | PM | I3a |
| T11a | **Contrato JSON**: JSON Schema + ejemplo sintético + tipos TS generados | 2 | T1 | DP, PP | WEB | I3a |
| T7b | Unir alquiler, población, HUT con `checked_join` (clave derecha única, mes → trimestre) | 4 | T0, T5 | DP | DM | I3b |
| T9 | Festes majors de los barris elegidos (fechas 2023–2025, fuente citada) | 2 | ⛔ | BR | DM | I3b |
| T10 | `indicators` (TDD): visitantes T9 por mes y municipio (nunca sumados entre meses), Δ vs 2023, cuota fin de semana = media diaria finde / media diaria laborable sobre días válidos, días suprimidos en la insignia | 8 | ⛔, T7b, T9 | JV, DP | DM | I3b |
| T11 | `export`: JSON validado contra el schema, recuentos ≥15, <5 MB, tests | 3 | T10, T11a | DP | DM | I3b |
| T12 | `notebooks/arrels_mvp.ipynb` + cronometraje (bruto y caché) | 4 | T11 | JV | NB | I3b |
| T13 | `docs/METHOD.md`: cada fórmula en palabras sencillas, R1–R5, ventanas, "no sumar visitantes únicos entre meses" | 4 | T10 | BR | PM | I3b |
| T14 | Web: scaffold Vite+React+TS, Vitest, lint, `make web`, carga del ejemplo sintético | 3 | T11a | PP | WEB | I3b |
| ⛔ | **Revisar tablas de indicadores antes de conectar la UI a datos reales** | 1 | T10–T12 | todos | PM | I3b |
| T15 | Selector de barri + rango de meses (serie o media mensual, nunca suma) + KPIs con insignias (test-first) | 6 | T14 | PP | WEB | I3b–I4a |
| T16 | Lista ordenada + círculos en centroides de municipios (MapLibre) | 5 | T14 | AP | WEB | I3b–I4a |
| T17 | Series temporales (visitantes vs 2023, alquiler) con marcas de festivos | 5 | T14 | AP | WEB | I4a |
| T18 | Sección "Mètode i limitacions" + textos en catalán revisados (neutralidad) | 3 | T13, T14 | BR | WEB | I4a |
| T19 | E2E Playwright: solo los 4 flujos (barri, rango, insignias, limitaciones) | 3 | T15–T18 | AI | WEB | I4b |
| T20 | Accesibilidad básica (contraste, etiquetas, teclado) | 2 | T15–T18 | AI | WEB | I4b |
| T21 | Una pasada de revisión por lenguaje (`python-reviewer`+`database-reviewer`, `typescript-reviewer`) + correcciones | 4 | T11, T18 | DP, PP | PM | I4b |
| T22 | Verificación final: `/code-review`, `/security-scan`, cobertura ≥80 % en `make test`, `verification-loop`, grep neutralidad | 2 | T19–T21 | AI | PM | I4b |
| T23 | Clon limpio reproducible + `/update-docs` + `BACKLOG.md` + resumen final (changes/issues/preguntas) | 4 | T22 | BR, DP | PM | I4b |
| — | Margen (~10 %) para revisiones por rama | 10 | — | todos | PM | — |
| | **Total** | **~115 h** | | | | |

Reparto aproximado (sin margen): DP ~31 h · JV ~23 h · PP ~13 h · AP ~10 h · BR ~13 h · AI ~12 h.

**Ruta crítica:** T1 → T3 → T4 → T5 → T7a → T8 → ⛔ → T10 → T11 → T12 → T22 → T23.
**Paralelizable:** T2, T6, T11a junto a T3; la web (T14–T16) arranca en I3b con el ejemplo sintético; T7b en cuanto llegue T0; T13 junto a T11–T12.

## 5. Indicadores (definición preliminar, detalle en METHOD.md)

| Indicador | Fuente | Regla |
|---|---|---|
| Visitants regionals únics (total, per municipi) | Tabla 9 | Suma de `visitantes` dentro del mes; **nunca entre meses** (serie o media mensual); `NA` → "residència desconeguda" |
| Δ vs mateix mes 2023 | Tabla 9 | `(v_m − v_m,2023) / v_m,2023`; solo si ambos publicados |
| Quota de cap de setmana | Tabla 3 mixta, `Regional`, municipi→barri | Rutas con fila ≥80 % de días (D1). Media diaria de fin de semana / media diaria laborable, solo días válidos (sin faltantes ni `partial`). Días suprimidos (0–14) contados en la insignia |
| Lloguer trimestral, residents, HUT/1.000 hab. (2025T2) | complementarias | Mostrar ventana de cobertura junto al valor |
| Insignia de cobertura | todas | ventana · % publicado · % suprimido · % ausente |

## 6. Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Ficheros de alquiler/población/HUT no disponibles (T0) | Alta | T7 dividido: la elección de barris (T8) ya no depende de T0; solo T7b/T10 lo esperan |
| Doble conteo al sumar visitantes únicos entre meses | Media | Regla en contrato JSON, METHOD.md y test de la web |
| Sesgo en cuota de fin de semana por días faltantes/parciales (2 son sábado/domingo) | Media | Medias diarias sobre días válidos, no cuota de sumas |
| 15 GB × varias pasadas → notebook >30 min | Media | Ingesta única a Parquet particionado; recon actual: 1 min por pasada completa |
| Cuota fin de semana con pocas rutas válidas (49 % pasan D1) | Media | Mostrar nº de rutas usadas en la insignia; ocultar si < umbral mínimo |
| Fuga de datos NDA (CSV/Parquet en Git, valores <15 en JSON) | Baja | `.gitignore` ya endurecido; test de export ≥15; `/security-scan` antes de cada push |
| Lenguaje no neutral en UI/docs | Baja | Test/grep `exili|expuls|echa|culpa` en `make test` |
| Fechas de festes majors poco fiables | Media | Fuente citada por fecha; flag mensual además de diario |
| Tiempo frontend (2 personas) | Media | Contrato JSON fijado en la semana 1 (T11a); la web empieza en I3b con datos sintéticos |
| Carga de DP concentrada en la ruta crítica | Media | T2 a AI, T6/T7a/T8 a JV, margen del 10 % |

## 7. Preguntas abiertas

1. Fechas exactas de las reuniones con el mentor (para ajustar I3/I4).
2. Ubicación de los ficheros de alquiler, población y HUT (T0).
3. Días `partial` y `NA` en Tabla 9: se aplican las propuestas por defecto de `DECISIONS.md` salvo objeción.

## 8. Aceptación (Definition of Done del enunciado §6)

- [ ] `make test` en verde; tests R1–R5 existen y pasan
- [ ] Notebook <30 min (bruto) y <2 min (caché)
- [ ] Toda unión mantiene filas y suma de `viajes` (afirmado)
- [ ] Web con JSON estático <5 MB, 2–3 barris, insignia en cada número
- [ ] Sin datos en Git; `/security-scan` limpio; ningún valor exportado <15
- [ ] Grep de neutralidad limpio
- [ ] `docs/` completo + resumen final (changes, issues, preguntas)

## 9. Revisión del agente `architect` (2026-11-09) — cambios aplicados

1. Visitantes únicos no se suman entre meses (contrato, METHOD, UI).
2. Cuota de fin de semana con medias diarias sobre días válidos; días suprimidos en la insignia.
3. Estado `absent` calculado al agregar; tabla `calendar` pequeña en lugar de rejilla completa.
4. `checked_join` con parámetro `measure` y clave derecha única.
5. `pyproject` corregido (≥3.12, `pipeline/` importable, deps fijadas).
6. Mapa con centroides; sin tarea de polígonos.
7. Caché con manifiesto + `FORCE_REBUILD`; límites de memoria DuckDB en config.
8. Contrato JSON en semana 1 (T11a) con valores tipados `{value, state}`.
9. T7 dividido (T7a/T7b): la elección de barris no espera a los ficheros externos.
10. Carga de DP repartida; menos horas en revisiones, E2E y mapa; 10 % de margen.
