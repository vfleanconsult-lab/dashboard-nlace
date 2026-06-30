import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, PlusCircle, BarChart2 } from 'lucide-react'
import * as D from '../lib/data'
import { useData } from '../lib/useData'
import { useFilter } from '../lib/useFilter'
import { getAllMonths } from '../lib/filter'
import { useFilterContext } from '../lib/FilterContext'
import { formatMonthLabel } from '../lib/filter'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import SectionLabel from '../components/SectionLabel'
import ChartCard from '../components/ChartCard'
import DataTable from '../components/DataTable'
import RankBadge from '../components/RankBadge'
import { LoadingState, ErrorState } from '../components/LoadingState'
import BarChartV from '../components/charts/BarChartV'
import { COLORS, PALETTE } from '../components/charts/theme'

const NOW_MONTH = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

export default function Ingresos() {
  const { rows: allRows, years, loading, error, errorDetail, loadedAt } = useData()
  const { initialize, state: filterState } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  // Year currently selected in the global filter (used to scope "Ventas del mes")
  const selectedYear = filterState.primary.year

  // ── CAMBIO 1: Ranking histórico de ventas por cliente ──────────────────────
  const rankingData = useMemo(() => {
    const map: Record<string, { facturas: number; total: number }> = {}
    rows.filter(r => D.isVenta(r) && !D.isAnticipo(r)).forEach(r => {
      const c = D.getCliente(r) || 'Sin nombre'
      if (!map[c]) map[c] = { facturas: 0, total: 0 }
      map[c].facturas++
      map[c].total += D.getMonto(r)
    })
    return Object.entries(map)
      .map(([cliente, d]) => ({ cliente, facturas: d.facturas, total: d.total }))
      .sort((a, b) => b.total - a.total)
  }, [rows])

  // ── CAMBIO 2: Ventas del mes ────────────────────────────────────────────────
  const salesMonthsInYear = useMemo(
    () => D.getMonthsForYear(allRows.filter(D.isVenta), selectedYear),
    [allRows, selectedYear]
  )

  const [localMonth, setLocalMonth] = useState('')

  // Reset local month selector when global year changes
  useEffect(() => { setLocalMonth('') }, [selectedYear])

  const currentMonthHasData = salesMonthsInYear.includes(NOW_MONTH)
  const effectiveMonth = localMonth
    || (currentMonthHasData ? NOW_MONTH : salesMonthsInYear[salesMonthsInYear.length - 1] ?? '')
  const isAutoFallback = !localMonth && !currentMonthHasData && salesMonthsInYear.length > 0

  const ventasDelMes = useMemo(() => {
    if (!effectiveMonth) return []
    return allRows
      .filter(r => D.isVenta(r) && !D.isAnticipo(r) && D.getMonth(r) === effectiveMonth)
      .map(r => ({
        cliente: D.getCliente(r) || 'Sin nombre',
        monto: D.getMonto(r),
        fechaEmision: D.getFechaEmision(r),
      }))
      .sort((a, b) => b.monto - a.monto)
  }, [allRows, effectiveMonth])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={errorDetail} />

  const ventas    = D.sumMonto(rows.filter(r => D.isVenta(r) && D.isPagado(r)))
  const otrosIng  = D.sumMonto(rows.filter(r => D.isOtroIngreso(r) && D.isPagado(r)))
  const totalIng  = ventas + otrosIng
  const ventasByM = D.groupByMonth(rows, r => D.isVenta(r) && D.isPagado(r))
  const otrosByM  = D.groupByMonth(rows, r => D.isOtroIngreso(r) && D.isPagado(r))

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

        {/* ── Ventas del mes ── */}
        <div>
          <SectionLabel>Ventas del mes</SectionLabel>

          {/* Month selector header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[12px] font-mono text-nl-400">Período:</span>
            <select
              value={localMonth}
              onChange={e => setLocalMonth(e.target.value)}
              className="text-[12px] font-mono text-nl-text bg-nl-white border border-nl-border-ui rounded-pill px-3 py-1.5 focus:outline-none focus:border-nl-primary cursor-pointer"
            >
              <option value="">Automático</option>
              {salesMonthsInYear.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>

            {/* Fallback notice */}
            {isAutoFallback && effectiveMonth && (
              <span className="text-[11px] font-mono text-nl-400 bg-nl-bg border border-nl-border-ui rounded-pill px-3 py-1">
                Sin movimientos en {formatMonthLabel(NOW_MONTH)} · Mostrando último período con actividad: {formatMonthLabel(effectiveMonth)}
              </span>
            )}

            {/* No data at all */}
            {!localMonth && salesMonthsInYear.length === 0 && (
              <span className="text-[11px] font-mono text-nl-400">
                Sin movimientos en {formatMonthLabel(NOW_MONTH)}
              </span>
            )}
          </div>

          <DataTable
            title={`Ventas del mes${effectiveMonth ? ' · ' + formatMonthLabel(effectiveMonth) : ''}`}
            columns={[
              {
                header: 'Cliente',
                accessor: 'cliente',
                align: 'left',
              },
              {
                header: 'Monto Bruto',
                accessor: (row) => <span className="font-body tabular-nums">{D.formatCLP(row.monto)}</span>,
                align: 'right',
              },
              {
                header: 'Fecha Emisión',
                accessor: 'fechaEmision',
                align: 'right',
              },
            ]}
            rows={ventasDelMes}
            keyFn={(_row, i) => String(i)}
            emptyText={effectiveMonth ? `Sin ventas en ${formatMonthLabel(effectiveMonth)}` : 'Sin datos disponibles'}
          />
        </div>

        {/* ── Ranking histórico de ventas por cliente ── */}
        <div>
          <SectionLabel>Ranking histórico de ventas por cliente</SectionLabel>
          <DataTable
            title="Ranking histórico de ventas por cliente"
            badge={label}
            columns={[
              {
                header: '#',
                accessor: (_row, i) => <RankBadge n={i} />,
                align: 'left',
                className: 'w-10',
              },
              {
                header: 'Cliente',
                accessor: 'cliente',
                align: 'left',
              },
              {
                header: 'N° Facturas',
                accessor: (row) => <span className="font-body tabular-nums">{row.facturas}</span>,
                align: 'right',
              },
              {
                header: 'Monto Total Facturado',
                accessor: (row) => <span className="font-body tabular-nums">{D.formatCLP(row.total)}</span>,
                align: 'right',
              },
            ]}
            rows={rankingData}
            keyFn={(row) => row.cliente}
            emptyText="Sin ventas en el período seleccionado"
          />
        </div>

      </div>
    </>
  )
}
