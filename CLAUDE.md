# CLAUDE.md

Guía de navegación para Claude Code. Lee este archivo primero, luego los archivos de referencia según la tarea.

## Referencia rápida

| Si necesitas... | Lee... |
|----------------|--------|
| Schema de Supabase, tablas, RLS, variables de entorno, mapper | `SUPABASE.md` |
| Lógica de negocio por página (Cashflow, Forecast, Gastos, Ingresos, parseDateCL) | `REGLAS_NEGOCIO.md` |
| Módulos de carga (ActualizarCostos, Gastos, Ventas, EstadoFacturas, IngresoManual) | `MODULOS_CARGA.md` |
| Historial de sesiones, lecciones aprendidas, patrones de trabajo | `lecciones-aprendidas.md` |

## Regla de documentación al cerrar sesión

Al finalizar una sesión, actualizar el archivo correspondiente según el tipo de cambio:

- Nuevo gotcha o cambio en Supabase → `SUPABASE.md`
- Cambio en regla de negocio o lógica de página → `REGLAS_NEGOCIO.md`
- Cambio en un módulo de carga → `MODULOS_CARGA.md`
- Patrones de trabajo, lecciones de proceso, reflexiones → `lecciones-aprendidas.md`

`lecciones-aprendidas.md` es para aprendizajes de proceso, no para reglas técnicas. Las reglas técnicas van en el archivo específico del área.

---

## Despliegue

- **Producción:** https://dashboard-nlace.vercel.app
- **Repo:** https://github.com/vfleanconsult-lab/dashboard-nlace
- Vercel despliega automáticamente al mergear a `main`.

## Stack y comandos

Vite 6 + React 18 + TypeScript + Tailwind CSS v4 + React Router v6 + Recharts + `@nlace/ui-kit` + Lucide React + `xlsx` (SheetJS) + `@clerk/clerk-react`

```bash
npm run dev      # localhost:5173
npm run build    # build de producción (verificar antes de commit)
npm run lint     # ESLint
```

> Después de instalar dependencias con el servidor corriendo: detenerlo y borrar `node_modules/.vite`.

## Estructura

```
src/
├── lib/
│   ├── supabase.ts        # Cliente Supabase + EMPRESA_RUT
│   ├── data.ts            # Lógica de datos — NO MODIFICAR sin necesidad
│   ├── filter.ts          # Tipos de período y helpers de filtrado
│   ├── FilterContext.tsx  # Contexto global del filtro (proveedor en App.tsx)
│   ├── useFilter.ts       # Hook del filtro global
│   ├── useData.ts         # Hook de datos con caché
│   └── forecast.ts        # Lógica de cálculo del Forecast
├── components/
│   ├── Layout.tsx              # Sidebar + Outlet
│   ├── Sidebar.tsx             # Navegación + botón logout (Clerk)
│   ├── ProtectedRoute.tsx      # Guard de autenticación (Clerk)
│   ├── PageHeader.tsx          # Header sticky con PeriodSelector
│   ├── PeriodSelector.tsx      # Selector Año / Mes / Rango / Comparar
│   ├── KpiCard.tsx             # Tarjeta KPI con modo comparativo
│   ├── ChartCard.tsx           # Contenedor de gráfico
│   ├── DataTable.tsx           # Tabla genérica tipada
│   ├── ForecastPanel.tsx       # Drawer de supuestos del Forecast
│   ├── ForecastFreezeToggle.tsx# Toggle congelar/descongelar Forecast
│   └── charts/
│       ├── theme.ts            # PALETTE, COLORS, TOOLTIP_STYLE
│       ├── AreaBarChart.tsx    # ComposedChart con modo comparativo
│       ├── AreaChart.tsx       # AreaChart apilable
│       ├── BarChartV.tsx       # BarChart vertical stacked
│       ├── PieChart.tsx        # Donut chart con leyenda
│       └── LineChartR.tsx      # LineChart con reference lines
└── pages/
    ├── Resumen.tsx
    ├── Ingresos.tsx
    ├── Costos.tsx
    ├── Gastos.tsx
    ├── Cobranzas.tsx
    ├── EstadoResultado.tsx
    ├── Cashflow.tsx
    ├── Forecast.tsx
    ├── ActualizarDatos.tsx           # Hub central de carga
    ├── ActualizarCostos.tsx
    ├── ActualizarGastos.tsx
    ├── ActualizarVentas.tsx
    ├── ActualizarEstadoFacturas.tsx
    ├── IngresoManualPartidas.tsx
    └── LoginPage.tsx                 # Login con Clerk
```

## Design system

Tokens de `@nlace/ui-kit` vía `src/index.css`.

| Token | Hex | Uso |
|-------|-----|-----|
| `nl-primary` | `#5869f7` | Acción principal, ventas |
| `nl-accent` | `#ff6143` | CTA, costos, margen |
| `nl-success-dark` | `#22c55e` | Positivo |
| `nl-danger` | `#dc2626` | Negativo, gastos |
| `nl-bg` | `#efefef` | Canvas global |

**Tipografía:** `font-display` (Space Grotesk) solo títulos · `font-body tabular-nums` para números · `font-mono` para labels y badges. Nunca `font-display` en números.

**Iconos:** Lucide React. Nunca emojis como iconos UI.

**Gráficos:** Recharts únicamente. Barras siempre colores planos (sin gradientes). Colores en `charts/theme.ts`.

## Autenticación (Clerk)

- Variable de entorno: `VITE_CLERK_PUBLISHABLE_KEY` (solo Publishable Key — no se necesita Secret Key en este SPA)
- `ClerkProvider` en `src/main.tsx`
- Todas las rutas del dashboard protegidas por `ProtectedRoute`
- Restricción de dominio `@nlace.com` configurada en el panel de Clerk (no en código)

## Añadir una nueva página

1. Crear `src/pages/NuevaPagina.tsx`
2. Añadir ruta en `src/App.tsx` (dentro del bloque `<ProtectedRoute>`)
3. Añadir entrada en `src/components/Sidebar.tsx` → `NAV_ITEMS`
4. Usar `useData` + `useFilter` para datos y filtrado

## Skill: informe-ceo (informe ejecutivo mensual .pptx)

Genera el informe ejecutivo mensual en PowerPoint para la reunión CFO→CEO. **No es parte del dashboard web** — se ejecuta desde Claude Code/Cowork, no desde un botón en la UI.

- Definición: `.claude/skills/informe-ceo/SKILL.md` (invocar pidiendo "informe CEO" / "informe mensual").
- Scripts: `.claude/skills/informe-ceo/scripts/fetch-datos.ts` (extrae y agrega datos de Supabase reutilizando `src/lib/data.ts`) y `.claude/skills/informe-ceo/scripts/generar-pptx.ts` (arma el .pptx con `pptxgenjs`, 6 slides, identidad NLACE).
- Comandos: `npm run informe:datos -- [--mes YYYY-MM] --out output/datos.json` y `npm run informe:pptx -- --datos ... --narrativa ... --out ...`.
- La narrativa ejecutiva la escribe el propio agente (no hay llamada a la API de Claude ni API key involucrada).
- `output/` (JSON intermedios y .pptx generados) está en `.gitignore` — nunca se versiona.
- `src/lib/supabase.ts` tiene un fallback a `process.env` además de `import.meta.env` para poder correr bajo Node/tsx desde estos scripts sin duplicar la lógica de `data.ts` — ver `lecciones-aprendidas.md` sesión 30/08/2026.
