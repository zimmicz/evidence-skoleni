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

  test('future hire is booked only on a session before the start date', () => {
    const p = plan({
      ...base,
      employees: [employee('A', { startDate: '2026-11-01' }), employee('D', { startDate: '2026-10-05' })],
      completions: [],
    })
    expect(p.suggested.map((b) => [b.employeeId, b.sessionId])).toEqual([['A', 'S1']])
    expect(p.unplaceable.map((r) => [r.employeeId, r.status])).toEqual([['D', 'beforeStart']])
  })

  test('confirmation on a past or cancelled session is reported stale and not re-suggested', () => {
    const p = plan(
      {
        ...base,
        sessions: [...base.sessions, session('P', '2026-09-01', 10), session('X', '2026-10-12', 10, { status: 'zrušeno' })],
      },
      { confirmed: { 'A|KYBER': 'P', 'C|KYBER': 'X' }, dismissed: {} },
    )
    expect(p.stale).toEqual([
      { employeeId: 'A', code: 'KYBER', sessionId: 'P', reason: 'past' },
      { employeeId: 'C', code: 'KYBER', sessionId: 'X', reason: 'unavailable' },
    ])
    expect(p.confirmed).toEqual([])
    expect(p.suggested.map((b) => b.employeeId)).toEqual(['B'])
  })

  test('past confirmation is not stale once the completion is imported', () => {
    const p = plan(
      {
        ...base,
        completions: [...base.completions, completion('A', '2027-09-01')],
        sessions: [...base.sessions, session('P', '2026-09-01', 10)],
      },
      { confirmed: { 'A|KYBER': 'P' }, dismissed: {} },
    )
    expect(p.stale).toEqual([])
  })

  test('past confirmation fulfilled by a completion stays hidden after that completion starts expiring', () => {
    const p = plan(
      {
        ...base,
        completions: [{ ...completion('A', '2026-11-01'), date: '2026-09-01' }],
        sessions: [...base.sessions, session('P', '2026-09-01', 10)],
      },
      { confirmed: { 'A|KYBER': 'P' }, dismissed: {} },
    )
    expect(p.stale).toEqual([])
    expect(p.suggested.map((b) => b.employeeId)).toContain('A')
  })

  test('stale confirmation of a departed or inactive employee is not reported', () => {
    const p = plan(
      {
        ...base,
        employees: [employee('A', { endDate: '2026-09-30' }), employee('B', { status: 'ukončen' }), employee('C')],
        sessions: [...base.sessions, session('P', '2026-09-01', 10)],
      },
      { confirmed: { 'A|KYBER': 'P', 'B|KYBER': 'P' }, dismissed: {} },
    )
    expect(p.stale).toEqual([])
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

test('sample: E0095 starting 2. 11. 2026 is before start and never offered the February BOZP session', () => {
  const { dataset } = buildDataset(loadSample(), {}, REF)
  const compliance = evaluate(dataset, REF, 90)
  expect(compliance.get('E0095')?.requirements.find((r) => r.code === 'BOZP-Z')?.status).toBe('beforeStart')
  const p = planBookings(dataset, compliance, REF, { confirmed: {}, dismissed: {} })
  const booking = p.suggested.find((b) => b.employeeId === 'E0095' && b.code === 'BOZP-Z')
  const session = dataset.sessions.find((s) => s.id === booking?.sessionId)
  expect(!booking || (session && session.date <= '2026-11-02')).toBe(true)
})
