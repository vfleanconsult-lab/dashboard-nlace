import type { Row } from './data'
import { getYear, getMonth, MONTH_LABELS } from './data'

export type PeriodType = 'year' | 'month' | 'range'

export interface SinglePeriod {
  type: PeriodType
  year:  string   // 'year' mode
  month: string   // 'month' mode — YYYY-MM
  from:  string   // 'range' mode — YYYY-MM
  to:    string   // 'range' mode — YYYY-MM
}

export interface FilterState {
  mode: 'single' | 'compare'
  primary:   SinglePeriod
  secondary: SinglePeriod
}

export function defaultPeriod(year: string): SinglePeriod {
  return { type: 'year', year, month: '', from: '', to: '' }
}

export function filterRowsByPeriod(rows: Row[], p: SinglePeriod): Row[] {
  switch (p.type) {
    case 'year':
      return rows.filter(r => getYear(r) === p.year)
    case 'month':
      return rows.filter(r => getMonth(r) === p.month)
    case 'range': {
      const from = p.from || ''
      const to   = p.to   || ''
      if (!from || !to) return []
      return rows.filter(r => {
        const m = getMonth(r)
        return !!m && m >= from && m <= to
      })
    }
  }
}

export function getMonthsForPeriod(rows: Row[], p: SinglePeriod): string[] {
  const filtered = filterRowsByPeriod(rows, p)
  const set: Record<string, boolean> = {}
  filtered.forEach(r => { const m = getMonth(r); if (m) set[m] = true })
  return Object.keys(set).sort()
}

export function getAllMonths(rows: Row[]): string[] {
  const set: Record<string, boolean> = {}
  rows.forEach(r => { const m = getMonth(r); if (m) set[m] = true })
  return Object.keys(set).sort()
}

export function formatMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-')
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`
}

export function getPeriodLabel(p: SinglePeriod): string {
  switch (p.type) {
    case 'year':  return p.year || '—'
    case 'month': return p.month ? formatMonthLabel(p.month) : '—'
    case 'range': {
      if (!p.from || !p.to) return '—'
      return `${formatMonthLabel(p.from)} – ${formatMonthLabel(p.to)}`
    }
  }
}

export function getFilterLabel(state: FilterState): string {
  if (state.mode === 'compare') {
    return `${getPeriodLabel(state.primary)} vs ${getPeriodLabel(state.secondary)}`
  }
  return getPeriodLabel(state.primary)
}
