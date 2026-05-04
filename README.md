# Dashboard NLACE

Dashboard financiero interno para análisis de resultados de gestión.

**Producción:** https://dashboard-nlace.vercel.app

---

## Stack

| Tecnología | Versión |
|---|---|
| React | 18 |
| TypeScript | 5 |
| Vite | 6 |
| Tailwind CSS | 4 |
| React Router | 6 |
| Recharts | 3 |
| `@nlace/ui-kit` | latest |
| Lucide React | latest |

---

## Vistas

### Resumen Ejecutivo
KPIs consolidados: ventas, costos, gastos, utilidad bruta y operacional, márgenes. Gráfico comparativo de períodos. Tabla de punto de equilibrio mensual.

### Ingresos
KPIs de ventas y otros ingresos YTD. Evolución mensual (barras). Tabla ventas del mes con selector propio. Ranking histórico de clientes.

### Costos
Estructura de costos por clasificación. Gráfico apilado + donut + tabla detalle.

### Gastos
Gastos operacionales por clasificación (excluye retiro de directores). Bar chart + donut + tabla.

### Cobranzas
- **DSO Global** — promedio de días de cobro (solo facturas pagadas)
- **Histograma** — distribución de facturas pagadas por tramos de días (≤20 / 21-30 / 31-40 / >40), con colores semáforo
- **Facturas impagas** — listado por factura con días sobre vencimiento y semáforo
- **Top 10 peores pagadores** — agrupado por cliente con DSO promedio y días sobre vencimiento

### Estado de Resultado
Tabla de Estado de Resultado con 7 partidas contables (Ingresos → Costos → Margen Bruto → Gastos → Resultado Op. → Rem. Directores → EBITDA). Vista YTD acumulada + evolución mensual en tabla horizontal.

### Cashflow
Flujo de caja mensual agrupado por **Fecha de Pago** (no por Mes Económico). Muestra los 12 meses del año seleccionado en columnas y 16 filas de componentes (saldo inicial, ingresos, costos, gastos desglosados, remuneración director, saldo final). Solo disponible desde 2026. Saldo inicial enero 2026 = $2.109.833 fijo; los meses siguientes encadenan el saldo final del mes anterior.

---

## Fuente de datos

Google Sheets exportado como CSV (público):

```
https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa--mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970
```

Cache busting cada 15 minutos. Para cambiar la fuente editar solo `CSV_URL` en `src/lib/data.ts`.

**Columnas clave:**
- `Tipo` — `Ingreso` / `Costo` / `Gasto` / `Remun`
- `Cuenta_Cble` — código contable (ventas = `5101-01`)
- `Tipo_Cuenta` — clasificación de cuenta (ej. `Gasto_Adm`, `Gasto_ERP`, `Gasto_Mkg`)
- `Estado` — `Emitida` / `Pagada` / `Pagada_parcial`
- `Cliente` — nombre del cliente
- `Mes_economico` — período `YYYY-MM` (base para vistas devengado)
- `monto_bruto` — monto de la transacción (siempre positivo)
- `Fecha_emision` — fecha de emisión de la factura (`DD/MM/YYYY`)
- `Fecha_Vencimiento` — fecha límite de pago (`DD/MM/YYYY`)
- `Fecha_Pago` — fecha de pago real, vacía si impaga (`DD/MM/YYYY`) — base para Cashflow

**Criterios de Estado por vista:**
- **Vistas devengado** (Resumen, Ingresos, EstadoResultado): ingresos con `Estado ∈ { Emitida, Pagada, Pagada_parcial }`
- **Cashflow**: ingresos con `Estado ∈ { Pagada, Pagada_parcial }` · egresos con `Estado = Pagada`
- **Cobranzas (DSO)**: todas las ventas, sin filtro de estado

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev        # http://localhost:5173

# Build de producción
npm run build

# Lint
npm run lint
```

> Después de instalar nuevas dependencias con el servidor corriendo, detenerlo y borrar `node_modules/.vite` antes de reiniciar.

---

## Deploy

Vercel despliega automáticamente al hacer merge a `main`.

Flujo de trabajo:
1. Hacer push directo a `main` (o crear rama + PR si se prefiere revisión)
2. Vercel detecta el push y despliega automáticamente
