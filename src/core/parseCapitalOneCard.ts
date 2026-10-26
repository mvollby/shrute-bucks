import { parseCsv } from './csv'
import type { ParsedTransaction } from './parsedTransaction'

// Capital One credit card exports split money across separate Debit and
// Credit columns instead of one signed amount (section 11.1). Header names:
// "Transaction Date","Posted Date","Card No.","Description","Category","Debit","Credit"
// Matched case-insensitively by name rather than by fixed column position,
// since Capital One has reordered/added columns across export vintages and
// the spec itself warns these headers may already be stale.
const HEADERS = {
  date: 'transaction date',
  description: 'description',
  debit: 'debit',
  credit: 'credit',
} as const

function parseAmount(value: string): number {
  const cleaned = value.replace(/[,$]/g, '').trim()
  return cleaned === '' ? 0 : Number(cleaned)
}

export function parseCapitalOneCard(csv: string): ParsedTransaction[] {
  const rows = parseCsv(csv)
  if (rows.length === 0) return []

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const dateIndex = header.indexOf(HEADERS.date)
  const descriptionIndex = header.indexOf(HEADERS.description)
  const debitIndex = header.indexOf(HEADERS.debit)
  const creditIndex = header.indexOf(HEADERS.credit)

  if (dateIndex === -1 || descriptionIndex === -1 || debitIndex === -1 || creditIndex === -1) {
    throw new Error('CSV does not look like a Capital One card export')
  }

  return rows
    .slice(1)
    .filter((row) => row.length > 1 || row[0] !== '')
    .map((row) => {
      const debit = parseAmount(row[debitIndex] ?? '')
      const credit = parseAmount(row[creditIndex] ?? '')
      // A purchase populates Debit and must come out negative; a payment
      // or refund populates Credit and stays positive.
      const amount = debit !== 0 ? -debit : credit

      const rawDescription = row[descriptionIndex] ?? ''
      return {
        date: (row[dateIndex] ?? '').trim(),
        description: rawDescription,
        rawDescription,
        amount,
      }
    })
}
