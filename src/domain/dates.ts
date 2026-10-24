export type IsoDate = string

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const DAY = 86_400_000

function iso(y: number, m: number, d: number): IsoDate | null {
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return t.toISOString().slice(0, 10)
}

export type ParsedDate = { ok: true; value: IsoDate; format: 'iso' | 'czech' | 'excel' } | { ok: false }

export function parseDate(raw: string): ParsedDate {
  const s = raw.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) {
    const v = iso(+m[1], +m[2], +m[3])
    return v ? { ok: true, value: v, format: 'iso' } : { ok: false }
  }
  m = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/.exec(s)
  if (m) {
    const v = iso(+m[3], +m[2], +m[1])
    return v ? { ok: true, value: v, format: 'czech' } : { ok: false }
  }
  m = /^(\d{5})$/.exec(s)
  if (m) {
    const v = new Date(EXCEL_EPOCH + +m[1] * DAY).toISOString().slice(0, 10)
    return { ok: true, value: v, format: 'excel' }
  }
  return { ok: false }
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10)
}

export function formatDate(date: IsoDate | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}
