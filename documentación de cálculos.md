# Dashboard NLACE – Reglas de negocio y cálculos

Documento de referencia (8 de octubre de 2026). Explica qué filas cuenta cada página del dashboard y cómo se calcula cada cifra. Las páginas se verificaron contra el código; la sección de módulos de carga resume `MODULOS_CARGA.md`.

## Cómo funciona el dashboard (base común)

Todas las páginas leen los mismos registros contables de NLACE y los filtran por período; lo que cambia entre páginas es qué filas cuentan y qué fecha se usa para ubicarlas en el tiempo.

**Fuente de datos.** Una sola vista de Supabase (`registros_contables`) que une cuatro tablas: `ventas` (Tipo Ingreso), `costos` (Costo), `gastos` (Gasto) y `remuneraciones` (Remun, retiros del director). Se descarga completa, solo de la empresa NLACE, y las páginas calculan en memoria. Todos los montos son `monto_bruto` en pesos chilenos (CLP).

**Dos fechas, dos lógicas.**

| Lógica | Fecha usada | Dónde se usa |
| --- | --- | --- |
| Devengado (cuándo se generó el ingreso o gasto) | `Mes_economico` (formato AAAA-MM) | Resumen, Ingresos, Costos, Gastos, Estado de Resultado, base del Forecast |
| Caja (cuándo entró o salió la plata) | `Fecha_Pago` | Cashflow, cobranzas (DSO) |

**Estados de una factura de venta.** `Emitida` (aún no pagada), `Pagada` (pago total) y `Pagada_parcial`. Costos, gastos y remuneraciones cargados desde la cartola del banco entran siempre como `Pagada`.

**Clasificación de filas** (reglas fijas del código):

- Venta: Tipo Ingreso y cuenta `5101-01`.
- Otro ingreso: Tipo Ingreso con cualquier otra cuenta.
- Costo: Tipo Costo.
- Gasto operacional: Tipo Gasto. La remuneración del director (Tipo Remun) queda fuera de los gastos.
- Una venta cuenta como devengada si su estado es Emitida, Pagada o Pagada_parcial (excluye Anticipo, Anulada y similares).

**Filtro de período global.** Un selector común (Año, Mes, Rango o Comparar) que filtra por `Mes_economico`. En modo Comparar se calculan dos períodos (A y B) y los KPIs muestran la variación. Un rango sin extremos devuelve cero filas a propósito.

**Fechas en formato chileno.** Las fechas se interpretan siempre como fecha local (día, mes, año) y nunca como UTC. Un error previo hacía que pagos del 1 de abril aparecieran en marzo en el Cashflow.

## Resumen Ejecutivo

Muestra el estado de resultados del período en cinco KPIs, un gráfico de ventas con margen y una tabla de cobertura del punto de equilibrio. Todo es devengado, por `Mes_economico`.

| KPI | Cálculo |
| --- | --- |
| Ventas | Suma de ventas (cuenta 5101-01) con estado Emitida, Pagada o Pagada_parcial |
| Otros ingresos | Suma de ingresos que no son cuenta 5101-01, con los mismos estados |
| Costos | Suma de todos los registros Tipo Costo |
| Gastos operacionales | Suma de todos los registros Tipo Gasto (no incluye remuneración del director) |
| Utilidad bruta | Ventas − Costos |
| Utilidad operacional | Utilidad bruta − Gastos |
| Margen bruto | Utilidad bruta ÷ Ventas (0 si no hay ventas) |
| Margen operacional | Utilidad operacional ÷ Ventas |

El color del KPI Margen Bruto es verde con 30% o más, ámbar entre 10% y 30%, y rojo bajo 10%. Los otros ingresos no entran en la utilidad bruta ni en la operacional.

**Modo comparativo.** Cada KPI muestra el valor del período B y la variación. Ventas, costos, gastos y otros ingresos usan variación porcentual: (A − B) ÷ |B|, sin dato si B es cero. Los márgenes usan diferencia en puntos porcentuales (25% vs 20% da +5 pp, no +25%). En costos y gastos, subir se muestra como negativo.

**Gráfico Ventas y Margen.** Barras = ventas del mes. Línea = margen operacional mensual: (Ventas − Costos − Gastos) ÷ Ventas × 100, y 0 si el mes no tiene ventas.

**Punto de equilibrio (PE) mensual.** Supone que los costos son variables y los gastos operacionales son fijos.

```
PE = Gastos operacionales ÷ ((Ventas − Costos) ÷ Ventas)
```

- Gap = Ventas − PE.
- Cobertura = Ventas ÷ PE (verde desde 100%).
- Si el margen de contribución del mes es cero o negativo, el PE queda en cero y se muestra "Sin datos".
- La tabla no aparece en modo comparativo.

## Ingresos

Separa las ventas (cuenta 5101-01) de los otros ingresos y los muestra devengados por `Mes_economico`.

| Elemento | Cálculo |
| --- | --- |
| Ventas | Ventas con estado Emitida, Pagada o Pagada_parcial del período |
| Otros ingresos | Ingresos de otras cuentas, con los mismos estados |
| Total ingresos | Ventas + Otros ingresos |
| % Ventas sobre el total | Ventas ÷ Total ingresos |
| Gráficos | Ventas por mes, y barras apiladas de ventas y otros ingresos por mes |

**Ventas del mes (selector propio).** Es independiente del filtro global, pero se limita al año elegido arriba.

- En "Automático" muestra el mes actual si tiene ventas; si no, el último mes del año con actividad (la página lo avisa).
- Lista cliente, monto bruto y fecha de emisión, de mayor a menor monto.
- Filtra por `Mes_economico`, nunca por fecha de emisión.
- Al cambiar el año global, el selector vuelve a Automático.

**Ranking histórico de clientes.** Usa el período global. Agrupa las ventas por cliente, cuenta facturas, suma el monto facturado y ordena de mayor a menor. Excluye anticipos, pero no filtra por estado: incluye facturas aún sin pagar.

## Costos

Muestra cuánto cuestan las ventas y cómo se reparte ese costo por clasificación. Costos son los registros Tipo Costo: software y herramientas (cuenta 4101-09) y equipo de entrega (cuenta 4101-01).

| Elemento | Cálculo |
| --- | --- |
| Costos totales | Suma de todos los registros Tipo Costo del período |
| Margen bruto | (Ventas − Costos) ÷ Ventas |
| Costos / Ventas | Costos ÷ Ventas. Referencia saludable: bajo 50% (verde), 50–70% ámbar, sobre 70% rojo |
| Clasificación | `Clasificacion_Cto`; si falta, `Clasificacion_Gasto`; si falta, "Sin clasificar" |
| % del total | Monto de la clasificación ÷ Costos totales |
| % sobre ventas | Monto de la clasificación ÷ Ventas (rojo sobre 50%) |

- El gráfico de barras apiladas muestra las 5 clasificaciones mayores y agrupa el resto en "Resto". El gráfico circular muestra las 8 mayores.
- Color del margen bruto: verde sobre 30%, ámbar sobre 10%, rojo en el resto.

**Diferencia con el Resumen.** Aquí las ventas suman todas las ventas del período sin filtrar por estado. El Resumen solo suma Emitida, Pagada y Pagada_parcial. El margen bruto puede diferir si hay facturas anuladas.

## Gastos

Muestra los gastos operacionales (Tipo Gasto) por mes y por clasificación. La remuneración del director (cuenta 4401-02, Tipo Remun) se excluye de todos los totales y se informa aparte.

| Elemento | Cálculo |
| --- | --- |
| Gastos operacionales | Suma de registros Tipo Gasto del período |
| % sobre ventas | Gastos ÷ Ventas. Referencia saludable: bajo 30% (verde), 30–50% ámbar, sobre 50% rojo |
| Rem. Directores | Suma de registros Tipo Remun del período, solo informativo |
| Categoría | `Clasificacion_Gasto`; si falta, "Sin clasificar" |
| Gráficos | Barras de gasto mensual y circular con las 8 categorías mayores |

**Tabla comparativa por clasificación.** Columnas: Clasificación, mes N−2, mes N−1, % Cambio, mes N y YTD, ordenadas por YTD de mayor a menor.

- El mes activo N depende del filtro: en Año es el último mes con datos; en Mes es el mes elegido; en Rango es el extremo derecho.
- N−1 y N−2 son los dos meses calendario anteriores a N.
- % Cambio = (N−1 − N−2) ÷ N−2. Es la variación entre los dos meses previos, no contra N. Verde si bajó, rojo si subió, "—" si N−2 es cero.
- YTD = suma desde enero del año de N hasta N.
- La tabla usa todos los datos cargados, sin aplicar el rango del filtro.

## Cobranzas

Mide qué tan rápido pagan los clientes (DSO, días de cobro) y qué facturas siguen sin pagar. Usa solo ventas (cuenta 5101-01) y excluye anticipos.

**DSO (días de cobro).** Para cada factura con fecha de emisión y fecha de pago, días = Fecha_Pago − Fecha_emision. El DSO global es el promedio simple de esos días, sin ponderar por monto. Se descartan facturas con pago anterior a la emisión. Verde hasta 30 días, ámbar hasta 60, rojo sobre 60.

| Elemento | Cálculo |
| --- | --- |
| DSO global | Promedio de días emisión a pago de las facturas del período filtrado |
| Monto pendiente | Suma de todas las ventas sin `Fecha_Pago`, de cualquier período (no usa el filtro) |
| Tasa de cobro | (Ventas del período − Monto pendiente) ÷ Ventas del período. Verde desde 90%, ámbar desde 70% |
| Ventas analizadas | Suma de ventas del período, sin filtrar por estado |
| Histograma | Facturas pagadas del período agrupadas por días de cobro: hasta 20, 21–30, 31–40 y más de 40 |

La tasa de cobro mezcla el pendiente de todos los períodos con las ventas del período filtrado. Consúltala con el filtro en el año completo.

**Facturas impagas.** Todas las ventas sin fecha de pago, ordenadas de la más vencida a la menos vencida. Días = Fecha_Vencimiento − hoy. El folio se busca en la tabla `ventas` por vencimiento, monto y cliente.

| Días | Estado |
| --- | --- |
| Positivos (aún no vence) | Vigente |
| 0 a −15 | Vencida (ámbar) |
| −16 a −30 | Vencida (naranja) |
| Más de 30 días vencida | Crítica |

**Top 10 peores pagadores.** Usa todos los períodos, no el filtro. Agrupa las facturas pagadas por cliente y ordena por DSO promedio, de mayor a menor. "Días sobre vencimiento" es el promedio de Fecha_Pago − Fecha_Vencimiento (negativo = paga antes). Semáforo por DSO: hasta 20 días Rápido, hasta 30 Normal, hasta 40 Lento, más de 40 Crítico.

## Estado de Resultado

Es el P&L devengado por `Mes_economico`: una tabla acumulada del período filtrado y una tabla mes a mes con las mismas partidas. El EBITDA aquí se calcula descontando también la remuneración del director.

| # | Partida | Cálculo |
| --- | --- | --- |
| 1 / 1.1 | Ingresos / Ventas | Cuenta 5101-01 con estado Emitida, Pagada o Pagada_parcial. No incluye otros ingresos |
| 2.1 | Costo de venta | Suma de la cuenta 4101-01 (equipo de entrega) |
| 2.2 | Otros costos / gastos de explotación | Suma de la cuenta 4101-09 (software y herramientas) |
| 2 | Costos | 2.1 + 2.2 |
| 3 | Margen bruto | Ingresos − Costos |
| 4 | Gastos operacionales | Todos los registros Tipo Gasto |
| 5 | Resultado operacional | Margen bruto − Gastos operacionales |
| 6 | Remuneraciones directores | Todos los registros Tipo Remun |
| 7 | EBITDA | Resultado operacional − Remuneraciones directores |

La columna "% Ingresos" divide cada partida por los ingresos del período ("—" si no hay ingresos). Los subtotales negativos se muestran en rojo.

**KPIs, todos sobre ingresos:**

- Margen bruto % = Margen bruto ÷ Ingresos.
- Rentabilidad sobre ventas % = EBITDA ÷ Ingresos.
- Costos sobre ventas = Costos ÷ Ingresos.
- Gastos sobre ventas = Gastos operacionales ÷ Ingresos.

**Diferencias con otras páginas.** Los costos se toman por cuenta (4101-01 y 4101-09), no por Tipo Costo como en Resumen y Costos. Si existiera un costo en otra cuenta, aparecería en Resumen pero no aquí. Los otros ingresos no entran en este estado.

## Cashflow

Es el flujo de caja real: ubica cada movimiento en el mes en que se pagó (`Fecha_Pago`), no en el mes económico, y encadena el saldo de un mes al siguiente. Muestra los 12 meses del año elegido, desde 2026 en adelante.

**Saldo.** El saldo inicial de enero 2026 es $2.109.833 (fijo en el código). El saldo inicial de cada mes siguiente es el saldo final del mes anterior.

```
Saldo final = Saldo inicial + Ingresos − Costos − Gastos − Remuneración director
```

Un saldo final negativo se muestra en valor absoluto y en rojo.

**Qué entra en cada fila.**

| Fila | Regla |
| --- | --- |
| Ventas | Cuenta 5101-01 con estado Pagada, Pagada_parcial o Anticipo |
| Otros ingresos | Cuenta 5201-03, mismos estados que las ventas |
| Costo venta | Cuenta 4101-01, solo Pagada |
| Otros gastos explotación | Cuenta 4101-09, solo Pagada |
| Gastos administración | Tipo_Cuenta Gasto_Adm, solo Pagada |
| Servicios computacionales | Tipo_Cuenta Gasto_ERP |
| Publicidad | Tipo_Cuenta Gasto_Mkg |
| Representación y viáticos | Cuenta 4201-09 |
| Locomoción | Cuenta 4201-26 |
| Legales y notariales | Cuenta 4201-12 |
| Otros gastos | Tipo_Cuenta Gasto_Otros o Gasto_Cobranza |
| Remuneración director | Cuenta 4401-02 |

Las facturas Emitida (no cobradas) nunca entran como ingreso. Los egresos entran solo cuando su estado es Pagada.

**Diferencia con la documentación técnica.** El código también cuenta como ingreso el estado Anticipo y suma Gasto_Cobranza dentro de Otros gastos; la guía `REGLAS_NEGOCIO.md` no lo menciona. Conviene actualizarla.

## Forecast

Proyecta el flujo de caja desde el mes actual hasta diciembre. Parte de ventas devengadas (cuándo se facturó), les aplica porcentajes de cobro para estimar cuándo entra el efectivo, y proyecta los egresos con promedios históricos y la dotación del equipo. El saldo inicial lo ingresa el usuario.

**Supuestos editables (panel lateral).**

| Supuesto | Valor por defecto | Significado |
| --- | --- | --- |
| Saldo inicial | $0 | Caja actual, ingresada a mano |
| Ventas recurrentes por mes | vacío | Vacío = promedio histórico; 0 = mes sin ventas |
| Ventas nuevas por mes | vacío | Vacío = $0 |
| % cobro recurrentes mes anterior | 85% | Parte de lo facturado en M−1 que se cobra este mes |
| % cobro recurrentes dos meses atrás | 12% | Parte de lo facturado en M−2 que se cobra este mes |
| % anticipo ventas nuevas | 50% | Parte de una venta nueva cobrada en el mismo mes |
| % incobrable ventas nuevas | 2% | Parte del saldo de nuevas que nunca se recupera |
| Tasa de pérdida de MRR | 2% mensual | Decaimiento de recurrentes proyectados (solo visual, ver abajo) |
| Dotación | 5 cargos | Cantidad y costo mensual por cargo, con cambios por mes |
| Remuneración director por mes | vacío | Vacío = último mes real; 0 = no cobrar |
| % incremento de software | 50% | Parte del aumento de ventas que se traduce en servicios computacionales |
| Mínimo de alerta | $3.000.000 | Meses con saldo final bajo este umbral se marcan en rojo |

Con la dotación por defecto (Dev Sr $1,5M, Diseñadora Lead $1,3M, Diseñadora UX $0,9M, Ejecutiva Comercial $1,2M; Dev Jr en 0) el costo de venta mensual parte en $4,9M.

**Base de ventas.** Las ventas recurrentes base de cada mes son el promedio devengado (`Mes_economico`, cuenta 5101-01, todos los estados) de los 3 últimos meses con ventas anteriores al primer mes proyectado. Aquí sí entran las Emitida, porque interesa lo facturado, no lo cobrado.

**Cobranza del mes (lo que entra como ingreso).**

```
Ingreso = Rec(M−1) × p1 + Rec(M−2) × p2 + Nuevas(M) × a + Nuevas(M−1) × (1 − a) × (1 − i)
```

Donde p1 = 85%, p2 = 12%, a = % anticipo e i = % incobrable.

- Para el primer mes proyectado, M−1 es el último mes cerrado con su facturación real.
- El cobro de M−2 en el primer mes es cero, porque se asume ya incluido en el saldo inicial ingresado.
- El segundo mes usa como M−2 la facturación real del último mes cerrado.
- Los otros ingresos se proyectan en cero.

**Egresos proyectados.**

| Partida | Cálculo |
| --- | --- |
| Costo de venta | Dotación: cantidad × costo mensual por cargo, aplicando los cambios programados |
| Otros gastos de explotación | Promedio de los 3 últimos meses con datos (solo gastos Pagada) |
| Servicios computacionales | Promedio histórico + (ventas proyectadas − promedio base) × % incremento de software, si la diferencia es positiva |
| Gastos adm., publicidad, representación, locomoción, legales | Promedio de los 3 últimos meses con datos cada uno |
| Remuneración director | Valor ingresado; si está vacío, el último mes real |

El saldo final de cada mes es saldo inicial + ingresos − costos − gastos − remuneración del director, y alimenta el saldo inicial del mes siguiente. La línea de referencia del gráfico es el mínimo de alerta.

**Puntos a tener presentes.**

- La pérdida de MRR reduce la columna de ventas recurrentes que se muestra, pero no entra en la fórmula de cobranza. Cambiarla no mueve el saldo final.
- El forecast no proyecta Otros gastos (Gasto_Otros y Gasto_Cobranza), que sí están en el Cashflow.
- El Forecast usa lo facturado; el Cashflow usa lo efectivamente pagado.

**Congelar y descongelar.** Un botón guarda en el navegador que los supuestos están congelados y la fecha. Mientras está congelado, el panel de supuestos no permite cambios. Se guarda solo en ese navegador.

## Módulos de carga de datos

Las páginas anteriores solo leen datos; estos cinco módulos (menú Actualizar datos) son los que los escriben en Supabase. Lo que se cargue aquí determina todos los números del dashboard. Esta sección resume las reglas de `MODULOS_CARGA.md`.

**Reglas comunes de las cartolas Santander (Costos y Gastos).**

- Se lee un Excel desde la fila 17 y solo se toman los cargos (montos negativos). Se guarda siempre el valor positivo.
- Se detiene al llegar a "Resumen comisiones".
- Cada fila trae un mes económico editable; por defecto es el mes de la fecha de pago.
- Duplicados: se compara fecha de pago, monto y glosa. Los que ya existen quedan marcados "YA EXISTE" y desmarcados.
- Flujo: subir archivo, revisar duplicados, previsualizar y elegir filas, modo prueba o producción, resultado. Los costos y gastos se guardan con estado Pagada.

| Módulo | Qué carga | Reglas de clasificación |
| --- | --- | --- |
| Costos | Cargos de cartola a la tabla `costos` | Glosa con alguno de 24 proveedores de software: cuenta 4101-09 (gasto de explotación). Glosa que empieza con el nombre de 10 personas del equipo: cuenta 4101-01 (costo de venta). Un socio va a la tabla de remuneraciones, cuenta 4401-02, tipo Gasto_Retiro |
| Gastos | Cargos de cartola a la tabla `gastos` | 11 categorías por palabras clave en la glosa (honorarios, ERP, marketing, cobranza, abogados, banco, otros, bencina, restaurantes, estacionamiento, movilización). Gana la primera que coincide, por eso Restaurantes va antes que Movilización ("UBER EATS" es comida, no taxi). Las cuotas de crédito bancario (LCA con amortización periódica) se excluyen |
| Ingresos (ventas) | CSV de Nubox a la tabla `ventas` | Siempre cuenta 5101-01 "VENTAS". Estados: Emitido a Emitida, Pagado a Pagada, Pagado Parcial a Pagada_parcial, Anulado a Anulada. Duplicados por folio, fecha de emisión y RUT del cliente |
| Estado de facturas | Abonos de cartola que marcan ventas como cobradas | Ver abajo |
| Ingreso manual | Una partida a mano en cualquier tabla | Asistente de 3 pasos; el mes económico sigue a la fecha de emisión salvo que se edite |

**Notas de crédito (Ingresos).** La nota de crédito se empareja con la factura de menor folio del mismo cliente y mismo monto; ambas se excluyen automáticamente. La factura de folio mayor queda disponible para cargar. Una nota de crédito sin par se marca "factura mes anterior" y viene seleccionada.

**Estado de facturas: conciliación de pagos.** Cambia ventas de Emitida a Pagada y registra la fecha de pago, en tres fases:

1. Exacta: mismo RUT del pagador y mismo monto que una factura Emitida. Si ya estaba Pagada, avisa "Ya procesada".
2. Doble pago del mismo mes: dos abonos del mismo RUT que suman el monto de una factura.
3. Parcial entre meses: el abono es menor a la factura. La original pasa a Pagada_parcial por el monto abonado y se crea una nueva fila Emitida por el resto. Esta fase está pendiente de validar con datos reales.

El RUT del pagador se extrae de la descripción bancaria (por ejemplo "00650205189 Transf. Nombre") y se normaliza sin puntos, guiones ni ceros a la izquierda. Los clientes que pagan a través de terceros se resuelven con un catálogo de alias.
