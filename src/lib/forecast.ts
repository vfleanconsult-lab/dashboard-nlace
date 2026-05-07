import * as D from './data'

export const SALDO_INICIAL_JAN_2026 = 2_109_833

// ─────────── Types ───────────

export interface DotacionCambio {
  mesIndex: number   // 0-based from forecast start
  cantidad: number   // new quantity effective from this month
}

export interface DotacionCargo {
  nombre: string
  cantidad: number
  costoMensual: number
  cambios: DotacionCambio[]
}

export interface ForecastAssumptions {
  saldoInicialManual: number | null
  ventasPorMes: number[]           // per projected month; 0 = use avgVentasHist
  pctRecurrente: number            // 0–100
  churnMensual: number             // 0–15
  pctIncobrable: number            // 0–10
  dotacion: DotacionCargo[]
  pctIncrementoSoftware: number    // 0–100
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
  saldoInicialManual: null,
  ventasPorMes: [],
  pctRecurrente: 60,
  churnMensual: 2,
  pctIncobrable: 1.5,
  dotacion: DEFAULT_DOTACION,
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
  saldoInicialCalculado: number
  projectedMonths: string[]
  movAvgMonths: string[]
  avgVentasHist: number
}

// ─────────── Internal: historical snapshot by mes_economico ───────────

interface MonthData {
  ventas: number
  gastosAdm: number
  gastosExpl: number
  publicidad: number
  representacion: number
  locomocion: number
  legales: number
  remDirector: number
  saldoFinal: number
}

function buildHistMap(allRows: D.Row[], lastYM: string): Map<string, MonthData> {
  const grouped: Record<string, D.Row[]> = {}
  for (const r of allRows) {
    const ym = D.getMonth(r)
    if (ym && ym >= '2026-01' && ym <= lastYM) {
      ;(grouped[ym] ??= []).push(r)
    }
  }

  const allYMs: string[] = []
  let cy = 2026, cm = 1
  const [maxY, maxM] = lastYM.split('-').map(Number)
  while (cy < maxY || (cy === maxY && cm <= maxM)) {
    allYMs.push(`${cy}-${String(cm).padStart(2, '0')}`)
    cm++; if (cm > 12) { cm = 1; cy++ }
  }

  const result = new Map<string, MonthData>()
  let prevFinal = SALDO_INICIAL_JAN_2026

  for (const ym of allYMs) {
    const rows = grouped[ym] ?? []
    const sumIng = (fn: (r: D.Row) => boolean) =>
      rows.filter(r => (D.getEstado(r) === 'Pagada' || D.getEstado(r) === 'Pagada_parcial') && fn(r))
          .reduce((s, r) => s + D.getMonto(r), 0)
    const sumPag = (fn: (r: D.Row) => boolean) =>
      rows.filter(r => D.getEstado(r) === 'Pagada' && fn(r))
          .reduce((s, r) => s + D.getMonto(r), 0)

    const ventas          = sumIng(r => D.getCuenta(r) === '5101-01')
    const otrosIngresos   = sumIng(r => D.getCuenta(r) === '5201-03')
    const ingresos        = ventas + otrosIngresos
    const costoVenta      = sumPag(r => D.getCuenta(r) === '4101-01')
    const otrosGastosExpl = sumPag(r => D.getCuenta(r) === '4101-09')
    const costos          = costoVenta + otrosGastosExpl
    const gastosAdm       = sumPag(r => D.getTipoCuenta(r) === 'Gasto_Adm')
    const gastosExpl      = sumPag(r => D.getTipoCuenta(r) === 'Gasto_ERP')
    const publicidad      = sumPag(r => D.getTipoCuenta(r) === 'Gasto_Mkg')
    const representacion  = sumPag(r => D.getCuenta(r) === '4201-09')
    const locomocion      = sumPag(r => D.getCuenta(r) === '4201-26')
    const legales         = sumPag(r => D.getCuenta(r) === '4201-12')
    const remDirector     = sumPag(r => D.getCuenta(r) === '4401-02')
    const gastos          = gastosAdm + gastosExpl + publicidad + representacion + locomocion + legales

    const saldoFinal = (ym === '2026-01' ? SALDO_INICIAL_JAN_2026 : prevFinal)
                     + ingresos - costos - gastos - remDirector

    result.set(ym, {
      ventas, gastosAdm, gastosExpl, publicidad,
      representacion, locomocion, legales, remDirector, saldoFinal,
    })
    prevFinal = saldoFinal
  }

  return result
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

  // Forecast starts from current month through Dec of current year
  const projectedMonths: string[] = []
  for (let m = currentMonth; m <= 12; m++) {
    projectedMonths.push(`${currentYear}-${String(m).padStart(2, '0')}`)
  }

  // Last closed month = month before current
  let lcMonth = currentMonth - 1
  let lcYear  = currentYear
  if (lcMonth < 1) { lcMonth = 12; lcYear-- }
  const lastClosedYM = `${lcYear}-${String(lcMonth).padStart(2, '0')}`

  const histMap               = buildHistMap(allRows, lastClosedYM)
  const saldoInicialCalculado = histMap.get(lastClosedYM)?.saldoFinal ?? SALDO_INICIAL_JAN_2026
  const saldoInicial          = assumptions.saldoInicialManual ?? saldoInicialCalculado

  // Moving average: 3 months before current
  const movAvgMonths: string[] = []
  for (let i = 3; i >= 1; i--) {
    let m = currentMonth - i
    let y = currentYear
    while (m < 1) { m += 12; y-- }
    movAvgMonths.push(`${y}-${String(m).padStart(2, '0')}`)
  }

  const validAvgMonths = movAvgMonths.filter(ym => {
    const d = histMap.get(ym)
    return d != null && (d.ventas + d.gastosAdm + d.gastosExpl + d.remDirector) > 0
  })

  const avg = (key: keyof MonthData): number => {
    if (validAvgMonths.length === 0) return 0
    const vals = validAvgMonths.map(ym => histMap.get(ym)![key] as number)
    return vals.reduce((a, b) => a + b, 0) / validAvgMonths.length
  }

  const avgVentasHist     = avg('ventas')
  const avgGastosAdm      = avg('gastosAdm')
  const avgGastosExpl     = avg('gastosExpl')
  const avgPublicidad     = avg('publicidad')
  const avgRepresentacion = avg('representacion')
  const avgLocomocion     = avg('locomocion')
  const avgLegales        = avg('legales')

  // remDirector: last non-zero value in movAvgMonths
  let lastRemDirector = 0
  for (const ym of [...movAvgMonths].reverse()) {
    const d = histMap.get(ym)
    if (d && d.remDirector > 0) { lastRemDirector = d.remDirector; break }
  }

  const incobrFactor = 1 - assumptions.pctIncobrable / 100
  const pctRec       = assumptions.pctRecurrente / 100
  const pctProy      = 1 - pctRec

  // Seed prev-month cobranza values from historical average
  let prevRecBruta  = avgVentasHist * pctRec
  let prevProyBruta = avgVentasHist * pctProy
  let prevSaldo     = saldoInicial

  const months: ForecastMonth[] = []

  for (let i = 0; i < projectedMonths.length; i++) {
    const ym = projectedMonths[i]

    const baseSales   = (assumptions.ventasPorMes[i] ?? 0) > 0
                        ? assumptions.ventasPorMes[i]
                        : avgVentasHist
    const churnFactor = Math.pow(1 - assumptions.churnMensual / 100, i)
    const ventasBruta = baseSales * churnFactor

    const recBruta  = ventasBruta * pctRec
    const proyBruta = ventasBruta * pctProy

    // Recurrentes cobrados el mes siguiente; proyectos: 50% anticipo + 50% saldo del mes anterior
    const ventas        = prevRecBruta * incobrFactor
                        + proyBruta * 0.5
                        + prevProyBruta * 0.5 * incobrFactor
    const otrosIngresos = 0
    const ingresos      = ventas + otrosIngresos

    const costoVenta      = computeCostoEquipo(assumptions.dotacion, i)
    const otrosGastosExpl = 0
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

    const remDirector = lastRemDirector
    const saldoFinal  = prevSaldo + ingresos - costos - gastos - remDirector

    months.push({
      ym, saldoInicial: prevSaldo, ventasBruta,
      ventas, otrosIngresos, ingresos,
      costoVenta, otrosGastosExpl, costos,
      gastosAdm, serviciosComp, publicidad, representacion, locomocion, legales, gastos,
      remDirector, saldoFinal,
      belowMinimum: saldoFinal < assumptions.saldoMinimo,
    })

    prevSaldo     = saldoFinal
    prevRecBruta  = recBruta
    prevProyBruta = proyBruta
  }

  return { months, saldoInicialCalculado, projectedMonths, movAvgMonths: validAvgMonths, avgVentasHist }
}
