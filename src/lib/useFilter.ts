import { type Row } from './data'
import { filterRowsByPeriod, getMonthsForPeriod, getPeriodLabel } from './filter'
import { useFilterContext } from './FilterContext'

export function useFilter(allRows: Row[]) {
  const { state } = useFilterContext()

  const rows         = filterRowsByPeriod(allRows, state.primary)
  const months       = getMonthsForPeriod(allRows, state.primary)
  const label        = getPeriodLabel(state.primary)
  const isCompare    = state.mode === 'compare'
  const compareRows  = isCompare ? filterRowsByPeriod(allRows, state.secondary) : null
  const compareMonths = isCompare ? getMonthsForPeriod(allRows, state.secondary) : null
  const compareLabel = isCompare ? getPeriodLabel(state.secondary) : null

  return { rows, months, label, isCompare, compareRows, compareMonths, compareLabel }
}
