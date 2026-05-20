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
│   └── useData.ts        # Hook que llama a data.ts y cachea el resultado
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
│   └── charts/
│       ├── theme.ts          # PALETTE, COLORS, TOOLTIP_STYLE compartidos
│       ├── AreaBarChart.tsx  # ComposedChart (barras + línea de margen). Soporta modo comparativo con dos datasets en el mismo gráfico.
│       ├── AreaChart.tsx     # AreaChart apilable (ingresos)
│       ├── BarChartV.tsx     # BarChart vertical, stacked y multiColor
│       ├── PieChart.tsx      # Donut chart con leyenda lateral
│       ├── LineChartR.tsx    # LineChart con reference lines (DSO)
│       └── HBarChart.tsx     # BarChart horizontal
└── pages/
    ├── Resumen.tsx         # Resumen Ejecutivo — KPIs + AreaBarChart comparativo
    ├── Ingresos.tsx        # Ventas y otros ingresos — BarChart mensual + ranking histórico clientes + tabla ventas del mes
    ├── Costos.tsx          # Estructura de costos — StackedBar + Donut + tabla
    ├── Gastos.tsx          # Gastos operacionales — Bar + Donut + tabla
    ├── Cobranzas.tsx       # DSO — LineChart + distribución por tramo + ranking clientes
    ├── EstadoResultado.tsx # Estado de Resultado — tabla YTD + evolución mensual por partida contable
    ├── Cashflow.tsx          # Flujo de caja — tabla 12 meses × 16 filas, agrupado por Fecha_Pago (solo 2026+)
    ├── Forecast.tsx          # Proyección de caja — modelo de cobranza configurable, mes actual → Dic año en curso
    ├── ActualizarDatos.tsx   # Hub central de carga — 4 módulos: Costos, Gastos, Ingresos*, Nuevas Ventas* (*próximamente)
    ├── ActualizarCostos.tsx  # Cartola bancaria → tablas costos + remuneraciones (ver sección dedicada)
    └── ActualizarGastos.tsx  # Cartola bancaria → tabla gastos (ver sección dedicada)
```

Y los archivos de soporte del Forecast:

```
src/
├── lib/
│   └── forecast.ts              # Tipos, lógica de cálculo y buildForecast(). NO usa Supabase directamente — recibe allRows.
└── components/
    ├── ForecastPanel.tsx         # Panel lateral (drawer) con 8 secciones de supuestos configurables
    └── ForecastFreezeToggle.tsx  # Toggle Congelar/Descongelar forecast — persiste en localStorage
```

## Fuente de datos — Supabase

La fuente de datos migró de Google Sheets CSV a **Supabase** (mayo 2025).
El cliente está en `src/lib/supabase.ts`. Los datos se leen desde la vista
`registros_contables` filtrada siempre por `empresa_id`.

**Proyecto Supabase:** `https://orjufhwfepojfiqejhfc.supabase.co`

### Arquitectura multiempresa

Todas las tablas tienen `empresa_id (UUID FK → empresas.id)`.
La empresa activa se define por `EMPRESA_RUT` en `src/lib/supabase.ts`.
En el futuro vendrá del contexto de sesión/auth.

### Tablas

| Tabla | Contenido | Tipo origen |
|-------|-----------|-------------|
| `empresas` | Tabla maestra de clientes SaaS | — |
| `ventas` | Facturas e ingresos | `Tipo = Ingreso` |
| `costos` | Costos de operación | `Tipo = Costo` |
| `gastos` | Gastos operacionales | `Tipo = Gasto` |
| `remuneraciones` | Remuneración directores | `Tipo = Remun` |

### Vista unificada

`registros_contables` — UNION ALL de las 4 tablas con columna `tipo` sintética.
Configurada con `security_invoker = on` para que el RLS de las tablas
subyacentes se aplique según el usuario que consulta.
`data.ts` lee siempre desde esta vista.

### Schema de columnas (todas las tablas)

```
empresa_id, cuenta_cble, descripcion_cta, clasificacion_gasto,
clasificacion_cto, tipo_cuenta, estado, mes_economico, ano_eco,
monto_bruto (NUMERIC), fecha_emision (DATE), fecha_pago (DATE),
fecha_vencimiento (DATE), cliente, creado_en
```

### RLS

- SELECT: `anon` y `authenticated` pueden leer (lectura pública por ahora)
- INSERT: usa `service_role` vía `VITE_SUPABASE_SERVICE_KEY` (ver sección ActualizarCostos)
- Estructura preparada para restringir por `empresa_id` cuando haya auth

### Variables de entorno

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (tiene fallback hardcodeado) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública para lectura (tiene fallback hardcodeado) |
| `VITE_SUPABASE_SERVICE_KEY` | Clave service_role legacy (JWT) para INSERTs desde ActualizarCostos y ActualizarGastos |

> La `VITE_SUPABASE_SERVICE_KEY` debe ser la key **legacy** en formato `eyJ...` (Settings → API → Legacy anon, service_role API keys). La nueva `sb_secret_...` está bloqueada por Supabase en contextos de browser.

### Migración de datos históricos

921 filas migradas desde Google Sheet `Data_Comb` (mayo 2025):
- ventas: 206 filas
- costos: 306 filas
- gastos: 373 filas
- remuneraciones: 36 filas

Script de migración: `supabase/migrate.mjs` (requiere `.env` con credenciales).
Schema inicial: `supabase/migrations/20250505_001_schema_inicial.sql`.

### Mapper CSV → Row

`supabaseToRow()` en `data.ts` convierte columnas snake_case de Supabase
a los nombres originales del CSV (`Tipo`, `Cuenta_Cble`, etc.) para que
toda la lógica de negocio existente funcione sin cambios.

**Columnas clave:** `Tipo` (Ingreso/Costo/Gasto/Remun), `Cuenta_Cble`, `Descripcion Cta.`, `Clasificacion_Gasto`, `Clasificacion_Cto`, `Tipo_Cuenta`, `Estado`, `Mes_economico` (YYYY-MM), `Ano_eco` (YYYY), `monto_bruto`, `Fecha_emision`, `Fecha_Pago`

**Valores de `Estado`:**
- `"Emitida"` — factura emitida, aún no pagada
- `"Pagada"` — pago total recibido
- `"Pagada_parcial"` — pago parcial recibido

**Reglas de negocio en `data.ts` — no tocar:**
- Ventas: `Tipo === "Ingreso" && Cuenta_Cble === "5101-01"`
- Costos: `Tipo === "Costo"`
- Gastos: `Tipo === "Gasto"` excluyendo retiro de directores (filtrado por keywords en descripción/clasificación)
- `isPagado(row)`: helper que evalúa `Estado ∈ { "Emitida", "Pagada", "Pagada_parcial" }` — usado para filtrar ingresos en vistas de devengado (Resumen, EstadoResultado, Ingresos)

## Sistema de filtrado de períodos

El estado del filtro es global (`FilterContext`). Cada página llama `initialize(years)` al cargar datos (solo se ejecuta una vez). Para consumir el filtro en una página:

```tsx
const { rows: allRows, years, loading, error, loadedAt } = useData()
const { initialize } = useFilterContext()
const allMonths = getAllMonths(allRows)              // todos los YYYY-MM disponibles
const { rows, months, label, isCompare, compareRows, compareMonths, compareLabel } = useFilter(allRows)

useEffect(() => { initialize(years) }, [years])
```

**Modos de período (`FilterState`):**
- `single / year` — año completo (comportamiento por defecto)
- `single / month` — mes específico `YYYY-MM`
- `single / range` — rango `from` → `to` en `YYYY-MM`
- `compare` — dos períodos independientes (primary + secondary), cada uno puede ser year o range

**Regla crítica:** al cambiar a tipo `range`, siempre inicializar `from` y `to` con `allMonths[0]` y `allMonths[last]` respectivamente — un rango con `from=''` o `to=''` retorna cero filas intencionalmente.

## Design system

Tokens de `@nlace/ui-kit` cargados vía `src/index.css`:

```css
@import "tailwindcss";
@import "@nlace/ui-kit/tailwind-v4";
```

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

**Regla de tipografía:** nunca usar `font-display` para mostrar números. Usar siempre `font-body tabular-nums`.

**Componentes del kit usados:** `NlaceLogo`, `Spinner`

**Iconos:** Lucide React — `import { IconName } from 'lucide-react'`. Nunca usar emojis como iconos UI.

## Gráficos

Todos los gráficos usan **Recharts**. No usar Chart.js ni react-chartjs-2.

- Las barras son siempre **colores planos** (sin gradientes, sin `fillOpacity`).
- Los colores compartidos están en `src/components/charts/theme.ts`.
- `AreaBarChart` soporta modo comparativo: pasar `compareData`, `labelA`, `labelB` para superponer dos períodos en el mismo gráfico (barras agrupadas + dos líneas, la del período B en `strokeDasharray="4 4"`).

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
- Si el filtro global cambia de año, el ranking se actualiza automáticamente

### Ventas del mes
- Tiene un `<select>` de mes propio independiente del selector de período global
- Los meses disponibles en el selector se calculan con `D.getMonthsForYear(allRows.filter(D.isVenta), selectedYear)` — acotados al año del filtro global
- Estado local: `localMonth` (string `''` = automático)
- Al cambiar el año global (`selectedYear`), un `useEffect` resetea `localMonth` a `''`
- Comportamiento automático (cuando `localMonth === ''`):
  - Si el mes calendario actual (`NOW_MONTH`) tiene datos en el año global → muestra ese mes
  - Si no → carga el último mes con actividad y muestra el aviso de fallback
- Filtra por `Mes_economico` (nunca por `Fecha_emision`)
- Columnas: Cliente · Monto Bruto · Fecha Emisión, ordenadas de mayor a menor monto

**Patrón reutilizable para filtro local de mes en otras páginas:**
```tsx
const salesMonthsInYear = useMemo(
  () => D.getMonthsForYear(allRows.filter(D.isVenta), selectedYear),
  [allRows, selectedYear]
)
const [localMonth, setLocalMonth] = useState('')
useEffect(() => { setLocalMonth('') }, [selectedYear])
const effectiveMonth = localMonth || (salesMonthsInYear.includes(NOW_MONTH)
  ? NOW_MONTH
  : salesMonthsInYear[salesMonthsInYear.length - 1] ?? '')
```

## Vista Cashflow — reglas específicas

`Cashflow.tsx` es diferente al resto de las páginas:

- **Fecha de agrupación:** `Fecha_Pago` (NO `Mes_economico`). Solo registros con `Fecha_Pago` presente.
- **Año mínimo:** 2026. No se calculan ni muestran años anteriores.
- **Saldo inicial enero 2026:** `$2.109.833` (valor fijo hardcodeado).
- **Encadenamiento:** `SaldoFinal(mes N) → SaldoInicial(mes N+1)`.
- **Filtro de Estado en ingresos (Cashflow):** solo `"Pagada"` o `"Pagada_parcial"` — NO incluye `"Emitida"` (es flujo de caja, no devengado).
- **Filtro de Estado en egresos (Cashflow):** solo `"Pagada"`.
- **Selector de año:** solo muestra años ≥ 2026; usa `cfYears` derivado de `Fecha_Pago`.
- **Estructura de filas:** 16 filas fijas (Saldo Inicial → Saldo Final). Los subtotales se destacan visualmente. Saldo Final negativo → valor absoluto en `text-nl-danger`.

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
| Remuneración Director | `Cuenta_Cble === "4401-02"` + Estado Pagada |

## Vista Forecast — reglas específicas

`Forecast.tsx` proyecta el flujo de caja desde el mes actual hasta diciembre del año en curso, usando datos reales como semilla y supuestos configurables por el usuario.

### Arquitectura

- **`forecast.ts`** — toda la lógica de cálculo. Recibe `allRows: D.Row[]` (ya cargado en memoria) y `ForecastAssumptions`. No hace queries a Supabase.
- **`ForecastPanel.tsx`** — drawer lateral con 8 secciones de supuestos.
- **`ForecastFreezeToggle.tsx`** — toggle de bloqueo del forecast (ver sección abajo).
- **`Forecast.tsx`** — página: KPIs, tabla mensual, gráficos, abre el panel.

### Supuestos configurables (`ForecastAssumptions`)

| Campo | Default | Descripción |
|-------|---------|-------------|
| `saldoInicial` | `0` | Saldo de caja actual — ingresado manualmente por el usuario |
| `ventasRecurrentesMes[]` | `null` | Ventas recurrentes por mes. `null` = promedio histórico devengado |
| `ventasNuevasMes[]` | `null` | Nuevas ventas por mes. `null` = $0 |
| `pctCobroMes1Rec` | `85` | % de recurrentes M-1 cobrado este mes |
| `pctCobroMes2Rec` | `12` | % de recurrentes M-2 cobrado este mes |
| `pctAnticipoNuevas` | `50` | % de nuevas ventas cobrado como anticipo en el mismo mes |
| `pctIncobrableNuevas` | `2` | % del saldo de nuevas ventas que no se recupera |
| `tasaPerdidaMRR` | `2` | % de decay mensual aplicado al MRR proyectado (solo display) |
| `dotacion[]` | 5 cargos | Costo mensual del equipo, con cambios de cantidad programados |
| `remDirectorPorMes[]` | `null` | Remuneración director por mes. `null` = último mes cerrado |
| `pctIncrementoSoftware` | `50` | % del delta de ventas sobre el avg histórico que se traslada a servicios computacionales |
| `minimoAlerta` | `3.000.000` | Umbral de saldo mínimo — meses bajo este valor se marcan en rojo |

### Modelo de cobranza — lógica central

Las ventas se registran en devengado (`mes_economico`, todos los estados incl. `Emitida`) y se modelan como cobros futuros:

```typescript
// Mes proyectado i:
cobro_rec_mes1  = ventasRecurrentes[M-1] * (pctCobroMes1Rec / 100)
cobro_rec_mes2  = ventasRecurrentes[M-2] * (pctCobroMes2Rec / 100)  // 0 en i=0 (ya en saldoInicial)
cobro_anticipo  = ventasNuevas[M]        * (pctAnticipoNuevas / 100)
cobro_saldo     = ventasNuevas[M-1]      * ((100 - pctAnticipoNuevas) / 100) * (1 - pctIncobrableNuevas / 100)

ingresoCobrado  = cobro_rec_mes1 + cobro_rec_mes2 + cobro_anticipo + cobro_saldo
```

**Semillas para el primer mes proyectado (i=0):**
- `ventasRecurrentes[M-1]` = ventas reales del mes anterior por `mes_economico`, todos los estados (`buildDevengadoVentasMap`)
- `ventasRecurrentes[M-2]` = `0` — el efecto M-2 ya está capturado en el `saldoInicial` ingresado por el usuario
- `ventasNuevas[M-1]` = `0` — no hay histórico separado de nuevas ventas

**`avgRecHist`** = promedio móvil de los últimos 3 meses con datos antes del primer mes proyectado, usando `buildDevengadoVentasMap` (devengado por `mes_economico`). Se usa como placeholder cuando `ventasRecurrentesMes[i] === null`.

### Función `buildDevengadoVentasMap`

Agrupa `allRows` por `mes_economico`, filtrando `Cuenta_Cble === '5101-01'` **sin filtro de Estado** (incluye Emitida + Pagada + Pagada_parcial). Esto da el total devengado facturado en cada mes, base correcta para aplicar los porcentajes de cobranza.

> **No confundir con Cashflow:** Cashflow agrupa por `Fecha_Pago` y solo cuenta `Pagada/Pagada_parcial` (cash efectivo). Forecast usa devengado porque los % de cobro modelan cuándo llegará ese cash.

### Gastos proyectados (promedios históricos)

Los gastos se calculan como promedio móvil de los últimos 3 meses con datos (`mes_economico`, solo `Estado=Pagada`):

| Componente | Filtro |
|-----------|--------|
| Costo venta (dotación) | `computeCostoEquipo(dotacion, i)` — suma `cantidad × costoMensual` por cargo |
| Otros gastos explotación | `Cuenta_Cble === '4101-09'` OR descripción contiene "OTROS GASTOS DE EXPLOTACION" |
| Gastos Adm | `Tipo_Cuenta === 'Gasto_Adm'` |
| Servicios computacionales | `Tipo_Cuenta === 'Gasto_ERP'` + delta por ventas sobre avg × `pctIncrementoSoftware` |
| Publicidad | `Tipo_Cuenta === 'Gasto_Mkg'` |
| Representación | `Cuenta_Cble === '4201-09'` |
| Locomoción | `Cuenta_Cble === '4201-26'` |
| Legales | `Cuenta_Cble === '4201-12'` |
| Rem. Director | `Cuenta_Cble === '4401-02'` — último mes cerrado o valor por mes del panel |

### Panel de control — 8 secciones

| # | Sección | Contenido |
|---|---------|-----------|
| ① | Punto de partida | `saldoInicial` — input manual del saldo de caja actual |
| ② | Ventas por mes | Dos inputs por mes: Recurrentes $ / Nuevas ventas $ |
| ③ | Política de cobranza | 4 sliders: cobro rec. mes1/mes2, anticipo nuevas, incobrable nuevas |
| ④ | Pérdida MRR | Slider `tasaPerdidaMRR` — decay sobre recurrentes proyectadas |
| ⑤ | Dotación | 5 cargos editables con cantidad, costo/mes y cambios programados |
| ⑥ | Remuneración Director | Input por mes (vacío = último mes real, `0` = no cobrar) |
| ⑦ | Gastos variables | Slider `pctIncrementoSoftware` |
| ⑧ | Alertas | `minimoAlerta` — umbral de saldo mínimo |

### Regla null vs 0

En todos los arrays por mes (`ventasRecurrentesMes`, `ventasNuevasMes`, `remDirectorPorMes`):
- `null` / campo vacío → usar valor por defecto (avg histórico o último real)
- `0` explícito → mes sin ventas / sin remuneración

### Toggle Congelar / Descongelar forecast

`ForecastFreezeToggle.tsx` permite bloquear el forecast en modo solo lectura.

**Comportamiento:**
- **Activo (desbloqueado):** botón verde con `<LockOpen />` y label "Forecast Activo". Panel de Control habilitado.
- **Congelado (bloqueado):** botón rojo con `<Lock />` y label "Forecast Congelado". Panel de Control deshabilitado (`disabled`, cursor not-allowed). Al congelar, el drawer se cierra automáticamente.
- Cambiar en cualquier dirección requiere confirmar un modal de confirmación.
- Bajo el botón, cuando está congelado, aparece el badge: "Congelado desde: DD/MM/YYYY HH:mm" (`font-body tabular-nums`).

**Persistencia en `localStorage`:**

| Clave | Valor |
|-------|-------|
| `forecast_frozen` | `"true"` cuando está congelado; ausente cuando activo |
| `forecast_frozen_at` | ISO 8601 del momento en que se congeló |

**Integración en `Forecast.tsx`:**
- El estado `isFrozen` se inicializa desde `localStorage` vía la prop `onFreezeChange`.
- Cuando `isFrozen === true`, se pasa `onChange={() => {}}` a `ForecastPanel` (no-op) para que ninguna edición tenga efecto aunque el panel se abra por alguna vía.
- Solo los archivos `Forecast.tsx` y `ForecastFreezeToggle.tsx` participan en esta funcionalidad — no tocar `ForecastPanel.tsx` ni `forecast.ts`.

## Módulo de carga de cartola — reglas comunes

`ActualizarCostos.tsx` y `ActualizarGastos.tsx` comparten el mismo patrón. Ninguna usa `useData()`, `useFilter()` ni `PageHeader`.

### Hub de navegación

`ActualizarDatos.tsx` (`/actualizar`) es la página de entrada con 4 tarjetas de módulos:
- **Costos** (`/actualizar-costos`) — activo
- **Gastos** (`/actualizar-gastos`) — activo
- **Ingresos** — próximamente (disabled)
- **Nuevas Ventas** — próximamente (disabled)

El ítem del Sidebar apunta a `/actualizar` con label "Actualizar Datos".

### Flujo (ambas páginas)

1. **Upload** — drag & drop o selección de archivo `.xlsx`
2. **Verificación de duplicados** — consulta Supabase automáticamente al parsear
3. **Preview** — tabla con checkboxes; columna **Mes Econ.** editable por fila
4. **Modo prueba / producción** — prueba muestra el JSON sin ejecutar; producción hace el INSERT real
5. **Resultado** — conteo de insertados, omitidos y errores por tabla

### Lectura de la cartola (ambas páginas)

- Archivo `.xlsx` del Banco Santander — usa la librería `xlsx` (SheetJS)
- Datos desde **fila 17** (índice 16): `[0]=MONTO | [1]=DESCRIPCIÓN | [3]=FECHA`
- Solo filas donde `monto < 0` (cargos)
- Se detiene cuando la columna A contiene `"Resumen comisiones"` (case insensitive)
- **Conversión obligatoria:** `monto_bd = Math.abs(monto_cartola)` — Supabase siempre recibe positivo

### Mes económico editable

En el preview cada fila tiene un `<input type="month">` para `mes_economico`. Por defecto usa el mes de `fecha_pago`. Si se modifica, la celda se resalta (azul en Costos, naranja en Gastos) y `buildSupabaseRow` / `buildRow` aplica el override junto con el `ano_eco` recalculado.

```typescript
const mes = mesOverrides[r._idx] ?? r.mes_economico
const ano = parseInt(mes.split('-')[0]) || r.ano_eco
```

Esto permite que pagos realizados en un mes se contabilicen en el mes económico correcto.

### Cliente Supabase para INSERTs

Ambas páginas crean un cliente separado `supabaseAdmin` con `VITE_SUPABASE_SERVICE_KEY` para bypassar RLS en escritura. Si la variable no está definida, cae en el cliente `anon` (que fallará por RLS).

```typescript
const supabaseAdmin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : supabase
```

Las lecturas de verificación de duplicados usan el cliente `anon` normal.

### Detección de duplicados (ambas páginas)

Consulta Supabase por el rango de fechas de la cartola y compara huellas `fecha_pago|monto_bruto|descripcion_glosa`. Filas duplicadas aparecen con badge **YA EXISTE**, desmarcadas por defecto.

---

## Vista ActualizarCostos — reglas específicas

### Catálogos

**`CATALOG_SOFTWARE`** (23 proveedores) — matching por keywords en la glosa (case insensitive, `includes`)
- Todos van a tabla `costos`, cuenta `4101-09`, clasificacion `Costo_Gto_Explot`

**`CATALOG_EQUIPO`** (11 personas) — matching por `id_norm` al inicio de la glosa (`startsWith`)
- 10 personas → tabla `costos`, cuenta `4101-01`, clasificacion `Costo_Vta`
- Cristian Labarca → tabla `remuneraciones`, cuenta `4401-02`, `clasificacion_gasto: "Retiros"`, `tipo_cuenta: "Gasto_Retiro"`

### Campos insertados por tabla

**`costos`:**
`empresa_id · cuenta_cble · descripcion_cta · clasificacion_cto · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado · descripcion_glosa`

**`remuneraciones`** (sin `descripcion_glosa`):
`empresa_id · cuenta_cble · descripcion_cta · clasificacion_cto · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado`

> `mes_economico` se envía como `YYYY-MM` (sin día). `estado` siempre `"Pagada"`.

---

## Vista ActualizarGastos — reglas específicas

### Catálogo

**`CATALOG_GASTOS`** (10 categorías) — matching por keywords en la glosa con `norm()` (normaliza acentos: `LÍNEA == LINEA`). Orden importa: categorías específicas antes que genéricas.

| # | Categoría | Tipo_Cuenta | Cuenta | Keywords clave |
|---|-----------|-------------|--------|----------------|
| 1 | Honorarios | Gasto_Adm | 4201-02 | OLGA, RAMIREZ, VICTOR FIGUEROA, RUTs |
| 2 | ERP | Gasto_ERP | 4201-37 | TOKU, NUBOX PAY, HAULMER |
| 3 | Marketing | Gasto_Mkg | 4301-03 | FACEBK, FACEBOOK, META |
| 4 | Cobranza | Gasto_Cobranza | 4301-02 | NP PAYU, PAYU |
| 5 | Abogados | Gasto_Legl | 4201-12 | RUT 76.229.620-9, FLORES ACEVEDO, NOTARIA |
| 6 | Banco | Gasto_Adm | 4201-10 | COM.MANTENCION, LCA N°, INTERESES LINEA, SOBREGIRO |
| 7 | Bencina | Gasto_Benc | 4201-26 | SHELL, ARAMCO, COMBUSTIBLE, BENCINA |
| 8 | Restorant | Gasto_Rest | 4201-09 | STARBUCKS, UBER EATS, KHIPU, CAFE, RESTAURANT… |
| 9 | Estacionamiento | Gasto_Mov | 4201-26 | SABA, PARKING, SIMPLEPARK, AKIPARK… |
| 10 | Movilizacion | Gasto_Mov | 4201-26 | CABIFY, UBER, SMARTYCAR |

> **Restorant va antes de Movilizacion** para que "UBER EATS" clasifique como restaurante y no como taxi.

### Función `norm()`

```typescript
function norm(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
```

Normaliza diacríticos antes del match. Se aplica tanto a la glosa como a cada keyword.

### Exclusión: amortización de crédito

```typescript
function isExcluded(glosa: string): boolean {
  const u = norm(glosa)
  return u.includes('LCA') && u.includes('AMORTIZACION PERIODICA')
}
```

Glosas con LCA + Amortización Periódica corresponden a cuotas de crédito bancario — no son gasto operacional y se excluyen antes del matching (quedan en "Sin categorizar").

### Campos insertados (`gastos`)

`empresa_id · cuenta_cble · descripcion_cta · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado · descripcion_glosa`

> No lleva `clasificacion_cto` (es NULL para todos los gastos operacionales).

## Función `parseDateCL` — comportamiento crítico

`parseDateCL` en `data.ts` soporta tres formatos de entrada:

| Formato | Ejemplo | Constructor usado |
|---------|---------|-------------------|
| `DD/MM/YYYY` | `"31/03/2026"` | `new Date(año, mes-1, día)` — hora local |
| `DD-MM-YYYY` | `"31-03-2026"` | `new Date(año, mes-1, día)` — hora local |
| `YYYY-MM-DD` (ISO) | `"2026-03-31"` | `new Date(año, mes-1, día)` — hora local |

**Regla invariante:** todos los branches usan `new Date(año, mes-1, día)` — **nunca** `new Date(isoString)`.

> **Por qué importa:** `new Date("2026-04-01")` interpreta la fecha como UTC midnight. En Chile (UTC-3/UTC-4), eso es el 31 de Marzo a las 21:00 local, por lo que `getMonth()` devuelve Marzo en vez de Abril. Este bug causó que pagos de Abril aparecieran en Marzo en el Cashflow (PR #44, mayo 2026).

## Áreas incompletas

- `Resumen.tsx` tabla Punto de Equilibrio: columnas PE/Gap/Cobertura son placeholders — requiere clasificación fijo/variable en la fuente de datos
- Sin toggle de sidebar en mobile (sidebar oculta en <860px sin menú hamburguesa)
