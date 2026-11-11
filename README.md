# Arrels — Barri Lab

Arrels es un análisis neutral y basado en datos de los **visitantes regionales** de tres barris de
Barcelona: de qué municipios vienen, cómo cambia su número respecto a 2023 y qué parte de los viajes
se hace en fin de semana. Muestra **patrones, no causas**.

Equipo **Barri Lab** (201_F, UPF) · **Telefónica Mobile Data Challenge 2026 — Challenge #3 (Open
Innovation)** · Entrega: 04/12/2026.

## Estado

MVP funcionando con datos reales para tres barris piloto (D3): la Dreta de l'Eixample, Sants y Sant
Andreu. Pendiente: integrar alquiler, población y HUT (ficheros no disponibles). Resumen, change log,
issue log y preguntas para el mentor: [`docs/SUMMARY.md`](docs/SUMMARY.md).

## Estructura

```text
.
├── pipeline/   # paquete Python: config, ingest, quality, aggregate, integrate, holidays,
│               # pilot, indicators, export, centroids, cache, run
├── tests/      # pytest, solo fixtures sintéticos (nunca datos reales)
├── contract/   # JSON Schema compartido entre pipeline/export.py y web/
├── notebooks/  # notebook reproducible (se versiona sin salidas)
├── web/        # página única (Vite + React + TypeScript), textos en catalán
├── scripts/    # recon de la Fase 0, informe de barris piloto, notebook, docs
└── docs/       # DATA_DICTIONARY, PLAN, METHOD, DECISIONS, PILOT_CANDIDATES, BACKLOG, SUMMARY
```

## Empezar

Requiere Python 3.12, Node 20+ y Google Chrome (para los tests e2e).

```bash
make setup
cp .env.example .env   # rellenar las rutas a los datos (ver tabla de variables)
make test
make data
make web-dev           # http://localhost:5173
```

## Comandos

<!-- AUTO-GENERATED:commands -->
| Comando | Qué hace |
|---|---|
| `make setup` | Crea .venv (Python 3.12) e instala dependencias fijadas, Python y web |
| `make data` | Pipeline completo (ingesta → calidad → agregados → indicadores) y export JSON para la web |
| `make test` | Tests del pipeline con cobertura (mínimo 80 %) |
| `make lint` | ruff + mypy (Python) y tsc (web) |
| `make notebook` | Genera y ejecuta notebooks/arrels_mvp.ipynb (salida en data/processed/) |
| `make web` | Build estático de la web en web/dist/ |
| `make web-dev` | Servidor de desarrollo de la web en http://localhost:5173 |
| `make clean-cache` | Borra la caché Parquet (la próxima ejecución será en frío) |
<!-- /AUTO-GENERATED:commands -->

<!-- AUTO-GENERATED:npm -->
| Comando (en `web/`) | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (datos reales de `public/data/`) |
| `npm run build` | Comprobación de tipos + build de producción |
| `npm run preview` | Sirve el build de producción |
| `npm run typecheck` | Solo comprobación de tipos |
| `npm run test` | Tests unitarios (Vitest) |
| `npm run test:watch` | Tests unitarios en modo watch |
| `npm run e2e` | Tests e2e (Playwright, Chrome instalado, solo datos sintéticos) |
| `npm run e2e:build` | Tests e2e contra el build de producción |
<!-- /AUTO-GENERATED:npm -->

## Variables de entorno (`.env`)

<!-- AUTO-GENERATED:env -->
| Variable | Obligatoria | Descripción | Ejemplo |
|---|---|---|---|
| `MOBILITY_DIR` | sí | Carpeta de movilidad de Telefónica (subcarpetas YYYY-MM) | `/path/to/output_limite_legal` |
| `TOURISM_DIR` | sí | Carpeta de turismo de Telefónica (subcarpetas YYYYMM) | `/path/to/output_limite_legal 2` |
| `RENT_FILE` | no | Alquiler €/m² por barri y trimestre; vacío = pipeline/reference/rent_pilot_quarters.csv (Portal de Dades) | `` |
| `POPULATION_FILE` | no | Carpeta con los *_pad_mdbas.csv de Open Data BCN (padró a 1 de enero) | `data/raw/context` |
| `HUT_FILE` | no | Registro HUT de Open Data BCN, 2025T2 (habitatges-us-turistic) | `data/raw/context/2025_2T_hut_comunicacio_opendata.csv` |
| `MIGRATION_FILE` | no | Migración residencial anual, o "none" | `none` |
| `CACHE_DIR` | no | Carpeta de la caché Parquet | `data/cache` |
| `DUCKDB_MEMORY_LIMIT` | no | Memoria máxima de DuckDB | `6GB` |
| `DUCKDB_TEMP_DIR` | no | Carpeta temporal de DuckDB (necesita espacio libre en disco) | `data/cache/duckdb_tmp` |
| `DUCKDB_THREADS` | no | Hilos de DuckDB | `8` |
| `FORCE_REBUILD` | no | 1 = ignorar la caché y reconstruir todo desde los CSV | `0` |
<!-- /AUTO-GENERATED:env -->

Las rutas solo viven en `.env` (nunca en el código).

## Datos y confidencialidad (NDA)

- Los datos de Telefónica **nunca** entran en Git: `data/`, `*.csv`, `*.parquet`, `*.xlsx` y `.env`
  están ignorados. Solo se versionan datos públicos de referencia en `pipeline/reference/`.
- La web solo recibe agregados por barri y mes; ningún valor exportado es menor de 15 (lo comprueba
  `pipeline/export.py`). El export real (`web/public/data/`) también está ignorado.
- Los tests y los e2e usan solo datos sintéticos (`web/public/sample/`).
- En esta sesión no se pudo ejecutar AgentShield. Antes de cada push:
  `npx --yes ecc-agentshield@1.6.0 scan --path .`

## Contribuir

- Una rama por tarea, commits pequeños (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), revisión antes de
  cada merge.
- TDD: primero el test que falla, después el código. Evidencia del pipeline en `docs/tdd/`.
- Antes de pedir revisión: `make lint`, `make test`, `cd web && npm test && npm run e2e`.
- Lenguaje neutral en código, UI y docs ("visitants regionals", "retorn", "vincle amb el barri",
  "canvi de residència"); sin afirmaciones causales ni políticas.
- Documentación en castellano o catalán; código en inglés. Las tablas de este README se regeneran con
  `python scripts/gen_docs.py`.

## Licencia

Código bajo licencia MIT. Los datos de terceros mantienen la licencia de su fuente original.
