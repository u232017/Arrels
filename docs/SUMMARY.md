# Resumen final — Arrels MVP

**Equipo:** Barri Lab (201_F, UPF) · **Reto:** Telefónica Mobile Data Challenge 2026, Challenge #3
**Fecha:** 2026-11-11 · **Entrega:** 04/12/2026
**Estado:** pipeline, notebook y web funcionando con datos reales para 3 barris piloto. Falta
integrar alquiler, población y HUT (ficheros no disponibles).

## Cómo ejecutarlo

```bash
make setup                 # Python 3.12 + dependencias web
cp .env.example .env       # rellenar rutas locales a los datos
make test                  # 134 tests, cobertura 91,9 %
make data                  # pipeline + export JSON (42–100 s en frío, ~11 s desde caché)
make notebook              # notebook reproducible (111 s en frío, 11–19 s desde caché)
make web-dev               # página en http://localhost:5173
```

## Change log

| Fecha | Cambio | Fase |
|---|---|---|
| 2026-11-09 | Reconocimiento de datos con DuckDB; `DATA_DICTIONARY.md`; `.gitignore` endurecido (NDA) | 0 |
| 2026-11-09 | `PLAN.md` (27 tareas, ~115 h) revisado por el agente `architect`; decisión D1 (cobertura R5) | 1 |
| 2026-11-11 | Paquete `pipeline/` (config, ingest, quality, aggregate, integrate, holidays, cache) con TDD; tests R1–R5 | 2 |
| 2026-11-11 | Ingesta por mes a Parquet (cabe en un portátil; solo reconstruye meses cambiados) | 2 |
| 2026-11-11 | Puntuación de suficiencia de datos y top 5; decisión D3 (Dreta de l'Eixample, Sants, Sant Andreu) | 3 |
| 2026-11-11 | Indicadores: visitantes T9, cambio vs 2023, cuota de fin de semana; `METHOD.md`; notebook | 4 |
| 2026-11-11 | Contrato JSON (`contract/arrels.schema.json`) y export validado (≥15, <5 MB) | 5 |
| 2026-11-11 | Página web única (Vite + React + TS) en catalán, con insignias, mapa, serie y limitaciones | 5 |
| 2026-11-11 | Centroides oficiales de municipios (Generalitat/ICGC) para el mapa | 5 |
| 2026-11-11 | Revisión de código, escaneo de seguridad, cobertura, verificación y clon limpio | 6 |
| 2026-11-11 | Dependencias web actualizadas (MapLibre 6.16, Vite 6.4, Vitest 3.2); producción sin vulnerabilidades | 6 |

## Issue log

| # | Problema | Severidad | Estado |
|---|---|---|---|
| I1 | La copia de movilidad en `data/raw/output_limite_legal` estaba vacía (copia fallida); se usa la de `~/Downloads` vía `.env` | Media | Resuelto (ruta en `.env`) |
| I2 | Ficheros de alquiler, población y HUT no localizados; cifras de enlace del enunciado sin verificar | Alta | **Abierto** (B1) |
| I3 | Días parciales junto a los 3 días sin datos (2025-04-12, 2025-05-19, 2025-05-21) | Media | Resuelto (D2, pendiente de confirmar) |
| I4 | El 62 % de R5 solo se reproduce contando días con fila (incl. suprimidas); con días publicados sería 14,5 % | Media | Resuelto (D1) |
| I5 | El limpiador antiguo `clean_data.py` convertía `08019` en 8019 y `-` en null | Alta | Resuelto (retirado) |
| I6 | La primera ingesta agotó el disco temporal (15 GiB) con un único COPY ordenado | Alta | Resuelto (ingesta por mes) |
| I7 | Bugs encontrados por revisores: doble conteo de días-ruta, campos barri vacíos sin detectar, claves duplicadas sin control, rutas SQL sin escapar | Alta | Resuelto (tests de regresión) |
| I8 | Web: respuestas tardías al cambiar de barri, rango no reajustado, JSON sin validar, mapa recreado en cada render | Alta | Resuelto (tests de regresión) |
| I9 | MapLibre 4.7 con XSS conocido (GHSA-jrc7-96c5-q579); MapLibre 6 rompía el worker del mapa | Alta | Resuelto (+ test e2e del mapa) |
| I10 | 7 avisos de `npm audit` solo en herramientas de test (Vitest 3) | Baja | Aceptado (T1 del backlog) |
| I11 | AgentShield no se ejecutó (permiso bloqueado en la sesión) | Media | **Abierto** (B4) |
| I12 | Fechas de festivos sin verificar; festes majors pendientes | Media | **Abierto** (B2, B3) |
| I13 | Portátil con solo ~16 GB libres | Baja | A tener en cuenta |
| I14 | `make setup` no instalaba dependencias web (visto en el clon limpio) | Baja | Resuelto |

## Preguntas para la próxima reunión con el mentor

1. **"Visitants regionals" incluye movilidad laboral** (Tabla 9 = excursionistas). ¿Lo aceptamos y lo
   explicamos en "Mètode i limitacions", o buscamos una forma de separarlo?
2. ¿Confirmamos la regla de **días parciales** (D2)?
3. La **cuota de fin de semana** (~17–18 %) está muy por debajo del 28,6 % de una semana uniforme.
   ¿Es útil como indicador o lo sustituimos?
4. ¿Mostramos los visitantes con **residencia desconocida** (`NA`, ~0,5 %) solo en la lista?
5. ¿Hay plazo para recibir los ficheros de **alquiler, población y HUT** antes del 04/12?
6. ¿La elección de barris piloto (D3) debe priorizar solo datos, o también variedad de perfiles?

## Definition of Done (enunciado §6)

| Criterio | Estado |
|---|---|
| `make test` verde; tests R1–R5 existen y pasan | ✅ 134 tests, 91,9 % |
| Notebook < 30 min en bruto y < 2 min desde caché | ✅ 111 s / 11–19 s |
| Toda unión mantiene filas y suma de `viajes` (afirmado) | ✅ `checked_join` + caché idéntica a los CSV |
| Web con JSON estático < 5 MB, 2–3 barris, insignia en cada número | ✅ 399 KB, 3 barris, insignias en KPIs, mapa y serie |
| Sin datos en Git; `/security-scan` limpio; ningún valor exportado < 15 | ⚠️ Sin datos en Git y ningún valor < 15; AgentShield pendiente (B4) |
| Sin lenguaje no neutral (grep exili/expuls/echa/culpa) | ✅ |
| `docs/` completo + este resumen | ✅ (alquiler/población/HUT pendientes) |

## Registros de revisión

- `docs/tdd/phase2.tdd.md` — evidencia TDD del pipeline
- `.claude/reviews/phase6-code-review.md`
- `.claude/reviews/phase6-security-scan.md`
- `.claude/reviews/phase6-verification.md`
