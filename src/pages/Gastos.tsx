import { useEffect } from 'react'
import { Receipt, Percent, UserX } from 'lucide-react'
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
  const { rows: allRows, years, loading, error, errorDetail, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={errorDetail} />

  const ventas        = D.sumMonto(rows.filter(D.isVenta))
  const gastos        = D.sumMonto(rows.filter(D.isGasto))
  const remDirectores = D.sumMonto(rows.filter(D.isRemDirectores))
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
            <KpiCard label="Rem. Directores (4401-02)" value={D.formatCLP(remDirectores, true)} sub={remDirectores > 0 ? D.formatCLP(remDirectores) : 'Sin movimientos en el período'} accent="neutral" icon={UserX} />
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


      </div>
    </>
  )
}
