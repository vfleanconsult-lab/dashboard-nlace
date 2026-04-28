import { useState, useRef, useEffect } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { type SinglePeriod, type FilterState, formatMonthLabel, getPeriodLabel, defaultPeriod } from '../lib/filter'
import { MONTH_LABELS } from '../lib/data'
import { useFilterContext } from '../lib/FilterContext'

const MODES = [
  { key: 'year',    label: 'Año' },
  { key: 'month',   label: 'Mes' },
  { key: 'range',   label: 'Rango' },
  { key: 'compare', label: 'Comparar' },
] as const

type UIMode = 'year' | 'month' | 'range' | 'compare'

interface Props { years: string[]; allMonths: string[] }

// ── Sub-component: selects a single year ────────────────────────────────────
function YearSelect({ value, years, onChange }: { value: string; years: string[]; onChange: (y: string) => void }) {
  return (
    <select
      className="w-full border border-nl-border-ui rounded-input px-3 py-2 text-[13px] font-body text-nl-text bg-nl-white outline-none focus:ring-2 focus:ring-nl-primary/30 focus:border-nl-primary cursor-pointer transition-all duration-[150ms]"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

// ── Sub-component: month grid ───────────────────────────────────────────────
function MonthGrid({ year, selected, years, onYearChange, onMonthSelect }: {
  year: string; selected: string; years: string[]
  onYearChange: (y: string) => void
  onMonthSelect: (m: string) => void
}) {
  return (
    <div className="space-y-3">
      <YearSelect value={year} years={years} onChange={onYearChange} />
      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_LABELS.map((m, i) => {
          const val = `${year}-${String(i + 1).padStart(2, '0')}`
          const active = selected === val
          return (
            <button
              key={m}
              onClick={() => onMonthSelect(val)}
              className={`py-1.5 px-2 rounded-[8px] text-[12px] font-body font-medium transition-all duration-[150ms] cursor-pointer
                ${active
                  ? 'bg-nl-primary text-white'
                  : 'text-nl-700 hover:bg-nl-primary-10 hover:text-nl-primary'}`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sub-component: month+year dropdown ─────────────────────────────────────
function MonthYearSelect({ label, value, allMonths, onChange }: {
  label: string; value: string; allMonths: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em]">{label}</p>
      <select
        className="w-full border border-nl-border-ui rounded-input px-3 py-2 text-[13px] font-body text-nl-text bg-nl-white outline-none focus:ring-2 focus:ring-nl-primary/30 focus:border-nl-primary cursor-pointer transition-all duration-[150ms]"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {allMonths.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
      </select>
    </div>
  )
}

// ── Sub-component: a single period picker for compare mode ──────────────────
function ComparePeriodPicker({ label, period, years, allMonths, onChange }: {
  label: string
  period: SinglePeriod
  years: string[]
  allMonths: string[]
  onChange: (p: SinglePeriod) => void
}) {
  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono font-bold bg-nl-primary text-white">{label}</span>
        <span className="text-[11px] font-mono text-nl-500 truncate">{getPeriodLabel(period)}</span>
      </div>
      <div className="flex gap-1 p-0.5 bg-nl-bg rounded-[8px]">
        {(['year', 'range'] as const).map(t => (
          <button
            key={t}
            onClick={() => onChange({
              ...period,
              type: t,
              ...(t === 'range' && {
                from: period.from || allMonths[0] || '',
                to:   period.to   || allMonths[allMonths.length - 1] || '',
              }),
            })}
            className={`flex-1 py-1 text-[11px] font-body font-medium rounded-[6px] transition-all duration-[150ms] cursor-pointer
              ${period.type === t ? 'bg-nl-white shadow-sm text-nl-primary' : 'text-nl-400 hover:text-nl-700'}`}
          >
            {t === 'year' ? 'Año' : 'Rango'}
          </button>
        ))}
      </div>
      {period.type === 'year' && (
        <YearSelect value={period.year} years={years} onChange={y => onChange({ ...period, year: y })} />
      )}
      {period.type === 'range' && (
        <div className="space-y-2">
          <MonthYearSelect label="Desde" value={period.from || allMonths[0]} allMonths={allMonths} onChange={v => onChange({ ...period, from: v })} />
          <MonthYearSelect label="Hasta" value={period.to || allMonths[allMonths.length - 1]} allMonths={allMonths} onChange={v => onChange({ ...period, to: v })} />
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function PeriodSelector({ years, allMonths }: Props) {
  const { state, setState } = useFilterContext()
  const [open, setOpen]     = useState(false)
  const [draft, setDraft]   = useState<FilterState>(state)
  const [uiMode, setUiMode] = useState<UIMode>(
    state.mode === 'compare' ? 'compare' : state.primary.type
  )
  const ref = useRef<HTMLDivElement>(null)

  // sync draft when opening
  const handleOpen = () => {
    setDraft(state)
    setUiMode(state.mode === 'compare' ? 'compare' : state.primary.type)
    setOpen(true)
  }

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const apply = () => {
    setState(draft)
    setOpen(false)
  }

  const updatePrimary = (patch: Partial<SinglePeriod>) =>
    setDraft(d => ({ ...d, primary: { ...d.primary, ...patch } }))

  const updateSecondary = (p: SinglePeriod) =>
    setDraft(d => ({ ...d, secondary: p }))

  const switchUIMode = (m: UIMode) => {
    setUiMode(m)
    if (m === 'compare') {
      setDraft(d => ({
        ...d,
        mode: 'compare',
        primary: d.primary.type === 'year' ? d.primary : defaultPeriod(years[0]),
        secondary: d.secondary.type === 'year'
          ? d.secondary
          : {
              ...d.secondary,
              from: d.secondary.from || allMonths[0] || '',
              to:   d.secondary.to   || allMonths[allMonths.length - 1] || '',
            },
      }))
    } else if (m === 'range') {
      setDraft(d => ({
        ...d,
        mode: 'single',
        primary: {
          ...d.primary,
          type: 'range',
          from: d.primary.from || allMonths[0] || '',
          to:   d.primary.to   || allMonths[allMonths.length - 1] || '',
        },
      }))
    } else {
      setDraft(d => ({ ...d, mode: 'single', primary: { ...d.primary, type: m as SinglePeriod['type'] } }))
    }
  }

  const currentLabel = (() => {
    if (state.mode === 'compare') return `${getPeriodLabel(state.primary)} vs ${getPeriodLabel(state.secondary)}`
    return getPeriodLabel(state.primary)
  })()

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 bg-nl-white border border-nl-border-ui rounded-input px-3 py-1.5 hover:border-nl-primary/50 transition-all duration-[150ms] cursor-pointer group"
      >
        <CalendarDays size={14} className="text-nl-400 group-hover:text-nl-primary transition-colors shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-body font-semibold text-nl-text tabular-nums">{currentLabel}</span>
        <ChevronDown size={12} className={`text-nl-400 transition-transform duration-[150ms] shrink-0 ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-nl-white rounded-card border border-nl-border-soft shadow-hover z-50 overflow-hidden animate-fade-up">

          {/* Mode tabs */}
          <div className="flex border-b border-nl-border-soft">
            {MODES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => switchUIMode(key as UIMode)}
                className={`flex-1 py-2.5 text-[12px] font-body font-medium transition-all duration-[150ms] cursor-pointer
                  ${uiMode === key
                    ? 'text-nl-primary border-b-2 border-nl-primary -mb-px bg-nl-primary-10/50'
                    : 'text-nl-400 hover:text-nl-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">

            {/* Año */}
            {uiMode === 'year' && (
              <YearSelect value={draft.primary.year} years={years} onChange={y => updatePrimary({ year: y })} />
            )}

            {/* Mes */}
            {uiMode === 'month' && (
              <MonthGrid
                year={draft.primary.month ? draft.primary.month.split('-')[0] : (draft.primary.year || years[0])}
                selected={draft.primary.month}
                years={years}
                onYearChange={y => {
                  const [, m] = draft.primary.month.split('-')
                  updatePrimary({ month: m ? `${y}-${m}` : `${y}-01`, year: y })
                }}
                onMonthSelect={m => updatePrimary({ month: m })}
              />
            )}

            {/* Rango */}
            {uiMode === 'range' && (
              <div className="space-y-2">
                <MonthYearSelect
                  label="Desde"
                  value={draft.primary.from || allMonths[0]}
                  allMonths={allMonths}
                  onChange={v => updatePrimary({ from: v, to: draft.primary.to && draft.primary.to >= v ? draft.primary.to : v })}
                />
                <MonthYearSelect
                  label="Hasta"
                  value={draft.primary.to || allMonths[allMonths.length - 1]}
                  allMonths={allMonths.filter(m => m >= (draft.primary.from || allMonths[0]))}
                  onChange={v => updatePrimary({ to: v })}
                />
              </div>
            )}

            {/* Comparar */}
            {uiMode === 'compare' && (
              <div className="flex gap-3">
                <ComparePeriodPicker
                  label="A"
                  period={draft.primary}
                  years={years}
                  allMonths={allMonths}
                  onChange={p => setDraft(d => ({ ...d, primary: p }))}
                />
                <div className="w-px bg-nl-border-soft self-stretch" />
                <ComparePeriodPicker
                  label="B"
                  period={draft.secondary}
                  years={years}
                  allMonths={allMonths}
                  onChange={p => updateSecondary(p)}
                />
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-nl-border-soft bg-nl-bg">
            <button
              onClick={() => setOpen(false)}
              className="text-[12px] font-body font-medium text-nl-400 hover:text-nl-700 transition-colors duration-[150ms] cursor-pointer px-3 py-1.5"
            >
              Cancelar
            </button>
            <button
              onClick={apply}
              className="text-[12px] font-body font-semibold text-white bg-nl-primary hover:bg-nl-primary-dark px-4 py-1.5 rounded-input transition-all duration-[150ms] cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
