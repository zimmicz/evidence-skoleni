import { describe, expect, test } from 'vitest'
import { addMonths, parseDate } from './dates'

describe('parseDate', () => {
  test.each([
    ['2019-01-06', '2019-01-06', 'iso'],
    ['1. 1. 1900', '1900-01-01', 'czech'],
    ['01.02.2019', '2019-02-01', 'czech'],
    [' 4. 12. 2026 ', '2026-12-04', 'czech'],
    ['43552', '2019-03-28', 'excel'],
  ])('%s → %s', (raw, value, format) => {
    expect(parseDate(raw)).toEqual({ ok: true, value, format })
  })

  test.each(['31. 9. 2026', '2026-02-30', '', 'datum', '12/03/2020'])('rejects %s', (raw) => {
    expect(parseDate(raw).ok).toBe(false)
  })
})

test('addMonths clamps to month end', () => {
  expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  expect(addMonths('2019-01-06', 24)).toBe('2021-01-06')
})
