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
import { LoadingState, ErrorState } from '../components/LoadingState'
import BarChartV from '../components/charts/BarChartV'

// ─── semáforo facturas impagas (por días vencida) ───────────────────────────
function semaforo(dias: number): { dot: string; label: string; badgeClass: string } {
  if (dias > 0)   return { dot: 'bg-nl-success-dark',  label: 'Vigente',  badgeClass: 'text-nl-success-text bg-nl-success-bg border-nl-success-dark/20' }
  if (dias >= -15) return { dot: 'bg-[#f59e0b]',        label: 'Vencida',  badgeClass: 'text-amber-700 bg-amber-50 border-amber-200' }
  if (dias >= -30) return { dot: 'bg-[#f97316]',        label: 'Vencida',  badgeClass: 'text-orange-700 bg-orange-50 border-orange-200' }
  return              { dot: 'bg-nl-danger',           label: 'Crítica',  badgeClass: 'text-nl-danger bg-nl-danger-8 border-nl-danger/20' }
}

// ─── semáforo peores pagadores (por DSO promedio) ────────────────────────────
function semaforoDso(dias: number): { dot: string; label: string; badgeClass: string } {
  if (dias <= 20)  return { dot: 'bg-nl-success-dark',  label: 'Rápido',   badgeClass: 'text-nl-success-text bg-nl-success-bg border-nl-success-dark/20' }
  if (dias <= 30)  return { dot: 'bg-[#f59e0b]',        label: 'Normal',   badgeClass: 'text-amber-700 bg-amber-50 border-amber-200' }
  if (dias <= 40)  return { dot: 'bg-[#f97316]',        label: 'Lento',    badgeClass: 'text-orange-700 bg-orange-50 border-orange-200' }
  return               { dot: 'bg-nl-danger',           label: 'Crítico',  badgeClass: 'text-nl-danger bg-nl-danger-8 border-nl-danger/20' }
}

function SemaforoBadge({ dot, label, badgeClass }: ReturnType<typeof semaforo>) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-medium border rounded-pill px-2.5 py-0.5 ${badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  )
}

// ─── histograma: tramos de días de cobro (facturas pagadas) ──────────────────
const TRAMOS_HIST = [
  { label: '≤ 20 días',  min: 0,  max: 20,       color: '#22c55e' },
  { label: '21–30 días', min: 21, max: 30,        color: '#f59e0b' },
  { label: '31–40 días', min: 31, max: 40,        color: '#f97316' },
  { label: '> 40 días',  min: 41, max: Infinity,  color: '#dc2626' },
]

export default function Cobranzas() {
  const { rows: allRows, years, loading, error, errorDetail, loadedAt } = useData()
  const { initialize } = useFilterContext()
  const allMonths = getAllMonths(allRows)
  const { rows, label } = useFilter(allRows)

  useEffect(() => { initialize(years) }, [years])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={errorDetail} />

  // ── KPIs ──
  const dsoGlobal      = D.calcDSO(rows)
  const ventasTotal    = D.sumMonto(rows.filter(D.isVenta))
  const facturasImpagas   = D.calcFacturasImpagas(allRows)
  const peoresPagadores   = D.calcTopPeoresPagadores(allRows)
  const montoPendiente = facturasImpagas.reduce((s, f) => s + f.monto, 0)
  const tasaPago       = ventasTotal > 0 ? (ventasTotal - montoPendiente) / ventasTotal : null
  const tieneEmision   = rows.some(r => D.isVenta(r) && D.getFechaEmision(r))

  const dsoAccent = dsoGlobal === null ? 'neutral' : dsoGlobal <= 30 ? 'success' : dsoGlobal <= 60 ? 'amber' : 'danger'

  // ── Histograma ──
  const histData = TRAMOS_HIST.map(t => {
    const count = rows.filter(r => {
      if (!D.isVenta(r) || !D.getFechaEmision(r) || !D.getFechaPago(r)) return false
      const emi  = D.parseDateCL(D.getFechaEmision(r))
      const pago = D.parseDateCL(D.getFechaPago(r))
      if (!emi || !pago) return false
      const dias = (pago.getTime() - emi.getTime()) / 86400000
      return dias >= t.min && dias <= t.max
    }).length
    return { label: t.label, count, color: t.color }
  })
  const totalFactPagadas = histData.reduce((s, d) => s + d.count, 0)

  return (
    <>
      <PageHeader title="Cobranzas" subtitle="DSO · Análisis de facturas y comportamiento de pago" years={years} allMonths={allMonths} loadedAt={loadedAt} />

      <div className="p-8 space-y-8">

        {!tieneEmision && (
          <div className="p-5 rounded-card bg-amber-50 border border-amber-200">
            <h3 className="font-display font-bold text-amber-800 mb-1 text-[14px]">Datos de fechas incompletos</h3>
            <p className="text-[12px] font-mono text-amber-700">No se encontraron registros de ventas con Fecha_emision. El cálculo de DSO requiere esta columna en la fuente de datos.</p>
          </div>
        )}

        {/* KPIs */}
        <div>
          <SectionLabel>{label} · Análisis de cobranzas</SectionLabel>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="DSO Global"
              value={dsoGlobal !== null ? D.formatDays(dsoGlobal) : '—'}
              sub={dsoGlobal !== null ? (dsoGlobal <= 30 ? 'Saludable' : dsoGlobal <= 60 ? 'Atención — revisar' : 'Crítico — acción requerida') : 'Sin datos suficientes'}
              accent={dsoAccent}
              icon={Clock}
            />
            <KpiCard
              label="Monto Pendiente"
              value={D.formatCLP(montoPendiente, true)}
              sub={`${facturasImpagas.length} facturas sin pagar`}
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
              sub={`${peoresPagadores.length} clientes analizados`}
              accent="primary"
              icon={DollarSign}
            />
          </div>
        </div>

        {/* Histograma de facturas pagadas por tramo */}
        <div>
          <SectionLabel>Distribución de facturas pagadas por tiempo de cobro</SectionLabel>
          <ChartCard
            title="Histograma de cobro"
            subtitle={`${totalFactPagadas} facturas pagadas · agrupadas por días entre emisión y pago`}
            height={260}
          >
            {totalFactPagadas > 0 ? (
              <BarChartV
                data={histData}
                datasets={[{ key: 'count', label: 'Facturas' }]}
                multiColor
                yTickFormatter={v => String(v)}
                tooltipFormatter={(v, name) => [`${v} factura${v !== 1 ? 's' : ''}`, name]}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[12px] font-mono text-nl-400">Sin facturas pagadas con fechas en el período</div>
            )}
          </ChartCard>
        </div>

        {/* Dos frames lado a lado */}
        <div>
          <SectionLabel>Detalle · Facturas impagas y peores pagadores</SectionLabel>
          <div className="grid grid-cols-2 gap-4">

            {/* Frame izquierdo: facturas impagas */}
            <DataTable
              title="Facturas impagas"
              badge={`${facturasImpagas.length} facturas`}
              columns={[
                {
                  header: 'Cliente',
                  accessor: f => <span className="font-medium text-nl-text">{f.cliente}</span>,
                },
                {
                  header: 'Monto', align: 'right',
                  accessor: f => <span className="font-mono text-[12px] text-nl-700">{D.formatCLP(f.monto)}</span>,
                },
                {
                  header: 'Vencimiento', align: 'right',
                  accessor: f => (
                    <span className="font-mono text-[12px] text-nl-400">{f.fechaVencimiento || '—'}</span>
                  ),
                },
                {
                  header: 'Días', align: 'right',
                  accessor: f => (
                    <span className={`font-mono text-[12px] font-semibold ${f.diasVencida > 0 ? 'text-nl-success-dark' : f.diasVencida >= -15 ? 'text-amber-700' : f.diasVencida >= -30 ? 'text-orange-700' : 'text-nl-danger'}`}>
                      {f.diasVencida > 0 ? `+${f.diasVencida}` : f.diasVencida}
                    </span>
                  ),
                },
                {
                  header: 'Estado', align: 'right',
                  accessor: f => <SemaforoBadge {...semaforo(f.diasVencida)} />,
                },
              ]}
              rows={facturasImpagas}
              keyFn={(f, i) => `${f.cliente}-${i}`}
              emptyText="Sin facturas impagas"
            />

            {/* Frame derecho: top 10 peores pagadores */}
            <DataTable
              title="Top 10 peores pagadores históricos"
              badge="solo facturas pagadas"
              columns={[
                { header: '#', accessor: (_, i) => <RankBadge n={i} /> },
                {
                  header: 'Cliente',
                  accessor: p => <span className="font-medium text-nl-text">{p.cliente}</span>,
                },
                {
                  header: 'Fact. Pagadas', align: 'right',
                  accessor: p => <span className="font-mono text-[12px] text-nl-700">{p.facturasPagadas}</span>,
                },
                {
                  header: 'DSO Prom.', align: 'right',
                  accessor: p => (
                    <span className={`font-mono text-[12px] font-semibold ${p.dsoDias <= 20 ? 'text-nl-success-dark' : p.dsoDias <= 30 ? 'text-amber-700' : p.dsoDias <= 40 ? 'text-orange-700' : 'text-nl-danger'}`}>
                      {Math.round(p.dsoDias)} días
                    </span>
                  ),
                },
                {
                  header: 'Días s/venc.', align: 'right',
                  accessor: p => {
                    if (p.diasSobreVenc === null) return <span className="font-mono text-[12px] text-nl-400">—</span>
                    const d = Math.round(p.diasSobreVenc)
                    const colorClass = d <= 0 ? 'text-nl-success-dark' : d <= 10 ? 'text-amber-700' : d <= 20 ? 'text-orange-700' : 'text-nl-danger'
                    return (
                      <span className={`font-mono text-[12px] font-semibold ${colorClass}`}>
                        {d > 0 ? `+${d}` : d}d
                      </span>
                    )
                  },
                },
                {
                  header: 'Estado', align: 'right',
                  accessor: p => <SemaforoBadge {...semaforoDso(p.dsoDias)} />,
                },
              ]}
              rows={peoresPagadores}
              keyFn={p => p.cliente}
              emptyText="Sin facturas pagadas"
            />

          </div>
        </div>

      </div>
    </>
  )
}
