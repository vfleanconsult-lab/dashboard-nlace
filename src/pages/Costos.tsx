import { useEffect } from 'react'
import { ShoppingCart, Percent, PackageOpen, Layers } from 'lucide-react'
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

export default function Costos() {
  const { rows: allRows, years, loading, error, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState />

  const ventas        = D.sumMonto(rows.filter(D.isVenta))
  const costos        = D.sumMonto(rows.filter(D.isCosto))
  const margenBruto   = ventas > 0 ? (ventas - costos) / ventas : 0
  const clasifMap     = D.groupCostosByClasif(rows)
  const clasifEntries = Object.entries(clasifMap).sort((a, b) => b[1] - a[1])

  const costoVentaKeys  = clasifEntries.filter(([k]) => /venta|directo|producci[oó]n/i.test(k))
  const costoExplotKeys = clasifEntries.filter(([k]) => !costoVentaKeys.find(cv => cv[0] === k))
  const costoVenta      = costoVentaKeys.reduce((s, [, v]) => s + v, 0)
  const costoExplot     = costoExplotKeys.reduce((s, [, v]) => s + v, 0)

  // Stacked bar: top 5 clasificaciones
  const topClasif  = clasifEntries.slice(0, 5)
  const restClasif = clasifEntries.slice(5)
  const topSet     = new Set(topClasif.map(([k]) => k))

  const stackedData = months.map(m => {
    const base: Record<string, unknown> = { label: D.monthLabel(m) }
    topClasif.forEach(([clas]) => {
      base[clas] = rows
        .filter(r => D.isCosto(r) && D.getMonth(r) === m && (D.getClasifCto(r) || D.getClasGasto(r) || 'Sin clasificar') === clas)
        .reduce((s, r) => s + D.getMonto(r), 0)
    })
    if (restClasif.length > 0) {
      base['Resto'] = filtered
        .filter(r => D.isCosto(r) && D.getMonth(r) === m && !topSet.has(D.getClasifCto(r) || D.getClasGasto(r) || 'Sin clasificar'))
        .reduce((s, r) => s + D.getMonto(r), 0)
    }
    return base
  })

  const stackedDs = [
    ...topClasif.map(([clas], i) => ({ key: clas, label: clas || 'Sin clasificar', color: PALETTE[i] })),
    ...(restClasif.length > 0 ? [{ key: 'Resto', label: 'Resto', color: PALETTE[5] }] : []),
  ]

  const pieData   = clasifEntries.slice(0, 8).map(([name, value]) => ({ name: name || 'Sin clasificar', value }))
  const margenAccent = margenBruto > 0.3 ? 'success' : margenBruto > 0.1 ? 'amber' : 'danger'

  return (
    <>
      <PageHeader title="Costos" subtitle="Estructura de costos · YTD" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        <div>
          <SectionLabel>{label} · Estructura de costos</SectionLabel>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Costos Totales YTD"  value={D.formatCLP(costos, true)}     sub={D.formatCLP(costos)}                                               accent="accent"  trend="down" icon={ShoppingCart} />
            <KpiCard label="Margen Bruto"         value={D.formatPct(margenBruto)}      sub={`Utilidad bruta: ${D.formatCLP(ventas - costos, true)}`}          accent={margenAccent}         icon={Percent} />
            <KpiCard label="Costo de Venta Est."  value={D.formatCLP(costoVenta, true)} sub={`${costos > 0 ? (costoVenta / costos * 100).toFixed(1) : 0}% del total`} accent="primary" icon={PackageOpen} />
            <KpiCard label="Costo Explotación"    value={D.formatCLP(costoExplot, true)} sub={`${costos > 0 ? (costoExplot / costos * 100).toFixed(1) : 0}% del total`} accent="neutral" icon={Layers} />
          </div>
        </div>

        <div>
          <SectionLabel>Evolución mensual</SectionLabel>
          <div className="grid gap-4" style={{ gridTemplateColumns: '3fr 2fr' }}>
            <ChartCard title="Costos por Clasificación" subtitle="Barras apiladas · Top clasificaciones" height={280}>
              <BarChartV data={stackedData} datasets={stackedDs} stacked />
            </ChartCard>
            <ChartCard title="Proporción YTD" subtitle="Distribución por clasificación" height={280}>
              <NlacePieChart data={pieData} />
            </ChartCard>
          </div>
        </div>

        <div>
          <SectionLabel>Desglose por clasificación</SectionLabel>
          <DataTable
            title="Ranking de costos YTD"
            badge={`${clasifEntries.length} clasificaciones`}
            columns={[
              { header: '#', accessor: (_, i) => <RankBadge n={i} /> },
              { header: 'Clasificación', accessor: ([clas]) => <span className="font-medium text-nl-text">{(clas as string) || 'Sin clasificar'}</span> },
              { header: 'Monto YTD', accessor: ([, monto]) => D.formatCLP(monto as number), align: 'right' },
              {
                header: '% del Total', align: 'right',
                accessor: ([, monto], i) => {
                  const pct = costos > 0 ? (monto as number) / costos * 100 : 0
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
                  return <span className={`font-mono text-[12px] ${pct > 50 ? 'text-nl-danger' : 'text-[#f59e0b]'}`}>{ventas > 0 ? `${pct.toFixed(1)}%` : '—'}</span>
                },
              },
            ]}
            rows={clasifEntries as [string, number][]}
            keyFn={([clas]) => clas || 'sin-clas'}
            emptyText="Sin costos en el período"
          />
        </div>

      </div>
    </>
  )
}
