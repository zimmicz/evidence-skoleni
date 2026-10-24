import { addDays, type IsoDate } from './dates'
import type { Completion, Dataset, Employee, Training } from './types'

export type RequirementStatus = 'missing' | 'beforeStart' | 'expired' | 'expiring' | 'valid'

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  missing: 'nikdy neabsolvováno',
  beforeStart: 'před nástupem',
  expired: 'prošlé',
  expiring: 'končí',
  valid: 'platné',
}

export type Requirement = {
  employeeId: string
  code: string
  status: RequirementStatus
  completion: Completion | null
  validUntil: IsoDate | null
}

export type EmployeeCompliance = { requirements: Requirement[]; extra: Completion[] }

export function isRequired(employee: Employee, training: Training): boolean {
  const { rule } = training
  if (rule.kind === 'all') return true
  if (rule.kind === 'department') return !!employee.department && rule.values.includes(employee.department)
  if (rule.kind === 'position') return !!employee.position && rule.values.includes(employee.position)
  return false
}

const later = (a: Completion, b: Completion) => {
  if (a.validUntil === null) return a
  if (b.validUntil === null) return b
  return a.validUntil >= b.validUntil ? a : b
}

export function evaluate(dataset: Dataset, referenceDate: IsoDate, windowDays: number): Map<string, EmployeeCompliance> {
  const horizon = addDays(referenceDate, windowDays)
  const byEmployee = new Map<string, Completion[]>()
  for (const c of dataset.completions) byEmployee.set(c.employeeId, [...(byEmployee.get(c.employeeId) ?? []), c])

  const result = new Map<string, EmployeeCompliance>()
  for (const employee of dataset.employees) {
    const own = byEmployee.get(employee.id) ?? []
    const required = dataset.trainings.filter((t) => isRequired(employee, t))
    const requirements = required.map((t): Requirement => {
      const matching = own.filter((c) => c.code === t.code)
      const completion = matching.length ? matching.reduce(later) : null
      const validUntil = completion?.validUntil ?? null
      const status: RequirementStatus = !completion
        ? employee.startDate && employee.startDate > referenceDate
          ? 'beforeStart'
          : 'missing'
        : validUntil === null
          ? 'valid'
          : validUntil < referenceDate
            ? 'expired'
            : validUntil <= horizon
              ? 'expiring'
              : 'valid'
      return { employeeId: employee.id, code: t.code, status, completion, validUntil }
    })
    const requiredCodes = new Set(required.map((t) => t.code))
    result.set(employee.id, { requirements, extra: own.filter((c) => !requiredCodes.has(c.code)) })
  }
  return result
}
