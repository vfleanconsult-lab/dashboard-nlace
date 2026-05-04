import { useEffect } from 'react'
import { BarChart2, Percent, TrendingDown, TrendingUp } from 'lucide-react'
import * as D from '../lib/data'
import { useData } from '../lib/useData'
import { useFilter } from '../lib/useFilter'
import { getAllMonths } from '../lib/filter'
import { useFilterContext } from '../lib/FilterContext'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import SectionLabel from '../components/SectionLabel'
import { LoadingState, ErrorState } from '../components/LoadingState'

type PartidaKey =
  | 'ingresos' | 'ventas'
  | 'costos' | 'costoVenta' | 'otrosCostos'
  | 'margenBruto'
  | 'gastos'
  | 'resultadoOp'
  | 'remDirectores'
  | 'ebitda'

interface Partida {
  id: PartidaKey
  num: string
  label: string
  level: 0 | 1
  isSubtotal: boolean
}

const PARTIDAS: Partida[] = [
  { id: 'ingresos',      num: '1',   label: 'Ingresos',                             level: 0, isSubtotal: false },
  { id: 'ventas',        num: '1.1', label: 'Ventas',                               level: 1, isSubtotal: false },
  { id: 'costos',        num: '2',   label: 'Costos',                               level: 0, isSubtotal: false },
  { id: 'costoVenta',    num: '2.1', label: 'Costo de Venta',                       level: 1, isSubtotal: false },
  { id: 'otrosCostos',   num: '2.2', label: 'Otros Costos / Gastos de Explotación', level: 1, isSubtotal: false },
  { id: 'margenBruto',   num: '3',   label: 'Margen Bruto',                         level: 0, isSubtotal: true  },
  { id: 'gastos',        num: '4',   label: 'Gastos Operacionales',                 level: 0, isSubtotal: false },
  { id: 'resultadoOp',   num: '5',   label: 'Resultado Operacional',                level: 0, isSubtotal: true  },
  { id: 'remDirectores', num: '6',   label: 'Remuneraciones Directores',            level: 1, isSubtotal: false },
  { id: 'ebitda',        num: '7',   label: 'EBITDA',                               level: 0, isSubtotal: true  },
]

type Valores = Record<PartidaKey, number>

function calcValues(rows: D.Row[]): Valores {
  const ingresos      = D.sumMonto(rows.filter(r => D.getCuenta(r) === '5101-01' && D.isPagado(r)))
  const costoVenta    = D.sumMonto(rows.filter(r => D.getCuenta(r) === '4101-01'))
  const otrosCostos   = D.sumMonto(rows.filter(r => D.getCuenta(r) === '4101-09'))
  const costos        = costoVenta + otrosCostos
  const margenBruto   = ingresos - costos
  const gastos        = D.sumMonto(rows.filter(D.isGasto))
  const resultadoOp   = margenBruto - gastos
  const remDirectores = D.sumMonto(rows.filter(D.isRemDirectores))
  const ebitda        = resultadoOp - remDirectores
  return {
    ingresos,
    ventas: ingresos,
    costos,
    costoVenta,
    otrosCostos,
    margenBruto,
    gastos,
    resultadoOp,
    remDirectores,
    ebitda,
  }
}

function fmtMonto(n: number): string {
  return '$' + Math.abs(Math.round(n)).toLocaleString('es-CL')
}

function fmtPct(n: number): string {
  return Math.abs(n).toFixed(1) + '%'
}

function pctSobreIngresos(val: number, ingresos: number): string {
  if (ingresos === 0) return '—'
  return Math.abs(val / ingresos * 100).toFixed(1) + '%'
}

export default function EstadoResultado() {
  const { rows: allRows, years, loading, error, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState />

  const ytd = calcValues(rows)

  const margenBrutoPct    = ytd.ingresos > 0 ? ytd.margenBruto  / ytd.ingresos * 100 : null
  const rentabilidadPct   = ytd.ingresos > 0 ? ytd.ebitda       / ytd.ingresos * 100 : null
  const costosSobreVentas = ytd.ingresos > 0 ? ytd.costos       / ytd.ingresos * 100 : null
  const gastosSobreVentas = ytd.ingresos > 0 ? ytd.gastos       / ytd.ingresos * 100 : null

  const monthlyData = months.map(m => ({
    month: m,
    values: calcValues(rows.filter(r => D.getMonth(r) === m)),
  }))

  return (
    <>
      <PageHeader
        title="Estado de Resultado"
        subtitle="Acumulado YTD · Mes_Economico"
        years={years}
        allMonths={allMonths}
        loadedAt={loadedAt}
      />

      <div className="p-8 space-y-8">

        {/* KPIs */}
        <div>
          <SectionLabel>{label} · Indicadores clave</SectionLabel>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Margen Bruto %"
              value={margenBrutoPct !== null ? fmtPct(margenBrutoPct) : '—'}
              sub="(Ingresos − Costos) / Ingresos"
              accent={margenBrutoPct !== null ? (margenBrutoPct >= 0 ? 'success' : 'danger') : 'neutral'}
              icon={TrendingUp}
            />
            <KpiCard
              label="Rentabilidad sobre Ventas %"
              value={rentabilidadPct !== null ? fmtPct(rentabilidadPct) : '—'}
              sub="EBITDA / Ingresos"
              accent={rentabilidadPct !== null ? (rentabilidadPct >= 0 ? 'primary' : 'danger') : 'neutral'}
              icon={BarChart2}
            />
            <KpiCard
              label="Costos sobre Ventas"
              value={costosSobreVentas !== null ? fmtPct(costosSobreVentas) : '—'}
              sub="Costos / Ventas"
              accent="accent"
              icon={TrendingDown}
            />
            <KpiCard
              label="Gastos sobre Ventas"
              value={gastosSobreVentas !== null ? fmtPct(gastosSobreVentas) : '—'}
              sub="Gastos Op. / Ventas"
              accent="danger"
              icon={Percent}
            />
          </div>
        </div>

        {/* YTD Table */}
        <div>
          <SectionLabel>{label} · Estado de Resultado YTD</SectionLabel>
          <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nl-border-soft bg-nl-bg/50">
                  <th className="px-5 py-3 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] w-8">#</th>
                  <th className="px-2 py-3 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em]">Partida</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] w-44">Monto YTD</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] w-36">% Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {PARTIDAS.map(({ id, num, label: pLabel, level, isSubtotal }) => {
                  const val = ytd[id]
                  const isNeg = isSubtotal && val < 0
                  return (
                    <tr
                      key={id}
                      className={[
                        'border-b border-nl-border-soft last:border-b-0',
                        isSubtotal ? 'bg-nl-bg/60' : 'hover:bg-nl-bg/20',
                      ].join(' ')}
                    >
                      <td className="px-5 py-3 font-mono text-[11px] text-nl-400">{num}</td>
                      <td className="px-2 py-3">
                        <span className={[
                          'font-body text-[13px]',
                          level === 1 ? 'pl-5 text-nl-500' : '',
                          isSubtotal ? 'font-semibold text-nl-text' : 'text-nl-700',
                        ].join(' ')}>
                          {pLabel}
                        </span>
                      </td>
                      <td className={[
                        'px-5 py-3 text-right font-body tabular-nums text-[13px]',
                        isSubtotal ? 'font-semibold' : '',
                        isNeg ? 'text-nl-danger' : isSubtotal ? 'text-nl-text' : 'text-nl-700',
                      ].join(' ')}>
                        {fmtMonto(val)}
                      </td>
                      <td className={[
                        'px-5 py-3 text-right font-mono text-[12px]',
                        isNeg ? 'text-nl-danger' : 'text-nl-400',
                      ].join(' ')}>
                        {pctSobreIngresos(val, ytd.ingresos)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Table */}
        {months.length > 0 && (
          <div>
            <SectionLabel>Evolución mensual · Estado de Resultado por mes</SectionLabel>
            <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-nl-border-soft bg-nl-bg/50">
                    <th className="px-4 py-3 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] sticky left-0 bg-nl-bg/80 z-10 min-w-[220px] border-r border-nl-border-soft">
                      Partida
                    </th>
                    {months.map(m => (
                      <th key={m} className="px-4 py-3 text-right text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] min-w-[110px]">
                        {D.monthLabel(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PARTIDAS.map(({ id, label: pLabel, level, isSubtotal }) => (
                    <tr
                      key={id}
                      className={[
                        'border-b border-nl-border-soft last:border-b-0',
                        isSubtotal ? 'bg-nl-bg/60' : 'hover:bg-nl-bg/20',
                      ].join(' ')}
                    >
                      <td className={[
                        'px-4 py-2.5 sticky left-0 z-10 border-r border-nl-border-soft',
                        isSubtotal ? 'bg-nl-bg/80' : 'bg-nl-white',
                      ].join(' ')}>
                        <span className={[
                          'font-body text-[12px]',
                          level === 1 ? 'pl-4 text-nl-500' : '',
                          isSubtotal ? 'font-semibold text-nl-text' : 'text-nl-700',
                        ].join(' ')}>
                          {pLabel}
                        </span>
                      </td>
                      {monthlyData.map(({ month, values }) => {
                        const val = values[id]
                        const isNeg = isSubtotal && val < 0
                        return (
                          <td
                            key={month}
                            className={[
                              'px-4 py-2.5 text-right font-body tabular-nums text-[12px]',
                              isSubtotal ? 'font-semibold' : '',
                              isNeg ? 'text-nl-danger' : isSubtotal ? 'text-nl-text' : 'text-nl-700',
                            ].join(' ')}
                          >
                            {fmtMonto(val)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
