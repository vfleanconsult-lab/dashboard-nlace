import { useEffect } from 'react'
import { TrendingUp, PlusCircle, BarChart2 } from 'lucide-react'
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
import BarChartV from '../components/charts/BarChartV'
import { COLORS, PALETTE } from '../components/charts/theme'

export default function Ingresos() {
  const { rows: allRows, years, loading, error, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState />

  const ventas    = D.sumMonto(rows.filter(D.isVenta))
  const otrosIng  = D.sumMonto(rows.filter(D.isOtroIngreso))
  const totalIng  = ventas + otrosIng
  const ventasByM = D.groupByMonth(rows, D.isVenta)
  const otrosByM  = D.groupByMonth(rows, D.isOtroIngreso)

  const chartData = months.map(m => ({
    label:  D.monthLabel(m),
    ventas: ventasByM[m] ?? 0,
    otros:  otrosByM[m]  ?? 0,
  }))

  return (
    <>
      <PageHeader title="Ingresos" subtitle="Ventas y otros ingresos · YTD" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        <div>
          <SectionLabel>{label} · Ingresos consolidados</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Ventas YTD"         value={D.formatCLP(ventas, true)}   sub={D.formatCLP(ventas)}    accent="primary" trend="up"  icon={TrendingUp}  />
            <KpiCard label="Otros Ingresos YTD" value={D.formatCLP(otrosIng, true)} sub={D.formatCLP(otrosIng)}  accent="neutral"             icon={PlusCircle}  />
            <KpiCard label="Total Ingresos YTD" value={D.formatCLP(totalIng, true)} sub={`Ventas: ${totalIng > 0 ? (ventas / totalIng * 100).toFixed(1) : 0}% del total`} accent="success" icon={BarChart2} />
          </div>
        </div>

        <div>
          <SectionLabel>Evolución mensual</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title="Ventas Mensuales" subtitle="Cuenta 5101-01 · Tipo = Ingreso" height={260}>
              <BarChartV
                data={chartData}
                datasets={[{ key: 'ventas', label: 'Ventas', color: COLORS.primary }]}
              />
            </ChartCard>
            <ChartCard
              title="Ventas vs Otros Ingresos"
              subtitle="Composición mensual"
              height={260}
              legend={[
                { color: COLORS.primary, label: 'Ventas' },
                { color: PALETTE[1],     label: 'Otros' },
              ]}
            >
              <BarChartV
                data={chartData}
                datasets={[
                  { key: 'ventas', label: 'Ventas',          color: COLORS.primary },
                  { key: 'otros',  label: 'Otros Ingresos',  color: PALETTE[1] },
                ]}
                stacked
              />
            </ChartCard>
          </div>
        </div>

      </div>
    </>
  )
}
