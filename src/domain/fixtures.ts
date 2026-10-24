import { readFileSync } from 'node:fs'
import { decode, detectKind, parseCsv } from './csv'
import type { Tables } from './import'

export function loadSample(): Tables {
  const tables = {} as Tables
  for (const name of ['zamestnanci', 'katalog_skoleni', 'absolvovana_skoleni', 'terminy_skoleni']) {
    const bytes = readFileSync(new URL(`../../data/${name}.csv`, import.meta.url))
    const table = parseCsv(decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)))
    const kind = detectKind(table.header)
    if (!kind) throw new Error(`unknown file ${name}`)
    tables[kind] = table
  }
  return tables
}
