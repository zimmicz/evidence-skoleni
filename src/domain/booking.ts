import type { IsoDate } from './dates'
import type { EmployeeCompliance, Requirement, RequirementStatus } from './compliance'
import type { Dataset, Session } from './types'

export type BookingState = {
  confirmed: Record<string, string>
  dismissed: Record<string, string[]>
}

const isLate = (deadline: IsoDate | null, date: IsoDate) => !!deadline && date > deadline

export const bookingKey = (employeeId: string, code: string) => `${employeeId}|${code}`

export type Booking = { employeeId: string; code: string; sessionId: string; late: boolean }

export type BookingPlan = {
  suggested: Booking[]
  confirmed: Booking[]
  unplaceable: Requirement[]
  free: Map<string, number>
  offered: Session[]
}

const RANK: Record<RequirementStatus, number> = { missing: 0, beforeStart: 1, expired: 2, expiring: 3, valid: 4 }

export function planBookings(
  dataset: Dataset,
  compliance: Map<string, EmployeeCompliance>,
  referenceDate: IsoDate,
  state: BookingState,
): BookingPlan {
  const offered = dataset.sessions
    .filter((s) => s.status === 'plánováno' && !s.blocked && s.date >= referenceDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const free = new Map(offered.map((s) => [s.id, Math.max(0, s.capacity - s.taken)]))
  const employees = new Map(dataset.employees.map((e) => [e.id, e]))
  const deadline = (r: Requirement) => (r.status === 'beforeStart' ? (employees.get(r.employeeId)?.startDate ?? null) : r.validUntil)

  const confirmed: Booking[] = []
  for (const [key, sessionId] of Object.entries(state.confirmed)) {
    const [employeeId, code] = key.split('|')
    const session = offered.find((s) => s.id === sessionId && s.code === code)
    const requirement = compliance.get(employeeId)?.requirements.find((r) => r.code === code)
    if (!session || !requirement || !employees.has(employeeId)) continue
    free.set(sessionId, (free.get(sessionId) ?? 0) - 1)
    confirmed.push({ employeeId, code, sessionId, late: isLate(deadline(requirement), session.date) })
  }
  const confirmedKeys = new Set(confirmed.map((b) => bookingKey(b.employeeId, b.code)))

  const candidates = [...compliance.values()]
    .flatMap((c) => c.requirements)
    .filter((r) => {
      const e = employees.get(r.employeeId)
      return (
        r.status !== 'valid' &&
        e?.status === 'aktivní' &&
        (!e.endDate || e.endDate > referenceDate) &&
        !confirmedKeys.has(bookingKey(r.employeeId, r.code))
      )
    })
    .sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] ||
        (deadline(a) ?? '').localeCompare(deadline(b) ?? '') ||
        a.employeeId.localeCompare(b.employeeId) ||
        a.code.localeCompare(b.code),
    )

  const suggested: Booking[] = []
  const unplaceable: Requirement[] = []
  for (const r of candidates) {
    const endDate = employees.get(r.employeeId)?.endDate
    const dismissed = state.dismissed[bookingKey(r.employeeId, r.code)] ?? []
    const eligible = offered.filter(
      (s) =>
        s.code === r.code &&
        (free.get(s.id) ?? 0) > 0 &&
        !dismissed.includes(s.id) &&
        (!endDate || s.date < endDate) &&
        (r.status !== 'beforeStart' || !isLate(deadline(r), s.date)),
    )
    const session = eligible[0]
    if (!session) {
      unplaceable.push(r)
      continue
    }
    free.set(session.id, (free.get(session.id) ?? 0) - 1)
    suggested.push({ employeeId: r.employeeId, code: r.code, sessionId: session.id, late: isLate(deadline(r), session.date) })
  }
  return { suggested, confirmed, unplaceable, free, offered }
}
