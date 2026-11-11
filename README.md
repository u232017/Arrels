# Arrels — Barri Lab

Arrels es una demo para visualizar cómo se distribuyen los desplazamientos de población entre Barcelona y su entorno metropolitano: cuánta gente ha tenido que marcharse de su barrio de origen y cuánta sigue haciendo vida en él.

El proyecto se desarrolla para el **Open Data Challenge de Càtedres Telefónica 2026** por el equipo **Barri Lab**. La aplicación final incorporará un mapa y métricas por barrio o municipio a partir del dataset oficial que se facilite.

## Estado

MVP en desarrollo (entrega 04/12/2026). Plan: `docs/PLAN.md`. Datos: `docs/DATA_DICTIONARY.md`.

## Estructura

```text
.
├── pipeline/   # paquete Python: config, ingest, quality, aggregate, integrate, ...
├── tests/      # pytest, solo fixtures sintéticos (nunca datos reales)
├── scripts/    # utilidades (recon de la Fase 0)
├── notebooks/  # notebook reproducible
├── web/        # página web (Vite + React + TS)
└── docs/       # DATA_DICTIONARY, PLAN, METHOD, DECISIONS, BACKLOG
```

## Preparar el entorno

Requiere Python 3.12.

```bash
make setup                 # crea .venv e instala dependencias fijadas
cp .env.example .env       # y rellenar las rutas locales a los datos
```

## Comandos

```bash
make data   # ejecuta el pipeline (usa la caché Parquet en data/cache/)
make test   # tests + cobertura (mínimo 80 %)
make web    # build de la web
```

Los datos de Telefónica están bajo NDA: nunca se suben a Git (`data/`, `*.csv`, `*.parquet`, `.env`
están ignorados). Solo se versionan datos públicos de referencia en `pipeline/reference/`.

## Convenciones de datos

No se deben subir datos personales ni identificadores que permitan reidentificar individuos. La visualización debe trabajar con datos agregados y respetar las condiciones de uso y atribución de la fuente oficial.

## Licencia

El código de este repositorio se distribuye bajo la licencia MIT. Los datos de terceros mantienen la licencia indicada por su fuente original; consultad `data/README.md` o la ficha del dataset antes de redistribuirlos.
