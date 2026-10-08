# Reconciliación de cartola BCI

Ejecuta la reconciliación completa de una cartola BCI contra Supabase.

## Prerequisito

El usuario adjunta directamente el `.xlsx` de la cartola BCI (formato `CartolaHistCtaCte-*.xlsx`). **No pedir CSV preclasificado** — leer el xlsx tal cual y clasificar automáticamente (ver Paso 1).

**⚠️ Colisión de nombres:** la columna propia del banco `CARGO/ABONO` (`A` = abono/crédito, `C` = cargo/débito) **no tiene relación** con el TIPO de negocio que usa esta skill (`C` = Costo). Son dos alfabetos distintos — no confundirlos al leer el archivo.

**Valores de TIPO (clasificación de negocio, no la columna del banco):**
- `I` — Ingreso (abono de cliente)
- `C` — Costo (tabla `costos`)
- `G` — Gasto (tabla `gastos`)
- `R` — Remuneración (tabla `remuneraciones`)
- `N` — Neutro (excluir: amortizaciones LCA, traspasos internos)
- `?` — Sin clasificar (revisar con el usuario, ver Paso 3.1)

## Pasos

### 1 — Leer el xlsx y auto-clasificar

Parsear el `.xlsx` con el mismo formato que ya usan los módulos de carga:
- Hoja "Cartola Historica CtaCte" (o "CartolaProvisoria"), header en fila 16 (índice 16), datos desde fila 17
- Columnas: `[0]=MONTO | [1]=DESCRIPCIÓN MOVIMIENTO | [3]=FECHA | [7]=CARGO/ABONO`
- Detener la lectura al llegar a la fila "Resumen comisiones"
- Solo filas con `CARGO/ABONO ∈ {A, C}` son movimientos reales

Clasificar cada fila **corriendo los catálogos reales del código** contra la glosa (no a mano, no inventar keywords nuevas):
- `CATALOG_EQUIPO` de `src/pages/ActualizarCostos.tsx` (match por `startsWith` del RUT/id_norm al inicio de la glosa) → tabla `costos` o `remuneraciones` según el proveedor
- `CATALOG_SOFTWARE` de `src/pages/ActualizarCostos.tsx` (match por keyword `includes`, case-insensitive) → tabla `costos`
- `CATALOG_GASTOS` de `src/pages/ActualizarGastos.tsx` (match por keyword sobre texto normalizado — mayúsculas sin tildes — respetando el orden del array: Restorant antes que Movilizacion) → tabla `gastos`
- Filas con `CARGO/ABONO = A` que no sean "Reverso Compra WebPay" → TIPO `I` (ingreso, fuera de alcance salvo que el usuario pida verificarlo)
- Filas que no calzan con ningún catálogo → TIPO `?`

Este enfoque garantiza que la skill clasifique **exactamente igual** que los módulos de carga del dashboard — si un ítem no clasifica aquí, tampoco clasificaría al subirlo por la UI.

Mostrar resumen: filas por TIPO y montos totales, rango de fechas de la cartola, filas `?` para revisión.

### 1.1 — Netear reversos WebPay

Antes de sumar totales, emparejar cada "Reverso Compra WebPay" (abono) con un cargo del **mismo día y mismo monto exacto**. Los pares que calzan se excluyen por completo del total (ni gasto/costo, ni ingreso — el neto es cero, la compra no ocurrió). Reversos sin cargo que calce quedan como TIPO `?` para revisión manual (posible reverso de un mes anterior o error).

### 2 — Consultar Supabase por fecha_pago

Usar las credenciales de `src/lib/supabase.ts` (`empresa_id = 02832e85-f5d9-43d6-a911-0bdf3e3e1a4a`).

**Alcance configurable:** por defecto consultar las 4 tablas, pero si el usuario indica que solo quiere verificar un subconjunto (ej. "verifica solo Costos y Gastos, los Ingresos ya están cuadrados"), consultar únicamente esas tablas y omitir el resto del diagnóstico para las tablas no pedidas.

```bash
# Costos
GET /rest/v1/costos?empresa_id=eq.{EMPRESA_ID}&fecha_pago=gte.{fecha_min}&fecha_pago=lte.{fecha_max}

# Gastos
GET /rest/v1/gastos?empresa_id=eq.{EMPRESA_ID}&fecha_pago=gte.{fecha_min}&fecha_pago=lte.{fecha_max}

# Remuneraciones
GET /rest/v1/remuneraciones?empresa_id=eq.{EMPRESA_ID}&fecha_pago=gte.{fecha_min}&fecha_pago=lte.{fecha_max}

# Ventas cobradas
GET /rest/v1/ventas?empresa_id=eq.{EMPRESA_ID}&fecha_pago=gte.{fecha_min}&fecha_pago=lte.{fecha_max}
```

### 3 — Comparar cartola vs Supabase

Para cada grupo TIPO, cruzar ítems por `monto` + `fecha` + descripción aproximada.

Identificar y reportar:

**A) Ítems de cartola NO en Supabase** (falta registrar)
**B) Ítems en Supabase NO en cartola** (posible duplicado o error — incluye reversos WebPay netmeados en 1.1 que igual quedaron registrados)
**C) Misclasificaciones** (monto y fecha coinciden pero en tabla incorrecta)
**D) Reversos WebPay** (ver 1.1 — cargos cancelados que quedaron mal registrados en Supabase)

### 3.1 — Ítems sin clasificar (TIPO `?`)

Presentar cada ítem `?` al usuario individualmente (fecha, monto, glosa) y pedirle la categoría/tabla destino antes de insertar. No adivinar la clasificación de negocio — el usuario puede pedir dejar alguno pendiente (sin insertar) si aún lo está investigando.

### 4 — Mostrar diagnóstico

Tabla resumen con totales:

| Tabla | Cartola | Supabase | Diferencia |
|-------|--------:|--------:|----------:|
| Costos (C) | $ | $ | $ |
| Gastos (G) | $ | $ | $ |
| Remuneraciones (R) | $ | $ | $ |
| Ventas cobradas (I) | $ | $ | $ |
| **Total egresos** | $ | $ | $ |

Luego listar cada discrepancia con monto y acción sugerida.

**No aplicar ninguna corrección todavía** — esperar confirmación del usuario.

### 5 — Aplicar correcciones (con confirmación)

Según instrucciones del usuario:

- **DELETE** filas erróneas: requiere `service_role` key (pedir al usuario si no está en `.env`)
- **INSERT** filas faltantes: usar la key de servicio
- **Reclasificar**: DELETE de tabla origen + INSERT en tabla destino
- Si el catálogo de `ActualizarCostos.tsx` o `ActualizarGastos.tsx` necesita actualización, hacer el cambio, crear rama, PR y merge

### 6 — Verificación final

Re-consultar Supabase y mostrar totales finales confirmando que cuadra.

### 7 — Limpieza

```bash
rm cartola_raw.csv
```

## Variables de conexión

```
SUPABASE_URL = https://orjufhwfepojfiqejhfc.supabase.co
ANON_KEY     = (en src/lib/supabase.ts)
EMPRESA_ID   = 02832e85-f5d9-43d6-a911-0bdf3e3e1a4a
```

La `service_role` key no está en el repo — pedirla al usuario cuando se necesite para DELETEs/INSERTs directos.

## Lecciones aprendidas (mayo 2026)

- Comparar siempre por `fecha_pago`, no por `mes_economico` — **esto aplica solo a esta reconciliación cartola-vs-Supabase** (base caja, contra movimientos bancarios reales). Para preguntas del tipo "¿falta algún mes de pago a este proveedor?" es al revés: agrupar por `mes_economico` (devengado), porque `fecha_pago` puede atrasarse o adelantarse y genera falsos huecos.
- Reversos WebPay = cancelan el costo original; eliminar el costo, no registrar como ingreso
- Amortización LCA + Traspaso interno (TIPO N) = neto cero, no registrar
- Si un ítem no aparece en el módulo de carga, verificar si el keyword falta en el catálogo (`ActualizarCostos.tsx` o `ActualizarGastos.tsx`)

## Lecciones aprendidas (julio 2026)

- No pedir `cartola_raw.csv` preclasificado a mano — leer el `.xlsx` directo y clasificar corriendo los catálogos reales del código (ver Paso 1). Ahorra el trabajo manual y garantiza consistencia con lo que clasificaría el dashboard.
- El neteo de reversos WebPay se puede hacer determinísticamente por (fecha, monto) — no requiere revisión manual salvo que un reverso quede sin cargo que calce (Paso 1.1).
- El alcance de tablas a verificar lo define el usuario en cada corrida — no asumir siempre las 4 tablas.

## Lecciones aprendidas (agosto 2026) — cuadre de ingresos

- **Cuadre de caja contra saldos del banco:** la cartola BCI trae su propio resumen en las filas 8-10 (`SALDO INICIAL | DEPÓSITOS | OTROS ABONOS | CHEQUES | OTROS CARGOS | IMPUESTOS | SALDO FINAL`). Verificación definitiva del flujo: `Σ ventas(fecha_pago) − Σ egresos(fecha_pago)` debe igualar `saldo_final − saldo_inicial`. Si cuadra, el flujo está reconciliado al peso.
- **Split de pago parcial en dos líneas** (patrón ya usado en el histórico, ej. folio 2 Biolumen): cuando un abono cubre solo parte de una factura `Emitida`, (1) modificar la línea original → `estado = Pagada_parcial`, `monto_bruto = monto cobrado`, `fecha_pago = fecha del abono`; y (2) crear una **nueva línea** con los mismos datos, `estado = Emitida`, `monto_bruto = saldo pendiente`, `fecha_pago = null`. Nunca sobrescribir el monto original sin dejar el saldo pendiente como línea aparte.
- **`mes_economico` (devengado) se preserva al marcar el cobro** — solo cambian `estado` y `fecha_pago`. La caja usa `fecha_pago`; el devengado usa `mes_economico`. Ver ejemplos: BFLOOW folio 40 quedó `mes_economico 2026-06` con `fecha_pago 2026-07-01`.
- **Reverso NO-WebPay:** la regla del reverso se extiende a cualquier proveedor, no solo WebPay. Un abono que calza exacto (mismo monto) con un cargo previo del mismo proveedor (ej. Khipu) es un reverso → **eliminar el cargo original, NO registrar el abono como ingreso**. Detección: mismo monto entre un cargo y un abono cercano del mismo RUT/proveedor.
- **Cruzar ingresos por RUT contra ventas `Emitida` pendientes, no solo por monto** — el pagador puede ser un representante con RUT distinto al del cliente (ej. una persona natural pagó por una sociedad), y el monto puede ser un parcial (ej. 50 % exacto de la factura). Traer todas las ventas pendientes y `empresas` para mapear antes de preguntar al usuario.
- **Los ingresos quedan fuera del alcance por defecto**, pero cuando el usuario pide cuadrar el flujo de caja hay que incluirlos: `Σ abonos` de la cartola menos los neutros (traspasos internos) menos los reversos debe igualar `Σ ventas(fecha_pago)` del período.
- **⚠️ VERIFICAR EL `id` CONTRA EL CLIENTE/GLOSA ANTES DE HACER PATCH/DELETE.** Los folios pueden **colisionar**: dos facturas de clientes distintos pueden compartir el mismo número de folio (ej. folio 3 = NOISE y también BIOLUMEN). Filtrar por `folio` o por `monto` puede devolver la fila equivocada. Antes de mutar una fila específica, confirmar que el `id` corresponde al `cliente`/`descripcion_glosa` esperado. En esta sesión un `id` cruzado sobrescribió la venta de NOISE por la de Biolumen y descuadró el cashflow acumulado en $283.410.
- **El Cashflow es acumulativo desde enero** (`SALDO_INICIAL_JAN_2026` hardcodeado en `Cashflow.tsx`). Un error de datos en cualquier mes previo arrastra el descuadre hasta el mes actual. Para diagnosticar, replicar `buildCFMap` mes a mes y comparar cada `saldoFinal` contra el saldo del banco de esa fecha (la cartola del mes da el `saldo_inicial` = saldo final del mes anterior, un segundo punto de control).

## Lecciones aprendidas (agosto 2026) — honorarios: provisión vs pago

- **Devengado (`mes_economico`) vs caja (`fecha_pago`) en honorarios recurrentes:** cada honorario mensual tiene UN registro por persona. El honorario se **devenga** en su mes (`mes_economico`) y se **paga** después (`fecha_pago` real). El Estado de Resultado / Gastos agrupan por `mes_economico`; el Cashflow por `fecha_pago`.
- **Un pago real lleva el `mes_economico` del fee que paga, no el mes en que se pagó.** Ej.: el honorario de Olga devengado en junio, pagado el 10-07, va con `mes_economico 2026-06` y `fecha_pago 2026-07-10`. Si se etiqueta con el mes del pago, infla ese mes y vacía el mes devengado.
- **Provisión `No Pagada` con `fecha_pago` futura/ficticia = señal de duplicado.** Cuando entra el pago real desde la cartola, la provisión estimada debe **eliminarse**, no quedar junto al pago. Detección: dos registros del mismo proveedor en el mismo mes (uno `Pagada` real + uno `No Pagada` de monto redondo), o un `Pagada` con `fecha_pago` que ninguna cartola respalda. Regla: cada mes debe tener un solo honorario por persona.
