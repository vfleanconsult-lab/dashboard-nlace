import Papa from 'papaparse'

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa--mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970'

export type Row = Record<string, string>

export interface KPIs {
  ventas: number
  otrosIngresos: number
  costos: number
  gastos: number
  utilBruta: number
  utilOp: number
  margenOp: number
  margenBruto: number
}

export interface DSOCliente {
  cliente: string
  dsoDias: number             // promedio días solo facturas pagadas
  transacciones: number       // total facturas (pagadas + pendientes)
  transaccionesPagadas: number
  monto: number               // monto total
  montoPagado: number
  montoPendiente: number
}

interface State {
  rows: Row[]
  years: string[]
  loaded: boolean
  error: unknown
  loadedAt: Date | null
}

function buildUrl(): string {
  const ts = Math.floor(Date.now() / (15 * 60 * 1000))
  return CSV_URL + '&_cb=' + ts
}

const state: State = { rows: [], years: [], loaded: false, error: null, loadedAt: null }

export const getTipo       = (row: Row) => (row['Tipo'] || '').trim()
export const getCuenta     = (row: Row) => (row['Cuenta_Cble'] || '').trim()
export const getDesc       = (row: Row) => (row['Descripcion Cta.'] || row['Descripcion Cta'] || '').trim()
export const getClasGasto  = (row: Row) => (row['Clasificacion_Gasto'] || '').trim()
export const getClasifCto  = (row: Row) => (row['Clasificacion_Cto'] || '').trim()
export const getTipoCuenta = (row: Row) => (row['Tipo_Cuenta'] || '').trim()
export const getEstado     = (row: Row) => (row['Estado'] || '').trim()
export const getMesEco     = (row: Row) => (row['Mes_economico'] || '').trim()
export const getAnoEco     = (row: Row) => (row['Ano_eco'] || '').trim()
export const getFechaEmision = (row: Row) => (row['Fecha_emision'] || '').trim()
export const getFechaPago    = (row: Row) => (row['Fecha_Pago'] || '').trim()

export function getMonto(row: Row): number {
  const raw = String(row['monto_bruto'] || '0')
  const cleaned = raw.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export function getYear(row: Row): string | null {
  const ano = getAnoEco(row)
  if (ano && /^\d{4}$/.test(ano)) return ano
  const mes = getMesEco(row)
  if (mes && mes.length >= 4) return mes.substring(0, 4)
  return null
}

export function getMonth(row: Row): string | null {
  const mes = getMesEco(row)
  if (!mes) return null
  return mes.length >= 7 ? mes.substring(0, 7) : null
}

export const isVenta       = (row: Row) => getTipo(row) === 'Ingreso' && getCuenta(row) === '5101-01'
export const isOtroIngreso = (row: Row) => getTipo(row) === 'Ingreso' && getCuenta(row) !== '5101-01'
export const isCosto       = (row: Row) => getTipo(row) === 'Costo'

export function isRetiroDirectores(row: Row): boolean {
  // Cuenta 4401-02 = Remuneraciones Directores (exclusión explícita por cuenta)
  if (getCuenta(row) === '4401-02') return true
  const desc = getDesc(row).toLowerCase()
  const clas = getClasGasto(row).toLowerCase()
  return desc.includes('retiro director') || clas.includes('retiro director')
}

// Selector explícito para la cuenta 4401-02 (Remuneraciones Directores)
export const isRemDirectores = (row: Row) => getTipo(row) === 'Gasto' && getCuenta(row) === '4401-02'

export const isGasto = (row: Row) => getTipo(row) === 'Gasto' && !isRetiroDirectores(row)

export function filterByYear(rows: Row[], year: string | null): Row[] {
  if (!year || year === 'all') return rows
  return rows.filter(r => getYear(r) === String(year))
}

export function filterByMonth(rows: Row[], month: string): Row[] {
  return rows.filter(r => getMonth(r) === month)
}

export function sumMonto(rows: Row[]): number {
  return rows.reduce((acc, r) => acc + getMonto(r), 0)
}

export function groupByMonth(rows: Row[], filterFn: (r: Row) => boolean): Record<string, number> {
  const map: Record<string, number> = {}
  rows.filter(filterFn).forEach(r => {
    const m = getMonth(r)
    if (!m) return
    map[m] = (map[m] || 0) + getMonto(r)
  })
  return map
}

export function getMonthsForYear(rows: Row[], year: string): string[] {
  const yr = String(year)
  const set: Record<string, boolean> = {}
  rows.forEach(r => {
    if (getYear(r) === yr) {
      const m = getMonth(r)
      if (m) set[m] = true
    }
  })
  return Object.keys(set).sort()
}

export const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function monthLabel(yyyyMM: string): string {
  const parts = yyyyMM.split('-')
  if (parts.length < 2) return yyyyMM
  const idx = parseInt(parts[1], 10) - 1
  return MONTH_LABELS[idx] ?? yyyyMM
}

export function formatCLP(n: number, compact?: boolean): string {
  const abs = Math.abs(n)
  if (compact) {
    if (abs >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(1) + 'B'
    if (abs >= 1_000_000)    return '$' + (n / 1_000_000).toFixed(1) + 'M'
    if (abs >= 1_000)        return '$' + (n / 1_000).toFixed(0) + 'K'
  }
  return '$' + Math.round(n).toLocaleString('es-CL')
}

export function formatPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

export function formatDays(n: number): string {
  return Math.round(n) + ' días'
}

export function loadData(
  onSuccess: (rows: Row[], years: string[]) => void,
  onError: (err: unknown) => void,
): void {
  if (state.loaded) { onSuccess(state.rows, state.years); return }
  Papa.parse<Row>(buildUrl(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete(result) {
      state.rows = result.data.filter(r => {
        const t = getTipo(r)
        return t === 'Ingreso' || t === 'Costo' || t === 'Gasto'
      })
      const ym: Record<string, boolean> = {}
      state.rows.forEach(r => { const y = getYear(r); if (y) ym[y] = true })
      state.years = Object.keys(ym).sort().reverse()
      state.loaded = true
      state.loadedAt = new Date()
      onSuccess(state.rows, state.years)
    },
    error(err) { state.error = err; onError(err) },
  })
}

export function getState() {
  return { rows: state.rows, years: state.years, loaded: state.loaded, loadedAt: state.loadedAt }
}

export function invalidateCache(): void {
  state.rows = []; state.years = []; state.loaded = false; state.error = null
}

export function calcKPIs(rows: Row[]): KPIs {
  const ventas        = sumMonto(rows.filter(isVenta))
  const otrosIngresos = sumMonto(rows.filter(isOtroIngreso))
  const costos        = sumMonto(rows.filter(isCosto))
  const gastos        = sumMonto(rows.filter(isGasto))
  const utilBruta     = ventas - costos
  const utilOp        = utilBruta - gastos
  const margenOp      = ventas > 0 ? utilOp / ventas : 0
  const margenBruto   = ventas > 0 ? utilBruta / ventas : 0
  return { ventas, otrosIngresos, costos, gastos, utilBruta, utilOp, margenOp, margenBruto }
}

export function parseDateCL(str: string): Date | null {
  if (!str) return null
  const s = str.trim()
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const p = s.split('-')
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.substring(0, 10))
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const p = s.split('/')
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt
}

export function calcDSO(rows: Row[]): number | null {
  // Incluye TODAS las ventas con Fecha_emision.
  // Pagadas: usa Fecha_Pago. Pendientes: usa fecha de hoy.
  const today = new Date()
  const conEmision = rows.filter(r => isVenta(r) && getFechaEmision(r))
  if (conEmision.length === 0) return null
  let total = 0, count = 0
  conEmision.forEach(r => {
    const emi = parseDateCL(getFechaEmision(r))
    if (!emi) return
    const pagoStr = getFechaPago(r)
    const pago    = pagoStr ? parseDateCL(pagoStr) : null
    const ref     = (pago && pago >= emi) ? pago : today
    total += (ref.getTime() - emi.getTime()) / 86400000
    count++
  })
  return count > 0 ? total / count : null
}

export function calcDSOByCliente(rows: Row[]): DSOCliente[] {
  const today = new Date()
  type Entry = { diasPagado: number; countPagado: number; montoPagado: number; montoPendiente: number; total: number }
  const map: Record<string, Entry> = {}

  rows
    .filter(r => isVenta(r) && getFechaEmision(r))
    .forEach(r => {
      const c   = getDesc(r) || getCuenta(r)
      const emi = parseDateCL(getFechaEmision(r))
      if (!emi) return
      const pagoStr = getFechaPago(r)
      const pago    = pagoStr ? parseDateCL(pagoStr) : null
      const monto   = getMonto(r)
      if (!map[c]) map[c] = { diasPagado: 0, countPagado: 0, montoPagado: 0, montoPendiente: 0, total: 0 }
      map[c].total += monto
      if (pago && pago >= emi) {
        map[c].diasPagado  += (pago.getTime() - emi.getTime()) / 86400000
        map[c].countPagado += 1
        map[c].montoPagado += monto
      } else {
        // Sin fecha de pago: factura pendiente — acumula días hasta hoy
        map[c].montoPendiente += monto
      }
    })

  return Object.keys(map)
    .map(c => {
      const e = map[c]
      return {
        cliente:               c,
        dsoDias:               e.countPagado > 0 ? e.diasPagado / e.countPagado : 0,
        transacciones:         rows.filter(r => isVenta(r) && getFechaEmision(r) && (getDesc(r) || getCuenta(r)) === c).length,
        transaccionesPagadas:  e.countPagado,
        monto:                 e.total,
        montoPagado:           e.montoPagado,
        montoPendiente:        e.montoPendiente,
      }
    })
    .filter(c => c.monto > 0)
    .sort((a, b) => b.montoPendiente - a.montoPendiente || b.dsoDias - a.dsoDias)
}

export function groupCostosByClasif(rows: Row[]): Record<string, number> {
  const map: Record<string, number> = {}
  rows.filter(isCosto).forEach(r => {
    const c = getClasifCto(r) || getClasGasto(r) || 'Sin clasificar'
    map[c] = (map[c] || 0) + getMonto(r)
  })
  return map
}

export function groupGastosByClasif(rows: Row[]): Record<string, number> {
  const map: Record<string, number> = {}
  rows.filter(isGasto).forEach(r => {
    const c = getClasGasto(r) || getClasifCto(r) || 'Sin clasificar'
    map[c] = (map[c] || 0) + getMonto(r)
  })
  return map
}
