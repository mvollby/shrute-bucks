import { parseCsv } from './csv'
import type { ParsedTransaction } from './parsedTransaction'

// Capital One 360 checking exports use a single amount column plus a
// transaction-type column, rather than the card export's split Debit/Credit
// columns (section 11.1). Header names:
// "Account Number","Transaction Date","Transaction Amount","Transaction Type","Transaction Description","Balance"
const HEADERS = {
  date: 'transaction date',
  description: 'transaction description',
  amount: 'transaction amount',
  type: 'transaction type',
} as const

function parseAmount(value: string): number {
  const cleaned = value.replace(/[,$]/g, '').trim()
  return cleaned === '' ? 0 : Number(cleaned)
}

export function parseCapitalOne360(csv: string): ParsedTransaction[] {
  const rows = parseCsv(csv)
  if (rows.length === 0) return []

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const dateIndex = header.indexOf(HEADERS.date)
  const descriptionIndex = header.indexOf(HEADERS.description)
  const amountIndex = header.indexOf(HEADERS.amount)
  const typeIndex = header.indexOf(HEADERS.type)

  if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1 || typeIndex === -1) {
    throw new Error('CSV does not look like a Capital One 360 checking export')
  }

  return rows
    .slice(1)
    .filter((row) => row.length > 1 || row[0] !== '')
    .map((row) => {
      const magnitude = Math.abs(parseAmount(row[amountIndex] ?? ''))
      const type = (row[typeIndex] ?? '').trim().toLowerCase()
      // "Debit" is money leaving the account and must come out negative;
      // anything else ("Credit", deposits, etc.) stays positive.
      const amount = type === 'debit' ? -magnitude : magnitude

      const rawDescription = row[descriptionIndex] ?? ''
      return {
        date: (row[dateIndex] ?? '').trim(),
        description: rawDescription,
        rawDescription,
        amount,
      }
    })
}
