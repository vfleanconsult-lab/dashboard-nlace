import * as D from './data'

export const SALDO_INICIAL_JAN_2026 = 2_109_833

// ─────────── Types ───────────

export interface DotacionCambio {
  mesIndex: number
  cantidad: number
}

export interface DotacionCargo {
  nombre: string
  cantidad: number
  costoMensual: number
  cambios: DotacionCambio[]
}

export interface ForecastAssumptions {
  saldoInicial: number                 // manual, default 0
  ventasPorMes: (number | null)[]      // null = usar avgVentasHist; 0 = cero explícito
  pctRecurrente: number                // 0–100
  churnMensual: number                 // 0–15
  pctIncobrable: number                // 0–10
  dotacion: DotacionCargo[]
  remDirectorPorMes: (number | null)[] // null = usar lastRemDirector; 0 = cero explícito
  pctIncrementoSoftware: number        // 0–100
  saldoMinimo: number
}

export const DEFAULT_DOTACION: DotacionCargo[] = [
  { nombre: 'Dev Full Stack Sr',   cantidad: 1, costoMensual: 1_500_000, cambios: [] },
  { nombre: 'Dev Full Stack Jr',   cantidad: 0, costoMensual: 1_000_000, cambios: [] },
  { nombre: 'Diseñadora Lead',     cantidad: 1, costoMensual: 1_300_000, cambios: [] },
  { nombre: 'Diseñadora UX',       cantidad: 1, costoMensual:   900_000, cambios: [] },
  { nombre: 'Ejecutiva Comercial', cantidad: 1, costoMensual: 1_200_000, cambios: [] },
]

export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  saldoInicial: 0,
  ventasPorMes: [],
  pctRecurrente: 60,
  churnMensual: 2,
  pctIncobrable: 1.5,
  dotacion: DEFAULT_DOTACION,
  remDirectorPorMes: [],
  pctIncrementoSoftware: 50,
  saldoMinimo: 3_000_000,
}

export interface ForecastMonth {
  ym: string
  saldoInicial: number
  ventasBruta: number
  ventas: number
  otrosIngresos: number
  ingresos: number
  costoVenta: number
  otrosGastosExpl: number
  costos: number
  gastosAdm: number
  serviciosComp: number
  publicidad: number
  representacion: number
  locomocion: number
  legales: number
  gastos: number
  remDirector: number
  saldoFinal: number
  belowMinimum: boolean
}

export interface ForecastResult {
  months: ForecastMonth[]
  projectedMonths: string[]
  movAvgMonths: string[]
  avgVentasHist: number
  lastRemDirector: number
}

// ─────────── Monthly totals map (all history, all years) ───────────

interface MonthData {
  ventas: number
  otrosGastosExpl: number
  gastosAdm: number
  gastosExpl: number
  publicidad: number
  representacion: number
  locomocion: number
  legales: number
  remDirector: number
}

function buildMonthlyMap(allRows: D.Row[]): Map<string, MonthData> {
  const grouped: Record<string, D.Row[]> = {}
  for (const r of allRows) {
    const ym = D.getMonth(r)
    if (ym) { (grouped[ym] ??= []).push(r) }
  }

  const result = new Map<string, MonthData>()
  for (const [ym, rows] of Object.entries(grouped)) {
    const sumIng = (fn: (r: D.Row) => boolean) =>
      rows.filter(r => (D.getEstado(r) === 'Pagada' || D.getEstado(r) === 'Pagada_parcial') && fn(r))
          .reduce((s, r) => s + D.getMonto(r), 0)
    const sumPag = (fn: (r: D.Row) => boolean) =>
      rows.filter(r => D.getEstado(r) === 'Pagada' && fn(r))
          .reduce((s, r) => s + D.getMonto(r), 0)

    result.set(ym, {
      ventas:          sumIng(r => D.getCuenta(r) === '5101-01'),
      otrosGastosExpl: sumPag(r =>
        D.getCuenta(r) === '4101-09' ||
        D.getDesc(r).toUpperCase().includes('OTROS GASTOS DE EXPLOTACION')
      ),
      gastosAdm:       sumPag(r => D.getTipoCuenta(r) === 'Gasto_Adm'),
      gastosExpl:      sumPag(r => D.getTipoCuenta(r) === 'Gasto_ERP'),
      publicidad:      sumPag(r => D.getTipoCuenta(r) === 'Gasto_Mkg'),
      representacion:  sumPag(r => D.getCuenta(r) === '4201-09'),
      locomocion:      sumPag(r => D.getCuenta(r) === '4201-26'),
      legales:         sumPag(r => D.getCuenta(r) === '4201-12'),
      remDirector:     sumPag(r => D.getCuenta(r) === '4401-02'),
    })
  }
  return result
}

// Last N months before beforeYM that have a non-zero value for key
function movAvg(
  map: Map<string, MonthData>,
  beforeYM: string,
  key: keyof MonthData,
  n = 3
): { value: number; months: string[] } {
  const entries = Array.from(map.entries())
    .filter(([ym, d]) => ym < beforeYM && (d[key] as number) > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, n)
  if (entries.length === 0) return { value: 0, months: [] }
  return {
    value:  entries.reduce((s, [, d]) => s + (d[key] as number), 0) / entries.length,
    months: entries.map(([ym]) => ym),
  }
}

// ─────────── Dotación cost for month index ───────────

function computeCostoEquipo(dotacion: DotacionCargo[], monthIndex: number): number {
  return dotacion.reduce((total, cargo) => {
    let qty = cargo.cantidad
    const sorted = [...cargo.cambios].sort((a, b) => a.mesIndex - b.mesIndex)
    for (const c of sorted) {
      if (c.mesIndex <= monthIndex) qty = c.cantidad
      else break
    }
    return total + qty * cargo.costoMensual
  }, 0)
}

// ─────────── Main export ───────────

export function buildForecast(allRows: D.Row[], assumptions: ForecastAssumptions): ForecastResult {
  const now          = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const projectedMonths: string[] = []
  for (let m = currentMonth; m <= 12; m++) {
    projectedMonths.push(`${currentYear}-${String(m).padStart(2, '0')}`)
  }
  const firstYM = projectedMonths[0] ?? `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  // Diagnostic: unique cuenta_cble in Costo rows
  const costoCuentas = [...new Set(
    allRows.filter(r => D.getTipo(r) === 'Costo').map(r => D.getCuenta(r))
  )].sort()
  console.log('[Forecast] cuenta_cble en filas Costo:', costoCuentas)

  const monthMap = buildMonthlyMap(allRows)

  // Moving averages: last 3 months with data before first projected month (any year)
  const avgVentasRes    = movAvg(monthMap, firstYM, 'ventas')
  const avgVentasHist   = avgVentasRes.value
  const movAvgMonths    = avgVentasRes.months

  const avgOtrosGastosExpl = movAvg(monthMap, firstYM, 'otrosGastosExpl').value
  const avgGastosAdm       = movAvg(monthMap, firstYM, 'gastosAdm').value
  const avgGastosExpl      = movAvg(monthMap, firstYM, 'gastosExpl').value
  const avgPublicidad      = movAvg(monthMap, firstYM, 'publicidad').value
  const avgRepresentacion  = movAvg(monthMap, firstYM, 'representacion').value
  const avgLocomocion      = movAvg(monthMap, firstYM, 'locomocion').value
  const avgLegales         = movAvg(monthMap, firstYM, 'legales').value
  const lastRemDirector    = movAvg(monthMap, firstYM, 'remDirector', 1).value

  // Seed previous-month cobranza from last closed month's actual ventas
  let lcMonth = currentMonth - 1
  let lcYear  = currentYear
  if (lcMonth < 1) { lcMonth = 12; lcYear-- }
  const lastClosedYM   = `${lcYear}-${String(lcMonth).padStart(2, '0')}`
  const lastClosedData = monthMap.get(lastClosedYM)
  const lastVentasReal = lastClosedData && lastClosedData.ventas > 0
                        ? lastClosedData.ventas
                        : avgVentasHist

  const incobrFactor = 1 - assumptions.pctIncobrable / 100
  const pctRec       = assumptions.pctRecurrente / 100
  const pctProy      = 1 - pctRec

  const ultimaVentaRealRecurrente = lastVentasReal * pctRec
  const ultimaVentaRealProyecto   = lastVentasReal * pctProy
  console.log('[Forecast] ultimaVentaRealRecurrente:', ultimaVentaRealRecurrente, 'ultimaVentaRealProyecto:', ultimaVentaRealProyecto)

  let prevRecBruta  = ultimaVentaRealRecurrente
  let prevProyBruta = ultimaVentaRealProyecto
  let prevSaldo     = assumptions.saldoInicial

  const months: ForecastMonth[] = []

  for (let i = 0; i < projectedMonths.length; i++) {
    const ym = projectedMonths[i]

    // null / undefined → avg; 0 → explicit zero
    const ventaTotal_M = assumptions.ventasPorMes[i] ?? avgVentasHist

    // Churn applies to recurrentes only
    const factorChurn  = Math.pow(1 - assumptions.churnMensual / 100, i + 1)
    const ventaRec_M   = ventaTotal_M * pctRec * factorChurn
    const ventaProy_M  = ventaTotal_M * pctProy
    const ventasBruta  = ventaRec_M + ventaProy_M

    const ventas = prevRecBruta * incobrFactor
                 + ventaProy_M * 0.5
                 + prevProyBruta * 0.5 * incobrFactor
    const otrosIngresos = 0
    const ingresos      = ventas + otrosIngresos

    console.log(`[Forecast] ${ym} ventasMes=${ventaTotal_M} ingresoCobrado=${Math.round(ventas)}`)

    const costoVenta      = computeCostoEquipo(assumptions.dotacion, i)
    const otrosGastosExpl = avgOtrosGastosExpl
    const costos          = costoVenta + otrosGastosExpl

    const delta         = ventasBruta - avgVentasHist
    const softDelta     = delta > 0 ? delta * assumptions.pctIncrementoSoftware / 100 : 0
    const serviciosComp = avgGastosExpl + softDelta

    const gastosAdm      = avgGastosAdm
    const publicidad     = avgPublicidad
    const representacion = avgRepresentacion
    const locomocion     = avgLocomocion
    const legales        = avgLegales
    const gastos         = gastosAdm + serviciosComp + publicidad + representacion + locomocion + legales

    // null / undefined → lastRemDirector; 0 → explicit zero
    const remDirector = assumptions.remDirectorPorMes[i] ?? lastRemDirector

    const saldoFinal = prevSaldo + ingresos - costos - gastos - remDirector

    months.push({
      ym, saldoInicial: prevSaldo, ventasBruta,
      ventas, otrosIngresos, ingresos,
      costoVenta, otrosGastosExpl, costos,
      gastosAdm, serviciosComp, publicidad, representacion, locomocion, legales, gastos,
      remDirector, saldoFinal,
      belowMinimum: saldoFinal < assumptions.saldoMinimo,
    })

    prevSaldo     = saldoFinal
    prevRecBruta  = ventaRec_M
    prevProyBruta = ventaProy_M
  }

  return { months, projectedMonths, movAvgMonths, avgVentasHist, lastRemDirector }
}
