import { expect, test } from 'vitest'
import { bookingKey } from './domain/booking'
import { empty, reducer } from './persisted'

const key = bookingKey('E1', 'BOZP')

test('import replaces only the imported file kinds', () => {
  const s = reducer(
    { ...empty(), files: { employees: { name: 'a.csv', text: 'a' } } },
    { type: 'import', files: [{ kind: 'sessions', name: 'b.csv', text: 'b' }] },
  )
  expect(s.files).toEqual({ employees: { name: 'a.csv', text: 'a' }, sessions: { name: 'b.csv', text: 'b' } })
})

test('resolve sets and clears a resolution', () => {
  const set = reducer(empty(), { type: 'resolve', id: 'x', resolution: { action: 'ignore' } })
  expect(set.resolutions).toEqual({ x: { action: 'ignore' } })
  expect(reducer(set, { type: 'resolve', id: 'x', resolution: null }).resolutions).toEqual({})
})

test('confirm, unconfirm and dismiss update booking state', () => {
  const confirmed = reducer(empty(), { type: 'confirm', employeeId: 'E1', code: 'BOZP', sessionId: 'T1' })
  expect(confirmed.booking.confirmed).toEqual({ [key]: 'T1' })
  expect(reducer(confirmed, { type: 'unconfirm', employeeId: 'E1', code: 'BOZP' }).booking.confirmed).toEqual({})

  const once = reducer(empty(), { type: 'dismiss', employeeId: 'E1', code: 'BOZP', sessionId: 'T1' })
  expect(reducer(once, { type: 'dismiss', employeeId: 'E1', code: 'BOZP', sessionId: 'T2' }).booking.dismissed).toEqual({
    [key]: ['T1', 'T2'],
  })
})

test('reset returns defaults', () => {
  const changed = reducer(reducer(empty(), { type: 'setWindowDays', days: 30 }), { type: 'setReferenceDate', date: '2027-01-01' })
  expect(changed).toMatchObject({ windowDays: 30, referenceDate: '2027-01-01' })
  expect(reducer(changed, { type: 'reset' })).toEqual(empty())
})
