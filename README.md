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
KPIs consolidados: ventas, costos, gastos, utilidad bruta y operacional, márgenes. Gráfico comparativo de períodos.

### Ingresos
Evolución de ventas por mes. Ranking de ingresos por cuenta. Soporta comparación de períodos.

### Costos
Estructura de costos por clasificación. Gráfico apilado + donut + tabla detalle.

### Gastos
Gastos operacionales por clasificación (excluye retiro de directores). Bar chart + donut + tabla.

### Cobranzas
- **DSO Global** — promedio de días de cobro (solo facturas pagadas)
- **Histograma** — distribución de facturas pagadas por tramos de días (≤20 / 21-30 / 31-40 / >40), con colores semáforo
- **Facturas impagas** — listado por factura con días sobre vencimiento y semáforo
- **Top 10 peores pagadores** — agrupado por cliente con DSO promedio y días sobre vencimiento

---

## Fuente de datos

Google Sheets exportado como CSV (público):

```
https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa--mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970
```

Cache busting cada 15 minutos. Para cambiar la fuente editar solo `CSV_URL` en `src/lib/data.ts`.

**Columnas clave:**
- `Tipo` — Ingreso / Costo / Gasto / Remun
- `Cuenta_Cble` — código contable (ventas = `5101-01`)
- `Cliente` — nombre del cliente
- `Mes_economico` — período `YYYY-MM`
- `monto_bruto` — monto de la transacción
- `Fecha_Emision` — fecha de emisión de la factura (`DD/MM/YYYY`)
- `Fecha_Vencimiento` — fecha límite de pago (`DD/MM/YYYY`)
- `Fecha_Pago` — fecha de pago real, vacía si impaga (`DD/MM/YYYY`)

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
1. Crear rama de trabajo
2. Hacer push y abrir Pull Request a `main`
3. Mergear → Vercel despliega automáticamente
