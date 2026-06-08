# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Despliegue

- **Producción:** https://dashboard-nlace.vercel.app
- **Repo:** https://github.com/vfleanconsult-lab/dashboard-nlace
- Vercel despliega automáticamente al mergear a `main`.
- Siempre hacer push a la rama de trabajo y abrir PR → merge a `main` para que Vercel despliegue.

## Stack

Vite 6 + React 18 + TypeScript + Tailwind CSS v4 + React Router v6 + Recharts + `@nlace/ui-kit` + Lucide React + `xlsx` (SheetJS)

```bash
npm run dev      # servidor de desarrollo en localhost:5173
npm run build    # build de producción
npm run lint     # ESLint
```

> **Importante:** después de instalar nuevas dependencias con el servidor corriendo, detenerlo y borrar `node_modules/.vite` antes de reiniciar para evitar errores `504 Outdated Optimize Dep`.

## Estructura

```
src/
├── lib/
│   ├── supabase.ts       # Cliente Supabase + EMPRESA_RUT (punto de entrada a la BD)
│   ├── data.ts           # Lógica de datos (Supabase → filtros → KPIs → DSO). NO MODIFICAR sin necesidad.
│   ├── filter.ts         # Tipos de período, filterRowsByPeriod, getMonthsForPeriod, labels
│   ├── FilterContext.tsx # Contexto React del filtro global (proveedor en App.tsx)
│   ├── useFilter.ts      # Hook que consume FilterContext y retorna rows/months/labels filtrados
│   ├── useData.ts        # Hook que llama a data.ts y cachea el resultado
│   └── forecast.ts       # Tipos, lógica de cálculo y buildForecast(). NO usa Supabase — recibe allRows.
├── components/
│   ├── Layout.tsx         # Sidebar + Outlet (wrapper de todas las páginas)
│   ├── Sidebar.tsx        # Navegación con iconos Lucide
│   ├── PageHeader.tsx     # Header sticky con PeriodSelector
│   ├── PeriodSelector.tsx # Selector de período (Año / Mes / Rango / Comparar)
│   ├── KpiCard.tsx        # Tarjeta KPI con soporte de modo comparativo y delta %
│   ├── ChartCard.tsx      # Contenedor de gráfico reutilizable
│   ├── DataTable.tsx      # Tabla genérica tipada
│   ├── SectionLabel.tsx   # Etiqueta de sección con línea divisora
│   ├── RankBadge.tsx      # Badge numerado (#1 #2 #3...)
│   ├── ProgressBar.tsx    # Barra de progreso inline
│   ├── LoadingState.tsx   # Spinner + estado de error
│   ├── ForecastPanel.tsx  # Drawer lateral con 8 secciones de supuestos configurables
│   ├── ForecastFreezeToggle.tsx  # Toggle Congelar/Descongelar — persiste en localStorage
│   └── charts/
│       ├── theme.ts          # PALETTE, COLORS, TOOLTIP_STYLE compartidos
│       ├── AreaBarChart.tsx  # ComposedChart (barras + línea de margen). Soporta modo comparativo.
│       ├── AreaChart.tsx     # AreaChart apilable (ingresos)
│       ├── BarChartV.tsx     # BarChart vertical, stacked y multiColor
│       ├── PieChart.tsx      # Donut chart con leyenda lateral
│       └── LineChartR.tsx    # LineChart con reference lines (DSO)
└── pages/
    ├── Resumen.tsx         # Resumen Ejecutivo — KPIs + AreaBarChart comparativo
    ├── Ingresos.tsx        # Ventas y otros ingresos — BarChart mensual + ranking histórico clientes + tabla ventas del mes
    ├── Costos.tsx          # Estructura de costos — StackedBar + Donut + tabla
    ├── Gastos.tsx          # Gastos operacionales — Bar + Donut + tabla comparativa N-2/N-1/N/YTD por clasificación
    ├── Cobranzas.tsx       # DSO — LineChart + distribución por tramo + ranking clientes
    ├── EstadoResultado.tsx # Estado de Resultado — tabla YTD + evolución mensual por partida contable
    ├── Cashflow.tsx          # Flujo de caja — tabla 12 meses × 16 filas, agrupado por Fecha_Pago (solo 2026+)
    ├── Forecast.tsx          # Proyección de caja — modelo de cobranza configurable, mes actual → Dic año en curso
    ├── ActualizarDatos.tsx          # Hub central de carga — 5 módulos activos
    ├── ActualizarCostos.tsx         # Cartola bancaria → tablas costos + remuneraciones (ver sección dedicada)
    ├── ActualizarGastos.tsx         # Cartola bancaria → tabla gastos (ver sección dedicada)
    ├── ActualizarVentas.tsx         # Reporte Nubox CSV → tabla ventas (ver sección dedicada)
    ├── ActualizarEstadoFacturas.tsx # Cartola bancaria → cambia estado Emitida→Pagada en tabla ventas (ver sección dedicada)
    └── IngresoManualPartidas.tsx    # Wizard 3 pasos → INSERT manual en cualquier tabla Supabase (ver sección dedicada)
```

## Fuente de datos — Supabase

**Proyecto:** `https://orjufhwfepojfiqejhfc.supabase.co`

Los datos se leen desde la vista `registros_contables` filtrada siempre por `empresa_id`.
El cliente está en `src/lib/supabase.ts`. Empresa activa definida por `EMPRESA_RUT`.

### Arquitectura multiempresa

Todas las tablas tienen `empresa_id (UUID FK → empresas.id)`.
En el futuro vendrá del contexto de sesión/auth.

### Tablas

| Tabla | Contenido | Tipo origen |
|-------|-----------|-------------|
| `empresas` | Tabla maestra de clientes SaaS | — |
| `ventas` | Facturas e ingresos | `Tipo = Ingreso` |
| `costos` | Costos de operación | `Tipo = Costo` |
| `gastos` | Gastos operacionales | `Tipo = Gasto` |
| `remuneraciones` | Remuneración directores | `Tipo = Remun` |

`registros_contables` — UNION ALL de las 4 tablas con columna `tipo` sintética, `security_invoker = on`.

### Schema de columnas

**Todas las tablas (base):**
```
empresa_id, cuenta_cble, descripcion_cta, clasificacion_gasto,
clasificacion_cto, tipo_cuenta, estado, mes_economico, ano_eco,
monto_bruto (NUMERIC), fecha_emision (DATE), fecha_pago (DATE),
fecha_vencimiento (DATE), cliente, creado_en
```

**Columnas adicionales por tabla:**
- `ventas`: `rut_cliente` (TEXT), `folio` (TEXT)
- `costos`: `descripcion_glosa` (TEXT)
- `gastos`: `descripcion_glosa` (TEXT)

### RLS y variables de entorno

- SELECT: `anon` y `authenticated` pueden leer
- INSERT/UPDATE: usa `service_role` vía `VITE_SUPABASE_SERVICE_KEY`

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto (tiene fallback hardcodeado) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública para lectura (tiene fallback hardcodeado) |
| `VITE_SUPABASE_SERVICE_KEY` | Clave service_role legacy (JWT) para INSERTs/UPDATEs |

> `VITE_SUPABASE_SERVICE_KEY` debe ser la key **legacy** en formato `eyJ...` (Settings → API → Legacy anon, service_role API keys). La nueva `sb_secret_...` está bloqueada por Supabase en browser.

### Mapper y columnas clave

`supabaseToRow()` en `data.ts` convierte snake_case de Supabase a los nombres del CSV original.

**Columnas clave:** `Tipo` (Ingreso/Costo/Gasto/Remun), `Cuenta_Cble`, `Descripcion Cta.`, `Clasificacion_Gasto`, `Clasificacion_Cto`, `Tipo_Cuenta`, `Estado`, `Mes_economico` (YYYY-MM), `Ano_eco` (YYYY), `monto_bruto`, `Fecha_emision`, `Fecha_Pago`

**Valores de `Estado`:**
- `"Emitida"` — factura emitida, aún no pagada
- `"Pagada"` — pago total recibido
- `"Pagada_parcial"` — pago parcial recibido

**Reglas de negocio en `data.ts` — no tocar:**
- Ventas: `Tipo === "Ingreso" && Cuenta_Cble === "5101-01"`
- Costos: `Tipo === "Costo"`
- Gastos: `Tipo === "Gasto"` excluyendo retiro de directores (keywords en descripción/clasificación)
- `isPagado(row)`: evalúa `Estado ∈ { "Emitida", "Pagada", "Pagada_parcial" }` — usado en vistas de devengado

## Sistema de filtrado de períodos

El estado del filtro es global (`FilterContext`). Para consumir en una página:

```tsx
const { rows: allRows, years, loading, error, loadedAt } = useData()
const { initialize } = useFilterContext()
const allMonths = getAllMonths(allRows)
const { rows, months, label, isCompare, compareRows, compareMonths, compareLabel } = useFilter(allRows)

useEffect(() => { initialize(years) }, [years])
```

**Modos de período (`FilterState`):**
- `single / year` — año completo (comportamiento por defecto)
- `single / month` — mes específico `YYYY-MM`
- `single / range` — rango `from` → `to` en `YYYY-MM`
- `compare` — dos períodos independientes (primary + secondary)

**Regla crítica:** al cambiar a tipo `range`, siempre inicializar `from` y `to` con `allMonths[0]` y `allMonths[last]` — un rango con `from=''` o `to=''` retorna cero filas intencionalmente.

## Design system

Tokens de `@nlace/ui-kit` cargados vía `src/index.css` (`@import "tailwindcss"` + `@import "@nlace/ui-kit/tailwind-v4"`).

**Paleta principal:**
| Token | Hex | Uso |
|-------|-----|-----|
| `nl-primary` | `#5869f7` | Acción principal, ventas |
| `nl-accent` | `#ff6143` | CTA, costos, margen |
| `nl-success-dark` | `#22c55e` | Positivo |
| `nl-danger` | `#dc2626` | Negativo, gastos |
| `nl-bg` | `#efefef` | Canvas global |
| `nl-text` | `#141414` | Texto principal |

**Tipografía:**
- `font-display` (Space Grotesk) — solo títulos y encabezados
- `font-body` (Inter) + `tabular-nums` — valores numéricos y KPIs
- `font-mono` (JetBrains Mono) — labels, badges, etiquetas

**Regla:** nunca usar `font-display` para números. Siempre `font-body tabular-nums`.

**Componentes del kit:** `NlaceLogo`, `Spinner`. **Iconos:** Lucide React. Nunca usar emojis como iconos.

## Gráficos

Todos los gráficos usan **Recharts**. No usar Chart.js ni react-chartjs-2.

- Barras siempre con **colores planos** (sin gradientes, sin `fillOpacity`).
- Colores compartidos en `src/components/charts/theme.ts`.
- `AreaBarChart` soporta modo comparativo: `compareData`, `labelA`, `labelB` (barras agrupadas + dos líneas, período B en `strokeDasharray="4 4"`).

## Añadir una nueva página

1. Crear `src/pages/NuevaPagina.tsx` siguiendo el patrón existente
2. Añadir ruta en `src/App.tsx`
3. Añadir entrada en `src/components/Sidebar.tsx` → `NAV_ITEMS`
4. Usar `useData` + `useFilter` para datos y filtrado

## Tablas con filtro local en Ingresos

`Ingresos.tsx` tiene dos tablas propias que combinan el filtro global con lógica local:

### Ranking histórico de ventas por cliente
- Fuente: `rows` (ya filtradas por el período global via `useFilter`)
- Filtra `isVenta` (`Cuenta_Cble === "5101-01"`), agrupa por `Cliente`
- Calcula N° facturas y monto total; ordena de mayor a menor monto

### Ventas del mes
- `<select>` de mes propio independiente del selector de período global
- Los meses disponibles se calculan con `D.getMonthsForYear(allRows.filter(D.isVenta), selectedYear)` — acotados al año del filtro global
- Estado local: `localMonth` (string `''` = automático); resetea a `''` al cambiar el año global
- Comportamiento automático: si `NOW_MONTH` tiene datos → muestra ese mes; si no → último mes con actividad
- Filtra por `Mes_economico` (nunca por `Fecha_emision`)

## Vista Gastos — tabla comparativa por clasificación

`Gastos.tsx` tiene una tabla "Top Gastos YTD · Clasificacion_Gasto":

### Columnas

| Clasificación | [N-2] | [N-1] | % Cambio | [N] | YTD |

- **N** = mes activo derivado del filtro global
- **N-1, N-2** = `shiftMonth(monthN, -1/-2)`
- **% Cambio** = variación de N-2 a N-1 (verde si bajó, rojo si subió; `—` cuando N-2 = 0)
- **YTD** = acumulado año hasta N inclusive — columna de ordenamiento (descendente)
- Headers en formato `Mmm-AA` (ej. `Mar-26`)

### Derivación del mes activo N

- Modo `year` → `months[months.length - 1]` (último mes con datos)
- Modo `month` → el mes específico del selector
- Modo `range` → `p.to` (extremo derecho del rango)

### Fuente de datos

Opera **solo sobre `allRows` en memoria** (no hace queries adicionales). Filtra `allRows.filter(D.isGasto)` y construye 4 subconjuntos por `monthN`, `monthN-1`, `monthN-2`, y YTD. El universo de categorías es la unión de claves de los 4 subconjuntos.

## Vista Cashflow — reglas específicas

- **Fecha de agrupación:** `Fecha_Pago` (NO `Mes_economico`). Solo registros con `Fecha_Pago` presente.
- **Año mínimo:** 2026. No se calculan ni muestran años anteriores.
- **Saldo inicial enero 2026:** `$2.109.833` (valor fijo hardcodeado).
- **Encadenamiento:** `SaldoFinal(mes N) → SaldoInicial(mes N+1)`.
- **Filtro Estado ingresos:** solo `"Pagada"` o `"Pagada_parcial"` — NO incluye `"Emitida"`.
- **Filtro Estado egresos:** solo `"Pagada"`.
- **Saldo Final negativo** → valor absoluto en `text-nl-danger`.

**Cuentas usadas en Cashflow:**

| Fila | Filtro |
|------|--------|
| Ventas | `Cuenta_Cble === "5101-01"` |
| Otros Ingresos | `Cuenta_Cble === "5201-03"` |
| Costo Venta | `Cuenta_Cble === "4101-01"` + Estado Pagada |
| Otros Gastos Explotación | `Cuenta_Cble === "4101-09"` + Estado Pagada |
| Gastos Adm | `Tipo_Cuenta === "Gasto_Adm"` + Estado Pagada |
| Servicios Computacionales | `Tipo_Cuenta === "Gasto_ERP"` + Estado Pagada |
| Publicidad | `Tipo_Cuenta === "Gasto_Mkg"` + Estado Pagada |
| Representación y Viáticos | `Cuenta_Cble === "4201-09"` + Estado Pagada |
| Locomoción | `Cuenta_Cble === "4201-26"` + Estado Pagada |
| Legales y Notariales | `Cuenta_Cble === "4201-12"` + Estado Pagada |
| Otros Gastos | `Tipo_Cuenta === "Gasto_Otros"` + Estado Pagada |
| Remuneración Director | `Cuenta_Cble === "4401-02"` + Estado Pagada |

## Vista Forecast — reglas específicas

Proyecta flujo de caja desde el mes actual hasta diciembre del año en curso.

### Arquitectura

- **`forecast.ts`** — lógica de cálculo. Recibe `allRows: D.Row[]` y `ForecastAssumptions`. No hace queries.
- **`ForecastPanel.tsx`** — drawer lateral con 8 secciones de supuestos.
- **`ForecastFreezeToggle.tsx`** — toggle de bloqueo (ver sección abajo).
- **`Forecast.tsx`** — página: KPIs, tabla mensual, gráficos, abre el panel.

### Supuestos configurables (`ForecastAssumptions`)

| Campo | Default | Descripción |
|-------|---------|-------------|
| `saldoInicial` | `0` | Saldo de caja actual — ingresado manualmente |
| `ventasRecurrentesMes[]` | `null` | Ventas recurrentes por mes. `null` = promedio histórico devengado |
| `ventasNuevasMes[]` | `null` | Nuevas ventas por mes. `null` = $0 |
| `pctCobroMes1Rec` | `85` | % de recurrentes M-1 cobrado este mes |
| `pctCobroMes2Rec` | `12` | % de recurrentes M-2 cobrado este mes |
| `pctAnticipoNuevas` | `50` | % de nuevas ventas cobrado como anticipo en el mismo mes |
| `pctIncobrableNuevas` | `2` | % del saldo de nuevas ventas que no se recupera |
| `tasaPerdidaMRR` | `2` | % de decay mensual aplicado al MRR proyectado (solo display) |
| `dotacion[]` | 5 cargos | Costo mensual del equipo, con cambios de cantidad programados |
| `remDirectorPorMes[]` | `null` | Remuneración director por mes. `null` = último mes cerrado |
| `pctIncrementoSoftware` | `50` | % del delta de ventas sobre avg histórico → servicios computacionales |
| `minimoAlerta` | `3.000.000` | Umbral de saldo mínimo — meses bajo este valor se marcan en rojo |

### Modelo de cobranza — lógica central

Las ventas se registran en devengado y se modelan como cobros futuros:

```typescript
cobro_rec_mes1  = ventasRecurrentes[M-1] * (pctCobroMes1Rec / 100)
cobro_rec_mes2  = ventasRecurrentes[M-2] * (pctCobroMes2Rec / 100)  // 0 en i=0 (ya en saldoInicial)
cobro_anticipo  = ventasNuevas[M]        * (pctAnticipoNuevas / 100)
cobro_saldo     = ventasNuevas[M-1]      * ((100 - pctAnticipoNuevas) / 100) * (1 - pctIncobrableNuevas / 100)
ingresoCobrado  = cobro_rec_mes1 + cobro_rec_mes2 + cobro_anticipo + cobro_saldo
```

**Semillas para i=0:** `ventasRecurrentes[M-1]` = ventas reales mes anterior; `ventasRecurrentes[M-2]` = 0 (ya en saldoInicial); `ventasNuevas[M-1]` = 0.

**`avgRecHist`** = promedio móvil últimos 3 meses con datos, vía `buildDevengadoVentasMap` (devengado por `mes_economico`, sin filtro de Estado — incluye Emitida + Pagada + Pagada_parcial). Placeholder cuando `ventasRecurrentesMes[i] === null`.

> **No confundir con Cashflow:** Cashflow agrupa por `Fecha_Pago` y solo cuenta `Pagada/Pagada_parcial`. Forecast usa devengado porque los % modelan cuándo llegará el cash.

### Gastos proyectados

Promedio móvil de los últimos 3 meses con datos (`mes_economico`, `Estado=Pagada`). Filtros idénticos a los de Cashflow por línea.

### Panel de control — 8 secciones

| # | Sección | Contenido |
|---|---------|-----------|
| ① | Punto de partida | `saldoInicial` |
| ② | Ventas por mes | Recurrentes $ / Nuevas ventas $ por mes |
| ③ | Política de cobranza | 4 sliders |
| ④ | Pérdida MRR | Slider `tasaPerdidaMRR` |
| ⑤ | Dotación | 5 cargos editables |
| ⑥ | Remuneración Director | Input por mes |
| ⑦ | Gastos variables | Slider `pctIncrementoSoftware` |
| ⑧ | Alertas | `minimoAlerta` |

### Regla null vs 0

En todos los arrays por mes: `null` / campo vacío → usar valor por defecto. `0` explícito → mes sin ventas/remuneración.

### Toggle Congelar / Descongelar

- **Activo:** botón verde `<LockOpen />` "Forecast Activo". Panel habilitado.
- **Congelado:** botón rojo `<Lock />` "Forecast Congelado". Panel deshabilitado. Drawer se cierra al congelar. Badge "Congelado desde: DD/MM/YYYY HH:mm".
- Cambiar en cualquier dirección requiere confirmar modal.

**localStorage:** `forecast_frozen = "true"` / `forecast_frozen_at` (ISO 8601).

**Integración:** cuando `isFrozen === true`, se pasa `onChange={() => {}}` a `ForecastPanel`. Solo `Forecast.tsx` y `ForecastFreezeToggle.tsx` participan — no tocar `ForecastPanel.tsx` ni `forecast.ts`.

## Módulo de carga de cartola — reglas comunes

`ActualizarCostos.tsx` y `ActualizarGastos.tsx` comparten el mismo patrón. Ninguna usa `useData()`, `useFilter()` ni `PageHeader`.

### Hub de navegación

`ActualizarDatos.tsx` (`/actualizar`) — 5 tarjetas en grid 3 columnas:
- **Costos** (`/actualizar-costos`) — `nl-primary` (azul)
- **Gastos** (`/actualizar-gastos`) — `nl-accent` (naranja)
- **Ingresos** (`/actualizar-ventas`) — `nl-success` (verde)
- **Estado Facturas** (`/actualizar-estado-facturas`) — `violet`
- **Ingreso Manual** (`/ingreso-manual`) — `slate`

Al añadir un módulo, agregar color en `colorMap` e `iconColorMap` de `ActualizarDatos.tsx`.

### Flujo (ambas páginas)

1. **Upload** — drag & drop o selección `.xlsx`
2. **Verificación de duplicados** — consulta Supabase automáticamente al parsear
3. **Preview** — tabla con checkboxes; columna **Mes Econ.** editable por fila
4. **Modo prueba / producción** — prueba muestra JSON sin ejecutar; producción hace INSERT real
5. **Resultado** — conteo de insertados, omitidos y errores por tabla

### Lectura de la cartola

- Archivo `.xlsx` Banco Santander — librería `xlsx` (SheetJS)
- Datos desde **fila 17** (índice 16): `[0]=MONTO | [1]=DESCRIPCIÓN | [3]=FECHA`
- Solo filas donde `monto < 0` (cargos)
- Se detiene al encontrar `"Resumen comisiones"` (case insensitive)
- **Conversión obligatoria:** `monto_bd = Math.abs(monto_cartola)` — Supabase siempre recibe positivo

### Mes económico editable

En el preview cada fila tiene `<input type="month">` para `mes_economico`. Por defecto usa el mes de `fecha_pago`. Al modificarlo se resalta (azul/naranja) y `buildSupabaseRow` aplica el override recalculando `ano_eco`. Permite contabilizar pagos en el mes económico correcto.

### Cliente Supabase para INSERTs

Crea `supabaseAdmin` con `VITE_SUPABASE_SERVICE_KEY` para bypassar RLS. Si la variable no está definida, cae al cliente `anon` (fallará por RLS). Las lecturas de verificación de duplicados usan el cliente `anon` normal.

### Detección de duplicados

Consulta Supabase por rango de fechas y compara huellas `fecha_pago|monto_bruto|descripcion_glosa`. Filas duplicadas: badge **YA EXISTE**, desmarcadas por defecto.

---

## Vista ActualizarCostos — reglas específicas

### Catálogos

**`CATALOG_SOFTWARE`** (24 proveedores) — matching por keywords en la glosa (case insensitive, `includes`)
- Todos → tabla `costos`, cuenta `4101-09`, clasificacion `Costo_Gto_Explot`

**`CATALOG_EQUIPO`** (11 personas) — matching por `id_norm` al inicio de la glosa (`startsWith`)
- 10 personas → tabla `costos`, cuenta `4101-01`, clasificacion `Costo_Vta`
- Cristian Labarca → tabla `remuneraciones`, cuenta `4401-02`, `clasificacion_gasto: "Retiros"`, `tipo_cuenta: "Gasto_Retiro"`

### Campos insertados por tabla

**`costos`:**
`empresa_id · cuenta_cble · descripcion_cta · clasificacion_cto · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado · descripcion_glosa`

**`remuneraciones`** (sin `descripcion_glosa`):
`empresa_id · cuenta_cble · descripcion_cta · clasificacion_cto · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado`

> `mes_economico` se envía como `YYYY-MM`. `estado` siempre `"Pagada"`.

---

## Vista ActualizarGastos — reglas específicas

### Catálogo

**`CATALOG_GASTOS`** (11 categorías) — matching por keywords con `norm()` (uppercase + NFD + elimina diacríticos). Orden importa: específicas antes que genéricas.

| # | Categoría | Tipo_Cuenta | Cuenta | Keywords clave |
|---|-----------|-------------|--------|----------------|
| 1 | Honorarios | Gasto_Adm | 4201-02 | OLGA, RAMIREZ, VICTOR FIGUEROA, RUTs |
| 2 | ERP | Gasto_ERP | 4201-37 | TOKU, NUBOX PAY, HAULMER |
| 3 | Marketing | Gasto_Mkg | 4301-03 | FACEBK, FACEBOOK, META |
| 4 | Cobranza | Gasto_Cobranza | 4301-02 | NP PAYU, PAYU |
| 5 | Abogados | Gasto_Legl | 4201-12 | RUT 76.229.620-9, FLORES ACEVEDO, NOTARIA |
| 6 | Banco | Gasto_Adm | 4201-10 | COM.MANTENCION, LCA N°, INTERESES LINEA, SOBREGIRO |
| 7 | Otros | Gasto_Otros | 4301-05 | PENTA HIPOTECARIO, MERPAGO*MELIMAS |
| 8 | Bencina | Gasto_Benc | 4201-26 | SHELL, ARAMCO, COMBUSTIBLE, BENCINA |
| 9 | Restorant | Gasto_Rest | 4201-09 | STARBUCKS, SBX ROSARIO, UBER EATS, KHIPU, CAFE, RESTAURANT, NUNOA, LUNKAI, MERCADOPAGO *LAFR, EL TOLDO AZUL, POINT 24H… |
| 10 | Estacionamiento | Gasto_Mov | 4201-26 | SABA, PARKING, SIMPLEPARK, AKIPARK, SUCURSAL PARQUE, VIDA PARQUE, CONCESA, ROSARIO NORTE… |
| 11 | Movilizacion | Gasto_Mov | 4201-26 | CABIFY, UBER, SMARTYCAR |

> **Restorant va antes de Movilizacion** para que "UBER EATS" clasifique como restaurante y no como taxi.

**Exclusión:** glosas con `LCA` + `AMORTIZACION PERIODICA` (cuotas de crédito bancario) se excluyen antes del matching → quedan en "Sin categorizar".

### Campos insertados (`gastos`)

`empresa_id · cuenta_cble · descripcion_cta · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado · descripcion_glosa`

> No lleva `clasificacion_cto` (NULL para todos los gastos operacionales).

---

## Vista ActualizarVentas — reglas específicas

Ruta: `/actualizar-ventas`. Importa reporte Nubox (`.csv` separador `;`) y carga facturas del mes seleccionado a `ventas`.

### Diferencias clave vs ActualizarCostos / ActualizarGastos

| Aspecto | Costos / Gastos | Ventas |
|---------|----------------|--------|
| Formato archivo | `.xlsx` Banco Santander | `.csv` Nubox (separador `;`) |
| Encoding | ArrayBuffer → UTF-8 | ArrayBuffer → UTF-8, fallback ISO-8859-1 |
| Catálogo de matching | Sí | No — todos son ventas |
| Filtro por mes | No | Sí — solo el mes seleccionado (default: mes actual) |
| Mes económico editable por fila | Sí | No (calculado desde `fecha_emision`) |
| Tabla Supabase destino | `costos` + `remuneraciones` / `gastos` | `ventas` |
| Color temático | azul / naranja | verde (`nl-success-dark`) |

### Parseo del CSV

- Primera fila: encabezados. Detección dinámica de columnas por nombre (case-insensitive).
- Columnas: `Fecha`, `Folio`, `Rut Cliente`, `Cliente`, `Monto total`, `Estado`, `Fecha vencimiento`, `Documento`
- `Documento` solo se usa internamente para clasificar tipo — no se guarda.
- Fechas `DD/MM/YYYY` → `YYYY-MM-DD`. Montos chilenos `"1.234.567,00"` → float.
- `monto_bruto` siempre positivo (`Math.abs`).

### Mapeo de estado

| CSV Nubox | Supabase |
|-----------|----------|
| `Emitido` | `Emitida` |
| `Pagado` | `Pagada` |
| `Pagado Parcial` | `Pagada_parcial` |
| `Anulado` | `Anulada` |

### Regla de duplicados — doble bloqueo

- Huella: `folio|fecha_emision|rut_cliente` (normalizados).
- **Normalización de RUT**: elimina puntos — `"76.229.620-9"` == `"76229620-9"`.
- `isDupe(r)` → `true` si la huella existe en `dupeKeys`.
- Filas duplicadas: checkbox bloqueado en rojo, excluidas de `selRows` y `toggleAll` — no pueden subirse.
- `selRows` filtra `selected[r._idx] && !isDupe(r)` como doble garantía.
- **Rango de consulta**: `YYYY-MM-01` → último día real del mes (`new Date(y, m, 0).getDate()`). **No usar `-31` fijo** — meses con <31 días generan error Postgres `22008` que silencia la detección.

### Lógica de notas de crédito (N/C-EL)

1. La N/C se empareja con la FAC de **menor folio** entre candidatas del mismo cliente y monto → esa FAC es la anulada.
2. Par N/C + FAC anulada: `isAutoExcluded = true`, aparece en sección "Excluidas automáticamente".
3. FAC de folio más alto queda disponible para cargar.
4. N/C sin par en el mismo mes → `isNcAnterior = true`, badge **"factura mes anterior"**, seleccionada por defecto.

### Campos insertados (`ventas`)

`empresa_id · cuenta_cble · descripcion_cta · folio · rut_cliente · cliente · monto_bruto · fecha_emision · fecha_vencimiento · estado · mes_economico · ano_eco`

Valores fijos: `cuenta_cble = '5101-01'`, `descripcion_cta = 'VENTAS'`, `empresa_id = '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a'`. No incluye `fecha_pago`, `clasificacion_gasto`, `clasificacion_cto`, `tipo_cuenta`.

---

## Función `parseDateCL` — comportamiento crítico

`parseDateCL` en `data.ts` soporta tres formatos:

| Formato | Ejemplo | Constructor |
|---------|---------|-------------|
| `DD/MM/YYYY` | `"31/03/2026"` | `new Date(año, mes-1, día)` — hora local |
| `DD-MM-YYYY` | `"31-03-2026"` | `new Date(año, mes-1, día)` — hora local |
| `YYYY-MM-DD` (ISO) | `"2026-03-31"` | `new Date(año, mes-1, día)` — hora local |

**Regla invariante:** todos los branches usan `new Date(año, mes-1, día)` — **nunca** `new Date(isoString)`.

> `new Date("2026-04-01")` interpreta UTC midnight → en Chile (UTC-3/UTC-4) es el 31 de Marzo local. Causó que pagos de Abril aparecieran en Marzo en el Cashflow.

---

## Vista ActualizarEstadoFacturas — reglas específicas

Ruta: `/actualizar-estado-facturas`. Lee cartola Santander (.xlsx) y actualiza `ventas`: `Emitida → Pagada`.

### Lectura de la cartola

Igual que ActualizarCostos, pero filtra **abonos** (monto positivo):
- **CartolaHistCtaCte**: header fila 16, datos desde fila 17
- **CartolaProvisoria**: header fila 13, datos desde fila 14

### Extracción de RUT del pagador

Descripción sigue el patrón `{RUT} Transf.? {nombre_parcial}`. Dos formatos:
- Dígitos con leading zero: `^(\d{8,12})\s+Transf`
- Con puntos y guión: `^(\d{1,2}\.\d{3}\.\d{3}-[\dkK])\s+Transf`

**Normalización para comparación:** elimina `.`, `-`, espacios y leading zeros.

### Catálogo de aliases (`ALIAS_CATALOG`)

Clientes que pagan vía terceros — hardcodeado como fuente de verdad; `Catalogo_Clientes` en Supabase se suma de forma aditiva.

| desc_mov (keyword) | RUT cliente | Cliente |
|-------------------|-------------|---------|
| `0765817307 PAGO PROVEEDOR PODCAST` | 76581730-7 | NOISE SPA |
| `0765500818 Transf. Chipax SpA` | 76477884-7 | AGROINTEGRAL SPA |
| `0765500818 Transf. Chipax SpA` | 76389181-K | VENTA DE INSUMOS AGRICOLAS MATHIAS QUIROZ AHUMADA E.I.R.L. |

Un mismo alias puede mapear a múltiples clientes — desempate por monto exacto.

**Tabla `Catalogo_Clientes`:** columnas `"RUT"` (TEXT, quoted uppercase), `cliente` (TEXT), `descripcion_movimiento` (TEXT).

### Algoritmo de matching — 3 fases

**Phase 1 — Exacto (RUT + monto):**
- Busca en `ventas.Emitida` donde `rutNorm` ∈ ruts y `monto_bruto` === abono.monto (exacto, `Number()` por NUMERIC)
- Match → `MatchSimple`, `estado → Pagada`, `fecha_pago = fecha abono`

**Phase 1b — YA EXISTE:**
- Si Phase 1 no encuentra Emitida pero sí hay match en `Pagada`/`Pagada_parcial` → alerta verde "Ya procesada"

**Phase 2 — Doble pago mismo mes:**
- Par de abonos del mismo RUT + mes que sumen exactamente el `monto_bruto` → `MatchDoble`, `fecha_pago = fecha segundo abono`

**Phase 3 — Parcial cross-mes:**
- Abono < `monto_bruto` de Emitida → `MatchParcial`
- UPDATE original (Pagada_parcial, monto = abono) + INSERT nueva fila (Emitida, monto = remainder, mismo folio)

### Campos actualizados en `ventas`

Match simple/doble: `estado = 'Pagada'`, `fecha_pago = YYYY-MM-DD`

Match parcial:
- Fila original: `estado = 'Pagada_parcial'`, `monto_bruto = abono.monto`, `fecha_pago`
- Nueva fila INSERT: campos originales, `estado = 'Emitida'`, `monto_bruto = remainder`, `fecha_pago = null`

---

## Vista IngresoManualPartidas — reglas específicas

Ruta: `/ingreso-manual`. Wizard 3 pasos — INSERT de una sola fila. No usa `useData()`, `useFilter()` ni `PageHeader`.

### Flujo — 3 pasos

**Paso 1:** Elige tabla (`ventas`, `costos`, `gastos`, `remuneraciones`).

**Paso 2:** `SELECT DISTINCT cuenta_cble, descripcion_cta FROM {tabla}` — dinámico, sin hardcodeo.

**Paso 3:** Campos comunes: `fecha_emision` (req.), `fecha_pago`, `fecha_vencimiento`, `monto_bruto` (req., positivo), `estado` (default Emitida), `mes_economico` (auto desde `fecha_emision`, sobreescribible).

Campos adicionales:
- **ventas**: `folio`, `rut_cliente`, `cliente` (todos req.)
- **costos**: `descripcion_glosa`, `clasificacion_cto` (select dinámico), `tipo_cuenta` (select dinámico)
- **gastos**: `descripcion_glosa`, `clasificacion_gasto` (req.), `tipo_cuenta` (req.)
- **remuneraciones**: solo comunes

`mes_economico` auto-sigue a `fecha_emision` hasta que el usuario lo edita manualmente (`_mes_manual = '1'`). `ano_eco` siempre derivado de `mes_economico`.

### Campos insertados por tabla

**`ventas`:** `empresa_id · cuenta_cble · descripcion_cta · folio · rut_cliente · cliente · monto_bruto · fecha_emision · fecha_pago · fecha_vencimiento · estado · mes_economico · ano_eco`

**`costos`:** `empresa_id · cuenta_cble · descripcion_cta · monto_bruto · fecha_emision · fecha_pago · fecha_vencimiento · estado · mes_economico · ano_eco · descripcion_glosa · clasificacion_cto · tipo_cuenta`

**`gastos`:** `empresa_id · cuenta_cble · descripcion_cta · monto_bruto · fecha_emision · fecha_pago · fecha_vencimiento · estado · mes_economico · ano_eco · descripcion_glosa · clasificacion_gasto · tipo_cuenta`

**`remuneraciones`:** `empresa_id · cuenta_cble · descripcion_cta · monto_bruto · fecha_emision · fecha_pago · fecha_vencimiento · estado · mes_economico · ano_eco`
(`clasificacion_gasto = 'Retiros'`, `tipo_cuenta = 'Gasto_Retiro'` — fijos)

Breadcrumb navegable. Al completar: "Nueva partida — misma cuenta" (paso 3 vacío) o "Nuevo ingreso" (paso 1).

---

## Áreas incompletas

- `Resumen.tsx` tabla Punto de Equilibrio: columnas PE/Gap/Cobertura son placeholders — requiere clasificación fijo/variable en la fuente de datos
- Sin toggle de sidebar en mobile (sidebar oculta en <860px sin menú hamburguesa)
- `ActualizarEstadoFacturas`: caso Parcial cross-mes (Phase 3) pendiente de validar con datos reales
