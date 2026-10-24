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

test('confirming the suggestion turns the task into an invitation reminder', () => {
  const first = agenda().plan.suggested.find((b) => b.sessionId === 'T015')!
  const { tasks } = agenda({ [`${first.employeeId}|${first.code}`]: 'T015' })
  const ids = tasks.map((t) => t.id)
  expect(ids).not.toContain('confirm:T015')
  expect(ids).toContain('notify:T015')
})
