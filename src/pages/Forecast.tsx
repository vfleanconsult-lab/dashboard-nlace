import { useState, useMemo, useEffect } from 'react'
import { Settings2, BarChart2, AlertTriangle, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { useData } from '../lib/useData'
import { useFilterContext } from '../lib/FilterContext'
import * as D from '../lib/data'
import {
  buildForecast,
  DEFAULT_ASSUMPTIONS,
  type ForecastAssumptions,
  type ForecastMonth,
} from '../lib/forecast'
import { COLORS, TOOLTIP_STYLE } from '../components/charts/theme'
import { LoadingState, ErrorState } from '../components/LoadingState'
import SectionLabel from '../components/SectionLabel'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import ForecastPanel from '../components/ForecastPanel'

// ─────────── Table row definitions (same structure as Cashflow) ───────────

type ForecastKey =
  | 'saldoInicial'
  | 'ingresos'
  | 'ventas'
  | 'otrosIngresos'
  | 'costos'
  | 'costoVenta'
  | 'otrosGastosExpl'
  | 'gastos'
  | 'gastosAdm'
  | 'serviciosComp'
  | 'publicidad'
  | 'representacion'
  | 'locomocion'
  | 'legales'
  | 'remDirector'
  | 'saldoFinal'

interface RowDef {
  key: ForecastKey
  label: string
  level: 0 | 1
  isSubtotal: boolean
  isBalance?: boolean
}

const ROW_DEFS: RowDef[] = [
  { key: 'saldoInicial',    label: 'Saldo Inicial',             level: 0, isSubtotal: false, isBalance: true },
  { key: 'ingresos',        label: 'Ingresos',                  level: 0, isSubtotal: true  },
  { key: 'ventas',          label: 'Ventas cobradas',           level: 1, isSubtotal: false },
  { key: 'otrosIngresos',   label: 'Otros Ingresos',            level: 1, isSubtotal: false },
  { key: 'costos',          label: 'Costos',                    level: 0, isSubtotal: true  },
  { key: 'costoVenta',      label: 'Costo Venta',               level: 1, isSubtotal: false },
  { key: 'otrosGastosExpl', label: 'Otros Gastos Explotación',  level: 1, isSubtotal: false },
  { key: 'gastos',          label: 'Gastos',                    level: 0, isSubtotal: true  },
  { key: 'gastosAdm',       label: 'Gastos Administración',     level: 1, isSubtotal: false },
  { key: 'serviciosComp',   label: 'Servicios Computacionales', level: 1, isSubtotal: false },
  { key: 'publicidad',      label: 'Publicidad',                level: 1, isSubtotal: false },
  { key: 'representacion',  label: 'Representación y Viáticos', level: 1, isSubtotal: false },
  { key: 'locomocion',      label: 'Locomoción',                level: 1, isSubtotal: false },
  { key: 'legales',         label: 'Legales y Notariales',      level: 1, isSubtotal: false },
  { key: 'remDirector',     label: 'Remuneración Director',     level: 0, isSubtotal: false },
  { key: 'saldoFinal',      label: 'Saldo Final',               level: 0, isSubtotal: true, isBalance: true },
]

function fmt(n: number): string {
  return '$' + Math.abs(Math.round(n)).toLocaleString('es-CL')
}

// ─────────── Page ───────────

export default function Forecast() {
  const { rows: allRows, years, loading, error, errorDetail, loadedAt } = useData()
  const { initialize } = useFilterContext()

  const [assumptions, setAssumptions] = useState<ForecastAssumptions>(DEFAULT_ASSUMPTIONS)
  const [panelOpen, setPanelOpen]     = useState(false)
  const [view, setView]               = useState<'table' | 'chart'>('table')

  useEffect(() => { initialize(years) }, [years])

  const result = useMemo(
    () => buildForecast(allRows, assumptions),
    [allRows, assumptions],
  )

  const { months, projectedMonths, avgRecHist, lastRemDirector, ymM1, ymM2, ventasM1, ventasM2 } = result

  // Resize per-month arrays when projected window changes
  useEffect(() => {
    setAssumptions(prev => {
      const len = projectedMonths.length
      const vrmOk = prev.ventasRecurrentesMes.length === len
      const vnmOk = prev.ventasNuevasMes.length === len
      const rdmOk = prev.remDirectorPorMes.length === len
      if (vrmOk && vnmOk && rdmOk) return prev
      const newVrm: (number | null)[] = Array.from({ length: len }, (_, i) => prev.ventasRecurrentesMes[i] ?? null)
      const newVnm: (number | null)[] = Array.from({ length: len }, (_, i) => prev.ventasNuevasMes[i] ?? null)
      const newRdm: (number | null)[] = Array.from({ length: len }, (_, i) => prev.remDirectorPorMes[i] ?? null)
      return { ...prev, ventasRecurrentesMes: newVrm, ventasNuevasMes: newVnm, remDirectorPorMes: newRdm }
    })
  }, [projectedMonths.length])

  // ── KPIs ──
  const totalIngresos = months.reduce((s, m) => s + m.ingresos, 0)
  const totalEgresos  = months.reduce((s, m) => s + m.costos + m.gastos + m.remDirector, 0)
  const saldoFinalDec = months.at(-1)?.saldoFinal ?? 0
  const mesesBajoMin  = months.filter(m => m.belowMinimum).length

  // ── Chart data ──
  const barData = months.map((m: ForecastMonth) => ({
    label:    D.monthLabel(m.ym),
    ingresos: m.ingresos,
    egresos:  m.costos + m.gastos + m.remDirector,
  }))

  const areaData = months.map((m: ForecastMonth) => ({
    label: D.monthLabel(m.ym),
    saldo: m.saldoFinal,
  }))

  const currentYear = new Date().getFullYear()
  const rangeLabel  = projectedMonths.length > 0
    ? `${D.monthLabel(projectedMonths[0])}–Dic ${currentYear}`
    : `${currentYear}`

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={errorDetail} />

  return (
    <>
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 h-[60px] flex items-center justify-between px-8 bg-nl-white/90 backdrop-blur-md border-b border-nl-border-soft">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[16px] font-display font-bold text-nl-text tracking-tight">Forecast</h1>
          <span className="text-[11px] font-mono text-nl-400">
            Flujo de caja proyectado · {rangeLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {loadedAt && (
            <span className="text-[10px] font-mono text-nl-400">
              Act. {loadedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12px] font-body font-medium bg-nl-primary text-white hover:bg-nl-primary/90 transition-colors"
          >
            <Settings2 size={14} />
            Panel de Control
          </button>
        </div>
      </header>

      <div className="p-8 space-y-8">

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Ingresos proyectados"
            value={D.formatCLP(totalIngresos, true)}
            sub={`${projectedMonths.length} meses · ${rangeLabel}`}
            accent="primary"
            icon={TrendingUp}
          />
          <KpiCard
            label="Egresos proyectados"
            value={D.formatCLP(totalEgresos, true)}
            sub="costos + gastos + remuneración"
            accent="accent"
          />
          <KpiCard
            label="Saldo final proyectado"
            value={D.formatCLP(saldoFinalDec, true)}
            sub={`Dic ${currentYear}`}
            accent={saldoFinalDec >= assumptions.minimoAlerta ? 'success' : 'danger'}
            trend={saldoFinalDec >= assumptions.minimoAlerta ? 'up' : 'down'}
          />
          <KpiCard
            label="Meses bajo mínimo"
            value={String(mesesBajoMin)}
            sub={
              mesesBajoMin > 0
                ? `Umbral: ${D.formatCLP(assumptions.minimoAlerta, true)}`
                : 'Sin alertas de liquidez'
            }
            accent={mesesBajoMin > 0 ? 'danger' : 'success'}
            icon={mesesBajoMin > 0 ? AlertTriangle : undefined}
          />
        </div>

        {/* ── Diagnóstico de cobranza ── */}
        {months.length > 0 && (() => {
          const m0 = months[0]
          return (
            <div className="bg-nl-bg border border-nl-border-soft rounded-[10px] px-4 py-3 text-[11px] font-mono text-nl-500 space-y-1">
              <p className="text-[9px] uppercase tracking-[0.1em] text-nl-400 mb-2">Diagnóstico cobranza — {D.monthLabel(m0.ym)}</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                <span>Ventas reales {D.monthLabel(ymM1)} (M-1)</span>
                <span className="text-nl-text tabular-nums">{D.formatCLP(ventasM1)}</span>
                <span>Ventas reales {D.monthLabel(ymM2)} (M-2)</span>
                <span className="text-nl-text tabular-nums">{D.formatCLP(ventasM2)}</span>
                <span>Promedio histórico 3m</span>
                <span className="text-nl-text tabular-nums">{D.formatCLP(avgRecHist)}</span>
                <span className="mt-1 pt-1 border-t border-nl-border-soft">Cobro rec. mes 1 ({assumptions.pctCobroMes1Rec}%)</span>
                <span className="mt-1 pt-1 border-t border-nl-border-soft text-nl-text tabular-nums">{D.formatCLP(m0.cobroRecMes1)}</span>
                <span>Cobro rec. mes 2 ({assumptions.pctCobroMes2Rec}%)</span>
                <span className="text-nl-text tabular-nums">{D.formatCLP(m0.cobroRecMes2)}</span>
                <span>Anticipo nuevas ({assumptions.pctAnticipoNuevas}%)</span>
                <span className="text-nl-text tabular-nums">{D.formatCLP(m0.cobroAnticipo)}</span>
                <span>Saldo nuevas M-1</span>
                <span className="text-nl-text tabular-nums">{D.formatCLP(m0.cobroSaldo)}</span>
                <span className="font-semibold text-nl-text">Total cobrado {D.monthLabel(m0.ym)}</span>
                <span className="font-semibold text-nl-text tabular-nums">{D.formatCLP(m0.ventas)}</span>
              </div>
            </div>
          )
        })()}

        {/* ── View toggle ── */}
        <div className="flex items-center gap-1 p-1 bg-nl-bg rounded-[12px] w-fit">
          {(['table', 'chart'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-body transition-all duration-[220ms]',
                view === v
                  ? 'bg-nl-white shadow-sm text-nl-text font-medium'
                  : 'text-nl-500 hover:text-nl-text',
              ].join(' ')}
            >
              <BarChart2 size={13} />
              {v === 'table' ? 'Tabla' : 'Gráfico'}
            </button>
          ))}
        </div>

        {/* ── Table view ── */}
        {view === 'table' && (
          <div>
            <SectionLabel>
              Proyección mensual · {rangeLabel}
              {result.movAvgMonths.length > 0 && (
                <span className="ml-2 text-nl-400 normal-case tracking-normal">
                  (prom. móvil: {result.movAvgMonths.map(D.monthLabel).join(', ')})
                </span>
              )}
            </SectionLabel>

            <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-nl-border-soft bg-nl-bg/50">
                    <th className="px-4 py-3 text-left text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] sticky left-0 bg-nl-bg/80 z-10 min-w-[240px] border-r border-nl-border-soft">
                      Componente
                    </th>
                    {months.map(m => (
                      <th
                        key={m.ym}
                        className={[
                          'px-4 py-3 text-right text-[10px] font-mono uppercase tracking-[0.1em] min-w-[110px]',
                          m.belowMinimum ? 'text-nl-danger' : 'text-nl-400',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {m.belowMinimum && <AlertTriangle size={10} className="shrink-0" />}
                          {D.monthLabel(m.ym)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROW_DEFS.map(({ key, label, level, isSubtotal, isBalance }) => (
                    <tr
                      key={key}
                      className={[
                        'border-b border-nl-border-soft last:border-b-0',
                        isSubtotal || isBalance ? 'bg-nl-bg/60' : 'hover:bg-nl-bg/20',
                      ].join(' ')}
                    >
                      <td
                        className={[
                          'px-4 py-2.5 sticky left-0 z-10 border-r border-nl-border-soft',
                          isSubtotal || isBalance ? 'bg-nl-bg/80' : 'bg-nl-white',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'font-body text-[12px]',
                            level === 1 ? 'pl-5 text-nl-500' : '',
                            isSubtotal || isBalance
                              ? 'font-semibold text-nl-text'
                              : 'text-nl-700',
                          ].join(' ')}
                        >
                          {level === 1 ? `→ ${label}` : label}
                        </span>
                      </td>
                      {months.map(m => {
                        const val        = m[key] as number
                        const isBelowMin = key === 'saldoFinal' && m.belowMinimum
                        const isNegFinal = key === 'saldoFinal' && val < 0
                        return (
                          <td
                            key={m.ym}
                            className={[
                              'px-4 py-2.5 text-right font-body tabular-nums text-[12px]',
                              isSubtotal || isBalance ? 'font-semibold' : '',
                              isBelowMin || isNegFinal
                                ? 'text-nl-danger'
                                : isSubtotal || isBalance
                                  ? 'text-nl-text'
                                  : 'text-nl-700',
                            ].join(' ')}
                          >
                            {fmt(val)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Chart view ── */}
        {view === 'chart' && months.length > 0 && (
          <div className="space-y-6">
            <ChartCard
              title="Ingresos vs Egresos proyectados"
              subtitle={`Flujo mensual · ${rangeLabel}`}
              legend={[
                { color: COLORS.primary, label: 'Ingresos' },
                { color: COLORS.accent,  label: 'Egresos'  },
              ]}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => D.formatCLP(v, true)}
                    width={62}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => [D.formatCLP(v), name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: COLORS.text, paddingTop: 12 }}
                  />
                  <Bar
                    dataKey="ingresos"
                    name="Ingresos"
                    fill={COLORS.primary}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                  <Bar
                    dataKey="egresos"
                    name="Egresos"
                    fill={COLORS.accent}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Saldo final proyectado"
              subtitle={`Línea de referencia: mínimo ${D.formatCLP(assumptions.minimoAlerta, true)}`}
              legend={[{ color: COLORS.primary, label: 'Saldo final' }]}
              height={280}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={areaData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradForecastSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={COLORS.primary} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => D.formatCLP(Number(v), true)}
                    width={62}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [D.formatCLP(v), 'Saldo final']}
                  />
                  <ReferenceLine
                    y={assumptions.minimoAlerta}
                    stroke="#dc2626"
                    strokeDasharray="5 3"
                    label={{
                      value: 'Mínimo',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: '#dc2626',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo final"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fill="url(#gradForecastSaldo)"
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.primary }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {months.length === 0 && (
          <div className="text-center py-16 text-[13px] font-mono text-nl-400">
            No hay meses proyectados para {currentYear}.
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      <ForecastPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        assumptions={assumptions}
        onChange={setAssumptions}
        projectedMonths={projectedMonths}
        avgRecHist={avgRecHist}
        lastRemDirector={lastRemDirector}
      />
    </>
  )
}
