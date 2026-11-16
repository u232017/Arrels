# Adaptación de la web de Arrels

16 de noviembre de 2026 · Barri Lab

La entrada principal es ahora un mapa de Barcelona junto a una ficha de barrio. El Project Charter y el one-pager se usaron como especificación de producto. De la maqueta se tomó la composición de la web de escritorio. Los nombres, límites, precios y cifras mostrados provienen de las fuentes del proyecto y de las series oficiales indicadas abajo. La interfaz conserva la identidad de Arrels y el catalán del repositorio.

## Qué se puede hacer en la web

| Función | Resultado |
| --- | --- |
| Mapa de calor | Explorar los 73 barrios oficiales. La escala roja representa el cambio porcentual de visitantes regionales publicados frente a enero de 2023. La variación está disponible desde febrero de 2023. |
| Procedencias | Elegir entre municipios de residencia, viajes entre barrios y cambios de domicilio. Las flechas muestran los cinco orígenes principales hacia el barrio seleccionado. El grosor representa su cuota sobre el total publicado de la fuente elegida. La ficha incluye la cuota y el recuento agregado de los demás orígenes cuando se muestran viajes o cambios de domicilio. |
| Precios | Activar **Lloguer** o **Compravenda**. La capa y la ficha usan el trimestre completo correspondiente al mes seleccionado. El alquiler se expresa en euros por m² y mes y la compraventa en euros por m² construido. El rayado de color distingue los ámbitos ampliados y el rayado gris identifica los datos ausentes. |
| Cronología | Navegar por los 32 meses entre enero de 2023 y agosto de 2025, reproducir la secuencia y consultar la mediana mensual de la variación por barrio. |
| Ficha | Abrir un barrio desde el mapa o mediante el buscador, que admite búsquedas sin tildes. La ficha reúne indicadores, series con valores consultables, procedencias y enlaces de vivienda. La vista inicial abre la Vila de Gràcia en marzo de 2025, como en la maqueta. |
| Vivienda y ayudas | Consultar el Bo Lloguer Jove, el registro y las adjudicaciones de vivienda protegida, y el índice oficial de referencia del alquiler. Los portales mantienen la información sobre convocatorias, requisitos y vigencia. |
| Barri Match | Introducir superficie, presupuesto mensual y un importe hipotético de ayuda. La estimación usa el precio contractual por m² del último trimestre completo disponible hasta el mes elegido. Ordena los barrios que encajan por similitud de su composición de viajes entre barrios, calculada como uno menos la mitad de la distancia absoluta entre las cuatro proporciones de segmentos. |
| Barri Wrapped | Consultar y copiar un resumen anual del barrio con la procedencia de mayor volumen publicado, la media mensual de visitantes, el mes de mayor volumen y el cambio del alquiler entre trimestres disponibles. La ventana de 2025 termina en agosto. La redacción se genera con plantillas a partir de los valores precomputados. |

## Cómo se integraron las fuentes

- **Evaluación del dataset de Telefónica.** La Taula 9 aporta recuentos mensuales publicados de visitantes regionales por barrio y municipio de residencia. Se comprueba la unicidad de esa clave. El cálculo usa residencias conocidas de otros municipios de la provincia de Barcelona y aplica `(visitantes del mes / visitantes de enero de 2023) − 1`. Se obtuvieron **2.336 observaciones para los 73 barrios** y **31 cambios calculables por barrio** desde febrero de 2023. La comparación refleja también la estacionalidad. Las cuotas usan el total de esa misma población observada. En Wrapped, la suma mensual por procedencia se expresa como apariciones acumuladas.
- **Marco de compatibilidad 1C.** Se reutilizó la correspondencia validada uno a uno entre los códigos de Telefónica y los códigos municipales de barrio. La geometría WGS84 viene del catálogo oficial. Las flechas usan los puntos de capitales municipales que ya incluía el repo. Los totales de bajas del padrón de 2023 y 2024 se agrupan por distrito. El método conserva un intervalo de 0 a 4 casos posibles por celda censurada cuando la fuente contiene censura.
- **Alquiler.** Se reutilizó el panel validado de fases 2 y 3 y se añadió 2025 T3 del extracto oficial completo preparado en 1C. La referencia de la web contiene **735 valores a escala de barrio**. Cuando la fuente publica los ámbitos ampliados de Poble-sec–Parc Montjuïc o la Marina del Prat Vermell–Zona Franca, el mapa y la ficha muestran el valor bajo ese nombre. Match compara los precios a escala de barrio y el perfil de viajes entrantes por segmento.
- **Compraventa.** Se verifican código y nombre en los cuadros trimestrales de la Generalitat y se usa el precio medio por m² construido cuando hay al menos tres compraventas. La web contiene **750 valores a escala de barrio** y muestra los ámbitos ampliados cuando corresponde. Julio y agosto de 2025 muestran los precios de 2025 T3, que abarcan julio, agosto y septiembre. La movilidad termina en agosto.
- **Contraste residencial.** Metodologia muestra las bajas de 2023 y 2024 junto con la mediana del cambio de visitantes de los barrios de cada distrito que tienen los dos años completos. La suma anual para ese cálculo cuenta observaciones barrio–mes y puede volver a contar al mismo visitante en meses distintos. El panel muestra conjuntamente la serie de visitantes y la de precios del barrio. Ambos contrastes son descriptivos.
- **Viajes entre barrios de Telefónica.** Se suman los recuentos diarios publicados por par origen–destino y mes, de enero de 2023 a agosto de 2025. Se usa la correspondencia de códigos ya validada en 1C. El mapa y la ficha consultan los cinco orígenes principales y el total publicado de viajes entrantes desde otros barrios. Se verificaron las 2.336 combinaciones barrio–mes.
- **Cambios de domicilio entre barrios.** Se reutilizan los CSV anuales de 2023, 2024 y 2025 de Open Data BCN preparados en 1C. El exportador contrasta los 73 códigos `CODI_BARRI_DEST` y los nombres de origen con la dimensión oficial `pad_dimensions.csv` y la cartografía. El selector mensual consulta el año correspondiente para esta fuente. El reparto usa los cambios publicados entre barrios distintos y la ficha indica cuántos orígenes están censurados por tener menos de cinco casos y cuántos carecen de registro. Se verificaron las 219 combinaciones barrio–año.

## Diferencias respecto del alcance de investigación

El one-pager propone un índice de exilio basado en la frecuencia de visita y el peso del fin de semana. El notebook de evaluación documenta que la familia municipio–barrio tiene varias filas para la misma clave diaria. Sin aclarar ese grano, dividir los viajes de la Taula 3 por los visitantes de la Taula 9 produciría un índice sin validar. La capa y la ficha muestran por ello **cambio de visitantes regionales publicados**.

El extracto de bajas por emigración aporta cifras anuales por distrito. El nuevo extracto de cambios de domicilio identifica el barrio de origen y el de destino dentro de Barcelona. Quedan pendientes la validación de una medida de recurrencia y su contraste con destinos residenciales. También queda pendiente la prueba de usabilidad con cinco personas externas prevista por el Charter.

## Comprobación de la Marina del Prat Vermell

El alquiler se publica para el ámbito **la Marina del Prat Vermell – AEI Zona Franca** con el código 12. El panel analítico de fases 2 y 3 había dejado en blanco todos los precios de barrio con el estado `ambito_AEI_excluido`. La web conserva el dato oficial ampliado y muestra su nombre. [Panel analítico, primera fila del barrio](../../fases_2_y_3/resultados/panel_alquiler_movilidad_barrio_trimestre.csv#L112).

| Trimestre | `valor_original` del alquiler | `precio_eur_m2_mes` en el CSV preparado |
| --- | --- | --- |
| 2023 T1 | `0` | Vacío |
| 2023 T2 | `13.39285714` | `13.39285714` |
| 2023 T3 | `0` | Vacío |
| 2023 T4 | `0` | Vacío |
| 2025 T1 | `17.979454122043478` | `17.979454122043478` |

[CSV de alquiler preparado a partir del XLSX oficial](../../preparacion_fase2/resultados/alquiler_trimestral_2023_2025_completo_fuente.csv#L630). En compraventa, el fichero trimestral de 2023 incluye una operación en T2 y dos en T4 para el ámbito ampliado. Sus celdas de precio muestran `0` y la web las muestra sin dato. En 2025 T1 la fuente publica **6.637,26 €/m² construido** para el barrio. [Cuadros trimestrales de compraventa de la Generalitat](https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Barcelona/).

## Búsqueda de cambios de domicilio de barrio a municipio

La búsqueda de fuentes públicas de 2023 a 2025 no permitió verificar una matriz con barrio de origen y municipio de destino. El Ayuntamiento publica destinos concretos desde el conjunto de Barcelona, como Terrassa, y hay precedentes de tablas históricas de distrito a municipio. El INE publica indicadores de salidas por área submunicipal y los microdatos públicos de migración interior identifican el origen y destino por municipio. [Informe municipal reciente](https://dades.ajuntament.barcelona.cat/informe-padro-poblacio/es/seccio_6.html) · [Tabla municipal histórica de 2018](https://bcnroc.ajuntament.barcelona.cat/jspui/bitstream/11703/115046/1/dem18.pdf) · [Metodología por área submunicipal del INE](https://ine.es/metodologia/Info_EMCR_SCDs.pdf) · [Microdatos y variables del INE](https://ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177098&idp=1254735573002&menu=faq).

Barri Match compara el perfil por segmento de los viajes entre barrios. Quedan pendientes los componentes de frecuencia semanal, estacionalidad y conectividad que propone el one-pager. Barri Wrapped resume los indicadores observables de visita y alquiler. Los recursos de vivienda protegida enlazan el registro y las adjudicaciones oficiales a escala municipal.

## Archivos y ejecución

- [`web/src/map/`](../web/src/map/) contiene la nueva interfaz React y TypeScript. El mapa se dibuja en SVG con la geometría local y las series usan Recharts. La web puede cargar estos datos sin teselas ni un servidor de API. La vista anterior de tres pilotos sigue disponible en `?view=detail`.
- [`scripts/build_map_reference.py`](../scripts/build_map_reference.py) crea [`web/public/reference/map.json`](../web/public/reference/map.json) a partir de la cartografía, las salidas de 1C y fases 2–3, el diccionario oficial de códigos del padrón y los tres XLSX de compraventa.
- [`scripts/export_map.py`](../scripts/export_map.py) reutiliza las lecturas, cálculos de visitantes y coordenadas del pipeline DuckDB. Escribe los agregados en `web/public/data/map.json`, que queda excluido de Git.

Desde `Arrels`, con las dependencias instaladas:

```bash
cd web
npm run dev
```

Abre [la web local](http://localhost:5173/). Si falta la exportación local, siguen disponibles el mapa, los precios públicos y los recursos de vivienda. [La demostración](http://localhost:5173/?demo=1) identifica la movilidad simulada y usa las series públicas de vivienda. Un build local con `public/data/` presente incorpora la exportación en `dist/`. Esta entrega se ha trabajado localmente.

Para regenerar la movilidad con las rutas configuradas en `.env`, usa `make data` o ejecuta sus tres pasos desde la raíz:

```bash
.venv/bin/python -m pipeline.run
.venv/bin/python -m pipeline.export
.venv/bin/python scripts/export_map.py
```

Para regenerar la referencia, descarga los tres libros trimestrales de la página oficial de compraventa y pasa sus rutas:

```bash
.venv/bin/python scripts/build_map_reference.py \
  --prepared ../preparacion_fase2/resultados \
  --integrated ../fases_2_y_3/resultados \
  --sales /ruta/BCN_trimestral_2023.xlsx /ruta/BCN_trimestral_2024.xlsx /ruta/Trimestrals_Barcelona_2025.xlsx
```

## Verificación

- Build de producción y comprobación de tipos con `npm run build`.
- Regeneración completa de la referencia y de la exportación local. Se ejecutaron los tres comandos de Python porque `make` no estaba disponible en este entorno.
- 94 pruebas unitarias de frontend, 164 del pipeline y 28 casos Playwright validados en Chrome de escritorio y móvil. Las pruebas de mapa comprueban el selector de procedencias, los precios exactos y ampliados de la Marina, las celdas vacías y el primer cambio de febrero de 2023.
- Comprobación en Chrome con datos locales de Vila de Gràcia, búsqueda de Sant Antoni, cambio a compraventa, falta de datos de 2025 T3 y Barri Wrapped.

## Fuentes públicas

- Geometría municipal [Unidades administrativas de Barcelona, Ajuntament de Barcelona / Open Data BCN](https://datos.gob.es/es/catalogo/l01080193-unidades-administrativas-de-la-ciudad-de-barcelona).
- Puntos de residencia [Capitales de municipio georreferenciadas, Generalitat / ICGC](https://analisi.transparenciacatalunya.cat/d/wpyq-we8x).
- Precios [Alquiler contractual, Generalitat / Incasòl](https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/mercat_de_lloguer/lloguers-barcelona-per-districtes-i-barris/index.html) y [Compraventas registradas, Generalitat](https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Barcelona/).
- Padrón municipal [Personas emigrantes, Oficina Municipal de Dades](https://datos.gob.es/ca/catalogo/l01080193-personas-emigrantes).
- Cambios de domicilio por barrio de origen y destino, Open Data BCN, CC BY 4.0. [Dataset municipal](https://opendata-ajuntament.barcelona.cat/data/ca/dataset/pad_cdo_b_barri-des) y [diccionario de códigos del padrón](https://opendata-ajuntament.barcelona.cat/data/es/dataset/pad-dimensions/resource/b00be3f8-9328-4175-8689-24a25bc0907c).
- Recursos de vivienda [Bo Lloguer Jove](https://tramits.gencat.cat/ca/tramits/tramits-temes/22866_Bo_lloguer_joves?moda=1), [Registro y adjudicaciones](https://www.consorcihabitatge.barcelona/ca/acces-lhabitatge/registre-de-sollicitants) e [Índice estatal de referencia](https://serpavi.mivau.gob.es/).
