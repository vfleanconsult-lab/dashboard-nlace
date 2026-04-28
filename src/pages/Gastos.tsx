import { useEffect } from 'react'
import { Receipt, Percent, Tag } from 'lucide-react'
import * as D from '../lib/data'
import { useData } from '../lib/useData'
import { useFilter } from '../lib/useFilter'
import { getAllMonths } from '../lib/filter'
import { useFilterContext } from '../lib/FilterContext'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import SectionLabel from '../components/SectionLabel'
import ChartCard from '../components/ChartCard'
import DataTable from '../components/DataTable'
import RankBadge from '../components/RankBadge'
import ProgressBar from '../components/ProgressBar'
import { LoadingState, ErrorState } from '../components/LoadingState'
import BarChartV from '../components/charts/BarChartV'
import NlacePieChart from '../components/charts/PieChart'
import { PALETTE, COLORS } from '../components/charts/theme'

export default function Gastos() {
  const { rows: allRows, years, loading, error, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState />

  const ventas        = D.sumMonto(rows.filter(D.isVenta))
  const gastos        = D.sumMonto(rows.filter(D.isGasto))
  const retirosExcl   = D.sumMonto(rows.filter(r => D.getTipo(r) === 'Gasto' && D.isRetiroDirectores(r)))
  const clasifMap     = D.groupGastosByClasif(rows)
  const clasifEntries = Object.entries(clasifMap).sort((a, b) => b[1] - a[1])
  const gastosByM     = D.groupByMonth(rows, D.isGasto)
  const pctVentas     = ventas > 0 ? gastos / ventas : 0
  const pctAccent     = pctVentas < 0.3 ? 'success' : pctVentas < 0.5 ? 'amber' : 'danger'

  const barData    = months.map(m => ({ label: D.monthLabel(m), gastos: gastosByM[m] ?? 0 }))
  const pieData    = clasifEntries.slice(0, 8).map(([name, value]) => ({ name: name || 'Sin clasificar', value }))

  return (
    <>
      <PageHeader title="Gastos Operacionales" subtitle="Excluye retiro de directores · YTD" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        <div>
          <SectionLabel>{label} · Gastos operacionales</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Gastos Operacionales YTD" value={D.formatCLP(gastos, true)} sub={D.formatCLP(gastos)}      accent="danger"  trend="down" icon={Receipt} />
            <KpiCard label="% sobre Ventas"           value={D.formatPct(pctVentas)}    sub="Referencia saludable: <30%" accent={pctAccent}             icon={Percent} />
            <KpiCard label="Categorías activas"       value={clasifEntries.length.toString()} sub={`Período: ${label}`} accent="neutral" icon={Tag} />
          </div>
        </div>

        <div>
          <SectionLabel>Evolución y distribución</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title="Gastos Mensuales" subtitle="Tipo = Gasto · Excluye retiro directores" height={260}>
              <BarChartV
                data={barData}
                datasets={[{ key: 'gastos', label: 'Gastos Op.', color: COLORS.accent }]}
              />
            </ChartCard>
            <ChartCard title="Distribución por Categoría YTD" subtitle="Clasificacion_Gasto" height={260}>
              <NlacePieChart data={pieData} innerRadius="60%" />
            </ChartCard>
          </div>
        </div>

        <div>
          <SectionLabel>Ranking de gastos por categoría</SectionLabel>
          <DataTable
            title="Top gastos YTD · Clasificacion_Gasto"
            badge={`${clasifEntries.length} categorías`}
            columns={[
              { header: '#', accessor: (_, i) => <RankBadge n={i} /> },
              { header: 'Categoría', accessor: ([clas]) => <span className="font-medium text-nl-text">{(clas as string) || 'Sin clasificar'}</span> },
              { header: 'Monto YTD', accessor: ([, monto]) => D.formatCLP(monto as number), align: 'right' },
              {
                header: '% del Total', align: 'right',
                accessor: ([, monto], i) => {
                  const pct = gastos > 0 ? (monto as number) / gastos * 100 : 0
                  return (
                    <div>
                      <span className="font-mono text-[12px] text-nl-700">{pct.toFixed(1)}%</span>
                      <ProgressBar pct={pct} color={PALETTE[i % PALETTE.length]} />
                    </div>
                  )
                },
              },
              {
                header: '% sobre Ventas', align: 'right',
                accessor: ([, monto]) => {
                  const pct = ventas > 0 ? (monto as number) / ventas * 100 : 0
                  return <span className="font-mono text-[12px] text-nl-700">{ventas > 0 ? `${pct.toFixed(1)}%` : '—'}</span>
                },
              },
            ]}
            rows={clasifEntries as [string, number][]}
            keyFn={([clas]) => clas || 'sin-clas'}
            emptyText="Sin gastos en el período"
          />
        </div>

        {retirosExcl > 0 && (
          <div>
            <SectionLabel>Excluidos del análisis</SectionLabel>
            <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card p-5 max-w-xs">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-nl-400" />
                <span className="text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em]">Retiro de Directores (excluido)</span>
              </div>
              <div className="font-body text-[20px] font-bold tabular-nums text-nl-700">{D.formatCLP(retirosExcl, true)}</div>
              <div className="text-[11px] font-mono text-nl-400 mt-1">No incluido en gastos operacionales por regla de negocio</div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
