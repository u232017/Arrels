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

## Pendientes

- `cod_municipio_residencia = "NA"` en Tabla 9. Propuesta por defecto: mostrar como
  "residència desconeguda" en la lista, sin punto en el mapa.
- Barris piloto (Fase 3): candidatos y evidencia en `docs/PILOT_CANDIDATES.md`. ⛔ decide el equipo (D3).
