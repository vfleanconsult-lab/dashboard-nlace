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
| `xlsx` (SheetJS) | latest |

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

### Forecast
Proyección de flujo de caja desde el mes actual hasta diciembre del año en curso. Usa datos reales como semilla y supuestos configurables por el usuario (ventas recurrentes/nuevas, política de cobranza, dotación, remuneración director, gastos variables). Panel lateral con 8 secciones de parámetros. Toggle de congelamiento que bloquea el forecast en modo solo lectura y persiste en `localStorage`.

### Actualizar Costos
Página administrativa para cargar la cartola bancaria mensual del Banco Santander (`.xlsx`) y registrar los cargos en Supabase. Detecta duplicados automáticamente. Modo prueba (preview sin INSERT) y modo producción. No usa el filtro global de período.

---

## Fuente de datos

**Supabase** — proyecto `https://orjufhwfepojfiqejhfc.supabase.co`

Los datos se leen desde la vista `registros_contables` (UNION ALL de las tablas `ventas`, `costos`, `gastos`, `remuneraciones`), filtrada siempre por `empresa_id`.

**Columnas clave:**
- `Tipo` — `Ingreso` / `Costo` / `Gasto` / `Remun`
- `Cuenta_Cble` — código contable (ventas = `5101-01`)
- `Tipo_Cuenta` — clasificación de cuenta (ej. `Gasto_Adm`, `Gasto_ERP`, `Gasto_Mkg`)
- `Estado` — `Emitida` / `Pagada` / `Pagada_parcial`
- `Cliente` — nombre del cliente
- `Mes_economico` — período `YYYY-MM` (base para vistas devengado)
- `monto_bruto` — monto de la transacción (siempre positivo)
- `Fecha_emision` — fecha de emisión de la factura
- `Fecha_Vencimiento` — fecha límite de pago
- `Fecha_Pago` — fecha de pago real, vacía si impaga — base para Cashflow

**Criterios de Estado por vista:**
- **Vistas devengado** (Resumen, Ingresos, EstadoResultado): ingresos con `Estado ∈ { Emitida, Pagada, Pagada_parcial }`
- **Cashflow**: ingresos con `Estado ∈ { Pagada, Pagada_parcial }` · egresos con `Estado = Pagada`
- **Cobranzas (DSO)**: todas las ventas, sin filtro de estado

---

## Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública para lectura |
| `VITE_SUPABASE_SERVICE_KEY` | Clave service_role legacy para INSERTs (ActualizarCostos) |

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
2. Push a la rama + abrir PR
3. Merge a `main` → Vercel despliega automáticamente
