import Papa from 'papaparse'
import type { FileKind } from './types'

export const HEADERS: Record<FileKind, string[]> = {
  employees: [
    'id_zamestnance',
    'jmeno',
    'prijmeni',
    'email',
    'utvar',
    'pozice',
    'vedouci_email',
    'datum_nastupu',
    'datum_ukonceni',
    'stav',
    'rodne_cislo',
    'poznamka',
  ],
  trainings: ['kod', 'nazev', 'platnost_mesicu', 'povinne_pro', 'poznamka'],
  completions: [
    'id_zaznamu',
    'id_zamestnance',
    'zamestnanec',
    'kod_skoleni',
    'datum_absolvovani',
    'platnost_do',
    'poskytovatel',
    'cena_kc',
    'poznamka',
  ],
  sessions: ['id_terminu', 'kod_skoleni', 'datum', 'cas', 'misto', 'kapacita', 'obsazeno', 'cena_na_osobu', 'stav'],
}

export function decode(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}

export type CsvTable = { header: string[]; rows: string[][] }

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.slice(0, clean.search(/\r?\n|$/))
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const result = Papa.parse<string[]>(clean, { delimiter, skipEmptyLines: 'greedy' })
  const [header = [], ...rows] = result.data
  return { header: header.map((h) => h.trim()), rows }
}

export type LoadedFile = { kind: FileKind; name: string; text: string }

export async function readUpload(file: File): Promise<LoadedFile | string> {
  const text = decode(await file.arrayBuffer())
  const kind = detectKind(parseCsv(text).header)
  return kind ? { kind, name: file.name, text } : `${file.name}: neznámá hlavička souboru`
}

export function detectKind(header: string[]): FileKind | null {
  const kinds = Object.keys(HEADERS) as FileKind[]
  return kinds.find((k) => HEADERS[k].length === header.length && HEADERS[k].every((h, i) => h === header[i])) ?? null
}
