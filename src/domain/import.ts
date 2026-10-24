import { HEADERS, type CsvTable } from './csv'
import { addMonths, parseDate, type IsoDate } from './dates'
import {
  EMPLOYMENT_STATUSES,
  SESSION_STATUSES,
  type Completion,
  type Dataset,
  type Employee,
  type EmploymentStatus,
  type FileKind,
  type ImportReport,
  type Inconsistency,
  type MapTarget,
  type Normalization,
  type RejectedRow,
  type Resolution,
  type Rule,
  type Session,
  type SessionStatus,
  type Training,
} from './types'

export type Resolutions = Record<string, Resolution>
export type Tables = Record<FileKind, CsvTable>

export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')

const collapse = (s: string) => s.trim().replace(/\s+/g, ' ')

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

class Context {
  normalizations: Normalization[] = []
  issues = new Map<string, Inconsistency>()
  rejected: RejectedRow[] = []
  private resolutions: Resolutions
  constructor(resolutions: Resolutions) {
    this.resolutions = resolutions
  }

  normalize(file: FileKind, row: string, field: string, from: string, to: string, rule: string) {
    if (from !== to) this.normalizations.push({ file, row, field, from, to, rule })
  }

  flag(issue: Omit<Inconsistency, 'rows'>, row: string): Resolution | undefined {
    const existing = this.issues.get(issue.id)
    if (existing) existing.rows.push(row)
    else this.issues.set(issue.id, { ...issue, rows: [row] })
    const resolution = this.resolutions[issue.id]
    return resolution && issue.actions.includes(resolution.action) ? resolution : undefined
  }
}

type Row = { key: string; get: (field: string) => string }

function readRows(file: FileKind, table: CsvTable, ctx: Context, keyPattern: RegExp): Row[] {
  const header = HEADERS[file]
  const seen = new Set<string>()
  const rows: Row[] = []
  table.rows.forEach((cells, index) => {
    const reject = (reason: string) => ctx.rejected.push({ file, row: index + 2, reason, raw: cells.join(' | ').slice(0, 300) })
    if (cells.length !== header.length) return reject(`Nesprávný počet sloupců (${cells.length} místo ${header.length})`)
    if (cells.filter((c, i) => c.trim() === header[i]).length >= header.length / 2) return reject('Opakovaná hlavička')
    const rawKey = cells[0]
    const key = rawKey.trim().toUpperCase()
    if (!key) return reject('Chybí identifikátor')
    if (!keyPattern.test(key)) return reject(`Neplatný identifikátor „${rawKey}“`)
    if (seen.has(key)) return reject(`Duplicitní identifikátor ${key}`)
    seen.add(key)
    ctx.normalize(file, key, header[0], rawKey, key, 'Mezery a velikost písmen v kódu')
    rows.push({ key, get: (field) => cells[header.indexOf(field)] ?? '' })
  })
  return rows
}

type Vocabulary = {
  canonical: string[]
  classify: (value: string) => { kind: 'ok' } | { kind: 'case'; to: string } | { kind: 'unknown'; suggestion?: string }
}

function vocabulary(values: string[]): Vocabulary {
  const groups = new Map<string, Map<string, number>>()
  for (const v of values) {
    if (!v) continue
    const g = groups.get(fold(v)) ?? new Map<string, number>()
    g.set(v, (g.get(v) ?? 0) + 1)
    groups.set(fold(v), g)
  }
  const canonicalOf = new Map<string, string>()
  for (const [f, g] of groups) {
    const total = [...g.values()].reduce((a, b) => a + b, 0)
    if (total < 2) continue
    const best = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0]
    canonicalOf.set(f, best)
  }
  const canonical = [...canonicalOf.values()].sort((a, b) => a.localeCompare(b, 'cs'))
  return {
    canonical,
    classify(value) {
      const f = fold(value)
      const c = canonicalOf.get(f)
      if (c === undefined) {
        const suggestion = canonical.find((x) => fold(x).startsWith(f) || f.startsWith(fold(x)))
        return { kind: 'unknown', suggestion }
      }
      if (c === value) return { kind: 'ok' }
      if (c.toLocaleLowerCase('cs') === value.toLocaleLowerCase('cs')) return { kind: 'case', to: c }
      return { kind: 'unknown', suggestion: c }
    },
  }
}

const select = (values: string[]): MapTarget => ({ type: 'select', options: values.map((v) => ({ value: v, label: v })) })

function fixNameCase(name: string): string {
  const c = collapse(name)
  if (c.length > 1 && (c === c.toLocaleUpperCase('cs') || c === c.toLocaleLowerCase('cs')))
    return c
      .toLocaleLowerCase('cs')
      .split(' ')
      .map((w) => w.charAt(0).toLocaleUpperCase('cs') + w.slice(1))
      .join(' ')
  return c
}

const cleanEmail = (s: string) => s.replace(/\s+/g, '').toLowerCase()
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/

type DateField = { value: IsoDate | null; invalid: boolean }

function readDate(ctx: Context, file: FileKind, row: string, field: string, raw: string): DateField {
  const parsed = parseDate(raw)
  if (parsed.ok) {
    if (parsed.format === 'excel') ctx.normalize(file, row, field, raw, parsed.value, 'Datum jako číslo z Excelu')
    else if (parsed.format === 'czech') ctx.normalize(file, row, field, raw, parsed.value, 'Český formát data')
    return { value: parsed.value, invalid: false }
  }
  return { value: null, invalid: true }
}

function readEmployees(rows: Row[], ctx: Context, referenceDate: IsoDate) {
  const file: FileKind = 'employees'
  const departments = vocabulary(rows.map((r) => collapse(r.get('utvar'))))
  const positions = vocabulary(rows.map((r) => collapse(r.get('pozice'))))
  const employees: Employee[] = []
  const excluded = new Set<string>()

  const classified = (row: string, field: string, raw: string, vocab: Vocabulary, label: string): string | null => {
    const value = collapse(raw)
    ctx.normalize(file, row, field, raw, value, 'Nadbytečné mezery')
    if (!value) {
      const r = ctx.flag(
        {
          id: `${file}:${field}:`,
          file,
          field,
          value: '',
          message: `Chybí ${label}`,
          actions: ['map', 'ignore'],
          target: select(vocab.canonical),
        },
        row,
      )
      return r?.action === 'map' ? r.value : null
    }
    const c = vocab.classify(value)
    if (c.kind === 'ok') return value
    if (c.kind === 'case') {
      ctx.normalize(file, row, field, value, c.to, 'Velikost písmen')
      return c.to
    }
    const r = ctx.flag(
      {
        id: `${file}:${field}:${value}`,
        file,
        field,
        value,
        message: `Neznámý ${label} (překlep, chybí diakritika nebo jediný výskyt)`,
        actions: ['map', 'ignore'],
        target: select(vocab.canonical),
        suggestion: c.suggestion,
      },
      row,
    )
    if (r?.action === 'map') return r.value
    return value
  }

  for (const row of rows) {
    const id = row.key
    const firstName = fixNameCase(row.get('jmeno'))
    const lastName = fixNameCase(row.get('prijmeni'))
    ctx.normalize(file, id, 'jmeno', row.get('jmeno'), firstName, 'Mezery a velikost písmen ve jméně')
    ctx.normalize(file, id, 'prijmeni', row.get('prijmeni'), lastName, 'Mezery a velikost písmen ve jméně')
    if (!firstName || !lastName) {
      const r = ctx.flag(
        {
          id: `${file}:jmeno:${id}`,
          file,
          field: 'jmeno',
          value: `${firstName} ${lastName}`,
          message: 'Chybí jméno nebo příjmení',
          actions: ['ignore', 'exclude'],
        },
        id,
      )
      if (r?.action === 'exclude') {
        excluded.add(id)
        continue
      }
    }

    const rawEmail = row.get('email')
    let email = cleanEmail(rawEmail)
    ctx.normalize(file, id, 'email', rawEmail, email, 'Mezery a velká písmena v e-mailu')
    if (!EMAIL.test(email)) {
      const r = ctx.flag(
        {
          id: `${file}:email:${id}`,
          file,
          field: 'email',
          value: rawEmail,
          message: 'Neplatný e-mail',
          actions: ['map', 'ignore', 'exclude'],
          target: { type: 'email' },
        },
        id,
      )
      if (r?.action === 'exclude') {
        excluded.add(id)
        continue
      }
      if (r?.action === 'map') email = r.value
    }

    const department = classified(id, 'utvar', row.get('utvar'), departments, 'útvar')
    const position = classified(id, 'pozice', row.get('pozice'), positions, 'pozice')

    const start = readDate(ctx, file, id, 'datum_nastupu', row.get('datum_nastupu'))
    let startDate = start.value
    if (start.invalid) {
      const r = ctx.flag(
        {
          id: `${file}:datum_nastupu:${id}`,
          file,
          field: 'datum_nastupu',
          value: row.get('datum_nastupu'),
          message: 'Neplatné datum nástupu',
          actions: ['map', 'ignore'],
          target: { type: 'date' },
        },
        id,
      )
      startDate = r?.action === 'map' ? r.value : null
    }
    let endDate: IsoDate | null = null
    if (row.get('datum_ukonceni').trim()) {
      const end = readDate(ctx, file, id, 'datum_ukonceni', row.get('datum_ukonceni'))
      endDate = end.value
      if (end.invalid) {
        const r = ctx.flag(
          {
            id: `${file}:datum_ukonceni:${id}`,
            file,
            field: 'datum_ukonceni',
            value: row.get('datum_ukonceni'),
            message: 'Neplatné datum ukončení',
            actions: ['map', 'ignore'],
            target: { type: 'date' },
          },
          id,
        )
        endDate = r?.action === 'map' ? r.value : null
      }
    }
    if (startDate && endDate && endDate < startDate) {
      const r = ctx.flag(
        {
          id: `${file}:konec-pred-nastupem:${id}`,
          file,
          field: 'datum_ukonceni',
          value: endDate,
          message: 'Ukončení je dříve než nástup',
          actions: ['map', 'ignore'],
          target: { type: 'date' },
        },
        id,
      )
      if (r?.action === 'map') endDate = r.value
    }

    const rawStatus = row.get('stav')
    let status: EmploymentStatus | null = EMPLOYMENT_STATUSES.find((s) => fold(s) === fold(rawStatus)) ?? null
    if (status) ctx.normalize(file, id, 'stav', rawStatus, status, 'Mezery a velikost písmen')
    else {
      const r = ctx.flag(
        {
          id: `${file}:stav:${collapse(rawStatus)}`,
          file,
          field: 'stav',
          value: rawStatus,
          message: rawStatus.trim() ? 'Neznámý stav zaměstnance' : 'Chybí stav zaměstnance',
          actions: ['map', 'exclude'],
          target: select([...EMPLOYMENT_STATUSES]),
        },
        id,
      )
      if (r?.action === 'exclude') {
        excluded.add(id)
        continue
      }
      status = r?.action === 'map' ? (r.value as EmploymentStatus) : null
    }
    if (status === 'aktivní' && endDate && endDate <= referenceDate) {
      const r = ctx.flag(
        {
          id: `${file}:aktivni-po-ukonceni:${id}`,
          file,
          field: 'stav',
          value: `aktivní, ukončen ${endDate}`,
          message: 'Aktivní zaměstnanec s datem ukončení k referenčnímu datu',
          actions: ['map', 'ignore'],
          target: select([...EMPLOYMENT_STATUSES]),
          suggestion: 'ukončen',
        },
        id,
      )
      if (r?.action === 'map') status = r.value as EmploymentStatus
    }

    employees.push({
      id,
      firstName,
      lastName,
      email,
      department,
      position,
      managerEmail: cleanEmail(row.get('vedouci_email')) || null,
      startDate,
      endDate,
      status,
      note: row.get('poznamka').trim(),
    })
  }

  const byEmail = new Map<string, Employee[]>()
  for (const e of employees) byEmail.set(e.email, [...(byEmail.get(e.email) ?? []), e])
  const alias = new Map<string, string>()
  for (const group of byEmail.values()) {
    if (group.length < 2) continue
    const [first, ...rest] = [...group].sort((a, b) => a.id.localeCompare(b.id))
    for (const dup of rest) {
      const r = ctx.flag(
        {
          id: `${file}:duplicita:${dup.id}`,
          file,
          field: 'email',
          value: `${dup.id} ${dup.lastName} ${dup.firstName}`,
          message: `Stejný e-mail jako ${first.id} ${first.lastName} ${first.firstName} – pravděpodobně duplicitní záznam`,
          actions: ['map', 'exclude', 'ignore'],
          target: { type: 'select', options: [{ value: first.id, label: `Sloučit do ${first.id} ${first.lastName} ${first.firstName}` }] },
          suggestion: first.id,
        },
        dup.id,
      )
      if (r?.action === 'map') alias.set(dup.id, r.value)
      if (r?.action === 'map' || r?.action === 'exclude') excluded.add(dup.id)
    }
  }

  const kept = employees.filter((e) => !excluded.has(e.id))
  const emails = new Set(kept.map((e) => e.email))
  const managerOptions: MapTarget = {
    type: 'select',
    options: kept
      .filter((e) => e.position === 'Vedoucí')
      .map((e) => ({ value: e.email, label: `${e.lastName} ${e.firstName} (${e.email})` })),
  }
  for (const e of kept) {
    if (!e.managerEmail || emails.has(e.managerEmail)) continue
    const r = ctx.flag(
      {
        id: `${file}:vedouci_email:${e.managerEmail}`,
        file,
        field: 'vedouci_email',
        value: e.managerEmail,
        message: 'Vedoucí s tímto e-mailem není v seznamu zaměstnanců',
        actions: ['map', 'ignore'],
        target: managerOptions,
      },
      e.id,
    )
    e.managerEmail = r?.action === 'map' ? r.value : null
  }

  return { employees: kept, allIds: new Set(rows.map((r) => r.key)), alias, departments, positions }
}

function readTrainings(rows: Row[], ctx: Context, departments: Vocabulary, positions: Vocabulary): Training[] {
  const file: FileKind = 'trainings'
  const trainings: Training[] = []
  for (const row of rows) {
    const code = row.key
    const name = collapse(row.get('nazev'))
    const rawMonths = row.get('platnost_mesicu').trim()
    let months: number | null = null
    const years = /^(\d+)\s*(rok|roky|let)$/i.exec(rawMonths)
    if (/^\d+$/.test(rawMonths)) months = +rawMonths
    else if (years) {
      months = +years[1] * 12
      ctx.normalize(file, code, 'platnost_mesicu', rawMonths, String(months), 'Platnost v letech převedena na měsíce')
    } else if (rawMonths) {
      const r = ctx.flag(
        {
          id: `${file}:platnost_mesicu:${code}`,
          file,
          field: 'platnost_mesicu',
          value: rawMonths,
          message: 'Neplatná doba platnosti',
          actions: ['map', 'exclude'],
          target: { type: 'number' },
        },
        code,
      )
      if (r?.action !== 'map') continue
      months = +r.value
    }

    const rawRule = collapse(row.get('povinne_pro'))
    const m = /^(UTVAR|POZICE):(.+)$/i.exec(rawRule)
    let rule: Rule
    if (fold(rawRule) === 'vsichni') rule = { kind: 'all' }
    else if (fold(rawRule) === 'nepovinne') rule = { kind: 'optional' }
    else if (m) {
      const isDepartment = m[1].toUpperCase() === 'UTVAR'
      const vocab = isDepartment ? departments : positions
      const values = m[2]
        .split(';')
        .map(collapse)
        .filter(Boolean)
        .map((v) => {
          const c = vocab.classify(v)
          if (c.kind === 'ok') return v
          if (c.kind === 'case') return c.to
          const r = ctx.flag(
            {
              id: `${file}:povinne_pro:${v}`,
              file,
              field: 'povinne_pro',
              value: v,
              message: `${isDepartment ? 'Útvar' : 'Pozice'} v pravidle neodpovídá žádnému zaměstnanci`,
              actions: ['map', 'ignore'],
              target: select(vocab.canonical),
              suggestion: c.suggestion,
            },
            code,
          )
          return r?.action === 'map' ? r.value : v
        })
      rule = isDepartment ? { kind: 'department', values } : { kind: 'position', values }
    } else {
      const r = ctx.flag(
        {
          id: `${file}:povinne_pro-format:${code}`,
          file,
          field: 'povinne_pro',
          value: rawRule,
          message: 'Neplatné pravidlo povinnosti',
          actions: ['ignore', 'exclude'],
        },
        code,
      )
      if (r?.action !== 'ignore') continue
      rule = { kind: 'optional' }
    }
    trainings.push({ code, name, months, rule })
  }
  return trainings
}

function codeSuggestion(value: string, codes: string[]): string | undefined {
  const bare = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const same = codes.find((c) => bare(c) === bare(value))
  if (same) return same
  const ranked = codes.map((c) => ({ c, d: levenshtein(c, value) })).sort((a, b) => a.d - b.d)
  return ranked[0] && ranked[0].d <= 2 ? ranked[0].c : undefined
}

function readCode(ctx: Context, file: FileKind, row: string, raw: string, codes: string[]): string | null | 'exclude' {
  const code = raw.trim().toUpperCase()
  ctx.normalize(file, row, 'kod_skoleni', raw, code, 'Mezery a velikost písmen v kódu')
  if (codes.includes(code)) return code
  const r = ctx.flag(
    {
      id: `${file}:kod_skoleni:${code}`,
      file,
      field: 'kod_skoleni',
      value: code,
      message: code ? 'Kód školení není v katalogu' : 'Chybí kód školení',
      actions: ['map', 'exclude'],
      target: select(codes),
      suggestion: codeSuggestion(code, codes),
    },
    row,
  )
  if (r?.action === 'map') return r.value
  return r?.action === 'exclude' ? 'exclude' : null
}

function readCompletions(
  rows: Row[],
  ctx: Context,
  referenceDate: IsoDate,
  employees: { employees: Employee[]; allIds: Set<string>; alias: Map<string, string> },
  trainings: Training[],
  catalogCodes: string[],
): Completion[] {
  const file: FileKind = 'completions'
  const byId = new Map(employees.employees.map((e) => [e.id, e]))
  const employeeOptions: MapTarget = {
    type: 'select',
    options: employees.employees.map((e) => ({ value: e.id, label: `${e.id} ${e.lastName} ${e.firstName}` })),
  }
  const completions: Completion[] = []
  const seen = new Map<string, string>()

  for (const row of rows) {
    const id = row.key
    const rawEmployee = row.get('id_zamestnance')
    let employeeId = rawEmployee.trim().toUpperCase()
    ctx.normalize(file, id, 'id_zamestnance', rawEmployee, employeeId, 'Mezery a velikost písmen v kódu')
    if (!employees.allIds.has(employeeId)) {
      const r = ctx.flag(
        {
          id: `${file}:id_zamestnance:${employeeId}`,
          file,
          field: 'id_zamestnance',
          value: employeeId,
          message: 'Zaměstnanec není v seznamu zaměstnanců',
          actions: ['map', 'exclude'],
          target: employeeOptions,
        },
        id,
      )
      if (r?.action !== 'map') continue
      employeeId = r.value
    }
    employeeId = employees.alias.get(employeeId) ?? employeeId
    const employee = byId.get(employeeId)
    if (employee && fold(row.get('zamestnanec')) !== fold(`${employee.lastName} ${employee.firstName}`)) {
      const r = ctx.flag(
        {
          id: `${file}:zamestnanec:${id}`,
          file,
          field: 'zamestnanec',
          value: `${row.get('zamestnanec')} ≠ ${employee.lastName} ${employee.firstName}`,
          message: 'Jméno v záznamu neodpovídá zaměstnanci s tímto ID',
          actions: ['ignore', 'exclude'],
        },
        id,
      )
      if (r?.action === 'exclude') continue
    }

    const code = readCode(ctx, file, id, row.get('kod_skoleni'), catalogCodes)
    if (!code || code === 'exclude') continue

    const rawDate = row.get('datum_absolvovani')
    const dateField = readDate(ctx, file, id, 'datum_absolvovani', rawDate)
    let date = dateField.value
    if (!date) {
      const r = ctx.flag(
        {
          id: `${file}:datum_absolvovani:${id}`,
          file,
          field: 'datum_absolvovani',
          value: rawDate,
          message: 'Neplatné datum absolvování',
          actions: ['map', 'exclude'],
          target: { type: 'date' },
        },
        id,
      )
      if (r?.action !== 'map') continue
      date = r.value
    } else if (date < '1950-01-01') {
      const r = ctx.flag(
        {
          id: `${file}:zastupne-datum:${id}`,
          file,
          field: 'datum_absolvovani',
          value: rawDate,
          message: 'Zástupné datum (rok 1900)',
          actions: ['map', 'exclude', 'ignore'],
          target: { type: 'date' },
        },
        id,
      )
      if (!r || r.action === 'exclude') continue
      if (r.action === 'map') date = r.value
    }
    if (date > referenceDate) {
      const r = ctx.flag(
        {
          id: `${file}:budouci-datum:${id}`,
          file,
          field: 'datum_absolvovani',
          value: rawDate,
          message: 'Datum absolvování je po referenčním datu (zadáno předem?) – nezapočítává se',
          actions: ['map', 'ignore', 'exclude'],
          target: { type: 'date' },
        },
        id,
      )
      if (!r || r.action === 'exclude') continue
      if (r.action === 'map') date = r.value
    }

    const training = trainings.find((t) => t.code === code)
    const computed = training?.months ? addMonths(date, training.months) : null
    const rawValid = row.get('platnost_do')
    let validUntil: IsoDate | null = computed
    if (rawValid.trim()) {
      const v = readDate(ctx, file, id, 'platnost_do', rawValid)
      if (!v.value) {
        const r = ctx.flag(
          {
            id: `${file}:platnost_do:${id}`,
            file,
            field: 'platnost_do',
            value: rawValid,
            message: 'Neplatné datum platnosti (ignorovat = dopočítat z katalogu)',
            actions: ['map', 'ignore', 'exclude'],
            target: { type: 'date' },
          },
          id,
        )
        if (!r || r.action === 'exclude') continue
        if (r.action === 'map') validUntil = r.value
      } else if (v.value < date) {
        const r = ctx.flag(
          {
            id: `${file}:platnost-pred-absolvovanim:${id}`,
            file,
            field: 'platnost_do',
            value: rawValid,
            message: 'Platnost končí dříve než absolvování (ignorovat = dopočítat z katalogu)',
            actions: ['map', 'ignore', 'exclude'],
            target: { type: 'date' },
          },
          id,
        )
        if (!r || r.action === 'exclude') continue
        if (r.action === 'map') validUntil = r.value
      } else validUntil = v.value
    }

    const rawPrice = row.get('cena_kc').trim()
    let price: number | null = null
    if (rawPrice) {
      const n = rawPrice.replace(/\s/g, '').replace(',', '.')
      if (/^\d+(\.\d+)?$/.test(n)) price = +n
      else {
        const r = ctx.flag(
          {
            id: `${file}:cena_kc:${id}`,
            file,
            field: 'cena_kc',
            value: rawPrice,
            message: 'Neplatná cena',
            actions: ['ignore', 'exclude'],
          },
          id,
        )
        if (r?.action === 'exclude') continue
      }
    }

    const dupKey = `${employeeId}|${code}|${date}`
    const original = seen.get(dupKey)
    if (original) {
      const r = ctx.flag(
        {
          id: `${file}:duplicita:${id}`,
          file,
          field: 'id_zaznamu',
          value: `${employeeId} ${code} ${date}`,
          message: `Duplicitní záznam k ${original}`,
          actions: ['exclude', 'ignore'],
        },
        id,
      )
      if (r?.action === 'exclude') continue
    } else seen.set(dupKey, id)

    completions.push({
      id,
      employeeId,
      code,
      date,
      validUntil,
      provider: collapse(row.get('poskytovatel')),
      price,
      note: row.get('poznamka').trim(),
    })
  }
  return completions
}

function readSessions(rows: Row[], ctx: Context, catalogCodes: string[]): Session[] {
  const file: FileKind = 'sessions'
  const sessions: Session[] = []
  const seen = new Map<string, string>()
  for (const row of rows) {
    const id = row.key
    const code = readCode(ctx, file, id, row.get('kod_skoleni'), catalogCodes)
    if (!code || code === 'exclude') continue

    const rawDate = row.get('datum')
    let date = readDate(ctx, file, id, 'datum', rawDate).value
    if (!date) {
      const r = ctx.flag(
        {
          id: `${file}:datum:${id}`,
          file,
          field: 'datum',
          value: rawDate,
          message: 'Neplatné datum termínu',
          actions: ['map', 'exclude'],
          target: { type: 'date' },
        },
        id,
      )
      if (r?.action !== 'map') continue
      date = r.value
    }

    const count = (field: string, label: string): number | null => {
      const raw = row.get(field).trim()
      if (/^\d+$/.test(raw)) return +raw
      const r = ctx.flag(
        {
          id: `${file}:${field}:${id}`,
          file,
          field,
          value: raw,
          message: `Neplatná ${label}`,
          actions: ['map', 'exclude'],
          target: { type: 'number' },
        },
        id,
      )
      return r?.action === 'map' ? +r.value : null
    }
    let capacity = count('kapacita', 'kapacita')
    const taken = count('obsazeno', 'obsazenost')
    if (capacity === null || taken === null) continue

    let blocked: string | null = null
    if (capacity === 0) {
      const r = ctx.flag(
        {
          id: `${file}:nulova-kapacita:${id}`,
          file,
          field: 'kapacita',
          value: '0',
          message: 'Termín s nulovou kapacitou',
          actions: ['map', 'ignore', 'exclude'],
          target: { type: 'number' },
        },
        id,
      )
      if (r?.action === 'exclude') continue
      if (r?.action === 'map') capacity = +r.value
      else blocked = 'Nulová kapacita'
    }
    if (taken > capacity) {
      const r = ctx.flag(
        {
          id: `${file}:preplneno:${id}`,
          file,
          field: 'obsazeno',
          value: `${taken} / ${capacity}`,
          message: 'Obsazeno víc míst, než je kapacita – termín je přeplněný',
          actions: ['map', 'ignore', 'exclude'],
          target: { type: 'number' },
        },
        id,
      )
      if (r?.action === 'exclude') continue
      if (r?.action === 'map') capacity = +r.value
      if (taken > capacity) blocked = 'Přeplněno'
    }

    const rawStatus = row.get('stav')
    let status: SessionStatus | null = SESSION_STATUSES.find((s) => fold(s) === fold(rawStatus)) ?? null
    if (status) ctx.normalize(file, id, 'stav', rawStatus, status, 'Mezery a velikost písmen')
    else {
      const r = ctx.flag(
        {
          id: `${file}:stav:${collapse(rawStatus)}`,
          file,
          field: 'stav',
          value: rawStatus,
          message: 'Neznámý stav termínu',
          actions: ['map', 'exclude'],
          target: select([...SESSION_STATUSES]),
        },
        id,
      )
      if (r?.action !== 'map') continue
      status = r.value as SessionStatus
    }

    const time = collapse(row.get('cas'))
    const place = collapse(row.get('misto'))
    const dupKey = `${code}|${date}|${time}|${fold(place)}`
    const original = seen.get(dupKey)
    if (original) {
      const r = ctx.flag(
        {
          id: `${file}:duplicita:${id}`,
          file,
          field: 'id_terminu',
          value: `${code} ${date} ${time} ${place}`,
          message: `Duplicitní termín k ${original}`,
          actions: ['exclude', 'ignore'],
        },
        id,
      )
      if (r?.action === 'exclude') continue
      if (!r) blocked = `Duplicitní k ${original}`
    } else seen.set(dupKey, id)

    const rawPrice = row.get('cena_na_osobu').replace(/\s/g, '').replace(',', '.')
    sessions.push({
      id,
      code,
      date,
      time,
      place,
      capacity,
      taken,
      price: /^\d+(\.\d+)?$/.test(rawPrice) ? +rawPrice : null,
      status,
      blocked,
    })
  }
  return sessions
}

export function buildDataset(tables: Tables, resolutions: Resolutions, referenceDate: IsoDate): { dataset: Dataset; report: ImportReport } {
  const ctx = new Context(resolutions)
  const employeeRows = readRows('employees', tables.employees, ctx, /^E\d{4}$/)
  const trainingRows = readRows('trainings', tables.trainings, ctx, /^[A-Z0-9][A-Z0-9 _-]*$/)
  const completionRows = readRows('completions', tables.completions, ctx, /^Z\d{6}$/)
  const sessionRows = readRows('sessions', tables.sessions, ctx, /^T\d{3,}$/)

  const people = readEmployees(employeeRows, ctx, referenceDate)
  const catalogCodes = trainingRows.map((r) => r.key)
  const trainings = readTrainings(trainingRows, ctx, people.departments, people.positions)
  const completions = readCompletions(completionRows, ctx, referenceDate, people, trainings, catalogCodes)
  const sessions = readSessions(sessionRows, ctx, catalogCodes)

  const employeeIds = new Set(people.employees.map((e) => e.id))
  const trainingCodes = new Set(trainings.map((t) => t.code))
  return {
    dataset: {
      employees: people.employees,
      trainings,
      completions: completions.filter((c) => employeeIds.has(c.employeeId) && trainingCodes.has(c.code)),
      sessions: sessions.filter((s) => trainingCodes.has(s.code)),
    },
    report: { normalizations: ctx.normalizations, inconsistencies: [...ctx.issues.values()], rejected: ctx.rejected },
  }
}
