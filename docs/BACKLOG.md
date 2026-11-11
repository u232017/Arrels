# Backlog — fuera del MVP

> Ideas y trabajo pendiente que **no** entran en la entrega del 04/12/2026. Se revisa en cada
> reunión con el mentor.

## Fuera de alcance por decisión (enunciado §3)

| Idea | Motivo |
|---|---|
| Barri Match | Fuera del MVP |
| Barri Wrapped | Fuera del MVP |
| Capa de ayudas a la vivienda | Fuera del MVP |
| Más de 3 barris | Priorización territorial (Iteración 2) |
| Predicciones | Arrels muestra patrones, no causas ni pronósticos |
| Datos a nivel individual | NDA y privacidad |
| Autenticación | Página estática pública dentro del equipo |
| Backend / API | JSON estático es suficiente |
| Despliegue más allá de un build estático | Fuera del MVP |

## Pendiente para completar el MVP

| # | Tarea | Bloqueo | Resp. |
|---|---|---|---|
| B1 | Integrar alquiler, población y HUT (T7b) y mostrarlos en las tarjetas de contexto | Faltan los ficheros | JV / DP |
| B2 | Verificar las fechas de `pipeline/reference/holidays.csv` contra el DOGC y las fiestas locales de Barcelona | — | JV |
| B3 | Festes majors de Dreta de l'Eixample, Sants y Sant Andreu 2023–2025 (T9) | Buscar fuentes oficiales | BR |
| B4 | Ejecutar AgentShield (`npx --yes ecc-agentshield@1.6.0 scan --path .`); en esta sesión el permiso lo bloqueó | Ejecutarlo a mano | AI |
| B5 | Migración residencial anual (opcional) | Integración pendiente | JV |

## Mejoras técnicas (después del 04/12)

| # | Mejora | Por qué |
|---|---|---|
| T1 | Subir Vitest a ≥ 4 | Quedan 7 avisos de `npm audit` solo en herramientas de test (ver `.claude/reviews/phase6-security-scan.md`) |
| T2 | ESLint para `web/` | Hoy solo `tsc --strict` |
| T3 | Estilo de mapa oscuro en modo oscuro | El mapa base es siempre claro |
| T4 | Test de accesibilidad automático (axe) en e2e | Hoy: contraste calculado a mano, etiquetas y teclado en tests |
| T5 | CI (GitHub Actions) con `make test`, `make lint` y e2e sobre la muestra sintética | Hoy todo se ejecuta en local |
| T6 | Mapa base propio (sin depender de OpenFreeMap) | Dependencia externa en tiempo de ejecución |
