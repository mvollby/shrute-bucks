import { parseCsv } from './csv'
import { parseCapitalOne360 } from './parseCapitalOne360'
import { parseCapitalOneCard } from './parseCapitalOneCard'
import type { ParsedTransaction } from './parsedTransaction'

export interface ImportAdapter {
  name: string
  detect(header: string[]): boolean
  parse(csv: string): ParsedTransaction[]
}

function lowerHeader(header: string[]): string[] {
  return header.map((h) => h.trim().toLowerCase())
}

export const capitalOneCardAdapter: ImportAdapter = {
  name: 'capital-one-card',
  detect: (header) => header.includes('debit') && header.includes('credit'),
  parse: parseCapitalOneCard,
}

export const capitalOne360Adapter: ImportAdapter = {
  name: 'capital-one-360',
  detect: (header) =>
    header.includes('transaction amount') && header.includes('transaction type'),
  parse: parseCapitalOne360,
}

const genericBankAdapter: ImportAdapter = {
  name: 'bank-csv',
  detect: (header) => {
    const hasDate = header.some((value) => ['date', 'transaction date', 'posted date'].includes(value))
    const hasDescription = header.some((value) => ['description', 'payee', 'merchant', 'name', 'transaction description'].includes(value))
    const hasAmount = header.some((value) => ['amount', 'transaction amount', 'debit', 'outflow', 'withdrawal'].includes(value))
    return hasDate && hasDescription && hasAmount
  },
  parse: parseGenericBankCsv,
}

export const importAdapters: ImportAdapter[] = [capitalOneCardAdapter, capitalOne360Adapter, genericBankAdapter]

function parseGenericBankCsv(csv: string): ParsedTransaction[] {
  const rows = parseCsv(csv)
  if (rows.length === 0) return []
  const header = lowerHeader(rows[0])
  const find = (...names: string[]) => header.findIndex((value) => names.includes(value))
  const dateIndex = find('date', 'transaction date', 'posted date')
  const descriptionIndex = find('description', 'payee', 'merchant', 'name', 'transaction description')
  const amountIndex = find('amount', 'transaction amount')
  const debitIndex = find('debit', 'outflow', 'withdrawal')
  const creditIndex = find('credit', 'inflow', 'deposit')
  const typeIndex = find('type', 'transaction type')

  return rows.slice(1).filter((row) => row.some((field) => field.trim() !== '')).flatMap((row) => {
    const rawDate = (row[dateIndex] ?? '').trim()
    const date = normalizeDate(rawDate)
    const description = (row[descriptionIndex] ?? '').trim()
    const parseAmount = (value: string) => {
      const cleaned = value.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
      return cleaned ? Number(cleaned) : 0
    }
    let amount: number
    if (debitIndex >= 0 && creditIndex >= 0) {
      const debit = parseAmount(row[debitIndex] ?? '')
      const credit = parseAmount(row[creditIndex] ?? '')
      amount = debit !== 0 ? -Math.abs(debit) : Math.abs(credit)
    } else {
      amount = parseAmount(row[amountIndex] ?? '')
      const type = (row[typeIndex] ?? '').trim().toLowerCase()
      if (type && /debit|withdraw|purchase|outflow/.test(type)) amount = -Math.abs(amount)
      else if (type && /credit|deposit|payment|inflow/.test(type)) amount = Math.abs(amount)
    }
    if (!date || !description || !Number.isFinite(amount)) return []
    return [{ date, description, rawDescription: description, amount }]
  })
}

function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!match) return null
  const [, month, day, rawYear] = match
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Single entry point per section 11.1: detects card vs. checking format from
// the header row alone, so callers never pass a format flag.
export function importCsv(csv: string, adapters: ImportAdapter[] = importAdapters): ParsedTransaction[] {
  const rows = parseCsv(csv)
  const header = lowerHeader(rows[0] ?? [])

  const adapter = adapters.find((candidate) => candidate.detect(header))
  if (!adapter) {
    throw new Error('Unrecognized CSV format: no import adapter matched the header row')
  }

  return adapter.parse(csv)
}
