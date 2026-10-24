import { expect, test } from 'vitest'
import { plural } from './plural'

const people = { one: 'člověk', few: 'lidé', other: 'lidí' }

test.each([
  [0, '0 lidí'],
  [1, '1 člověk'],
  [2, '2 lidé'],
  [3, '3 lidé'],
  [4, '4 lidé'],
  [5, '5 lidí'],
  [11, '11 lidí'],
  [21, '21 lidí'],
  [22, '22 lidí'],
])('%i → %s', (n, expected) => {
  expect(plural(n, people)).toBe(expected)
})
