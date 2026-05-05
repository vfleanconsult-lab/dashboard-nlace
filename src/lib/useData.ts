import { useState, useEffect } from 'react'
import { loadData, getState, type Row } from './data'

interface DataState {
  rows: Row[]
  years: string[]
  loading: boolean
  error: boolean
  errorDetail: unknown
  loadedAt: Date | null
}

export function useData(): DataState {
  const cached = getState()
  const [state, setState] = useState<DataState>({
    rows: cached.rows,
    years: cached.years,
    loading: !cached.loaded,
    error: false,
    errorDetail: null,
    loadedAt: cached.loadedAt,
  })

  useEffect(() => {
    if (cached.loaded) return
    loadData(
      (rows, years) => setState({ rows, years, loading: false, error: false, errorDetail: null, loadedAt: getState().loadedAt }),
      (err)         => setState(s => ({ ...s, loading: false, error: true, errorDetail: err })),
    )
  }, [])

  return state
}
