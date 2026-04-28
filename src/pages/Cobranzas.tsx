import { useEffect } from 'react'
import { Clock, AlertTriangle, DollarSign } from 'lucide-react'
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
import { LoadingState, ErrorState } from '../components/LoadingState'
import LineChartR from '../components/charts/LineChartR'
import BarChartV from '../components/charts/BarChartV'
import { COLORS } from '../components/charts/theme'

function DsoBadge({ dias }: { dias: number }) {
  if (dias <= 30) return <span className="inline-block text-[10px] font-mono font-medium text-nl-success-text bg-nl-success-bg border border-nl-success-dark/20 rounded-pill px-2.5 py-0.5 cursor-default">{dias.toFixed(0)}d · Saludable</span>
  if (dias <= 60) return <span className="inline-block text-[10px] font-mono font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-pill px-2.5 py-0.5 cursor-default">{dias.toFixed(0)}d · Alerta</span>
  return               <span className="inline-block text-[10px] font-mono font-medium text-nl-danger bg-nl-danger-8 border border-nl-danger/20 rounded-pill px-2.5 py-0.5 cursor-default">{dias.toFixed(0)}d · Crítico</span>
}

const TRAMOS = [
  { label: '≤ 15d',  min: 0,  max: 15  },
  { label: '16–30d', min: 16, max: 30  },
  { label: '31–45d', min: 31, max: 45  },
  { label: '46–60d', min: 46, max: 60  },
  { label: '61–90d', min: 61, max: 90  },
  { label: '> 90d',  min: 91, max: Infinity },
]

export default function Cobranzas() {
  const { rows: allRows, years, loading, error, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, months, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState />

  const dsoGlobal    = D.calcDSO(rows)
  const dsoClientes  = D.calcDSOByCliente(rows)
  const ventasTotal  = D.sumMonto(rows.filter(D.isVenta))
  const tienesFechas = rows.some(r => D.isVenta(r) && D.getFechaEmision(r) && D.getFechaPago(r))

  const lineData = months.map(m => {
    const rowsM = D.filterByMonth(rows, m).filter(D.isVenta)
    const dso   = rowsM.length > 0 ? D.calcDSO(D.filterByMonth(rows, m)) : null
    return { label: D.monthLabel(m), value: dso !== null ? parseFloat(dso.toFixed(1)) : null }
  })

  const tramoData = TRAMOS.map((t, i) => ({
    label:    t.label,
    clientes: dsoClientes.filter(c => c.dsoDias >= t.min && c.dsoDias <= t.max).length,
    color:    i < 2 ? COLORS.success : i < 4 ? COLORS.amber : COLORS.accent,
  }))

  const dsoAccent  = dsoGlobal === null ? 'neutral' : dsoGlobal <= 30 ? 'success' : dsoGlobal <= 60 ? 'amber' : 'danger'
  const critCount  = dsoClientes.filter(c => c.dsoDias > 60).length

  return (
    <>
      <PageHeader title="Cobranzas" subtitle="DSO · Días promedio de cobro" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        {!tienesFechas && (
          <div className="p-5 rounded-card bg-amber-50 border border-amber-200">
            <h3 className="font-display font-bold text-amber-800 mb-1 text-[14px]">Datos de fechas incompletos</h3>
            <p className="text-[12px] font-mono text-amber-700">No se encontraron registros con Fecha_emision y Fecha_Pago simultáneamente. El cálculo de DSO requiere ambas fechas en la fuente de datos.</p>
          </div>
        )}

        <div>
          <SectionLabel>{label} · Análisis de cobranzas</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              label="DSO Global"
              value={dsoGlobal !== null ? D.formatDays(dsoGlobal) : '—'}
              sub={dsoGlobal !== null ? (dsoGlobal <= 30 ? 'Saludable' : dsoGlobal <= 60 ? 'Alerta — revisar' : 'Crítico — acción requerida') : 'Sin fechas de pago en el período'}
              accent={dsoAccent}
              icon={Clock}
            />
            <KpiCard
              label="Clientes con DSO > 60d"
              value={critCount.toString()}
              sub={`De ${dsoClientes.length} clientes totales`}
              accent={critCount > 0 ? 'danger' : 'success'}
              icon={AlertTriangle}
            />
            <KpiCard
              label="Ventas analizadas"
              value={D.formatCLP(ventasTotal, true)}
              sub={`${dsoClientes.length} clientes identificados`}
              accent="primary"
              icon={DollarSign}
            />
          </div>
        </div>

        <div>
          <SectionLabel>Evolución DSO mensual</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <ChartCard
                title="Días Promedio de Cobro (DSO)"
                subtitle="< 30d saludable · 30–60d alerta · > 60d crítico"
                height={260}
              >
                {lineData.some(d => d.value !== null) ? (
                  <LineChartR
                    data={lineData}
                    color={COLORS.primary}
                    yTickFormatter={v => `${v}d`}
                    referenceLines={[
                      { y: 30, label: '30d', color: COLORS.success },
                      { y: 60, label: '60d', color: COLORS.accent },
                    ]}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[12px] font-mono text-nl-400">Sin datos de fechas para calcular DSO mensual</div>
                )}
              </ChartCard>
            </div>
            <ChartCard title="Clientes por Tramo DSO" subtitle="N° de clientes en cada rango" height={260}>
              {dsoClientes.length > 0 ? (
                <BarChartV
                  data={tramoData}
                  datasets={[{ key: 'clientes', label: 'N° clientes' }]}
                  multiColor
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[12px] font-mono text-nl-400">Sin datos suficientes</div>
              )}
            </ChartCard>
          </div>
        </div>

        <div>
          <SectionLabel>Ranking de clientes por DSO</SectionLabel>
          <DataTable
            title="Clientes ordenados por días promedio de pago"
            badge={`${dsoClientes.length} clientes`}
            columns={[
              { header: '#', accessor: (_, i) => <RankBadge n={i} /> },
              { header: 'Cliente / Descripción', accessor: c => <span className="font-medium text-nl-text">{c.cliente}</span> },
              { header: 'DSO Promedio', accessor: c => `${c.dsoDias.toFixed(1)} días`, align: 'right' },
              { header: 'Clasificación', accessor: c => <DsoBadge dias={c.dsoDias} />, align: 'right' },
              { header: 'Transacciones', accessor: c => c.transacciones, align: 'right' },
              { header: 'Monto Total', accessor: c => D.formatCLP(c.monto), align: 'right' },
            ]}
            rows={dsoClientes}
            keyFn={c => c.cliente}
            emptyText="Sin datos de clientes con fechas de pago completas en el período"
          />
        </div>

      </div>
    </>
  )
}
