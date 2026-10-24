import { expect, test } from 'vitest'
import { buildAgenda } from './agenda'
import { planBookings } from './booking'
import { evaluate } from './compliance'
import { loadSample } from './fixtures'
import { buildDataset } from './import'

const REF = '2026-10-01'

function agenda(confirmed: Record<string, string> = {}) {
  const { dataset, report } = buildDataset(loadSample(), {}, REF)
  const plan = planBookings(dataset, evaluate(dataset, REF, 90), REF, { confirmed, dismissed: {} })
  return { tasks: buildAgenda(dataset, plan, report.inconsistencies.length, REF), plan }
}

test('sample agenda: data first, then sessions within two weeks, then the rest', () => {
  const { tasks } = agenda()
  const ids = tasks.map((t) => t.id)
  expect(ids[0]).toBe('data')
  expect(ids).toContain('confirm:T015')
  expect(ids).toContain('confirm:later')
  expect(ids).toContain('late:BOZP-Z')
  expect(ids.indexOf('confirm:T015')).toBeLessThan(ids.indexOf('confirm:later'))
  expect(tasks.filter((t) => t.priority === 'high').every((t) => ids.indexOf(t.id) < ids.indexOf('confirm:later'))).toBe(true)
})

test('confirmation on a cancelled session becomes a high priority task', () => {
  const employeeId = agenda().plan.suggested.find((b) => b.code === 'BOZP-Z')!.employeeId
  const { tasks } = agenda({ [`${employeeId}|BOZP-Z`]: 'T017' })
  expect(tasks.find((t) => t.id === 'stale')).toMatchObject({ priority: 'high', link: '/sessions' })
})

test('confirming all suggestions clears the confirm task', () => {
  const first = agenda().plan.suggested.find((b) => b.sessionId === 'T015')!
  const { tasks } = agenda({ [`${first.employeeId}|${first.code}`]: 'T015' })
  const ids = tasks.map((t) => t.id)
  expect(ids).not.toContain('confirm:T015')
  expect(ids.some((id) => id.includes('T015'))).toBe(false)
})
