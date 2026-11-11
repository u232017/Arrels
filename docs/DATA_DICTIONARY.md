# Diccionario de datos — Arrels MVP

> Generado en la **Fase 0 (reconocimiento)**, 2026-11-09, con `scripts/recon.py` (DuckDB 1.1.3).
> Solo se documentan esquemas y agregados. Ningún dato a nivel de fila sale del portátil (NDA).
> Para reproducir: rellenar `.env` (ver `.env.example`) y ejecutar `python scripts/recon.py`.

## 1. Telefónica — movilidad (`MOBILITY_DIR`)

- Estructura: `MOBILITY_DIR/YYYY-MM/` × **32 meses** (2023-01 → 2025-08), 3 ficheros por mes.
- Nombres reales: `movilidad_{barrios,mun_barrios,municipios}_YYYY-MM_origen.csv` (sufijo `_origen`).
- Separador `,`, cabecera, 15 GB en total. Leer **todo como texto** (los códigos llevan ceros a la izquierda).

### Columnas

| Columna | Tipo | Descripción / observaciones |
|---|---|---|
| `day` | fecha `YYYY-MM-DD` (texto) | Día del viaje. Siempre coincide con el mes de la carpeta. |
| `day_of_week` | texto | En castellano: `Lunes` … `Domingo` (con tildes: `Miércoles`, `Sábado`). |
| `month` | texto `MM` | Mes con dos dígitos (`01`…`12`), sin año. |
| `origen` | categoría | `Internacional`, `Nacional`, `Regional`, `Residente`. |
| `municipio_origen` / `municipio_destino` | texto, 5 chars | Código INE (`08019` = Barcelona). |
| `*_name` | texto | Nombre del municipio / barrio. |
| `barrio_origen` / `barrio_destino` | texto, 9 chars o `-` | Código de barrio (`080190101`); `-` = sin barrio. No existen en la familia municipal. |
| `viajes` | entero | Viajes del día. `0` = publicado pero **<15** (supresión). Mínimo no nulo = 15. Sin decimales ni valores no numéricos. |

### Familias de granularidad (R3)

| Familia | Fichero | Filas | Filas `viajes=0` | Suma `viajes` |
|---|---|---:|---:|---:|
| barri ↔ barri | `movilidad_barrios_*` | 16.560.949 | 7.035.131 (42,5 %) | 1.920.012.572 |
| mixta mun ↔ barri | `movilidad_mun_barrios_*` | 85.823.522 | 66.675.559 (77,7 %) | 1.158.523.160 |
| municipal | `movilidad_municipios_*` | 64.880.151 | 47.644.677 (73,4 %) | 3.686.599.800 |

- **Mixta:** cada fila tiene **exactamente un** lado con `-` (42,8 M filas mun→barri, 43,0 M barri→mun). Nunca ambos ni ninguno.
- **barri ↔ barri:** nunca contiene `-`.
- ~2,7 M filas/mes en la mixta (el enunciado decía ~2,8 M).

Porcentaje de filas `viajes=0` (suprimidas) por `origen`:

| origen | barri↔barri | mixta | municipal |
|---|---:|---:|---:|
| Internacional | 55,2 % | 89,2 % | 84,1 % |
| Nacional | 64,6 % | 91,0 % | 82,0 % |
| Regional | 42,7 % | 66,0 % | 62,1 % |
| Residente | 17,3 % | 77,9 % | 80,2 % |

### Días sin datos (R1)

Calendario esperado: 974 días. Presentes: **971** en las tres familias. Faltan los mismos 3 días:

- **2024-02-11** (domingo)
- **2025-04-13** (domingo)
- **2025-05-20** (martes)

⚠️ **Hallazgo nuevo — días parciales junto a los huecos.** Los días adyacentes tienen volúmenes muy por debajo de la mediana de su día de la semana (barri↔barri):

| Día | Ratio vs mediana del mismo día de la semana |
|---|---:|
| 2025-05-21 | 0,26 |
| 2025-04-12 | 0,42 |
| 2025-05-19 | 0,46 |

Los demás días bajos son festivos (15-ago, 25/26-dic, 24-jun: 0,45–0,53), lo cual es esperable. Propuesta: marcar 2025-04-12, 2025-05-19 y 2025-05-21 como `partial` y excluirlos de los indicadores diarios (pendiente de decisión).

### Estados de calidad (R2)

| Estado | Movilidad | Turismo |
|---|---|---|
| `published` | fila con `viajes ≥ 15` | fila presente (`visitantes ≥ 15`) |
| `suppressed(<15)` | fila con `viajes = 0` | no se distingue: la fila se omite |
| `absent` | la fila no existe (o día faltante) | la fila no existe |

## 2. Telefónica — turismo (`TOURISM_DIR`)

- Estructura: `TOURISM_DIR/YYYYMM/` × **32 meses** (202301 → 202508), 9 ficheros por mes, separador `;`.
- ⚠️ La columna **`mes` contiene `YYYYMM`** (p. ej. `202301`), no el número de mes. `año` es `YYYY`.
- Mínimo de `visitantes` = 15 en todas las tablas de barrio (las filas <15 se omiten, confirmado).
- Sin valores no numéricos.

| Fichero | Filas (32 meses) | Columnas |
|---|---:|---|
| `visitantes_regionales_barrio_yearmon` (**Tabla 9**) | 385.959 | `año;mes;cod_barrio;cod_municipio;desc_municipio;tipo_visitante;cod_municipio_residencia;municipio_residencia;visitantes` |
| `visitantes_unicos_barrio_yearmon` | 11.667 | `año;mes;cod_municipio;cod_barrio;desc_municipio;origen;tipo_visitante;visitantes` |
| `visitantes_unicos_barrio_date_dt` | 350.537 | + `date_dt` |
| `visitantes_unicos_municipio_yearmon` | 160 | sin barrio |
| `visitantes_unicos_municipio_date_dt` | 4.855 | sin barrio, + `date_dt` |
| `visitantes_nacionales_barrio_yearmon` | 183.178 | + `provincia_residencia` |
| `visitantes_internacionales_barrio_yearmon` | 296.121 | + `pais_residencia` |
| `visitantes_sociodemografico_barrio_yearmon` | 312.345 | + `genero;edad;nivel_renta` |
| `pernoctaciones_semana` | 1.942 | `año;mes;semana;periodo;cod_municipio;desc_municipio;origen;pernoctaciones;visitantes` |

### Tabla 9 — detalles

- `tipo_visitante`: solo `Excursionista` (confirmado).
- Solo `cod_municipio = 08019` (Barcelona). **73 barrios** distintos (todos los de la ciudad), códigos de 9 caracteres.
- 283 municipios de residencia con código de 5 caracteres.
- ⚠️ `cod_municipio_residencia = "NA"` (residencia desconocida): 2.336 filas, 971.530 visitantes (0,5 %). Tratarlo como categoría "desconeguda", nunca como municipio.
- Sin claves duplicadas `(mes, cod_barrio, cod_municipio_residencia)`.

## 3. Comparación Tablas 3 vs 9 (R5) — marzo 2025

Rutas municipio → barrio de visitantes `Regional` (familia mixta) unidas con Tabla 9: **11.947 rutas**.

| Medida | Valor |
|---|---:|
| Rutas con viajes < visitantes únicos (todas) | 80,8 % |
| Rutas presentes ≥80 % de los días | 49,4 % |
| … de ellas, con viajes < visitantes | **62,5 %** (coincide con el 62 % del enunciado) |
| Rutas **publicadas (≥15)** ≥80 % de los días | 14,5 % |
| Mediana de días publicados por ruta | 1 de 31 |

Conclusión: el 62 % del enunciado corresponde a "días con fila" (incluidas suprimidas). Si "cobertura" significa días con valor **publicado**, solo el 14,5 % de las rutas pasa el umbral del 80 %. Hay que fijar la definición (ver preguntas abiertas).

## 4. Fuentes complementarias

| Fuente | Ruta | Estado |
|---|---|---|
| Alquiler €/m² por barri y trimestre | `pipeline/reference/rent_pilot_quarters.csv` (o `RENT_FILE`) | ✅ Barcelona Dades, *Preu mitjà per superfície (€/m²) del lloguer d'habitatges* (Incasòl, CC-BY 4.0), 2023T1–2025T4, 3 barris piloto, copiado de la tabla trimestral el 2026-11-11 |
| Población por barri | `POPULATION_FILE` (carpeta) | ✅ Open Data BCN `pad_mdbas` (padró a 1 de enero, por sección censal, CC-BY 4.0): 2023, 2024, 2025. **Anual, no mensual** |
| HUT (2025T2) | `HUT_FILE` | ✅ Open Data BCN `habitatges-us-turistic`, `2025_2T_hut_comunicacio_opendata.csv` (CC-BY 4.0); solo se usa el recuento por barri |
| Migración residencial | `MIGRATION_FILE` | opcional, `none` |

Las cifras de enlace del equipo (97,3 %, 100 %, 95,33 %) se refieren a sus ficheros validados y no se han podido verificar; aquí se usan las fuentes públicas (decisión D6).

## 5. Datos públicos de referencia (versionados en Git)

| Fichero | Fuente | Columnas |
|---|---|---|
| `pipeline/reference/holidays.csv` | Calendario laboral oficial (DOGC) y fiestas locales de Barcelona — fechas por verificar | `day, scope (ES/CAT/BCN), name_ca, source` |
| `pipeline/reference/municipality_centroids.csv` | Generalitat de Catalunya, *Capitals de municipi georeferenciades* (analisi.transparenciacatalunya.cat, `wpyq-we8x`; ICGC Base municipal 1:5.000), descargado el 2026-11-11. 947 municipios | `code` (INE, 5 dígitos), `lat`, `lon` |

| `pipeline/reference/pilot_centroids.csv` | Ajuntament de Barcelona, Open Data BCN, *Districtes i barris* (`BarcelonaCiutat_Barris.csv`, CC-BY 4.0), descargado el 2026-11-11. Centroide del polígono WGS84 de los 3 barris piloto | `code, name, lat, lon` |

Regenerar los centroides: `python -I -m pipeline.centroids <ruta/al/export.csv>`.

## 6. Preguntas abiertas

1. ¿Dónde están los ficheros de alquiler, población y HUT validados por el equipo?
2. ~~R5: definición de cobertura~~ → **Resuelto (D1):** días con fila, incluidas las suprimidas.
3. ¿Marcamos como `partial` los días adyacentes a los huecos (2025-04-12, 2025-05-19, 2025-05-21)?
4. Tabla 9: ¿mostramos `NA` como "residència desconeguda" o la excluimos del mapa?
