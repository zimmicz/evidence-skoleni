import { z } from 'zod'
import { bookingKey } from './domain/booking'
import type { LoadedFile } from './domain/csv'
import type { Resolution } from './domain/types'

const STORAGE_KEY = 'evidence-skoleni:v1'
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
export type Persisted = z.infer<typeof persistedSchema>

export type Action =
  | { type: 'import'; files: LoadedFile[] }
  | { type: 'resolve'; id: string; resolution: Resolution | null }
  | { type: 'confirm'; employeeId: string; code: string; sessionId: string }
  | { type: 'unconfirm'; employeeId: string; code: string }
  | { type: 'dismiss'; employeeId: string; code: string; sessionId: string }
  | { type: 'setReferenceDate'; date: string }
  | { type: 'setWindowDays'; days: number }
  | { type: 'reset' }

export const empty = (): Persisted => ({
  files: {},
  resolutions: {},
  booking: { confirmed: {}, dismissed: {} },
  referenceDate: DEFAULT_REFERENCE_DATE,
  windowDays: DEFAULT_WINDOW,
})

export function load(): Persisted {
  try {
    const parsed = persistedSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
    return parsed.success ? parsed.data : empty()
  } catch {
    return empty()
  }
}

export function save(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    return
  }
}

export function reducer(s: Persisted, action: Action): Persisted {
  switch (action.type) {
    case 'import':
      return { ...s, files: { ...s.files, ...Object.fromEntries(action.files.map((f) => [f.kind, { name: f.name, text: f.text }])) } }
    case 'resolve': {
      const resolutions = { ...s.resolutions }
      if (action.resolution) resolutions[action.id] = action.resolution
      else delete resolutions[action.id]
      return { ...s, resolutions }
    }
    case 'confirm':
      return {
        ...s,
        booking: { ...s.booking, confirmed: { ...s.booking.confirmed, [bookingKey(action.employeeId, action.code)]: action.sessionId } },
      }
    case 'unconfirm': {
      const confirmed = { ...s.booking.confirmed }
      delete confirmed[bookingKey(action.employeeId, action.code)]
      return { ...s, booking: { ...s.booking, confirmed } }
    }
    case 'dismiss': {
      const key = bookingKey(action.employeeId, action.code)
      return {
        ...s,
        booking: { ...s.booking, dismissed: { ...s.booking.dismissed, [key]: [...(s.booking.dismissed[key] ?? []), action.sessionId] } },
      }
    }
    case 'setReferenceDate':
      return { ...s, referenceDate: action.date }
    case 'setWindowDays':
      return { ...s, windowDays: action.days }
    case 'reset':
      return empty()
  }
}
