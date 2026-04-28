import { useEffect } from 'react'
import { TrendingUp, Percent, PlusCircle, ShoppingCart, Wallet } from 'lucide-react'
import * as D from '../lib/data'
import { useData } from '../lib/useData'
import { useFilter } from '../lib/useFilter'
import { getAllMonths } from '../lib/filter'
import { useFilterContext } from '../lib/FilterContext'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import SectionLabel from '../components/SectionLabel'
import ChartCard from '../components/ChartCard'
import { LoadingState, ErrorState } from '../components/LoadingState'
import AreaBarChart from '../components/charts/AreaBarChart'
import { COLORS } from '../components/charts/theme'

function calcCompareKPIs(rows: D.Row[] | null) {
  if (!rows) return null
  return D.calcKPIs(rows)
}

function deltaPct(a: number, b: number): number | null {
  if (b === 0) return null
  return (a - b) / Math.abs(b) * 100
}

export default function Resumen() {
  const { rows: allRows, years, loading, error, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label, isCompare, compareRows, compareMonths, compareLabel } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState />

  const kpis    = D.calcKPIs(rows)
  const kpisB   = calcCompareKPIs(compareRows)

  const ventasByM  = D.groupByMonth(rows, D.isVenta)
  const costosByM  = D.groupByMonth(rows, D.isCosto)
  const gastosByM  = D.groupByMonth(rows, D.isGasto)
  const chartData  = months.map(m => {
    const v = ventasByM[m] ?? 0; const c = costosByM[m] ?? 0; const g = gastosByM[m] ?? 0
    return { label: D.monthLabel(m), bar: v, line: v > 0 ? (v - c - g) / v * 100 : 0 }
  })

  // Compare chart: overlay both periods by month index
  const ventasByMB = compareRows ? D.groupByMonth(compareRows, D.isVenta) : {}
  const costosByMB = compareRows ? D.groupByMonth(compareRows, D.isCosto) : {}
  const gastosByMB = compareRows ? D.groupByMonth(compareRows, D.isGasto) : {}
  const compareChartData = isCompare
    ? (compareMonths ?? []).map(m => {
        const v = ventasByMB[m] ?? 0; const c = costosByMB[m] ?? 0; const g = gastosByMB[m] ?? 0
        return { label: D.monthLabel(m), bar: v, line: v > 0 ? (v - c - g) / v * 100 : 0 }
      })
    : []

  const margenAccent = kpis.margenOp >= 0.1 ? 'success' : kpis.margenOp >= 0 ? 'amber' : 'danger'

  return (
    <>
      <PageHeader title="Resumen Ejecutivo" subtitle="Vista consolidada · YTD" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        {isCompare && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-nl-primary-10 border border-nl-primary-20 rounded-card">
            <span className="text-[11px] font-mono text-nl-primary font-medium">Modo comparativo:</span>
            <span className="text-[11px] font-mono text-nl-primary font-bold">{label}</span>
            <span className="text-nl-primary/40 mx-1">vs</span>
            <span className="text-[11px] font-mono text-nl-primary font-bold">{compareLabel}</span>
          </div>
        )}

        <div>
          <SectionLabel>Indicadores clave · {label}</SectionLabel>
          <div className="grid grid-cols-5 gap-3">
            <KpiCard label="Ventas YTD" value={D.formatCLP(kpis.ventas, true)} sub={isCompare ? undefined : D.formatCLP(kpis.ventas)} accent="primary" trend={!isCompare ? 'up' : undefined} icon={TrendingUp}
              compare={kpisB ? { value: D.formatCLP(kpisB.ventas, true), delta: deltaPct(kpis.ventas, kpisB.ventas) } : undefined} />
            <KpiCard label="Margen Operacional" value={D.formatPct(kpis.margenOp)} sub={isCompare ? undefined : `Util. Op.: ${D.formatCLP(kpis.utilOp, true)}`} accent={margenAccent} icon={Percent}
              compare={kpisB ? { value: D.formatPct(kpisB.margenOp), delta: deltaPct(kpis.margenOp, kpisB.margenOp) } : undefined} />
            <KpiCard label="Otros Ingresos YTD" value={D.formatCLP(kpis.otrosIngresos, true)} sub={isCompare ? undefined : D.formatCLP(kpis.otrosIngresos)} accent="neutral" icon={PlusCircle}
              compare={kpisB ? { value: D.formatCLP(kpisB.otrosIngresos, true), delta: deltaPct(kpis.otrosIngresos, kpisB.otrosIngresos) } : undefined} />
            <KpiCard label="Costos YTD" value={D.formatCLP(kpis.costos, true)} sub={isCompare ? undefined : `M. Bruto: ${D.formatPct(kpis.margenBruto)}`} accent="accent" trend={!isCompare ? 'down' : undefined} icon={ShoppingCart}
              compare={kpisB ? { value: D.formatCLP(kpisB.costos, true), delta: deltaPct(kpis.costos, kpisB.costos) } : undefined} />
            <KpiCard label="Gastos Op. YTD" value={D.formatCLP(kpis.gastos, true)} sub={isCompare ? undefined : `${D.formatPct(kpis.ventas > 0 ? kpis.gastos / kpis.ventas : 0)} sobre ventas`} accent="danger" trend={!isCompare ? 'down' : undefined} icon={Wallet}
              compare={kpisB ? { value: D.formatCLP(kpisB.gastos, true), delta: deltaPct(kpis.gastos, kpisB.gastos) } : undefined} />
          </div>
        </div>

        <div>
          <SectionLabel>Evolución mensual</SectionLabel>
          <ChartCard
            title={isCompare ? `Ventas & Margen — ${label} vs ${compareLabel}` : 'Ventas & Margen Operacional'}
            subtitle="Barras = Ventas · Línea = Margen Op. % · Línea punteada = Período B"
            height={320}
          >
            <AreaBarChart
              data={chartData}
              compareData={isCompare ? compareChartData : undefined}
              labelA={label ?? undefined}
              labelB={compareLabel ?? undefined}
            />
          </ChartCard>
        </div>

        {!isCompare && (
          <div>
            <SectionLabel>Ventas vs punto de equilibrio</SectionLabel>
            <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-nl-border-soft">
                <span className="font-display font-bold text-[14px] text-nl-text tracking-tight">Análisis mensual de cobertura</span>
                <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-pill px-3 py-1">Parametrizable</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-nl-bg">
                    {['Mes', 'Ventas', 'Punto de Equilibrio', 'Gap (Ventas − PE)', 'Cobertura'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] border-b border-nl-border-soft font-normal [&:not(:first-child)]:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={m} className="border-b border-nl-border-soft last:border-0 hover:bg-nl-bg/60 transition-colors duration-[150ms]">
                      <td className="px-5 py-3 text-[13px] font-medium text-nl-text">{chartData[i]?.label}</td>
                      <td className="px-5 py-3 text-right font-mono text-[12px] text-nl-700">{D.formatCLP(ventasByM[m] ?? 0)}</td>
                      <td className="px-5 py-3 text-right font-mono text-[12px] text-nl-400">— (parametrizar)</td>
                      <td className="px-5 py-3 text-right font-mono text-[12px] text-nl-400">—</td>
                      <td className="px-5 py-3 text-right"><span className="text-[10px] font-mono text-nl-400 bg-nl-bg border border-nl-border-ui rounded-pill px-2 py-0.5">Sin PE</span></td>
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
