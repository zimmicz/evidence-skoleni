import { expect, test } from 'vitest'
import { escapeCell, toCsv } from './export'

test.each([
  ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
  ['+1+1', "'+1+1"],
  ['-2+3', "'-2+3"],
  ['@SUM(1+1)', "'@SUM(1+1)"],
  ['Novák; Jan', '"Novák; Jan"'],
  ['plain', 'plain'],
])('escapeCell(%s)', (input, output) => {
  expect(escapeCell(input)).toBe(output)
})

test('toCsv adds BOM and uses semicolons', () => {
  expect(
    toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ]),
  ).toBe('﻿a;b\r\nc;d')
})
