import type { IsoDate } from './dates'

export type FileKind = 'employees' | 'trainings' | 'completions' | 'sessions'

export const FILE_LABELS: Record<FileKind, string> = {
  employees: 'zamestnanci.csv',
  trainings: 'katalog_skoleni.csv',
  completions: 'absolvovana_skoleni.csv',
  sessions: 'terminy_skoleni.csv',
}

export const EMPLOYMENT_STATUSES = ['aktivní', 'rodičovská', 'ukončen'] as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

export const SESSION_STATUSES = ['plánováno', 'zrušeno'] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export type Employee = {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string | null
  position: string | null
  managerEmail: string | null
  startDate: IsoDate | null
  endDate: IsoDate | null
  status: EmploymentStatus | null
  note: string
}

export type Rule =
  { kind: 'all' } | { kind: 'optional' } | { kind: 'department'; values: string[] } | { kind: 'position'; values: string[] }

export type Training = {
  code: string
  name: string
  months: number | null
  rule: Rule
}

export type Completion = {
  id: string
  employeeId: string
  code: string
  date: IsoDate
  validUntil: IsoDate | null
  provider: string
  price: number | null
  note: string
}

export type Session = {
  id: string
  code: string
  date: IsoDate
  time: string
  place: string
  capacity: number
  taken: number
  price: number | null
  status: SessionStatus
  blocked: string | null
}

export type Dataset = {
  employees: Employee[]
  trainings: Training[]
  completions: Completion[]
  sessions: Session[]
}

export type ResolutionAction = 'map' | 'exclude' | 'ignore'

export type MapTarget =
  { type: 'select'; options: { value: string; label: string }[] } | { type: 'date' } | { type: 'number' } | { type: 'email' }

export type Inconsistency = {
  id: string
  file: FileKind
  field: string
  value: string
  message: string
  rows: string[]
  actions: ResolutionAction[]
  target?: MapTarget
  suggestion?: string
}

export type Resolution = { action: 'map'; value: string } | { action: 'exclude' } | { action: 'ignore' }

export type Normalization = {
  file: FileKind
  row: string
  field: string
  from: string
  to: string
  rule: string
}

export type RejectedRow = {
  file: FileKind
  row: number
  reason: string
  raw: string
}

export type ImportReport = {
  normalizations: Normalization[]
  inconsistencies: Inconsistency[]
  rejected: RejectedRow[]
}
