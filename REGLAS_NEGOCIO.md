# REGLAS_NEGOCIO.md — Lógica por página

## Sistema de filtrado de períodos

Estado global en `FilterContext`. Patrón de uso en cada página:

```tsx
const { rows: allRows, years, loading, error, loadedAt } = useData()
const { initialize } = useFilterContext()
const allMonths = getAllMonths(allRows)
const { rows, months, label, isCompare, compareRows, compareMonths, compareLabel } = useFilter(allRows)

useEffect(() => { initialize(years) }, [years])
```

**Modos:** `single/year` · `single/month` · `single/range` · `compare`

**Regla crítica:** al cambiar a tipo `range`, inicializar `from` y `to` con `allMonths[0]` y `allMonths[last]` — un rango vacío retorna cero filas intencionalmente.

---

## Función `parseDateCL` — invariante crítico

`parseDateCL` en `data.ts` soporta `DD/MM/YYYY`, `DD-MM-YYYY` y `YYYY-MM-DD`.

**Regla invariante:** todos los branches usan `new Date(año, mes-1, día)` — **nunca** `new Date(isoString)`.

> `new Date("2026-04-01")` interpreta UTC midnight → en Chile (UTC-3/UTC-4) es el 31 de Marzo local. Causó que pagos de Abril aparecieran en Marzo en el Cashflow.

---

## Vista Ingresos — filtros locales

### Ranking histórico de clientes
- Fuente: `rows` (filtradas por período global via `useFilter`)
- Filtra `isVenta` (`Cuenta_Cble === "5101-01"`), agrupa por `Cliente`, ordena por monto

### Ventas del mes (selector local independiente)
- `localMonth = ''` = automático: muestra `NOW_MONTH` si tiene datos, si no el último mes con actividad
- Al cambiar el año global, `localMonth` se resetea a `''`
- Filtra por `Mes_economico` (nunca por `Fecha_emision`)

---

## Vista Gastos — tabla comparativa por clasificación

Columnas: `Clasificación | [N-2] | [N-1] | % Cambio | [N] | YTD`

- **% Cambio** = variación de N-2 a N-1 (verde si bajó, rojo si subió; `—` cuando N-2 = 0)
- **YTD** = acumulado año hasta N, columna de ordenamiento (descendente)
- Headers en formato `Mmm-AA` (ej. `Mar-26`)

**Derivación del mes activo N:**
- Modo `year` → `months[months.length - 1]` (último mes con datos)
- Modo `month` → el mes específico del selector
- Modo `range` → `p.to` (extremo derecho del rango)

Opera solo sobre `allRows` en memoria — no hace queries adicionales a Supabase.

---

## Vista Cashflow

- **Fecha de agrupación:** `Fecha_Pago` (NO `Mes_economico`). Solo registros con `Fecha_Pago` presente.
- **Año mínimo:** 2026.
- **Saldo inicial enero 2026:** `$2.109.833` (hardcodeado).
- **Encadenamiento:** `SaldoFinal(mes N) → SaldoInicial(mes N+1)`.
- **Ingresos:** solo `"Pagada"` o `"Pagada_parcial"` — NO `"Emitida"`.
- **Egresos:** solo `"Pagada"`.
- **Saldo Final negativo** → valor absoluto en `text-nl-danger`.

**Cuentas usadas:**

| Fila | Filtro |
|------|--------|
| Ventas | `Cuenta_Cble === "5101-01"` |
| Otros Ingresos | `Cuenta_Cble === "5201-03"` |
| Costo Venta | `Cuenta_Cble === "4101-01"` + Pagada |
| Otros Gastos Explotación | `Cuenta_Cble === "4101-09"` + Pagada |
| Gastos Adm | `Tipo_Cuenta === "Gasto_Adm"` + Pagada |
| Servicios Computacionales | `Tipo_Cuenta === "Gasto_ERP"` + Pagada |
| Publicidad | `Tipo_Cuenta === "Gasto_Mkg"` + Pagada |
| Representación y Viáticos | `Cuenta_Cble === "4201-09"` + Pagada |
| Locomoción | `Cuenta_Cble === "4201-26"` + Pagada |
| Legales y Notariales | `Cuenta_Cble === "4201-12"` + Pagada |
| Otros Gastos | `Tipo_Cuenta === "Gasto_Otros"` + Pagada |
| Remuneración Director | `Cuenta_Cble === "4401-02"` + Pagada |

---

## Vista Forecast

Proyecta flujo de caja desde el mes actual hasta diciembre del año en curso.

### Archivos
- `src/lib/forecast.ts` — lógica de cálculo, recibe `allRows` y `ForecastAssumptions`
- `src/components/ForecastPanel.tsx` — drawer con 8 secciones de supuestos
- `src/components/ForecastFreezeToggle.tsx` — toggle de bloqueo (localStorage)

### Supuestos (`ForecastAssumptions`)

| Campo | Default | Descripción |
|-------|---------|-------------|
| `saldoInicial` | `0` | Saldo de caja actual — ingresado manualmente |
| `ventasRecurrentesMes[]` | `null` | `null` = promedio histórico devengado |
| `ventasNuevasMes[]` | `null` | `null` = $0 |
| `pctCobroMes1Rec` | `85` | % recurrentes M-1 cobrado este mes |
| `pctCobroMes2Rec` | `12` | % recurrentes M-2 cobrado este mes |
| `pctAnticipoNuevas` | `50` | % nuevas ventas cobrado como anticipo |
| `pctIncobrableNuevas` | `2` | % del saldo de nuevas que no se recupera |
| `tasaPerdidaMRR` | `2` | % decay mensual sobre MRR proyectado |
| `dotacion[]` | 5 cargos | Costo mensual del equipo |
| `remDirectorPorMes[]` | `null` | `null` = último mes real; `0` = no cobrar |
| `pctIncrementoSoftware` | `50` | % del delta ventas → servicios computacionales |
| `minimoAlerta` | `3.000.000` | Umbral saldo mínimo — meses en rojo |

### Modelo de cobranza

```typescript
cobro_rec_mes1  = ventasRecurrentes[M-1] * (pctCobroMes1Rec / 100)
cobro_rec_mes2  = ventasRecurrentes[M-2] * (pctCobroMes2Rec / 100)  // 0 en i=0
cobro_anticipo  = ventasNuevas[M]        * (pctAnticipoNuevas / 100)
cobro_saldo     = ventasNuevas[M-1]      * ((100 - pctAnticipoNuevas) / 100) * (1 - pctIncobrableNuevas / 100)
ingresoCobrado  = cobro_rec_mes1 + cobro_rec_mes2 + cobro_anticipo + cobro_saldo
```

`buildDevengadoVentasMap`: agrupa por `mes_economico`, `Cuenta_Cble === '5101-01'`, **sin filtro de Estado** (incluye Emitida). Base para aplicar % de cobranza.

> Forecast usa devengado (cuándo se facturó). Cashflow usa `Fecha_Pago` (cuándo llegó el cash).

### Regla null vs 0
- `null` / campo vacío → usar valor por defecto (avg histórico o último real)
- `0` explícito → mes sin ventas / sin remuneración

### Toggle Congelar / Descongelar
- localStorage: `forecast_frozen = "true"` / `forecast_frozen_at` (ISO 8601)
- Congelado → `onChange={() => {}}` en ForecastPanel (no-op)
- Solo `Forecast.tsx` y `ForecastFreezeToggle.tsx` participan — no tocar `ForecastPanel.tsx` ni `forecast.ts`

---

## Áreas incompletas

- `Resumen.tsx` tabla Punto de Equilibrio: columnas PE/Gap/Cobertura son placeholders
- Sin toggle de sidebar en mobile (oculta en <860px sin menú hamburguesa)
- `ActualizarEstadoFacturas`: caso Parcial cross-mes (Phase 3) pendiente de validar con datos reales
