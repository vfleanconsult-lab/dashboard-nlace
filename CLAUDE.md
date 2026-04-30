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
│   ├── data.ts           # Lógica de datos (CSV → filtros → KPIs → DSO). NO MODIFICAR sin necesidad.
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
    ├── Resumen.tsx    # Resumen Ejecutivo — KPIs + AreaBarChart comparativo
    ├── Ingresos.tsx   # Ventas y otros ingresos — AreaChart + tabla ranking
    ├── Costos.tsx     # Estructura de costos — StackedBar + Donut + tabla
    ├── Gastos.tsx     # Gastos operacionales — Bar + Donut + tabla
    └── Cobranzas.tsx  # DSO — LineChart + distribución por tramo + ranking clientes
```

## Fuente de datos

Google Sheets exportado como CSV vía URL pública en `src/lib/data.ts`:

```
CSV_URL = "https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa--mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970"
```

Cache busting cada 15 minutos (`_cb` param). Para cambiar la fuente, modificar solo `CSV_URL`.

**Columnas clave:** `Tipo` (Ingreso/Costo/Gasto), `Cuenta_Cble`, `Descripcion Cta.`, `Clasificacion_Gasto`, `Clasificacion_Cto`, `Mes_economico` (YYYY-MM), `Ano_eco` (YYYY), `monto_bruto`, `Fecha_emision`, `Fecha_Pago`

**Reglas de negocio en `data.ts` — no tocar:**
- Ventas: `Tipo === "Ingreso" && Cuenta_Cble === "5101-01"`
- Costos: `Tipo === "Costo"`
- Gastos: `Tipo === "Gasto"` excluyendo retiro de directores (filtrado por keywords en descripción/clasificación)

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

## Áreas incompletas

- `Resumen.tsx` tabla Punto de Equilibrio: columnas PE/Gap/Cobertura son placeholders — requiere clasificación fijo/variable en la fuente de datos
- Sin toggle de sidebar en mobile (sidebar oculta en <860px sin menú hamburguesa)
