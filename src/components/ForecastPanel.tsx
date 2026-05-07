import { X, RefreshCcw, Plus, Trash2 } from 'lucide-react'
import type { ForecastAssumptions, DotacionCargo, DotacionCambio } from '../lib/forecast'
import { DEFAULT_ASSUMPTIONS, DEFAULT_DOTACION } from '../lib/forecast'
import { MONTH_LABELS, formatCLP } from '../lib/data'

interface Props {
  isOpen: boolean
  onClose: () => void
  assumptions: ForecastAssumptions
  onChange: (a: ForecastAssumptions) => void
  projectedMonths: string[]
  avgRecHist: number
  lastRemDirector: number
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-mono text-nl-400 uppercase tracking-[0.12em] mb-3">
      {children}
    </p>
  )
}

function SliderField({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-mono text-nl-500">{label}</label>
        <span className="text-[11px] font-body tabular-nums text-nl-text font-semibold">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full bg-nl-bg appearance-none cursor-pointer accent-nl-primary"
      />
      <div className="flex justify-between text-[9px] font-mono text-nl-400">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

function CurrencyField({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-mono text-nl-500">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-nl-400 pointer-events-none">$</span>
        <input
          type="number" value={value} min={0} step={100_000}
          onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-full pl-6 pr-3 py-2 text-[12px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[8px] focus:outline-none focus:border-nl-primary"
        />
      </div>
    </div>
  )
}

export default function ForecastPanel({
  isOpen, onClose, assumptions, onChange, projectedMonths, avgRecHist, lastRemDirector,
}: Props) {
  const upd = <K extends keyof ForecastAssumptions>(key: K, value: ForecastAssumptions[K]) =>
    onChange({ ...assumptions, [key]: value })

  const updateCargo = (ci: number, patch: Partial<DotacionCargo>) =>
    upd('dotacion', assumptions.dotacion.map((c, i) => i === ci ? { ...c, ...patch } : c))

  const updateCambio = (ci: number, chi: number, patch: Partial<DotacionCambio>) =>
    upd('dotacion', assumptions.dotacion.map((c, i) =>
      i !== ci ? c : { ...c, cambios: c.cambios.map((ch, j) => j === chi ? { ...ch, ...patch } : ch) }
    ))

  const addCambio = (ci: number) =>
    upd('dotacion', assumptions.dotacion.map((c, i) =>
      i !== ci ? c : { ...c, cambios: [...c.cambios, { mesIndex: 0, cantidad: c.cantidad }] }
    ))

  const removeCambio = (ci: number, chi: number) =>
    upd('dotacion', assumptions.dotacion.map((c, i) =>
      i !== ci ? c : { ...c, cambios: c.cambios.filter((_, j) => j !== chi) }
    ))

  const setRecurrentesMes = (i: number, v: number | null) => {
    const arr: (number | null)[] = [...(assumptions.ventasRecurrentesMes ?? [])]
    while (arr.length <= i) arr.push(null)
    arr[i] = v
    upd('ventasRecurrentesMes', arr)
  }

  const setNuevasMes = (i: number, v: number | null) => {
    const arr: (number | null)[] = [...(assumptions.ventasNuevasMes ?? [])]
    while (arr.length <= i) arr.push(null)
    arr[i] = v
    upd('ventasNuevasMes', arr)
  }

  const setRemDirectorMes = (i: number, v: number | null) => {
    const arr: (number | null)[] = [...(assumptions.remDirectorPorMes ?? [])]
    while (arr.length <= i) arr.push(null)
    arr[i] = v
    upd('remDirectorPorMes', arr)
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-nl-text/10 backdrop-blur-[1px]" onClick={onClose} />
      )}

      <aside className={[
        'fixed top-0 right-0 bottom-0 z-50 w-[440px] bg-nl-white border-l border-nl-border-soft shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-nl-border-soft shrink-0">
          <div>
            <h2 className="font-display font-bold text-[14px] text-nl-text">Panel de Control</h2>
            <p className="text-[10px] font-mono text-nl-400 mt-0.5">Supuestos del forecast</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[8px] text-nl-400 hover:bg-nl-bg hover:text-nl-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ① Punto de partida */}
          <section className="space-y-3">
            <SectionTitle>① Punto de partida</SectionTitle>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono text-nl-500">Saldo de caja actual ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-nl-400 pointer-events-none">$</span>
                <input
                  type="number"
                  value={assumptions.saldoInicial}
                  step={100_000}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  onChange={e => upd('saldoInicial', parseFloat(e.target.value) || 0)}
                  className="w-full pl-6 pr-3 py-2 text-[12px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[8px] focus:outline-none focus:border-nl-primary"
                />
              </div>
            </div>
          </section>

          {/* ② Ventas por mes */}
          <section className="space-y-3">
            <SectionTitle>② Ventas por mes</SectionTitle>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-14 shrink-0" />
              <span className="flex-1 text-[9px] font-mono text-nl-400 text-center">Recurrentes</span>
              <span className="flex-1 text-[9px] font-mono text-nl-400 text-center">Nuevas ventas</span>
            </div>
            <div className="space-y-2">
              {projectedMonths.map((ym, i) => {
                const [year, mon] = ym.split('-')
                const label = `${MONTH_LABELS[parseInt(mon) - 1]} ${year}`
                const valRec = assumptions.ventasRecurrentesMes[i]
                const valNuv = assumptions.ventasNuevasMes[i]
                return (
                  <div key={ym} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-nl-500 w-14 shrink-0">{label}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-nl-400 pointer-events-none">$</span>
                      <input
                        type="number"
                        min={0}
                        step={100_000}
                        value={valRec == null ? '' : valRec}
                        placeholder={avgRecHist > 0 ? String(Math.round(avgRecHist)) : ''}
                        onClick={e => (e.target as HTMLInputElement).select()}
                        onChange={e => setRecurrentesMes(i, e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full pl-5 pr-1 py-1.5 text-[11px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[6px] focus:outline-none focus:border-nl-primary"
                      />
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-nl-400 pointer-events-none">$</span>
                      <input
                        type="number"
                        min={0}
                        step={100_000}
                        value={valNuv == null ? '' : valNuv}
                        placeholder="0"
                        onClick={e => (e.target as HTMLInputElement).select()}
                        onChange={e => setNuevasMes(i, e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full pl-5 pr-1 py-1.5 text-[11px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[6px] focus:outline-none focus:border-nl-primary"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {avgRecHist > 0 && (
              <p className="text-[9px] font-mono text-nl-400">
                Recurrentes vacío = prom. histórico ({formatCLP(avgRecHist, true)}) · Nuevas vacío = $0
              </p>
            )}
          </section>

          {/* ③ Política de cobranza */}
          <section className="space-y-4">
            <SectionTitle>③ Política de cobranza</SectionTitle>
            <SliderField
              label="Cobro recurrentes mes 1 (%)"
              value={assumptions.pctCobroMes1Rec}
              min={0} max={100} step={5}
              display={`${assumptions.pctCobroMes1Rec}%`}
              onChange={v => upd('pctCobroMes1Rec', v)}
            />
            <SliderField
              label="Cobro recurrentes mes 2 (%)"
              value={assumptions.pctCobroMes2Rec}
              min={0} max={50} step={1}
              display={`${assumptions.pctCobroMes2Rec}%`}
              onChange={v => upd('pctCobroMes2Rec', v)}
            />
            <SliderField
              label="Anticipo nuevas ventas (%)"
              value={assumptions.pctAnticipoNuevas}
              min={0} max={100} step={5}
              display={`${assumptions.pctAnticipoNuevas}%`}
              onChange={v => upd('pctAnticipoNuevas', v)}
            />
            <SliderField
              label="Incobrable nuevas ventas (%)"
              value={assumptions.pctIncobrableNuevas}
              min={0} max={10} step={0.5}
              display={`${assumptions.pctIncobrableNuevas}%`}
              onChange={v => upd('pctIncobrableNuevas', v)}
            />
            <div className="px-3 py-2 bg-nl-bg rounded-[8px]">
              <p className="text-[9px] font-mono text-nl-400 leading-relaxed">
                Recurrentes: {assumptions.pctCobroMes1Rec}% mes 1 + {assumptions.pctCobroMes2Rec}% mes 2<br />
                Nuevas ventas: {assumptions.pctAnticipoNuevas}% anticipo + {100 - assumptions.pctAnticipoNuevas}% saldo
              </p>
            </div>
          </section>

          {/* ④ Pérdida MRR */}
          <section className="space-y-4">
            <SectionTitle>④ Pérdida MRR</SectionTitle>
            <SliderField
              label="Pérdida MRR mensual (%)"
              value={assumptions.tasaPerdidaMRR}
              min={0} max={15} step={0.5}
              display={`${assumptions.tasaPerdidaMRR}%`}
              onChange={v => upd('tasaPerdidaMRR', v)}
            />
            <div className="px-3 py-2 bg-nl-bg rounded-[8px]">
              <p className="text-[9px] font-mono text-nl-400 leading-relaxed">
                Tasa de cancelación o reducción mensual del MRR recurrente.
                0% = sin pérdida · 2% típico para SaaS estable.
              </p>
            </div>
          </section>

          {/* ⑤ Dotación */}
          <section className="space-y-3">
            <SectionTitle>⑤ Dotación</SectionTitle>
            <div className="space-y-3">
              {assumptions.dotacion.map((cargo, ci) => (
                <div key={ci} className="border border-nl-border-soft rounded-[8px] p-3 space-y-2">
                  <input
                    type="text"
                    value={cargo.nombre}
                    onChange={e => updateCargo(ci, { nombre: e.target.value })}
                    className="w-full text-[12px] font-body text-nl-text bg-transparent border-none outline-none font-medium leading-tight"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[9px] font-mono text-nl-400">Cant.</label>
                      <input
                        type="number"
                        min={0}
                        value={cargo.cantidad}
                        onChange={e => updateCargo(ci, { cantidad: parseInt(e.target.value) || 0 })}
                        className="w-12 text-[12px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[6px] px-2 py-1 text-center focus:outline-none focus:border-nl-primary"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <label className="text-[9px] font-mono text-nl-400 shrink-0">$/mes</label>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-nl-400 pointer-events-none">$</span>
                        <input
                          type="number"
                          min={0}
                          step={50_000}
                          value={cargo.costoMensual}
                          onChange={e => updateCargo(ci, { costoMensual: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-4 pr-2 py-1 text-[11px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[6px] focus:outline-none focus:border-nl-primary"
                        />
                      </div>
                    </div>
                  </div>
                  {cargo.cambios.map((cambio, chi) => (
                    <div key={chi} className="flex items-center gap-2 pl-2 border-l-2 border-nl-border-soft/60">
                      <span className="text-[9px] font-mono text-nl-400 shrink-0">desde</span>
                      <select
                        value={cambio.mesIndex}
                        onChange={e => updateCambio(ci, chi, { mesIndex: parseInt(e.target.value) })}
                        className="text-[11px] font-body bg-nl-bg border border-nl-border-soft rounded-[6px] px-2 py-0.5 focus:outline-none focus:border-nl-primary"
                      >
                        {projectedMonths.map((ym, mi) => (
                          <option key={ym} value={mi}>
                            {MONTH_LABELS[parseInt(ym.split('-')[1]) - 1]}
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] font-mono text-nl-400">→</span>
                      <input
                        type="number"
                        min={0}
                        value={cambio.cantidad}
                        onChange={e => updateCambio(ci, chi, { cantidad: parseInt(e.target.value) || 0 })}
                        className="w-12 text-[11px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[6px] px-1.5 py-0.5 text-center focus:outline-none focus:border-nl-primary"
                      />
                      <button
                        onClick={() => removeCambio(ci, chi)}
                        className="ml-auto p-0.5 text-nl-400 hover:text-nl-danger transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addCambio(ci)}
                    className="flex items-center gap-1 text-[9px] font-mono text-nl-primary hover:text-nl-primary/80 transition-colors"
                  >
                    <Plus size={10} />
                    Cambio programado
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ⑥ Remuneración Director */}
          <section className="space-y-3">
            <SectionTitle>⑥ Remuneración Director</SectionTitle>
            <p className="text-[9px] font-mono text-nl-400 -mt-1">Variable según disponibilidad de caja</p>
            <div className="space-y-2">
              {projectedMonths.map((ym, i) => {
                const [year, mon] = ym.split('-')
                const label = `${MONTH_LABELS[parseInt(mon) - 1]} ${year}`
                const val = assumptions.remDirectorPorMes[i]
                return (
                  <div key={ym} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-nl-500 w-14 shrink-0">{label}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-nl-400 pointer-events-none">$</span>
                      <input
                        type="number"
                        min={0}
                        step={100_000}
                        value={val == null ? '' : val}
                        placeholder={lastRemDirector > 0 ? String(Math.round(lastRemDirector)) : '0'}
                        onClick={e => (e.target as HTMLInputElement).select()}
                        onChange={e => setRemDirectorMes(i, e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full pl-6 pr-2 py-1.5 text-[11px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[6px] focus:outline-none focus:border-nl-primary"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {lastRemDirector > 0 && (
              <p className="text-[9px] font-mono text-nl-400">
                Vacío = último mes cerrado ({formatCLP(lastRemDirector, true)}) · 0 = no cobrar
              </p>
            )}
          </section>

          {/* ⑦ Gastos variables */}
          <section className="space-y-4">
            <SectionTitle>⑦ Gastos variables</SectionTitle>
            <SliderField
              label="% incremento software por ventas"
              value={assumptions.pctIncrementoSoftware}
              min={0} max={100} step={5}
              display={`${assumptions.pctIncrementoSoftware}%`}
              onChange={v => upd('pctIncrementoSoftware', v)}
            />
          </section>

          {/* ⑧ Alertas */}
          <section className="space-y-3">
            <SectionTitle>⑧ Alertas</SectionTitle>
            <CurrencyField
              label="Saldo mínimo de alerta ($)"
              value={assumptions.minimoAlerta}
              onChange={v => upd('minimoAlerta', v)}
            />
          </section>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-nl-border-soft shrink-0">
          <button
            onClick={() => onChange({
              ...DEFAULT_ASSUMPTIONS,
              ventasRecurrentesMes: Array(projectedMonths.length).fill(null),
              ventasNuevasMes: Array(projectedMonths.length).fill(null),
              remDirectorPorMes: Array(projectedMonths.length).fill(null),
              dotacion: DEFAULT_DOTACION.map(c => ({ ...c, cambios: [] })),
            })}
            className="flex items-center gap-2 text-[11px] font-mono text-nl-400 hover:text-nl-text transition-colors"
          >
            <RefreshCcw size={12} />
            Restablecer supuestos por defecto
          </button>
        </div>
      </aside>
    </>
  )
}
