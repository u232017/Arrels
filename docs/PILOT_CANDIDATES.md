# Candidatos a barris piloto — Fase 3

> Generado el 2026-11-11 con `scripts/pilot_report.py` (puntuación en `pipeline/pilot.py`).
> Ventana: 2023-01 → 2025-08 (32 meses), 73 barris. Solo agregados por barri, nunca filas.
> ⛔ **El equipo elige 2–3 barris.** La decisión se registra en `DECISIONS.md` (D3).

## Cómo se puntúa (en palabras sencillas)

Cinco partes, cada una entre 0 y 1. La puntuación es su **media simple** (sin pesos ocultos).

| Parte | Qué mide | Por qué importa |
|---|---|---|
| **% publicat** | De los días con fila de viajes regionales municipio→barri, cuántos son publicados (≥15) y no suprimidos | Menos supresión = series diarias más completas |
| **rutes útils** | Rutas municipio→barri que cumplen D1 (fila en ≥80 % de días) en un mes típico, dividido por el mejor barri | Base del indicador de fin de semana (R5) |
| **mesos T9** | Meses con datos de Tabla 9 / 32 | Serie de visitantes completa |
| **municipis T9** | Municipios de residencia conocidos por mes en Tabla 9, dividido por el mejor barri | Base del mapa de residencia |
| **estabilitat** | Meses cuyo total de visitantes está entre 0,5× y 2× su mes mediano / 32 | Series sin saltos raros |

**Alquiler, población y HUT:** pendientes (no tenemos los ficheros). No forman parte de la
puntuación; se comprobarán para los barris elegidos en cuanto lleguen (T7b).

## Top 5

| # | Barri | Score | % publicat | Rutes útils | Mesos T9 | Municipis T9 | Estabilitat | Por qué destaca |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | **la Dreta de l'Eixample** (080190203) | 0,923 | 0,61 | 1,00 | 1,00 | 1,00 | 1,00 | Mejor en todo: 156 rutas útiles/mes, 251 municipios/mes, menor supresión |
| 2 | **Sants** (080190308) | 0,858 | 0,54 | 0,85 | 1,00 | 0,90 | 1,00 | 2.º en supresión baja; 133 rutas útiles/mes |
| 3 | **la Marina del Prat Vermell** (080190302) | 0,858 | 0,51 | 0,91 | 1,00 | 0,86 | 1,00 | 2.º en rutas útiles (143/mes) — ver advertencia |
| 4 | **Sant Gervasi - Galvany** (080190505) | 0,845 | 0,47 | 0,85 | 1,00 | 0,91 | 1,00 | Perfil equilibrado |
| 5 | **l'Antiga Esquerra de l'Eixample** (080190204) | 0,844 | 0,46 | 0,84 | 1,00 | 0,92 | 1,00 | Muchos municipios de origen (230/mes) |

### Top 15 con evidencia completa

| # | codi | barri | score | % publicat | rutes útils | mesos T9 | municipis T9 | estabilitat | rutes/mes | mesos T9 | municipis/mes | visitants/mes | mesos estables |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 080190203 | la Dreta de l'Eixample | 0.923 | 0.61 | 1.0 | 1.0 | 1.0 | 1.0 | 156.4 | 32 | 250.7 | 472794.0 | 32 |
| 2 | 080190308 | Sants | 0.858 | 0.54 | 0.85 | 1.0 | 0.9 | 1.0 | 133.1 | 32 | 226.1 | 255756.0 | 32 |
| 3 | 080190302 | la Marina del Prat Vermell | 0.858 | 0.51 | 0.91 | 1.0 | 0.86 | 1.0 | 143.1 | 32 | 216.2 | 155463.0 | 32 |
| 4 | 080190505 | Sant Gervasi - Galvany | 0.845 | 0.47 | 0.85 | 1.0 | 0.91 | 1.0 | 132.2 | 32 | 229.0 | 172820.0 | 32 |
| 5 | 080190204 | l'Antiga Esquerra de l'Eixample | 0.844 | 0.46 | 0.84 | 1.0 | 0.92 | 1.0 | 131.4 | 32 | 230.0 | 189189.0 | 32 |
| 6 | 080190401 | les Corts | 0.841 | 0.47 | 0.83 | 1.0 | 0.91 | 1.0 | 130.1 | 32 | 227.3 | 201661.0 | 32 |
| 7 | 080190904 | Sant Andreu | 0.837 | 0.5 | 0.82 | 1.0 | 0.87 | 1.0 | 128.0 | 32 | 217.8 | 180499.0 | 32 |
| 8 | 080190903 | el Bon Pastor | 0.829 | 0.48 | 0.81 | 1.0 | 0.86 | 1.0 | 126.6 | 32 | 214.9 | 193277.0 | 32 |
| 9 | 080190402 | la Maternitat i Sant Ramon | 0.826 | 0.42 | 0.82 | 1.0 | 0.89 | 1.0 | 128.0 | 32 | 222.4 | 164301.0 | 32 |
| 10 | 080190102 | el Barri Gòtic | 0.82 | 0.42 | 0.76 | 1.0 | 0.92 | 1.0 | 119.3 | 32 | 230.4 | 231466.0 | 32 |
| 11 | 080190504 | Sant Gervasi - la Bonanova | 0.814 | 0.41 | 0.78 | 1.0 | 0.87 | 1.0 | 122.1 | 32 | 218.8 | 134226.0 | 32 |
| 12 | 080190205 | la Nova Esquerra de l'Eixample | 0.805 | 0.4 | 0.75 | 1.0 | 0.87 | 1.0 | 117.3 | 32 | 218.6 | 144024.0 | 32 |
| 13 | 080190301 | el Poble-sec | 0.805 | 0.39 | 0.73 | 1.0 | 0.9 | 1.0 | 114.5 | 32 | 225.3 | 195226.0 | 32 |
| 14 | 080190502 | Sarrià | 0.8 | 0.4 | 0.78 | 1.0 | 0.88 | 0.94 | 121.8 | 32 | 221.8 | 151898.0 | 30 |

## Robustez

- Quitando cada parte de una en una, el **top 5 no cambia**, salvo al quitar "municipis T9":
  entra Sant Andreu (#7) y sale l'Antiga Esquerra (#5).
- **"mesos T9" no discrimina:** los 73 barris tienen los 32 meses (desviación 0). Se mantiene por
  transparencia, pero no influye en el orden.
- Del #2 al #11 la diferencia es pequeña (0,86 → 0,81). Elegir dentro del top 10 apenas cambia la
  calidad de los datos, así que el equipo puede elegir también por interpretabilidad y variedad.

## Advertencias para interpretar (no son causas, son límites de los datos)

1. **Tabla 9 cuenta "Excursionistas":** visitantes regionales sin pernoctación. Eso incluye
   desplazamientos por trabajo o estudio. En barris con muchas oficinas o industria, "visitants
   regionals" refleja sobre todo movilidad laboral, no necesariamente vínculo personal con el barri.
2. **la Marina del Prat Vermell** incluye el área industrial de la Zona Franca y tiene pocos
   residentes (verificar con el padrón). Sus datos son abundantes pero probablemente dominados por
   trabajo; los indicadores "por residente" serían muy inestables.
3. **la Dreta de l'Eixample** es un centro de oficinas y comercio: los mejores datos, con la
   misma advertencia sobre movilidad laboral.

## Propuesta para debatir (el equipo decide)

Una combinación con buenos datos y perfiles distintos:

- **la Dreta de l'Eixample** — los mejores datos de la ciudad (centro).
- **Sants** — #2, barri residencial con mucha conexión regional.
- **Sant Andreu** (#7) o **les Corts** (#6) — residenciales, más fáciles de interpretar que la
  Marina del Prat Vermell, con una pérdida de puntuación muy pequeña (0,84 vs 0,86).

## Preguntas para la reunión con el mentor

1. ¿Aceptamos que "visitants regionals" (Excursionista) incluye movilidad laboral y lo decimos en
   "Mètode i limitacions"?
2. ¿Priorizamos solo la puntuación de datos, o también la variedad de perfiles (central / residencial)?
