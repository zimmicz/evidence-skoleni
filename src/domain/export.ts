export function escapeCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(escapeCell).join(';')).join('\r\n')
}
