# Arrels — Barri Lab

Arrels es una demo para visualizar cómo se distribuyen los desplazamientos de población entre Barcelona y su entorno metropolitano: cuánta gente ha tenido que marcharse de su barrio de origen y cuánta sigue haciendo vida en él.

El proyecto se desarrolla para el **Open Data Challenge de Càtedres Telefónica 2026** por el equipo **Barri Lab**. La aplicación final incorporará un mapa y métricas por barrio o municipio a partir del dataset oficial que se facilite.

## Estado

Este repositorio contiene la base de preparación de datos. El dataset todavía no está incluido. Cuando esté disponible, guardad una copia original en `data/raw/` y ejecutad el limpiador.

## Estructura

```text
.
├── data/
│   ├── raw/          # Datos originales, no modificados
│   └── processed/    # Datos listos para la visualización
├── src/arrels/
│   └── clean_data.py # Limpieza y normalización reproducible
├── tests/
│   └── test_clean_data.py
├── LICENSE
└── pyproject.toml
```

## Preparar el entorno

El limpiador usa únicamente la biblioteca estándar de Python.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

## Limpiar un dataset

Para un CSV:

```bash
python -m arrels.clean_data data/raw/dataset.csv \
  --output data/processed/dataset_clean.csv \
  --summary data/processed/dataset_summary.json
```

También acepta JSON con una lista de objetos:

```bash
python -m arrels.clean_data data/raw/dataset.json
```

El proceso:

- normaliza nombres de columnas a `snake_case`;
- elimina filas completamente vacías y duplicados;
- convierte valores vacíos a `null` en el resumen y conserva el CSV limpio;
- normaliza espacios y comillas en textos;
- convierte números con formatos habituales (`1.234,56`, porcentajes y separadores);
- genera un resumen con filas de entrada/salida, columnas y valores ausentes.

El script no presupone todavía los nombres definitivos del dataset. Cuando llegue el fichero, se podrán añadir reglas específicas para columnas de barrio, municipio, origen, destino y población sin alterar el flujo general.

## Convenciones de datos

No se deben subir datos personales ni identificadores que permitan reidentificar individuos. La visualización debe trabajar con datos agregados y respetar las condiciones de uso y atribución de la fuente oficial.

## Ejecutar tests

```bash
pytest
```

## Licencia

El código de este repositorio se distribuye bajo la licencia MIT. Los datos de terceros mantienen la licencia indicada por su fuente original; consultad `data/README.md` o la ficha del dataset antes de redistribuirlos.
