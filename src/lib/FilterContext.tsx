import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type FilterState, type SinglePeriod, defaultPeriod } from './filter'

interface FilterContextValue {
  state:       FilterState
  setState:    (s: FilterState) => void
  initialize:  (years: string[]) => void
  initialized: boolean
}

const defaultSingle: SinglePeriod = { type: 'year', year: '', month: '', from: '', to: '' }

const defaultState: FilterState = {
  mode:      'single',
  primary:   defaultSingle,
  secondary: defaultSingle,
}

const FilterContext = createContext<FilterContextValue>({
  state:       defaultState,
  setState:    () => {},
  initialize:  () => {},
  initialized: false,
})

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState]         = useState<FilterState>(defaultState)
  const [initialized, setInit]    = useState(false)

  const initialize = useCallback((years: string[]) => {
    if (initialized || years.length === 0) return
    const latest = years[0]
    setState({
      mode:      'single',
      primary:   defaultPeriod(latest),
      secondary: defaultPeriod(years[1] ?? latest),
    })
    setInit(true)
  }, [initialized])

  return (
    <FilterContext.Provider value={{ state, setState, initialize, initialized }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilterContext() {
  return useContext(FilterContext)
}
