import * as D from './data'

export const SALDO_INICIAL_JAN_2026 = 2_109_833

// ─────────── Internal: historical cashflow (mirrors Cashflow.tsx logic) ───────────

interface MonthCF {
  saldoInicial: number
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
}

function getFechaPagoYM(row: D.Row): string | null {
  const fp = D.getFechaPago(row)
  if (!fp) return null
  const d = D.parseDateCL(fp)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildCFMap(allRows: D.Row[]): Map<string, MonthCF> {
  const yearSet = new Set<string>(['2026'])
  for (const r of allRows) {
    const ym = getFechaPagoYM(r)
    if (ym && ym >= '2026-01') yearSet.add(ym.substring(0, 4))
  }

  const ymSet = new Set<string>()
  for (const y of yearSet) {
    for (let m = 1; m <= 12; m++) ymSet.add(`${y}-${String(m).padStart(2, '0')}`)
  }

  const grouped: Record<string, D.Row[]> = {}
  for (const r of allRows) {
    const ym = getFechaPagoYM(r)
    if (ym && ymSet.has(ym)) {
      ;(grouped[ym] ??= []).push(r)
    }
  }

  const sortedYMs = Array.from(ymSet).sort()
  const result = new Map<string, MonthCF>()
  let prevFinal = SALDO_INICIAL_JAN_2026

  for (const ym of sortedYMs) {
    const rows = grouped[ym] ?? []
    const sum       = (fn: (r: D.Row) => boolean) =>
      rows.filter(fn).reduce((s, r) => s + D.getMonto(r), 0)
    const sumPag    = (fn: (r: D.Row) => boolean) =>
      sum(r => D.getEstado(r) === 'Pagada' && fn(r))
    const sumIng    = (fn: (r: D.Row) => boolean) =>
      sum(r => (D.getEstado(r) === 'Pagada' || D.getEstado(r) === 'Pagada_parcial') && fn(r))

    const saldoInicial    = ym === '2026-01' ? SALDO_INICIAL_JAN_2026 : prevFinal
    const ventas          = sumIng(r => D.getCuenta(r) === '5101-01')
    const otrosIngresos   = sumIng(r => D.getCuenta(r) === '5201-03')
    const ingresos        = ventas + otrosIngresos
    const costoVenta      = sumPag(r => D.getCuenta(r) === '4101-01')
    const otrosGastosExpl = sumPag(r => D.getCuenta(r) === '4101-09')
    const costos          = costoVenta + otrosGastosExpl
    const gastosAdm       = sumPag(r => D.getTipoCuenta(r) === 'Gasto_Adm')
    const serviciosComp   = sumPag(r => D.getTipoCuenta(r) === 'Gasto_ERP')
    const publicidad      = sumPag(r => D.getTipoCuenta(r) === 'Gasto_Mkg')
    const representacion  = sumPag(r => D.getCuenta(r) === '4201-09')
    const locomocion      = sumPag(r => D.getCuenta(r) === '4201-26')
    const legales         = sumPag(r => D.getCuenta(r) === '4201-12')
    const gastos          = gastosAdm + serviciosComp + publicidad + representacion + locomocion + legales
    const remDirector     = sumPag(r => D.getCuenta(r) === '4401-02')
    const saldoFinal      = saldoInicial + ingresos - costos - gastos - remDirector

    result.set(ym, {
      saldoInicial, ventas, otrosIngresos, ingresos,
      costoVenta, otrosGastosExpl, costos,
      gastosAdm, serviciosComp, publicidad, representacion, locomocion, legales, gastos,
      remDirector, saldoFinal,
    })
    prevFinal = saldoFinal
  }

  return result
}

// ─────────── Cobranza factor ───────────

function cobranzaFactor(dias: number): number {
  if (dias <= 15) return 1.00
  if (dias <= 30) return 0.85
  if (dias <= 45) return 0.65
  if (dias <= 60) return 0.45
  return 0.25
}

// ─────────── Public types ───────────

export interface ForecastAssumptions {
  ventasMensuales: number
  diasCobranza: number        // 10–90
  pctIncobrable: number       // 0–10
  churnMensual: number        // 0–15
  personasNuevas: number      // 0–5
  mesContratacion: number     // 0-indexed from forecast start
  costoPorPersona: number
  pctIncrementoSoftware: number  // 0–50
  saldoMinimo: number
  saldoInicialManual: number | null  // null = use calculated
}

export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  ventasMensuales: 5_000_000,
  diasCobranza: 30,
  pctIncobrable: 2,
  churnMensual: 0,
  personasNuevas: 0,
  mesContratacion: 0,
  costoPorPersona: 1_500_000,
  pctIncrementoSoftware: 10,
  saldoMinimo: 1_000_000,
  saldoInicialManual: null,
}

export interface ForecastMonth {
  ym: string
  saldoInicial: number
  ventas: number           // cash collected (ingresoCobrado)
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
  ventasBruta: number      // gross MRR before cobranza (for KPI display)
}

export interface ForecastResult {
  months: ForecastMonth[]
  saldoInicialCalculado: number
  projectedMonths: string[]
  movAvgMonths: string[]   // reference months used for moving averages
}

// ─────────── Main export ───────────

export function buildForecast(allRows: D.Row[], assumptions: ForecastAssumptions): ForecastResult {
  const now          = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1  // 1–12

  // First projected month = next calendar month
  let fMonth = currentMonth + 1
  let fYear  = currentYear
  if (fMonth > 12) { fMonth = 1; fYear++ }

  // Projected months: fMonth..Dec of currentYear (only within current year)
  const projectedMonths: string[] = []
  if (fYear === currentYear) {
    for (let m = fMonth; m <= 12; m++) {
      projectedMonths.push(`${currentYear}-${String(m).padStart(2, '0')}`)
    }
  }

  const cfMap = buildCFMap(allRows)

  // Last closed month = month before current
  let lcMonth = currentMonth - 1
  let lcYear  = currentYear
  if (lcMonth < 1) { lcMonth = 12; lcYear-- }
  const lastClosedYM = `${lcYear}-${String(lcMonth).padStart(2, '0')}`

  const saldoInicialCalculado = cfMap.get(lastClosedYM)?.saldoFinal ?? SALDO_INICIAL_JAN_2026
  const saldoInicial          = assumptions.saldoInicialManual ?? saldoInicialCalculado

  // Last 3 months before forecast start
  const movAvgMonths: string[] = []
  for (let i = 3; i >= 1; i--) {
    let m = fMonth - i
    let y = fYear
    while (m < 1) { m += 12; y-- }
    movAvgMonths.push(`${y}-${String(m).padStart(2, '0')}`)
  }

  // Only months with actual data (non-zero outflows) for the moving average
  const validMonths = movAvgMonths.filter(ym => {
    const cf = cfMap.get(ym)
    return cf != null && (cf.costos + cf.gastos + cf.remDirector + cf.ventas) > 0
  })

  const avg = (key: keyof MonthCF): number => {
    if (validMonths.length === 0) return 0
    const vals = validMonths.map(ym => cfMap.get(ym)![key] as number)
    return vals.reduce((a, b) => a + b, 0) / validMonths.length
  }

  const avgCostoVenta      = avg('costoVenta')
  const avgSoftware        = avg('serviciosComp')
  const avgGastosAdm       = avg('gastosAdm')
  const avgPublicidad      = avg('publicidad')
  const avgOtrosGastosExpl = avg('otrosGastosExpl')
  const avgRepresentacion  = avg('representacion')
  const avgLocomocion      = avg('locomocion')
  const avgLegales         = avg('legales')
  const avgRemDirector     = avg('remDirector')
  const avgVentasHist      = avg('ventas')

  const cobFactor    = cobranzaFactor(assumptions.diasCobranza)
  const incobrFactor = 1 - assumptions.pctIncobrable / 100

  const months: ForecastMonth[] = []
  let prevSaldo = saldoInicial

  for (let i = 0; i < projectedMonths.length; i++) {
    const ym = projectedMonths[i]

    // Ventas with cumulative churn
    const churnFactor  = Math.pow(1 - assumptions.churnMensual / 100, i)
    const ventasBruta  = assumptions.ventasMensuales * churnFactor
    const ventas       = ventasBruta * cobFactor * incobrFactor
    const otrosIngresos = 0
    const ingresos     = ventas + otrosIngresos

    // Costo venta + new people from hiring month onwards
    const personaExtra = (i >= assumptions.mesContratacion && assumptions.personasNuevas > 0)
      ? assumptions.personasNuevas * assumptions.costoPorPersona
      : 0
    const costoVenta      = avgCostoVenta + personaExtra
    const otrosGastosExpl = avgOtrosGastosExpl
    const costos          = costoVenta + otrosGastosExpl

    // Software scales with sales delta vs historical average
    const delta       = ventasBruta - avgVentasHist
    const softDelta   = delta > 0 ? delta * assumptions.pctIncrementoSoftware / 100 : 0
    const serviciosComp = avgSoftware + softDelta

    const gastosAdm     = avgGastosAdm
    const publicidad    = avgPublicidad
    const representacion = avgRepresentacion
    const locomocion    = avgLocomocion
    const legales       = avgLegales
    const gastos        = gastosAdm + serviciosComp + publicidad + representacion + locomocion + legales
    const remDirector   = avgRemDirector

    const saldoFinal = prevSaldo + ingresos - costos - gastos - remDirector

    months.push({
      ym,
      saldoInicial: prevSaldo,
      ventasBruta,
      ventas,
      otrosIngresos,
      ingresos,
      costoVenta,
      otrosGastosExpl,
      costos,
      gastosAdm,
      serviciosComp,
      publicidad,
      representacion,
      locomocion,
      legales,
      gastos,
      remDirector,
      saldoFinal,
      belowMinimum: saldoFinal < assumptions.saldoMinimo,
    })

    prevSaldo = saldoFinal
  }

  return { months, saldoInicialCalculado, projectedMonths, movAvgMonths: validMonths }
}
