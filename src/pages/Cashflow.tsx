import { useEffect, useMemo, useState } from 'react'
import * as D from '../lib/data'
import { useData } from '../lib/useData'
import { useFilterContext } from '../lib/FilterContext'
import { getAllMonths } from '../lib/filter'
import PageHeader from '../components/PageHeader'
import SectionLabel from '../components/SectionLabel'
import { LoadingState, ErrorState } from '../components/LoadingState'

const SALDO_INICIAL_JAN_2026 = 2_109_833

function getFechaPagoYM(row: D.Row): string | null {
  const fp = D.getFechaPago(row)
  if (!fp) return null
  const d = D.parseDateCL(fp)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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

type CFKey = keyof MonthCF

interface RowDef {
  key: CFKey
  label: string
  level: 0 | 1
  isSubtotal: boolean
  isBalance?: boolean
}

const ROW_DEFS: RowDef[] = [
  { key: 'saldoInicial',    label: 'Saldo Inicial',              level: 0, isSubtotal: false, isBalance: true },
  { key: 'ingresos',        label: 'Ingresos',                   level: 0, isSubtotal: true  },
  { key: 'ventas',          label: 'Ventas',                     level: 1, isSubtotal: false },
  { key: 'otrosIngresos',   label: 'Otros Ingresos',             level: 1, isSubtotal: false },
  { key: 'costos',          label: 'Costos',                     level: 0, isSubtotal: true  },
  { key: 'costoVenta',      label: 'Costo Venta',                level: 1, isSubtotal: false },
  { key: 'otrosGastosExpl', label: 'Otros Gastos Explotación',   level: 1, isSubtotal: false },
  { key: 'gastos',          label: 'Gastos',                     level: 0, isSubtotal: true  },
  { key: 'gastosAdm',       label: 'Gastos Administración',      level: 1, isSubtotal: false },
  { key: 'serviciosComp',   label: 'Servicios Computacionales',  level: 1, isSubtotal: false },
  { key: 'publicidad',      label: 'Publicidad',                 level: 1, isSubtotal: false },
  { key: 'representacion',  label: 'Representación y Viáticos',  level: 1, isSubtotal: false },
  { key: 'locomocion',      label: 'Locomoción',                 level: 1, isSubtotal: false },
  { key: 'legales',         label: 'Legales y Notariales',       level: 1, isSubtotal: false },
  { key: 'remDirector',     label: 'Remuneración Director',      level: 0, isSubtotal: false },
  { key: 'saldoFinal',      label: 'Saldo Final',                level: 0, isSubtotal: true, isBalance: true },
]

const EMPTY_CF: MonthCF = {
  saldoInicial: 0, ventas: 0, otrosIngresos: 0, ingresos: 0,
  costoVenta: 0, otrosGastosExpl: 0, costos: 0,
  gastosAdm: 0, serviciosComp: 0, publicidad: 0, representacion: 0,
  locomocion: 0, legales: 0, gastos: 0, remDirector: 0, saldoFinal: 0,
}

function buildCFMap(allRows: D.Row[]): Map<string, MonthCF> {
  // Collect all years >= 2026 that appear in Fecha_Pago
  const yearSet = new Set<string>(['2026'])
  for (const r of allRows) {
    const ym = getFechaPagoYM(r)
    if (ym && ym >= '2026-01') yearSet.add(ym.substring(0, 4))
  }

  // Build full set of year-months: all 12 months for each relevant year
  const ymSet = new Set<string>()
  for (const y of yearSet) {
    for (let m = 1; m <= 12; m++) ymSet.add(`${y}-${String(m).padStart(2, '0')}`)
  }

  // Pre-group rows by Fecha_Pago year-month
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
    const sumPag     = (fn: (r: D.Row) => boolean) =>
      sum(r => D.getEstado(r) === 'Pagada' && fn(r))
    const sumIngreso = (fn: (r: D.Row) => boolean) =>
      sum(r => (D.getEstado(r) === 'Pagada' || D.getEstado(r) === 'Pagada_parcial') && fn(r))

    const saldoInicial    = ym === '2026-01' ? SALDO_INICIAL_JAN_2026 : prevFinal
    const ventas          = sumIngreso(r => D.getCuenta(r) === '5101-01')
    const otrosIngresos   = sumIngreso(r => D.getCuenta(r) === '5201-03')
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

function fmt(n: number): string {
  return '$' + Math.abs(Math.round(n)).toLocaleString('es-CL')
}

export default function Cashflow() {
  const { rows: allRows, years, loading, error, errorDetail, loadedAt } = useData()
  const { state, initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)

  useEffect(() => { initialize(years) }, [years])

  const cfMap    = useMemo(() => buildCFMap(allRows), [allRows])
  const cfYears  = useMemo(() => {
    const filtered = years.filter(y => y >= '2026')
    return filtered.length > 0 ? filtered : ['2026']
  }, [years])
  const cfMonths = useMemo(
    () => { const f = allMonths.filter(m => m >= '2026-01'); return f.length > 0 ? f : allMonths },
    [allMonths],
  )

  const selectedYear = useMemo(() => {
    const p = state.primary
    const raw = p.type === 'year'  ? p.year
              : p.type === 'month' && p.month ? p.month.substring(0, 4)
              : p.type === 'range' && p.from  ? p.from.substring(0, 4)
              : ''
    return raw >= '2026' ? raw : (cfYears[0] ?? '2026')
  }, [state.primary, cfYears])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`),
    [selectedYear],
  )

  const [detailMonth, setDetailMonth] = useState<string>('')
  const effectiveDetailMonth = detailMonth || months[2] // default Mar del año seleccionado

  const ingresoRows = useMemo(() => {
    return allRows
      .filter(r => {
        const ym = getFechaPagoYM(r)
        if (ym !== effectiveDetailMonth) return false
        const cuenta = D.getCuenta(r)
        return cuenta === '5101-01' || cuenta === '5201-03'
      })
      .sort((a, b) => {
        const fa = D.parseDateCL(D.getFechaPago(a))
        const fb = D.parseDateCL(D.getFechaPago(b))
        return (fa?.getTime() ?? 0) - (fb?.getTime() ?? 0)
      })
  }, [allRows, effectiveDetailMonth])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={errorDetail} />

  return (
    <>
      <PageHeader
        title="Cashflow"
        subtitle="Flujo de caja · Agrupado por Fecha de Pago"
        years={cfYears}
        allMonths={cfMonths}
        loadedAt={loadedAt}
      />

      <div className="p-8 space-y-8">
        <div>
          <SectionLabel>Cashflow {selectedYear} · Flujo mensual por Fecha de Pago</SectionLabel>
          <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-nl-border-soft bg-nl-bg/50">
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] sticky left-0 bg-nl-bg/80 z-10 min-w-[240px] border-r border-nl-border-soft">
                    Componente
                  </th>
                  {months.map(m => (
                    <th key={m} className="px-4 py-3 text-right text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] min-w-[110px]">
                      {D.monthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_DEFS.map(({ key, label, level, isSubtotal, isBalance }) => (
                  <tr
                    key={key}
                    className={[
                      'border-b border-nl-border-soft last:border-b-0',
                      isSubtotal || isBalance ? 'bg-nl-bg/60' : 'hover:bg-nl-bg/20',
                    ].join(' ')}
                  >
                    <td className={[
                      'px-4 py-2.5 sticky left-0 z-10 border-r border-nl-border-soft',
                      isSubtotal || isBalance ? 'bg-nl-bg/80' : 'bg-nl-white',
                    ].join(' ')}>
                      <span className={[
                        'font-body text-[12px]',
                        level === 1 ? 'pl-5 text-nl-500' : '',
                        isSubtotal || isBalance ? 'font-semibold text-nl-text' : 'text-nl-700',
                      ].join(' ')}>
                        {level === 1 ? `→ ${label}` : label}
                      </span>
                    </td>
                    {months.map(m => {
                      const data = cfMap.get(m) ?? EMPTY_CF
                      const val = data[key]
                      const isNegFinal = key === 'saldoFinal' && val < 0
                      return (
                        <td
                          key={m}
                          className={[
                            'px-4 py-2.5 text-right font-body tabular-nums text-[12px]',
                            isSubtotal || isBalance ? 'font-semibold' : '',
                            isNegFinal
                              ? 'text-nl-danger'
                              : isSubtotal || isBalance ? 'text-nl-text' : 'text-nl-700',
                          ].join(' ')}
                        >
                          {fmt(val)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Detalle de transacciones de ingresos por mes */}
        <div>
          <div className="flex items-center gap-4 mb-3">
            <SectionLabel className="mb-0">Detalle Ingresos · Ventas (5101-01) y Otros (5201-03)</SectionLabel>
            <select
              value={effectiveDetailMonth}
              onChange={e => setDetailMonth(e.target.value)}
              className="ml-auto text-[12px] font-mono border border-nl-border-soft rounded px-2 py-1 bg-nl-white text-nl-text"
            >
              {months.map(m => (
                <option key={m} value={m}>{D.monthLabel(m)}</option>
              ))}
            </select>
          </div>
          <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-nl-border-soft bg-nl-bg/50">
                  {['Cliente', 'Cuenta', 'Estado', 'Fecha Pago', 'Mes Económico', 'Monto'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ingresoRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[12px] text-nl-400 font-body">
                      Sin registros para {D.monthLabel(effectiveDetailMonth)}
                    </td>
                  </tr>
                ) : (
                  ingresoRows.map((r, i) => {
                    const estado = D.getEstado(r)
                    const esIngreso = estado === 'Pagada' || estado === 'Pagada_parcial'
                    return (
                      <tr key={i} className={['border-b border-nl-border-soft last:border-b-0', esIngreso ? '' : 'bg-amber-50'].join(' ')}>
                        <td className="px-4 py-2 text-[12px] font-body text-nl-700">{r['Cliente'] ?? '—'}</td>
                        <td className="px-4 py-2 text-[12px] font-mono text-nl-500">{D.getCuenta(r)}</td>
                        <td className="px-4 py-2 text-[12px] font-mono">
                          <span className={['px-1.5 py-0.5 rounded text-[10px]', esIngreso ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'].join(' ')}>
                            {estado}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[12px] font-mono text-nl-500">{D.getFechaPago(r) ?? '—'}</td>
                        <td className="px-4 py-2 text-[12px] font-mono text-nl-500">{r['Mes_economico'] ?? '—'}</td>
                        <td className={['px-4 py-2 text-[12px] font-body tabular-nums text-right', esIngreso ? 'text-nl-text font-semibold' : 'text-amber-600'].join(' ')}>
                          {fmt(D.getMonto(r))}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {ingresoRows.length > 0 && (() => {
                const totalPag = ingresoRows.filter(r => { const e = D.getEstado(r); return e === 'Pagada' || e === 'Pagada_parcial' }).reduce((s, r) => s + D.getMonto(r), 0)
                const totalTodo = ingresoRows.reduce((s, r) => s + D.getMonto(r), 0)
                const ventas5101 = ingresoRows.filter(r => D.getCuenta(r) === '5101-01' && (D.getEstado(r) === 'Pagada' || D.getEstado(r) === 'Pagada_parcial')).reduce((s, r) => s + D.getMonto(r), 0)
                return (
                  <tfoot className="border-t-2 border-nl-border-soft bg-nl-bg/60">
                    <tr>
                      <td colSpan={5} className="px-4 py-2.5 text-[11px] font-mono text-nl-400">
                        {ingresoRows.length} registros · Solo Pagada/Pagada_parcial → suma en cashflow
                      </td>
                      <td className="px-4 py-2.5 text-right text-[11px] font-mono text-nl-400">
                        <span className="block text-nl-text font-semibold text-[12px]">{fmt(totalPag)}</span>
                        <span className="text-amber-600">Total incl. Emitida: {fmt(totalTodo)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-4 pb-2 text-[11px] font-mono text-nl-500">
                        → Ventas 5101-01 (Pagada/Pagada_parcial):
                      </td>
                      <td className="px-4 pb-2 text-right text-[12px] font-body tabular-nums font-semibold text-nl-primary">
                        {fmt(ventas5101)}
                      </td>
                    </tr>
                  </tfoot>
                )
              })()}
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
