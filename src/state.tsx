import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import employeesUrl from '../data/zamestnanci.csv?url'
import trainingsUrl from '../data/katalog_skoleni.csv?url'
import completionsUrl from '../data/absolvovana_skoleni.csv?url'
import sessionsUrl from '../data/terminy_skoleni.csv?url'
import { planBookings, type BookingPlan, type BookingState } from './domain/booking'
import { evaluate, type EmployeeCompliance } from './domain/compliance'
import { decode, detectKind, parseCsv, type LoadedFile } from './domain/csv'
import { buildDataset, type Resolutions, type Tables } from './domain/import'
import type { Dataset, FileKind, ImportReport, Resolution } from './domain/types'
import { load, reducer, save } from './persisted'

const SAMPLE_URLS: Record<FileKind, string> = {
  employees: employeesUrl,
  trainings: trainingsUrl,
  completions: completionsUrl,
  sessions: sessionsUrl,
}

async function fetchSamples(): Promise<Record<FileKind, string>> {
  const entries = await Promise.all(
    (Object.entries(SAMPLE_URLS) as [FileKind, string][]).map(async ([kind, url]) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Nepodařilo se načíst ukázková data (${response.status})`)
      return [kind, decode(await response.arrayBuffer())] as const
    }),
  )
  return Object.fromEntries(entries) as Record<FileKind, string>
}

type Store = {
  ready: boolean
  loadError: string | null
  dataset: Dataset
  report: ImportReport
  compliance: Map<string, EmployeeCompliance>
  plan: BookingPlan
  resolutions: Resolutions
  booking: BookingState
  referenceDate: string
  windowDays: number
  importFiles: (files: LoadedFile[]) => void
  resolve: (id: string, resolution: Resolution | null) => void
  confirm: (employeeId: string, code: string, sessionId: string) => void
  unconfirm: (employeeId: string, code: string) => void
  dismiss: (employeeId: string, code: string, sessionId: string) => void
  setReferenceDate: (date: string) => void
  setWindowDays: (days: number) => void
  reset: () => void
}

const StoreContext = createContext<Store | null>(null)

const emptyTables = (): Tables => ({
  employees: { header: [], rows: [] },
  trainings: { header: [], rows: [] },
  completions: { header: [], rows: [] },
  sessions: { header: [], rows: [] },
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const { data: samples, error } = useQuery({ queryKey: ['samples'], queryFn: fetchSamples, staleTime: Infinity })

  useEffect(() => save(state), [state])

  const tables = useMemo(() => {
    if (!samples) return emptyTables()
    const t = emptyTables()
    for (const kind of Object.keys(SAMPLE_URLS) as FileKind[]) {
      const table = parseCsv(state.files[kind]?.text ?? samples[kind])
      if (detectKind(table.header) === kind) t[kind] = table
    }
    return t
  }, [samples, state.files])

  const { dataset, report } = useMemo(
    () => buildDataset(tables, state.resolutions, state.referenceDate),
    [tables, state.resolutions, state.referenceDate],
  )
  const compliance = useMemo(
    () => evaluate(dataset, state.referenceDate, state.windowDays),
    [dataset, state.referenceDate, state.windowDays],
  )
  const plan = useMemo(
    () => planBookings(dataset, compliance, state.referenceDate, state.booking),
    [dataset, compliance, state.referenceDate, state.booking],
  )

  const store: Store = {
    ready: !!samples,
    loadError: error ? String(error) : null,
    dataset,
    report,
    compliance,
    plan,
    resolutions: state.resolutions,
    booking: state.booking,
    referenceDate: state.referenceDate,
    windowDays: state.windowDays,
    importFiles: (files) => dispatch({ type: 'import', files }),
    resolve: (id, resolution) => dispatch({ type: 'resolve', id, resolution }),
    confirm: (employeeId, code, sessionId) => dispatch({ type: 'confirm', employeeId, code, sessionId }),
    unconfirm: (employeeId, code) => dispatch({ type: 'unconfirm', employeeId, code }),
    dismiss: (employeeId, code, sessionId) => dispatch({ type: 'dismiss', employeeId, code, sessionId }),
    setReferenceDate: (date) => dispatch({ type: 'setReferenceDate', date }),
    setWindowDays: (days) => dispatch({ type: 'setWindowDays', days }),
    reset: () => dispatch({ type: 'reset' }),
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}
