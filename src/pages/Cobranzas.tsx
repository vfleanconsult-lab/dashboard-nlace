import { useEffect } from 'react'
import { Clock, AlertTriangle, DollarSign, CheckCircle2 } from 'lucide-react'
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
import LineChartR from '../components/charts/LineChartR'
import BarChartV from '../components/charts/BarChartV'
import { COLORS } from '../components/charts/theme'

function estadoDso(dias: number): { label: string; className: string } {
  if (dias <= 30) return { label: 'Saludable', className: 'text-nl-success-text bg-nl-success-bg border-nl-success-dark/20' }
  if (dias <= 60) return { label: 'Atención',  className: 'text-amber-700 bg-amber-50 border-amber-200' }
  return             { label: 'Crítico',   className: 'text-nl-danger bg-nl-danger-8 border-nl-danger/20' }
}

function DsoBadge({ dias }: { dias: number }) {
  const e = estadoDso(dias)
  return (
    <span className={`inline-block text-[10px] font-mono font-medium border rounded-pill px-2.5 py-0.5 cursor-default ${e.className}`}>
      {dias.toFixed(0)}d
    </span>
  )
}

function EstadoBadge({ dias }: { dias: number }) {
  const e = estadoDso(dias)
  return (
    <span className={`inline-block text-[10px] font-mono font-medium border rounded-pill px-2.5 py-0.5 cursor-default ${e.className}`}>
      {e.label}
    </span>
  )
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

  const dsoGlobal      = D.calcDSO(rows)
  const dsoClientes    = D.calcDSOByCliente(rows)
  const ventasTotal    = D.sumMonto(rows.filter(D.isVenta))
  const montoPendiente = dsoClientes.reduce((s, c) => s + c.montoPendiente, 0)
  const tieneEmision   = rows.some(r => D.isVenta(r) && D.getFechaEmision(r))

  // Solo filas con Fecha_Pago para el gráfico mensual
  const lineData = months.map(m => {
    const dso = D.calcDSO(D.filterByMonth(rows, m))
    return { label: D.monthLabel(m), value: dso !== null ? parseFloat(dso.toFixed(1)) : null }
  })

  const tramoData = TRAMOS.map((t, i) => ({
    label:    t.label,
    clientes: dsoClientes.filter(c => c.dsoDias >= t.min && c.dsoDias <= t.max).length,
    color:    i < 2 ? COLORS.success : i < 4 ? COLORS.amber : COLORS.accent,
  }))

  const dsoAccent  = dsoGlobal === null ? 'neutral' : dsoGlobal <= 30 ? 'success' : dsoGlobal <= 60 ? 'amber' : 'danger'
  const critCount  = dsoClientes.filter(c => c.montoPendiente > 0).length
  const tasaPago   = ventasTotal > 0 ? (ventasTotal - montoPendiente) / ventasTotal : null

  return (
    <>
      <PageHeader title="Cobranzas" subtitle="DSO · Días promedio de cobro (facturas pagadas)" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        {!tieneEmision && (
          <div className="p-5 rounded-card bg-amber-50 border border-amber-200">
            <h3 className="font-display font-bold text-amber-800 mb-1 text-[14px]">Datos de fechas incompletos</h3>
            <p className="text-[12px] font-mono text-amber-700">No se encontraron registros de ventas con Fecha_emision. El cálculo de DSO requiere esta columna en la fuente de datos.</p>
          </div>
        )}

        <div>
          <SectionLabel>{label} · Análisis de cobranzas</SectionLabel>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="DSO Global"
              value={dsoGlobal !== null ? D.formatDays(dsoGlobal) : '—'}
              sub={dsoGlobal !== null ? (dsoGlobal <= 30 ? 'Saludable' : dsoGlobal <= 60 ? 'Atención — revisar' : 'Crítico — acción requerida') : 'Sin facturas pagadas en el período'}
              accent={dsoAccent}
              icon={Clock}
            />
            <KpiCard
              label="Monto Pendiente"
              value={D.formatCLP(montoPendiente, true)}
              sub={`${critCount} clientes con facturas sin pagar`}
              accent={montoPendiente > 0 ? 'danger' : 'success'}
              icon={AlertTriangle}
            />
            <KpiCard
              label="Tasa de Cobro"
              value={tasaPago !== null ? D.formatPct(tasaPago) : '—'}
              sub="Monto cobrado / Monto facturado"
              accent={tasaPago === null ? 'neutral' : tasaPago >= 0.9 ? 'success' : tasaPago >= 0.7 ? 'amber' : 'danger'}
              icon={CheckCircle2}
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
                subtitle="Solo facturas pagadas · promedio de Fecha_Pago − Fecha_Emision"
                height={260}
              >
                {lineData.some(d => d.value !== null) ? (
                  <LineChartR
                    data={lineData}
                    color={COLORS.primary}
                    yDomainMin={0}
                    yTickFormatter={v => `${v}d`}
                    referenceLines={[
                      { y: 30, label: '30d', color: COLORS.success },
                      { y: 60, label: '60d', color: COLORS.accent },
                    ]}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[12px] font-mono text-nl-400">Sin facturas pagadas con fechas en el período</div>
                )}
              </ChartCard>
            </div>
            <ChartCard title="Clientes por Tramo DSO" subtitle="N° de clientes en cada rango (solo facturas pagadas)" height={260}>
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
          <SectionLabel>Ranking · Comportamiento de pago por cliente</SectionLabel>
          <DataTable
            title="Clientes ordenados por monto pendiente"
            badge={`${dsoClientes.length} clientes`}
            columns={[
              { header: '#', accessor: (_, i) => <RankBadge n={i} /> },
              { header: 'Cliente', accessor: c => <span className="font-medium text-nl-text">{c.cliente}</span> },
              {
                header: 'Monto Total Facturado', align: 'right',
                accessor: c => <span className="font-mono text-[12px] text-nl-700">{D.formatCLP(c.monto)}</span>,
              },
              {
                header: 'Monto Cobrado', align: 'right',
                accessor: c => (
                  <div>
                    <span className="font-mono text-[12px] text-nl-success-dark">{D.formatCLP(c.montoPagado)}</span>
                    <ProgressBar pct={c.monto > 0 ? c.montoPagado / c.monto * 100 : 0} color={COLORS.success} />
                  </div>
                ),
              },
              {
                header: 'Monto Pendiente', align: 'right',
                accessor: c => (
                  <span className={`font-mono text-[12px] font-semibold ${c.montoPendiente > 0 ? 'text-nl-danger' : 'text-nl-400'}`}>
                    {c.montoPendiente > 0 ? D.formatCLP(c.montoPendiente) : '—'}
                  </span>
                ),
              },
              {
                header: 'Fact. Totales', align: 'right',
                accessor: c => <span className="font-mono text-[12px] text-nl-700">{c.transacciones}</span>,
              },
              {
                header: 'Fact. Pagadas', align: 'right',
                accessor: c => <span className="font-mono text-[12px] text-nl-700">{c.transaccionesPagadas}</span>,
              },
              {
                header: 'DSO Prom.', align: 'right',
                accessor: c => c.transaccionesPagadas > 0
                  ? <DsoBadge dias={c.dsoDias} />
                  : <span className="text-[10px] font-mono text-nl-400">Sin pagos</span>,
              },
              {
                header: 'Estado', align: 'right',
                accessor: c => c.transaccionesPagadas > 0
                  ? <EstadoBadge dias={c.dsoDias} />
                  : <span className="text-[10px] font-mono text-nl-400">—</span>,
              },
            ]}
            rows={dsoClientes}
            keyFn={c => c.cliente}
            emptyText="Sin ventas en el período"
          />
        </div>

      </div>
    </>
  )
}
