import { supabase, EMPRESA_RUT } from './supabase'

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

const state: State = { rows: [], years: [], loaded: false, error: null, loadedAt: null }

type SupabaseRow = {
  tipo: string
  cuenta_cble: string | null
  descripcion_cta: string | null
  clasificacion_gasto: string | null
  clasificacion_cto: string | null
  tipo_cuenta: string | null
  estado: string | null
  mes_economico: string | null
  ano_eco: string | null
  monto_bruto: number | null
  fecha_emision: string | null
  fecha_pago: string | null
  fecha_vencimiento: string | null
  cliente: string | null
}

function supabaseToRow(r: SupabaseRow): Row {
  return {
    'Tipo':                 r.tipo || '',
    'Cuenta_Cble':          r.cuenta_cble || '',
    'Descripcion Cta.':     r.descripcion_cta || '',
    'Clasificacion_Gasto':  r.clasificacion_gasto || '',
    'Clasificacion_Cto':    r.clasificacion_cto || '',
    'Tipo_Cuenta':          r.tipo_cuenta || '',
    'Estado':               r.estado || '',
    'Mes_economico':        r.mes_economico || '',
    'Ano_eco':              r.ano_eco || '',
    // Número → string con coma decimal para que getMonto() lo procese igual que el CSV
    'monto_bruto':          r.monto_bruto != null ? String(r.monto_bruto).replace('.', ',') : '0',
    'Fecha_emision':        r.fecha_emision || '',
    'Fecha_Pago':           r.fecha_pago || '',
    'Fecha_Vencimiento':    r.fecha_vencimiento || '',
    'Cliente':              r.cliente || '',
  }
}

async function fetchFromSupabase(): Promise<void> {
  // 1. Obtener empresa_id de NLACE
  const { data: empresas, error: empErr } = await supabase
    .from('empresas')
    .select('id')
    .eq('rut', EMPRESA_RUT)

  if (empErr) throw empErr
  if (!empresas || empresas.length === 0) throw new Error('Empresa no encontrada: ' + EMPRESA_RUT)
  const empresaId = empresas[0].id

  // 2. Descargar todos los registros con paginación
  const SELECT = 'tipo,cuenta_cble,descripcion_cta,clasificacion_gasto,clasificacion_cto,tipo_cuenta,estado,mes_economico,ano_eco,monto_bruto,fecha_emision,fecha_pago,fecha_vencimiento,cliente'
  let allRows: SupabaseRow[] = []
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('registros_contables')
      .select(SELECT)
      .eq('empresa_id', empresaId)
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    allRows = allRows.concat(data as SupabaseRow[])
    if (data.length < PAGE) break
    from += PAGE
  }

  state.rows = allRows.map(supabaseToRow)
  const ym: Record<string, boolean> = {}
  state.rows.forEach(r => { const y = getYear(r); if (y) ym[y] = true })
  state.years = Object.keys(ym).sort().reverse()
  state.loaded = true
  state.loadedAt = new Date()
}

export const getTipo       = (row: Row) => (row['Tipo'] || '').trim()
export const getCuenta     = (row: Row) => (row['Cuenta_Cble'] || '').trim()
export const getDesc       = (row: Row) => (row['Descripcion Cta.'] || row['Descripcion Cta'] || '').trim()
export const getClasGasto  = (row: Row) => (row['Clasificacion_Gasto'] || '').trim()
export const getClasifCto  = (row: Row) => (row['Clasificacion_Cto'] || '').trim()
export const getTipoCuenta = (row: Row) => (row['Tipo_Cuenta'] || '').trim()
export const getEstado     = (row: Row) => (row['Estado'] || '').trim()
export const getMesEco     = (row: Row) => (row['Mes_economico'] || '').trim()
export const getAnoEco     = (row: Row) => (row['Ano_eco'] || '').trim()
export const getFechaEmision      = (row: Row) => (row['Fecha_emision'] || '').trim()
export const getFechaPago         = (row: Row) => (row['Fecha_Pago'] || '').trim()
export const getFechaVencimiento  = (row: Row) => (row['Fecha_Vencimiento'] || '').trim()
export const getCliente           = (row: Row) => (row['Cliente'] || '').trim()

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
export const isPagado      = (row: Row) => getEstado(row) === 'Emitida' || getEstado(row) === 'Pagada' || getEstado(row) === 'Pagada_parcial'

// Tipo='Remun' en la fuente de datos → separado de 'Gasto', no necesita exclusión manual
export const isRemDirectores = (row: Row) => getTipo(row) === 'Remun'
export const isGasto         = (row: Row) => getTipo(row) === 'Gasto'

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
  fetchFromSupabase()
    .then(() => onSuccess(state.rows, state.years))
    .catch(err => { state.error = err; onError(err) })
}

export function getState() {
  return { rows: state.rows, years: state.years, loaded: state.loaded, loadedAt: state.loadedAt }
}

export function invalidateCache(): void {
  state.rows = []; state.years = []; state.loaded = false; state.error = null
}

export function calcKPIs(rows: Row[]): KPIs {
  const ventas        = sumMonto(rows.filter(r => isVenta(r) && isPagado(r)))
  const otrosIngresos = sumMonto(rows.filter(r => isOtroIngreso(r) && isPagado(r)))
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
  // DD/MM/YYYY [time] — CSV primary format; {1,2} handles non-zero-padded; no $ anchor ignores time component
  const slashM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashM) return new Date(+slashM[3], +slashM[2] - 1, +slashM[1])
  // DD-MM-YYYY [time]
  const dashM = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dashM) return new Date(+dashM[3], +dashM[2] - 1, +dashM[1])
  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.substring(0, 10))
  return null
}

export function calcDSO(rows: Row[]): number | null {
  // Solo facturas pagadas: requiere Fecha_Pago y Fecha_emision
  const pagadas = rows.filter(r => isVenta(r) && getFechaEmision(r) && getFechaPago(r))
  if (pagadas.length === 0) return null
  let total = 0, count = 0
  pagadas.forEach(r => {
    const emi  = parseDateCL(getFechaEmision(r))
    const pago = parseDateCL(getFechaPago(r))
    if (!emi || !pago || pago < emi) return
    total += (pago.getTime() - emi.getTime()) / 86400000
    count++
  })
  return count > 0 ? total / count : null
}

export function calcDSOByCliente(rows: Row[]): DSOCliente[] {
  type Entry = { diasPagado: number; countPagado: number; countTotal: number; montoPagado: number; montoPendiente: number; total: number }
  const map: Record<string, Entry> = {}

  rows
    .filter(r => isVenta(r))
    .forEach(r => {
      const c     = getCliente(r) || getDesc(r) || getCuenta(r)
      if (!c) return
      const monto = getMonto(r)
      if (!map[c]) map[c] = { diasPagado: 0, countPagado: 0, countTotal: 0, montoPagado: 0, montoPendiente: 0, total: 0 }
      map[c].total      += monto
      map[c].countTotal += 1
      const pagoStr = getFechaPago(r)
      if (pagoStr) {
        map[c].montoPagado  += monto
        map[c].countPagado  += 1
        const emiStr = getFechaEmision(r)
        if (emiStr) {
          const emi  = parseDateCL(emiStr)
          const pago = parseDateCL(pagoStr)
          if (emi && pago && pago >= emi) {
            map[c].diasPagado += (pago.getTime() - emi.getTime()) / 86400000
          }
        }
      } else {
        map[c].montoPendiente += monto
      }
    })

  return Object.keys(map)
    .map(c => {
      const e = map[c]
      return {
        cliente:              c,
        dsoDias:              e.countPagado > 0 ? e.diasPagado / e.countPagado : 0,
        transacciones:        e.countTotal,
        transaccionesPagadas: e.countPagado,
        monto:                e.total,
        montoPagado:          e.montoPagado,
        montoPendiente:       e.montoPendiente,
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

export interface FacturaImpaga {
  cliente: string
  monto: number
  fechaVencimiento: string
  diasVencida: number // positive = not yet due, negative = overdue
}

export function calcFacturasImpagas(rows: Row[], today?: Date): FacturaImpaga[] {
  const hoy = today ?? new Date()
  const hoyMs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()

  return rows
    .filter(r => isVenta(r) && !getFechaPago(r))
    .map(r => {
      const vencStr = getFechaVencimiento(r)
      const venc = vencStr ? parseDateCL(vencStr) : null
      const diasVencida = venc ? Math.round((venc.getTime() - hoyMs) / 86400000) : 0
      return {
        cliente: getCliente(r) || getDesc(r) || 'Sin nombre',
        monto: getMonto(r),
        fechaVencimiento: vencStr,
        diasVencida,
      }
    })
    .sort((a, b) => a.diasVencida - b.diasVencida) // most overdue first
}

export interface TopPagador {
  cliente: string
  facturasPagadas: number
  dsoDias: number
  diasSobreVenc: number | null // avg(Fecha_Pago - Fecha_Vencimiento); negative = paid early
}

export function calcTopPeoresPagadores(rows: Row[], limit = 10): TopPagador[] {
  type Entry = { totalDias: number; count: number; totalSobreVenc: number; countVenc: number }
  const map: Record<string, Entry> = {}

  rows.filter(r => isVenta(r) && getFechaPago(r) && getFechaEmision(r)).forEach(r => {
    const c = getCliente(r) || getDesc(r) || 'Sin nombre'
    const emi = parseDateCL(getFechaEmision(r))
    const pago = parseDateCL(getFechaPago(r))
    if (!emi || !pago || pago < emi) return
    const dias = (pago.getTime() - emi.getTime()) / 86400000
    if (!map[c]) map[c] = { totalDias: 0, count: 0, totalSobreVenc: 0, countVenc: 0 }
    map[c].totalDias += dias
    map[c].count += 1
    const vencStr = getFechaVencimiento(r)
    if (vencStr) {
      const venc = parseDateCL(vencStr)
      if (venc) {
        map[c].totalSobreVenc += (pago.getTime() - venc.getTime()) / 86400000
        map[c].countVenc += 1
      }
    }
  })

  return Object.keys(map)
    .map(c => ({
      cliente: c,
      facturasPagadas: map[c].count,
      dsoDias: map[c].totalDias / map[c].count,
      diasSobreVenc: map[c].countVenc > 0 ? map[c].totalSobreVenc / map[c].countVenc : null,
    }))
    .sort((a, b) => b.dsoDias - a.dsoDias)
    .slice(0, limit)
}
