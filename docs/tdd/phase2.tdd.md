# Evidencia TDD — Fase 2 (pipeline)

**Plan:** `docs/PLAN.md` (T1–T7a) · **Fecha:** 2026-11-11 · **Ramas:** `feat/t1-skeleton` → `feat/t2-quality-tests` → `feat/t3-t5-core` → `fix/phase2-review`

## Historias de usuario

- Como analista, quiero que los días sin datos queden como NULL y no como 0, para no inventar caídas de movilidad (R1).
- Como analista, quiero distinguir publicado / suprimido (<15) / ausente, para no confundir "pocos viajes" con "sin dato" (R2).
- Como analista, quiero que las familias de granularidad nunca se mezclen (R3) y que ninguna unión cambie filas ni totales (R4).
- Como analista, quiero que viajes/visitantes solo se calcule en rutas con fila en ≥80 % de los días (R5, D1).
- Como equipo, quiero que el pipeline corra en un portátil: <30 min en bruto, <2 min desde caché.

## Ciclos RED → GREEN

| Paso | Commit | Evidencia |
|---|---|---|
| T1 config RED→GREEN | `1b49020` | `pytest tests/test_config.py` → ImportError (RED) → 8 passed |
| T2 reglas R1–R5 RED | `da9c3f3` | `pytest tests/test_rules.py` → 33 failed (NotImplementedError), 1 passed |
| T3–T5 GREEN | `a601fb6` | `pytest tests` → 42 passed |
| T3/T6/T7a RED | caché + festivos | `pytest tests/test_cache_and_holidays.py` → 17 failed |
| T3/T6/T7a GREEN | `aa2737d` | `pytest tests` → 59 passed |
| Revisión RED | regresiones de `python-reviewer` y `database-reviewer` | 9 failed, 6 passed |
| Caché por mes RED | tras quedarse sin disco en datos reales | 4 failed, 14 passed |
| Revisión GREEN | `fix/phase2-review` | `make test` → 75 passed, cobertura 96 % |

## Garantías

| # | Garantía | Test | Resultado |
|---|---|---|---|
| 1 | Los días sin filas se detectan y su total es NULL, no 0 | `TestR1MissingDays` | PASS |
| 2 | Día bajo junto a un hueco → `partial`; día bajo aislado (festivo) → `ok` | `TestR1MissingDays` | PASS |
| 3 | `viajes=0` → suprimido; >0 → publicado; ausente se deriva sin rejilla | `TestR2States` | PASS |
| 4 | Un día con filas 0 y >0 cuenta una vez (publicado + suprimido = con fila) | `TestCoverageEdges` | PASS |
| 5 | Valores 1–14, negativos o no numéricos rompen el contrato | `TestR2States`, `TestContractEdges` | PASS |
| 6 | Mezclar familias o usar otra familia en cobertura → `FamilyMixError` | `TestR3Families` | PASS |
| 7 | Fila mixta sin exactamente un lado barri (también campo vacío) → error | `TestR3Families`, `TestContractEdges` | PASS |
| 8 | Códigos con ceros a la izquierda se conservan; `-` → NULL | `TestR3Families` | PASS |
| 9 | `checked_join`: mismas filas y suma; clave derecha única; claves en ambos lados; tolerancia float | `TestR4Joins`, `TestJoinHardening` | PASS |
| 10 | Ratio viajes/visitantes NULL bajo 80 % de días con fila (D1) | `TestR5TripsVsVisitors` | PASS |
| 11 | Claves duplicadas en Tabla 9 → error | `TestCoverageEdges` | PASS |
| 12 | Caché por mes: se reutiliza, solo reconstruye el mes cambiado, `FORCE_REBUILD`, versión de código, manifiesto corrupto | `TestParquetCache`, `TestCacheHardening` | PASS |
| 13 | Festivos: una fila por fecha, ámbito correcto, banderas diaria y mensual | `TestHolidays`, `TestHolidayFile` | PASS |

## Verificación con datos reales (portátil de DP, 2026-11-11)

| Medida | Resultado | Objetivo |
|---|---|---|
| `make data` en frío (15 GB CSV) | **100 s** | < 30 min |
| `make data` desde caché | **11 s** | < 2 min |
| Filas y suma de `viajes` en caché vs CSV (3 familias) | idénticas | iguales (R4) |
| Días faltantes | 2024-02-11, 2025-04-13, 2025-05-20 | = Fase 0 |
| Días parciales | 2025-04-12, 2025-05-19, 2025-05-21 | = propuesta Fase 0 |
| Rutas con `days_absent < 0` | 0 | 0 |
| Tamaño de la caché | ~430 MB | — |

## Huecos conocidos

- `pipeline/run.py` (orquestación) está excluido de la cobertura; se valida con las ejecuciones reales.
- Las fechas de `pipeline/reference/holidays.csv` deben verificarse contra el DOGC (JV, T6).
- Disco: el portátil tenía 16–17 GB libres; la primera versión (un único COPY) agotó el disco temporal. Resuelto con ingesta por mes.
