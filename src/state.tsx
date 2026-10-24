import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { z } from 'zod'
import employeesUrl from '../data/zamestnanci.csv?url'
import trainingsUrl from '../data/katalog_skoleni.csv?url'
import completionsUrl from '../data/absolvovana_skoleni.csv?url'
import sessionsUrl from '../data/terminy_skoleni.csv?url'
import { bookingKey, planBookings, type BookingPlan, type BookingState } from './domain/booking'
import { evaluate, type EmployeeCompliance } from './domain/compliance'
import { decode, detectKind, parseCsv, type LoadedFile } from './domain/csv'
import { buildDataset, type Resolutions, type Tables } from './domain/import'
import type { Dataset, FileKind, ImportReport, Resolution } from './domain/types'

const STORAGE_KEY = 'evidence-skoleni:v1'
const SAMPLE_URLS: Record<FileKind, string> = {
  employees: employeesUrl,
  trainings: trainingsUrl,
  completions: completionsUrl,
  sessions: sessionsUrl,
}
const DEFAULT_REFERENCE_DATE = '2026-10-01'
const DEFAULT_WINDOW = 90

const fileKind = z.enum(['employees', 'trainings', 'completions', 'sessions'])
const resolution = z.discriminatedUnion('action', [
  z.object({ action: z.literal('map'), value: z.string() }),
  z.object({ action: z.literal('exclude') }),
  z.object({ action: z.literal('ignore') }),
])
const persistedSchema = z.object({
  files: z.partialRecord(fileKind, z.object({ name: z.string(), text: z.string() })),
  resolutions: z.record(z.string(), resolution),
  booking: z.object({
    confirmed: z.record(z.string(), z.string()),
    dismissed: z.record(z.string(), z.array(z.string())),
  }),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowDays: z.number().int().min(0).max(3650),
})
type Persisted = z.infer<typeof persistedSchema>

const empty = (): Persisted => ({
  files: {},
  resolutions: {},
  booking: { confirmed: {}, dismissed: {} },
  referenceDate: DEFAULT_REFERENCE_DATE,
  windowDays: DEFAULT_WINDOW,
})

function save(state: Persisted): Persisted {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    return state
  }
  return state
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

function load(): Persisted {
  try {
    const parsed = persistedSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
    return parsed.success ? parsed.data : empty()
  } catch {
    return empty()
  }
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
  summaryOpen: boolean
  setSummaryOpen: (open: boolean) => void
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
  const [state, setState] = useState<Persisted>(load)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const { data: samples, error } = useQuery({ queryKey: ['samples'], queryFn: fetchSamples, staleTime: Infinity })

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

  const update = useCallback((fn: (s: Persisted) => Persisted) => setState((s) => save(fn(s))), [])

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
    summaryOpen,
    setSummaryOpen,
    importFiles: (files) => {
      update((s) => ({ ...s, files: { ...s.files, ...Object.fromEntries(files.map((f) => [f.kind, { name: f.name, text: f.text }])) } }))
      setSummaryOpen(true)
    },
    resolve: (id, r) =>
      update((s) => {
        const resolutions = { ...s.resolutions }
        if (r) resolutions[id] = r
        else delete resolutions[id]
        return { ...s, resolutions }
      }),
    confirm: (employeeId, code, sessionId) =>
      update((s) => ({
        ...s,
        booking: { ...s.booking, confirmed: { ...s.booking.confirmed, [bookingKey(employeeId, code)]: sessionId } },
      })),
    unconfirm: (employeeId, code) =>
      update((s) => {
        const confirmed = { ...s.booking.confirmed }
        delete confirmed[bookingKey(employeeId, code)]
        return { ...s, booking: { ...s.booking, confirmed } }
      }),
    dismiss: (employeeId, code, sessionId) =>
      update((s) => {
        const key = bookingKey(employeeId, code)
        return {
          ...s,
          booking: { ...s.booking, dismissed: { ...s.booking.dismissed, [key]: [...(s.booking.dismissed[key] ?? []), sessionId] } },
        }
      }),
    setReferenceDate: (referenceDate) => update((s) => ({ ...s, referenceDate })),
    setWindowDays: (windowDays) => update((s) => ({ ...s, windowDays })),
    reset: () => {
      setState(save(empty()))
      setSummaryOpen(true)
    },
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}
