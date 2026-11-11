# Método — Arrels MVP

> Cómo se calcula cada número, en palabras sencillas. Arrels muestra **patrones, no causas**.
> Código: `pipeline/`. Decisiones: `docs/DECISIONS.md`. Datos: `docs/DATA_DICTIONARY.md`.

## 1. Fuentes y ventanas

| Fuente | Qué aporta | Ventana | Estado |
|---|---|---|---|
| Telefónica movilidad (Tabla 3) | Viajes diarios por origen y destino | 2023-01-01 → 2025-08-31 (diaria) | ✅ |
| Telefónica turismo, Tabla 9 | Visitantes regionales únicos por barri, mes y municipio de residencia | 2023-01 → 2025-08 (mensual) | ✅ |
| Festivos ES / CAT / BCN | Marcas diarias y mensuales | 2023 → 2025 | ✅ (fechas por verificar, T6) |
| Capitales de municipio georreferenciadas (Generalitat, ICGC) | Punto de cada municipio en el mapa | — | ✅ `pipeline/reference/municipality_centroids.csv` |
| Alquiler €/m² por barri y trimestre (Incasòl, vía Barcelona Dades) | Tarjeta de lloguer | 2023T1 → 2025T4 | ✅ |
| Padró por barri (1 de enero) | Residents, HUT por 1.000 | 2023, 2024, 2025 | ✅ (anual) |
| HUT (registro de viviendas de uso turístico) | HUT por 1.000 residents | 2025T2 | ✅ |

Cada valor de la web muestra su ventana al lado.

## 2. Reglas de calidad

**R1 — Días sin datos.** Faltan 3 días enteros (2024-02-11, 2025-04-13, 2025-05-20). Se guardan
como vacío (NULL), **nunca como 0**: un 0 inventaría una caída de movilidad.
Además (decisión D2), un día es **parcial** si está pegado a un día sin datos y tiene menos de la
mitad de los viajes de un día normal de la misma semana (mediana del mismo día de la semana).
Resultan 2025-04-12, 2025-05-19 y 2025-05-21. Los días parciales tampoco se usan en medias diarias.

**R2 — Tres estados.** Telefónica no publica cifras menores de 15.

- `published`: hay un valor de 15 o más.
- `suppressed`: en movilidad, una fila con `viajes = 0` significa "entre 0 y 14", no "cero".
- `absent`: no existe la fila. En turismo, las filas con menos de 15 se omiten, así que "suprimido"
  y "ausente" no se pueden distinguir y ambos cuentan como `absent`.

**R3 — Familias separadas.** Municipal, barri↔barri y mixta (municipio↔barri) miden cosas
distintas. El código no deja sumarlas ni mezclarlas (lanza un error).

**R4 — Uniones seguras.** Toda unión comprueba que el número de filas y la suma de la medida
(`viajes` o `visitantes`) son iguales antes y después, y que la tabla de la derecha no tiene claves
repetidas. Comprobado también con los datos reales: la caché tiene exactamente las mismas filas y
viajes que los CSV.

**R5 — Viajes y visitantes no miden lo mismo.** Tabla 3 cuenta viajes; Tabla 9 cuenta personas
distintas en el mes. Solo se comparan en rutas con datos en al menos el 80 % de los días (D1: un
día cuenta si tiene fila, aunque esté suprimida). Para contar visitantes se usa siempre Tabla 9.

## 3. Indicadores (por barri piloto y mes)

### Visitants regionals únics

> **V(barri, mes) = suma de `visitantes` de Tabla 9 de todos los municipios de residencia.**

En palabras: cuántas personas distintas que viven en otros municipios de la provincia de Barcelona visitaron el
barri ese mes, sin pasar la noche. Se suman municipios (cada persona vive en uno solo), pero
**nunca se suman meses**: la misma persona puede volver cada mes y se contaría dos veces. Para
un rango de meses se muestra la serie o la media mensual.

También se muestra **por municipio de residencia** (mapa y lista). Los visitantes con residencia
desconocida (`NA`, ~0,5 %) aparecen en la lista como "Residència desconeguda", sin punto en el mapa.

### Canvi vs any anterior

> **Canvi = media(V de los meses elegidos) / media(V de los mismos meses un año antes) − 1**

En palabras: cuánto ha subido o bajado la media mensual del periodo elegido respecto a los mismos
meses del año anterior. Comparar los mismos meses evita confundir estacionalidad (agosto, Navidad)
con cambio. Se oculta si falta alguno de esos meses (por ejemplo, para periodos de 2023).

### Quota de cap de setmana (viajes regionales)

> **Quota = 2·W / (2·W + 5·L)**
>
> W = media de viajes por día de fin de semana; L = media de viajes por día laborable.

En palabras: de los viajes de una semana típica hacia el barri, qué parte ocurre el sábado y el
domingo. Una semana con el mismo número de viajes cada día daría 2/7 ≈ 29 %.

Condiciones:

- Solo viajes `Regional` de municipio → barri (familia mixta).
- Solo rutas que cumplen D1 ese mes (fila en ≥ 80 % de los días).
- Solo días válidos: ni faltantes, ni parciales, ni festivos. Se usan medias por día (no sumas),
  así que un domingo que falta no hace bajar la quota.
- Los días suprimidos de una ruta (0–14 viajes) cuentan como 0; su proporción aparece en la insignia.

### Contexto

- Festivos del mes (marca en la serie temporal).
- Alquiler trimestral, residentes, HUT por 1.000 residentes (2025T2): pendientes de los ficheros.

## 4. Insignia de cobertura (en cada número)

| Campo | Significado |
|---|---|
| `window` | Periodo que cubre el dato |
| `pct_published` | % de las unidades (días-ruta o meses) con valor publicado |
| `pct_suppressed` | % suprimido (<15) |
| `pct_absent` | % sin fila |
| `n_routes` | Rutas usadas (solo quota de fin de semana) |

## 5. Selección de barris piloto

Puntuación transparente de suficiencia de datos: media simple de cinco partes entre 0 y 1
(% publicado, rutas útiles, meses de Tabla 9, municipios de Tabla 9, estabilidad). Detalle y
evidencia en `docs/PILOT_CANDIDATES.md`. Elegidos (D3): la Dreta de l'Eixample, Sants, Sant Andreu.

## 6. Limitaciones

- **"Visitants regionals" son residentes de otros municipios de la provincia de Barcelona** (todos
  los códigos de residencia empiezan por 08) e incluye movilidad por trabajo o estudio (Tabla 9 = excursionistas, sin
  pernoctación). No mide por sí solo un vínculo personal con el barri.
- Los valores por debajo de 15 no se conocen; en la quota de fin de semana cuentan como 0.
- Las fechas de festivos están por verificar con el DOGC; las festes majors están pendientes (T9).
- El padró es anual (no mensual) y el precio del alquiler es trimestral: son contexto, no se comparan mes a mes con los visitantes.
- Los datos de Telefónica son estimaciones a partir de líneas móviles, no recuentos censales.
- **Patrones, no causas:** ningún indicador explica por qué cambia algo.
