import { describe, expect, test } from 'vitest'
import { evaluate } from './compliance'
import { loadSample } from './fixtures'
import { buildDataset, type Resolutions } from './import'

const REF = '2026-10-01'
const tables = loadSample()
const build = (resolutions: Resolutions = {}) => buildDataset(tables, resolutions, REF)

describe('sample import', () => {
  const { dataset, report } = build()
  const ids = report.inconsistencies.map((i) => i.id)

  test('rejects structurally broken rows only', () => {
    const reasons = report.rejected.map((r) => r.reason)
    expect(reasons).toContain('Opakovaná hlavička')
    expect(reasons.some((r) => r.includes('Celkem'))).toBe(true)
    expect(reasons.some((r) => r.startsWith('Neplatný identifikátor „# export'))).toBe(true)
  })

  test('flags known inconsistencies', () => {
    expect(ids).toEqual(
      expect.arrayContaining([
        'employees:utvar:Laboratore',
        'employees:utvar:Studijní',
        'employees:utvar:',
        'employees:email:E0121',
        'employees:duplicita:E1000',
        'employees:duplicita:E1002',
        'employees:vedouci_email:nezname.jmeno@vzorova.example',
        'completions:kod_skoleni:KYB3R',
        'completions:kod_skoleni:BOZP-X',
        'completions:id_zamestnance:E9001',
        'completions:zastupne-datum:Z000001',
        'completions:budouci-datum:Z002836',
        'completions:platnost-pred-absolvovanim:Z000643',
        'sessions:datum:T014',
        'sessions:kod_skoleni:KYB3R',
        'sessions:preplneno:T016',
        'sessions:preplneno:T030',
        'sessions:nulova-kapacita:T026',
        'sessions:duplicita:T009',
      ]),
    )
  })

  test('suggests fixes for typos', () => {
    const byId = new Map(report.inconsistencies.map((i) => [i.id, i]))
    expect(byId.get('employees:utvar:Laboratore')?.suggestion).toBe('Laboratoře')
    expect(byId.get('employees:utvar:Studijní')?.suggestion).toBe('Studijní oddělení')
    expect(byId.get('completions:kod_skoleni:POZ_OCH')?.suggestion).toBe('POZ-OCH')
    expect(byId.get('completions:kod_skoleni:KYB3R')?.suggestion).toBe('KYBER')
  })

  test('normalizes unambiguous values and lists them', () => {
    const excel = report.normalizations.find((n) => n.row === 'Z000471' && n.field === 'datum_absolvovani')
    expect(excel).toMatchObject({ from: '43552', to: '2019-03-28' })
    expect(dataset.trainings.find((t) => t.code === 'ZDVIH')?.months).toBe(24)
    expect(dataset.employees.find((e) => e.id === 'E0020')?.firstName).toBe('Lucie')
  })

  test('unresolved problem rows are not used', () => {
    expect(dataset.completions.some((c) => c.id === 'Z002836')).toBe(false)
    expect(dataset.sessions.some((s) => s.id === 'T010' || s.id === 'T014')).toBe(false)
    expect(dataset.sessions.find((s) => s.id === 'T009')?.blocked).toMatch(/Duplicitní/)
    expect(dataset.sessions.find((s) => s.id === 'T016')?.blocked).toBe('Přeplněno')
  })

  test('one-time training never expires, record platnost_do wins over catalog', () => {
    const z = dataset.completions.find((c) => c.code === 'LEAD')
    expect(z).toBeDefined()
    const c = dataset.completions.find((c) => c.id === 'Z000003')
    expect(c?.validUntil).toBe('2021-01-06')
  })
})

describe('duplicate identifiers', () => {
  const withRow = (row: string[]) => ({ ...tables, completions: { ...tables.completions, rows: [...tables.completions.rows, row] } })
  const conflicting = ['Z000003', 'E0024', 'Blažek Adam', 'GDPR', '2019-01-06', '', 'Interní školitel', '0,00', '']

  test('same content in another format is rejected as a duplicate row', () => {
    const { report } = build()
    expect(report.rejected.some((r) => r.reason === 'Duplicitní řádek – shodný obsah jako první výskyt Z000052')).toBe(true)
    expect(report.inconsistencies.some((i) => i.id.startsWith('completions:duplicitni-id:'))).toBe(false)
  })

  test('different content becomes an inconsistency and is used only when kept', () => {
    const unresolved = buildDataset(withRow(conflicting), {}, REF)
    const issue = unresolved.report.inconsistencies.find((i) => i.id.startsWith('completions:duplicitni-id:Z000003'))
    expect(issue).toBeDefined()
    expect(unresolved.dataset.completions.filter((c) => c.id.startsWith('Z000003'))).toHaveLength(1)

    const kept = buildDataset(withRow(conflicting), { [issue!.id]: { action: 'ignore' } }, REF)
    expect(kept.dataset.completions.filter((c) => c.id.startsWith('Z000003')).map((c) => c.code)).toEqual(['BOZP-Z', 'GDPR'])
  })
})

describe('resolutions', () => {
  test('mapping a department applies to all rows and drives requirements', () => {
    const { dataset } = build({ 'employees:utvar:Laboratore': { action: 'map', value: 'Laboratoře' } })
    const e = dataset.employees.find((e) => e.id === 'E0134')
    expect(e?.department).toBe('Laboratoře')
    const codes = evaluate(dataset, REF, 90)
      .get('E0134')
      ?.requirements.map((r) => r.code)
    expect(codes).toContain('LAB-BEZ')
  })

  test('merging a duplicate employee moves completions', () => {
    const before = build().dataset
    const after = build({ 'employees:duplicita:E1000': { action: 'map', value: 'E0155' } }).dataset
    expect(after.employees.some((e) => e.id === 'E1000')).toBe(false)
    const count = (d: typeof before) => d.completions.filter((c) => c.employeeId === 'E0155').length
    const moved = before.completions.filter((c) => c.employeeId === 'E1000').length
    expect(count(after)).toBe(count(before) + moved)
  })

  test('ignoring a future completion makes it count', () => {
    const { dataset } = build({ 'completions:budouci-datum:Z002837': { action: 'ignore' } })
    expect(dataset.completions.some((c) => c.id === 'Z002837')).toBe(true)
  })

  test('mapping a session code and date brings sessions back', () => {
    const { dataset } = build({
      'sessions:kod_skoleni:KYB3R': { action: 'map', value: 'KYBER' },
      'sessions:datum:T014': { action: 'map', value: '2026-10-31' },
    })
    expect(dataset.sessions.find((s) => s.id === 'T010')?.code).toBe('KYBER')
    expect(dataset.sessions.find((s) => s.id === 'T014')?.date).toBe('2026-10-31')
  })

  test('excluding removes the duplicate session', () => {
    const { dataset } = build({ 'sessions:duplicita:T009': { action: 'exclude' } })
    expect(dataset.sessions.some((s) => s.id === 'T009')).toBe(false)
  })

  test('resolution with an action the inconsistency does not allow is ignored', () => {
    const { dataset } = build({ 'completions:id_zamestnance:E9001': { action: 'ignore' } })
    expect(dataset.completions.some((c) => c.employeeId === 'E9001')).toBe(false)
  })
})
