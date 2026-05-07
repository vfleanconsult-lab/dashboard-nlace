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
  saldoInicial: number
  ventasRecurrentesMes: (number | null)[]   // null = use avgRecHist; 0 = explicit zero
  ventasNuevasMes: (number | null)[]         // null = 0; 0 = explicit zero
  pctAnticipoNuevas: number                  // 0–100, default 50
  pctCobroMes1Rec: number                    // 0–100, default 85
  pctCobroMes2Rec: number                    // 0–50, default 12
  pctIncobrableNuevas: number                // 0–10, default 2
  tasaPerdidaMRR: number                     // 0–15, default 2
  dotacion: DotacionCargo[]
  remDirectorPorMes: (number | null)[]       // null = use lastRemDirector; 0 = explicit zero
  pctIncrementoSoftware: number              // 0–100, default 50
  minimoAlerta: number
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
  ventasRecurrentesMes: [],
  ventasNuevasMes: [],
  pctAnticipoNuevas: 50,
  pctCobroMes1Rec: 85,
  pctCobroMes2Rec: 12,
  pctIncobrableNuevas: 2,
  tasaPerdidaMRR: 2,
  dotacion: DEFAULT_DOTACION,
  remDirectorPorMes: [],
  pctIncrementoSoftware: 50,
  minimoAlerta: 3_000_000,
}

export interface ForecastMonth {
  ym: string
  saldoInicial: number
  ventasRecurrentes: number
  ventasNuevas: number
  ventasBruta: number
  cobroRecMes1: number
  cobroRecMes2: number
  cobroAnticipo: number
  cobroSaldo: number
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
  avgRecHist: number
  lastRemDirector: number
  ymM1: string
  ymM2: string
  ventasM1: number
  ventasM2: number
}

// ─────────── Cash ventas map grouped by fecha_pago ───────────
// For cash-flow forecasting: cash received = grouped by payment date, not invoice date

function buildCashVentasMap(allRows: D.Row[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of allRows) {
    if (D.getCuenta(r) !== '5101-01') continue
    const estado = D.getEstado(r)
    if (estado !== 'Pagada' && estado !== 'Pagada_parcial') continue
    const fp = D.getFechaPago(r)
    if (!fp) continue
    const ym = fp.slice(0, 7)  // YYYY-MM from YYYY-MM-DD
    map.set(ym, (map.get(ym) ?? 0) + D.getMonto(r))
  }
  return map
}

function avgCashVentas(
  map: Map<string, number>,
  beforeYM: string,
  n = 3
): { value: number; months: string[] } {
  const entries = Array.from(map.entries())
    .filter(([ym, v]) => ym < beforeYM && v > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, n)
  if (entries.length === 0) return { value: 0, months: [] }
  return {
    value:  entries.reduce((s, [, v]) => s + v, 0) / entries.length,
    months: entries.map(([ym]) => ym),
  }
}

// ─────────── Monthly totals map (expenses by mes_economico) ───────────

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

  // Cash-based map for ventas (grouped by fecha_pago = actual cash received)
  const cashMap = buildCashVentasMap(allRows)
  const avgVentasCashRes = avgCashVentas(cashMap, firstYM)
  const avgRecHist       = avgVentasCashRes.value
  const movAvgMonths     = avgVentasCashRes.months

  // Expense averages still use mes_economico (accrual basis for cost estimation)
  const monthMap = buildMonthlyMap(allRows)

  const avgOtrosGastosExpl = movAvg(monthMap, firstYM, 'otrosGastosExpl').value
  const avgGastosAdm       = movAvg(monthMap, firstYM, 'gastosAdm').value
  const avgGastosExpl      = movAvg(monthMap, firstYM, 'gastosExpl').value
  const avgPublicidad      = movAvg(monthMap, firstYM, 'publicidad').value
  const avgRepresentacion  = movAvg(monthMap, firstYM, 'representacion').value
  const avgLocomocion      = movAvg(monthMap, firstYM, 'locomocion').value
  const avgLegales         = movAvg(monthMap, firstYM, 'legales').value
  const lastRemDirector    = movAvg(monthMap, firstYM, 'remDirector', 1).value

  // Last two closed months — seeds M-1 and M-2 collection for first projected month
  let lcMonth = currentMonth - 1
  let lcYear  = currentYear
  if (lcMonth < 1) { lcMonth = 12; lcYear-- }
  const lastClosedYM = `${lcYear}-${String(lcMonth).padStart(2, '0')}`

  let lc2Month = lcMonth - 1
  let lc2Year  = lcYear
  if (lc2Month < 1) { lc2Month = 12; lc2Year-- }
  const penultClosedYM = `${lc2Year}-${String(lc2Month).padStart(2, '0')}`

  // Use cash-based lookup (fecha_pago) for actual cash received in each month
  const ventasRealesUltimoMes    = cashMap.get(lastClosedYM)    ?? avgRecHist
  const ventasRealesPenultimoMes = cashMap.get(penultClosedYM)  ?? avgRecHist

  console.log('[Forecast] lastClosedYM (M-1):', lastClosedYM, '→ ventas:', ventasRealesUltimoMes)
  console.log('[Forecast] penultClosedYM (M-2):', penultClosedYM, '→ ventas:', ventasRealesPenultimoMes)
  console.log('[Forecast] avgRecHist:', avgRecHist)

  const {
    pctAnticipoNuevas, pctCobroMes1Rec, pctCobroMes2Rec,
    pctIncobrableNuevas, tasaPerdidaMRR,
  } = assumptions

  let prevSaldo     = assumptions.saldoInicial
  const months: ForecastMonth[] = []

  for (let i = 0; i < projectedMonths.length; i++) {
    const ym = projectedMonths[i]

    // MRR decay — only used for display column, NOT in collection formula
    const factorMRR_M = Math.pow(1 - tasaPerdidaMRR / 100, i + 1)

    // Raw inputs for this month
    const recBase_M = assumptions.ventasRecurrentesMes[i] !== null && assumptions.ventasRecurrentesMes[i] !== undefined
      ? (assumptions.ventasRecurrentesMes[i] as number)
      : avgRecHist
    const nuevas_M  = assumptions.ventasNuevasMes[i] !== null && assumptions.ventasNuevasMes[i] !== undefined
      ? (assumptions.ventasNuevasMes[i] as number)
      : 0

    // Ventas for display (recurrentes after MRR decay)
    const ventasRecurrentes = recBase_M * factorMRR_M
    const ventasNuevas      = nuevas_M
    const ventasBruta       = ventasRecurrentes + ventasNuevas

    // Previous month recurrentes base (for collections in this month)
    const recBase_ant = i === 0
      ? ventasRealesUltimoMes
      : (assumptions.ventasRecurrentesMes[i - 1] !== null && assumptions.ventasRecurrentesMes[i - 1] !== undefined
          ? (assumptions.ventasRecurrentesMes[i - 1] as number)
          : avgRecHist)

    // M-2 recurrentes base (used for cobro_rec_mes2)
    const recBase_ant2 = i === 0
      ? ventasRealesPenultimoMes                                                   // March real
      : i === 1
        ? ventasRealesUltimoMes
        : (assumptions.ventasRecurrentesMes[i - 2] !== null && assumptions.ventasRecurrentesMes[i - 2] !== undefined
            ? (assumptions.ventasRecurrentesMes[i - 2] as number)
            : avgRecHist)

    const nuevas_ant = i === 0 ? 0
      : (assumptions.ventasNuevasMes[i - 1] !== null && assumptions.ventasNuevasMes[i - 1] !== undefined
          ? (assumptions.ventasNuevasMes[i - 1] as number)
          : 0)

    // Cobranza recurrentes: M-1 × pct1 + M-2 × pct2 (sin factor MRR en cobro)
    const cobro_rec_mes1 = recBase_ant  * (pctCobroMes1Rec / 100)
    const cobro_rec_mes2 = recBase_ant2 * (pctCobroMes2Rec / 100)

    // Cobranza nuevas: anticipo este mes + saldo del mes anterior
    const cobro_anticipo = nuevas_M   * (pctAnticipoNuevas / 100)
    const cobro_saldo    = nuevas_ant * ((100 - pctAnticipoNuevas) / 100) * (1 - pctIncobrableNuevas / 100)

    console.log(`[Forecast] ${ym} cobro_rec_mes1=${Math.round(cobro_rec_mes1)} cobro_rec_mes2=${Math.round(cobro_rec_mes2)} cobro_anticipo=${Math.round(cobro_anticipo)} cobro_saldo=${Math.round(cobro_saldo)} total=${Math.round(cobro_rec_mes1 + cobro_rec_mes2 + cobro_anticipo + cobro_saldo)}`)

    const ventas = cobro_rec_mes1 + cobro_rec_mes2 + cobro_anticipo + cobro_saldo
    const otrosIngresos = 0
    const ingresos      = ventas + otrosIngresos

    const costoVenta      = computeCostoEquipo(assumptions.dotacion, i)
    const otrosGastosExpl = avgOtrosGastosExpl
    const costos          = costoVenta + otrosGastosExpl

    const delta         = ventasBruta - avgRecHist
    const softDelta     = delta > 0 ? delta * assumptions.pctIncrementoSoftware / 100 : 0
    const serviciosComp = avgGastosExpl + softDelta

    const gastosAdm      = avgGastosAdm
    const publicidad     = avgPublicidad
    const representacion = avgRepresentacion
    const locomocion     = avgLocomocion
    const legales        = avgLegales
    const gastos         = gastosAdm + serviciosComp + publicidad + representacion + locomocion + legales

    const remDirector = assumptions.remDirectorPorMes[i] !== null && assumptions.remDirectorPorMes[i] !== undefined
      ? (assumptions.remDirectorPorMes[i] as number)
      : lastRemDirector

    const saldoFinal = prevSaldo + ingresos - costos - gastos - remDirector

    months.push({
      ym, saldoInicial: prevSaldo,
      ventasRecurrentes, ventasNuevas, ventasBruta,
      cobroRecMes1: cobro_rec_mes1, cobroRecMes2: cobro_rec_mes2,
      cobroAnticipo: cobro_anticipo, cobroSaldo: cobro_saldo,
      ventas, otrosIngresos, ingresos,
      costoVenta, otrosGastosExpl, costos,
      gastosAdm, serviciosComp, publicidad, representacion, locomocion, legales, gastos,
      remDirector, saldoFinal,
      belowMinimum: saldoFinal < assumptions.minimoAlerta,
    })

    prevSaldo = saldoFinal
  }

  return {
    months, projectedMonths, movAvgMonths, avgRecHist, lastRemDirector,
    ymM1: lastClosedYM, ymM2: penultClosedYM,
    ventasM1: ventasRealesUltimoMes, ventasM2: ventasRealesPenultimoMes,
  }
}
