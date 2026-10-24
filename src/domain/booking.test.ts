import { describe, expect, test } from 'vitest'
import { planBookings } from './booking'
import { evaluate } from './compliance'
import { loadSample } from './fixtures'
import { buildDataset } from './import'
import type { Dataset, Employee, Session } from './types'

const REF = '2026-10-01'

const employee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
  id,
  firstName: id,
  lastName: id,
  email: `${id}@x.example`,
  department: 'IT',
  position: 'Specialista',
  managerEmail: null,
  startDate: '2020-01-01',
  endDate: null,
  status: 'aktivní',
  note: '',
  ...overrides,
})

const session = (id: string, date: string, capacity: number, overrides: Partial<Session> = {}): Session => ({
  id,
  code: 'KYBER',
  date,
  time: '9:00',
  place: 'A',
  capacity,
  taken: 0,
  price: null,
  status: 'plánováno',
  blocked: null,
  ...overrides,
})

const completion = (employeeId: string, validUntil: string) => ({
  id: `Z-${employeeId}`,
  employeeId,
  code: 'KYBER',
  date: '2025-01-01',
  validUntil,
  provider: '',
  price: null,
  note: '',
})

function plan(dataset: Dataset, state = { confirmed: {}, dismissed: {} }) {
  return planBookings(dataset, evaluate(dataset, REF, 90), REF, state)
}

const base: Dataset = {
  employees: [employee('A'), employee('B'), employee('C')],
  trainings: [{ code: 'KYBER', name: 'Kyber', months: 12, rule: { kind: 'all' } }],
  completions: [completion('B', '2026-11-15'), completion('C', '2026-10-20')],
  sessions: [session('S1', '2026-10-10', 1), session('S2', '2026-12-01', 5)],
}

describe('planBookings', () => {
  test('missing first, then expiring by nearest Valid until', () => {
    const p = plan(base)
    expect(p.suggested.map((b) => [b.employeeId, b.sessionId, b.late])).toEqual([
      ['A', 'S1', false],
      ['C', 'S2', true],
      ['B', 'S2', true],
    ])
  })

  test('confirmed booking takes a seat and stays fixed', () => {
    const p = plan(base, { confirmed: { 'C|KYBER': 'S1' }, dismissed: {} })
    expect(p.confirmed).toEqual([{ employeeId: 'C', code: 'KYBER', sessionId: 'S1', late: false }])
    expect(p.suggested.find((s) => s.employeeId === 'A')?.sessionId).toBe('S2')
  })

  test('dismissed session is not suggested again', () => {
    const p = plan(base, { confirmed: {}, dismissed: { 'A|KYBER': ['S1'] } })
    expect(p.suggested.find((s) => s.employeeId === 'A')?.sessionId).toBe('S2')
  })

  test('parental leave, terminated and leaving employees are handled', () => {
    const p = plan({
      ...base,
      employees: [employee('A', { status: 'rodičovská' }), employee('B', { status: 'ukončen' }), employee('C', { endDate: '2026-10-05' })],
    })
    expect(p.suggested.map((b) => b.employeeId)).toEqual([])
    expect(p.unplaceable.map((r) => r.employeeId)).toEqual(['C'])
  })

  test('cancelled, blocked and past sessions are not offered', () => {
    const p = plan({
      ...base,
      sessions: [
        session('P', '2026-09-01', 10),
        session('X', '2026-10-10', 10, { status: 'zrušeno' }),
        session('Y', '2026-10-11', 10, { blocked: 'Přeplněno' }),
      ],
    })
    expect(p.suggested).toEqual([])
    expect(p.unplaceable).toHaveLength(3)
  })
})

test('sample: the only October BOZP seat goes to a missing BOZP, expiring ones wait for February', () => {
  const { dataset } = buildDataset(loadSample(), {}, REF)
  const compliance = evaluate(dataset, REF, 90)
  const p = planBookings(dataset, compliance, REF, { confirmed: {}, dismissed: {} })
  const bozp = p.suggested.filter((b) => b.code === 'BOZP-Z')
  const october = bozp.filter((b) => b.sessionId === 'T015')
  expect(october).toHaveLength(1)
  const status = (id: string) => compliance.get(id)?.requirements.find((r) => r.code === 'BOZP-Z')?.status
  expect(status(october[0].employeeId)).toBe('missing')
  expect(bozp.some((b) => b.sessionId === 'T018' && b.late && status(b.employeeId) === 'expiring')).toBe(true)
  expect(p.suggested.some((b) => ['T016', 'T017', 'T026', 'T030', 'T009', 'T008'].includes(b.sessionId))).toBe(false)
})
