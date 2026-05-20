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
import { LoadingState, ErrorState } from '../components/LoadingState'
import BarChartV from '../components/charts/BarChartV'
import NlacePieChart from '../components/charts/PieChart'
import { COLORS } from '../components/charts/theme'

type GastoRow = { clasif: string; n2: number; n1: number; pctChange: number | null; n: number; ytd: number }

function shiftMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shortMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-')
  return `${D.MONTH_LABELS[parseInt(m, 10) - 1]}-${y.substring(2)}`
}

function buildClasifMap(rows: D.Row[]): Record<string, number> {
  const map: Record<string, number> = {}
  rows.forEach(r => {
    const c = D.getClasGasto(r) || 'Sin clasificar'
    map[c] = (map[c] || 0) + D.getMonto(r)
  })
  return map
}

export default function Gastos() {
  const { rows: allRows, years, loading, error, errorDetail, loadedAt } = useData()
  const { initialize, state } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={errorDetail} />

  const ventas        = D.sumMonto(rows.filter(D.isVenta))
  const gastos        = D.sumMonto(rows.filter(D.isGasto))
  const remDirectores = D.sumMonto(rows.filter(D.isRemDirectores))
  const clasifEntries = Object.entries(D.groupGastosByClasif(rows)).sort((a, b) => b[1] - a[1])
  const gastosByM     = D.groupByMonth(rows, D.isGasto)
  const pctVentas     = ventas > 0 ? gastos / ventas : 0
  const pctAccent     = pctVentas < 0.3 ? 'success' : pctVentas < 0.5 ? 'amber' : 'danger'

  const barData = months.map(m => ({ label: D.monthLabel(m), gastos: gastosByM[m] ?? 0 }))
  const pieData = clasifEntries.slice(0, 8).map(([name, value]) => ({ name: name || 'Sin clasificar', value }))

  // Determine active month N from filter state
  const p = state.primary
  const monthN  = p.type === 'month' ? p.month
                : p.type === 'range' ? (p.to || months[months.length - 1] || '')
                : (months[months.length - 1] || '')
  const monthN1 = monthN ? shiftMonth(monthN, -1) : ''
  const monthN2 = monthN ? shiftMonth(monthN, -2) : ''
  const yearN   = monthN ? monthN.substring(0, 4) : ''

  const gastoRows = allRows.filter(D.isGasto)
  const rowsN   = monthN  ? gastoRows.filter(r => D.getMonth(r) === monthN)  : []
  const rowsN1  = monthN1 ? gastoRows.filter(r => D.getMonth(r) === monthN1) : []
  const rowsN2  = monthN2 ? gastoRows.filter(r => D.getMonth(r) === monthN2) : []
  const rowsYTD = monthN  ? gastoRows.filter(r => { const m = D.getMonth(r); return !!m && D.getYear(r) === yearN && m <= monthN }) : []

  const mapN   = buildClasifMap(rowsN)
  const mapN1  = buildClasifMap(rowsN1)
  const mapN2  = buildClasifMap(rowsN2)
  const mapYTD = buildClasifMap(rowsYTD)

  const allClasifs = [...new Set([...Object.keys(mapN), ...Object.keys(mapN1), ...Object.keys(mapN2), ...Object.keys(mapYTD)])]
  const gastosTableData: GastoRow[] = allClasifs
    .map(c => {
      const n2 = mapN2[c] ?? 0
      const n1 = mapN1[c] ?? 0
      return { clasif: c, n2, n1, pctChange: n2 > 0 ? (n1 - n2) / n2 * 100 : null, n: mapN[c] ?? 0, ytd: mapYTD[c] ?? 0 }
    })
    .sort((a, b) => b.ytd - a.ytd)

  const labelN  = monthN  ? shortMonthLabel(monthN)  : '—'
  const labelN1 = monthN1 ? shortMonthLabel(monthN1) : '—'
  const labelN2 = monthN2 ? shortMonthLabel(monthN2) : '—'

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
          <DataTable<GastoRow>
            title="Top Gastos YTD · Clasificacion_Gasto"
            badge={`${gastosTableData.length} categorías`}
            columns={[
              {
                header: 'Clasificación',
                accessor: row => <span className="font-medium text-nl-text">{row.clasif || 'Sin clasificar'}</span>,
              },
              {
                header: labelN2,
                align: 'right',
                accessor: row => D.formatCLP(row.n2),
              },
              {
                header: labelN1,
                align: 'right',
                accessor: row => D.formatCLP(row.n1),
              },
              {
                header: '% Cambio',
                align: 'right',
                accessor: row => {
                  if (row.pctChange === null) return <span className="font-mono text-[12px] text-nl-400">—</span>
                  const color = row.pctChange < 0 ? 'text-green-600' : row.pctChange > 0 ? 'text-red-600' : 'text-nl-700'
                  const sign  = row.pctChange > 0 ? '+' : ''
                  return <span className={`font-mono text-[12px] ${color}`}>{sign}{row.pctChange.toFixed(1)}%</span>
                },
              },
              {
                header: labelN,
                align: 'right',
                accessor: row => D.formatCLP(row.n),
              },
              {
                header: 'YTD',
                align: 'right',
                accessor: row => <span className="font-body tabular-nums font-semibold">{D.formatCLP(row.ytd)}</span>,
              },
            ]}
            rows={gastosTableData}
            keyFn={row => row.clasif || 'sin-clas'}
            emptyText="Sin gastos en el período"
          />
        </div>

      </div>
    </>
  )
}
