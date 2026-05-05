# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Despliegue

- **Producción:** https://dashboard-nlace.vercel.app
- **Repo:** https://github.com/vfleanconsult-lab/dashboard-nlace
- Vercel despliega automáticamente al mergear a `main`.
- Siempre hacer push a la rama de trabajo y abrir PR → merge a `main` para que Vercel despliegue.

## Stack

Vite 6 + React 18 + TypeScript + Tailwind CSS v4 + React Router v6 + Recharts + `@nlace/ui-kit` + Lucide React

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
    └── Cashflow.tsx        # Flujo de caja — tabla 12 meses × 16 filas, agrupado por Fecha_Pago (solo 2026+)
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
- INSERT: solo `service_role` (migraciones y cargas futuras)
- Estructura preparada para restringir por `empresa_id` cuando haya auth

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

## Áreas incompletas

- `Resumen.tsx` tabla Punto de Equilibrio: columnas PE/Gap/Cobertura son placeholders — requiere clasificación fijo/variable en la fuente de datos
- Sin toggle de sidebar en mobile (sidebar oculta en <860px sin menú hamburguesa)
