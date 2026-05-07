import { X, RefreshCcw } from 'lucide-react'
import type { ForecastAssumptions } from '../lib/forecast'
import { DEFAULT_ASSUMPTIONS } from '../lib/forecast'
import { MONTH_LABELS, formatCLP } from '../lib/data'

interface Props {
  isOpen: boolean
  onClose: () => void
  assumptions: ForecastAssumptions
  onChange: (a: ForecastAssumptions) => void
  saldoInicialCalculado: number
  projectedMonths: string[]
}

function set<K extends keyof ForecastAssumptions>(
  assumptions: ForecastAssumptions,
  onChange: (a: ForecastAssumptions) => void,
  key: K,
  value: ForecastAssumptions[K],
) {
  onChange({ ...assumptions, [key]: value })
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-mono text-nl-400 uppercase tracking-[0.12em] mb-3">
      {children}
    </p>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-mono text-nl-500">{label}</label>
        <span className="text-[11px] font-body tabular-nums text-nl-text font-semibold">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full bg-nl-bg appearance-none cursor-pointer accent-nl-primary"
      />
      <div className="flex justify-between text-[9px] font-mono text-nl-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-mono text-nl-500">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-nl-400 pointer-events-none">
          $
        </span>
        <input
          type="number"
          value={value}
          min={0}
          step={100000}
          onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-full pl-6 pr-3 py-2 text-[12px] font-body tabular-nums text-nl-text bg-nl-bg border border-nl-border-soft rounded-[8px] focus:outline-none focus:border-nl-primary"
        />
      </div>
    </div>
  )
}

export default function ForecastPanel({
  isOpen,
  onClose,
  assumptions,
  onChange,
  saldoInicialCalculado,
  projectedMonths,
}: Props) {
  const upd = <K extends keyof ForecastAssumptions>(key: K, value: ForecastAssumptions[K]) =>
    set(assumptions, onChange, key, value)

  const saldoDisplay = assumptions.saldoInicialManual ?? saldoInicialCalculado

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-nl-text/10 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed top-0 right-0 bottom-0 z-50 w-80 bg-nl-white border-l border-nl-border-soft shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-nl-border-soft shrink-0">
          <div>
            <h2 className="font-display font-bold text-[14px] text-nl-text">Panel de Control</h2>
            <p className="text-[10px] font-mono text-nl-400 mt-0.5">Supuestos del forecast</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-nl-400 hover:bg-nl-bg hover:text-nl-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Ingresos ── */}
          <section className="space-y-4">
            <SectionTitle>Ingresos</SectionTitle>

            <SliderField
              label="Ventas mensuales (MRR base)"
              value={assumptions.ventasMensuales}
              min={0}
              max={20_000_000}
              step={100_000}
              display={formatCLP(assumptions.ventasMensuales, true)}
              onChange={v => upd('ventasMensuales', v)}
            />

            <SliderField
              label="Días de cobranza"
              value={assumptions.diasCobranza}
              min={10}
              max={90}
              step={5}
              display={`${assumptions.diasCobranza} días`}
              onChange={v => upd('diasCobranza', v)}
            />

            <SliderField
              label="% incobrable"
              value={assumptions.pctIncobrable}
              min={0}
              max={10}
              step={0.5}
              display={`${assumptions.pctIncobrable}%`}
              onChange={v => upd('pctIncobrable', v)}
            />

            <SliderField
              label="Churn mensual"
              value={assumptions.churnMensual}
              min={0}
              max={15}
              step={0.5}
              display={`${assumptions.churnMensual}%`}
              onChange={v => upd('churnMensual', v)}
            />
          </section>

          {/* ── Costos ── */}
          <section className="space-y-4">
            <SectionTitle>Costos y gastos</SectionTitle>

            <SliderField
              label="Personas nuevas"
              value={assumptions.personasNuevas}
              min={0}
              max={5}
              step={1}
              display={`${assumptions.personasNuevas} pers.`}
              onChange={v => upd('personasNuevas', v)}
            />

            {assumptions.personasNuevas > 0 && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-nl-500">
                    Mes de contratación
                  </label>
                  <select
                    value={assumptions.mesContratacion}
                    onChange={e => upd('mesContratacion', parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-[12px] font-body text-nl-text bg-nl-bg border border-nl-border-soft rounded-[8px] focus:outline-none focus:border-nl-primary"
                  >
                    {projectedMonths.map((ym, i) => {
                      const [year, month] = ym.split('-')
                      const label = `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`
                      return (
                        <option key={ym} value={i}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <CurrencyField
                  label="Costo por persona / mes"
                  value={assumptions.costoPorPersona}
                  onChange={v => upd('costoPorPersona', v)}
                />
              </>
            )}

            <SliderField
              label="% incremento software por ventas"
              value={assumptions.pctIncrementoSoftware}
              min={0}
              max={50}
              step={1}
              display={`${assumptions.pctIncrementoSoftware}%`}
              onChange={v => upd('pctIncrementoSoftware', v)}
            />
          </section>

          {/* ── Alertas ── */}
          <section className="space-y-4">
            <SectionTitle>Alertas</SectionTitle>
            <CurrencyField
              label="Saldo mínimo de alerta"
              value={assumptions.saldoMinimo}
              onChange={v => upd('saldoMinimo', v)}
            />
          </section>

          {/* ── Saldo inicial ── */}
          <section className="space-y-3">
            <SectionTitle>Saldo inicial</SectionTitle>
            <div className="px-3 py-2 bg-nl-bg rounded-[8px]">
              <p className="text-[10px] font-mono text-nl-400">Calculado desde Supabase</p>
              <p className="text-[13px] font-body tabular-nums font-semibold text-nl-text mt-0.5">
                {formatCLP(saldoInicialCalculado)}
              </p>
            </div>
            <CurrencyField
              label="Saldo inicial (ajuste manual)"
              value={saldoDisplay}
              onChange={v => upd('saldoInicialManual', v)}
            />
            {assumptions.saldoInicialManual !== null && (
              <button
                onClick={() => upd('saldoInicialManual', null)}
                className="text-[10px] font-mono text-nl-primary hover:text-nl-primary/80 transition-colors"
              >
                ↺ Restaurar valor calculado
              </button>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-nl-border-soft shrink-0">
          <button
            onClick={() => onChange({ ...DEFAULT_ASSUMPTIONS })}
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
