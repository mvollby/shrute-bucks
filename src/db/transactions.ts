import { computeTransactionHash, dedupeByHash, hashTransactions } from '../core/dedupe'
import { importCsv } from '../core/importCsv'
import type { ParsedTransaction } from '../core/parsedTransaction'
import { applyRules } from '../core/rules'
import type { Transaction } from '../core/types'
import { db } from './db'

// Parses, hashes, dedupes against what's already stored, applies existing
// merchant Rules, and persists only the genuinely new rows. Re-importing
// the same file, or an overlapping export window, inserts nothing (section
// 11.2) -- the dedupe check runs against every stored transaction, not
// just this account's, since the hash already incorporates accountId and a
// global scan is simple and, at personal-finance-app scale, cheap.
export async function importTransactionsFromCsv(
  csv: string,
  accountId: string,
): Promise<Transaction[]> {
  return persistImportedTransactions(importCsv(csv), accountId)
}

export async function importTransactionsFromSpreadsheet(
  file: File,
  accountId: string,
): Promise<Transaction[]> {
  if (!accountId.trim()) throw new Error('Enter the account name before importing.')
  if (file.size > 15 * 1024 * 1024) throw new Error('This file is larger than 15 MB. Export a smaller date range and try again.')
  if (file.name.toLowerCase().endsWith('.csv')) {
    return persistImportedTransactions(importCsv(await file.text()), accountId.trim())
  }

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheetRows: 50000 })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('No worksheet was found in this workbook.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], {
    header: 1, raw: false, dateNF: 'yyyy-mm-dd', blankrows: false,
  })
  if (rows.length < 2) throw new Error('The first worksheet needs a header row and at least one transaction.')
  const csv = rows.map((row) => row.map((value) => {
    const cell = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '')
    return `"${cell.replaceAll('"', '""')}"`
  }).join(',')).join('\n')
  return persistImportedTransactions(importCsv(csv), accountId.trim())
}

async function persistImportedTransactions(parsed: ParsedTransaction[], accountId: string): Promise<Transaction[]> {
  const hashed = await hashTransactions(parsed, accountId)

  const existing = await db.transactions.toArray()
  const toInsert = dedupeByHash(existing, hashed)

  const unCategorized: Transaction[] = toInsert.map((entry) => ({
    id: crypto.randomUUID(),
    date: entry.date,
    description: entry.description,
    rawDescription: entry.rawDescription,
    amount: entry.amount,
    accountId: entry.accountId,
    hash: entry.hash,
  }))

  const rules = await db.rules.toArray()
  const { transactions, rules: updatedRules } = applyRules(unCategorized, rules)

  if (transactions.length > 0) {
    await db.transactions.bulkAdd(transactions)
  }
  if (updatedRules.length > 0) {
    await db.rules.bulkPut(updatedRules)
  }

  return transactions
}

export interface ManualTransactionInput {
  date: string
  description: string
  amount: number
  accountId: string
  categoryId?: string
}

// Cash and Venmo never appear in any export (section 11.3), so this is the
// only way those get in. Produces the exact same Transaction shape the CSV
// pipeline does -- no "manual" flag -- so nothing downstream can tell the
// two apart, per that section's requirement.
export async function addManualTransaction(
  input: ManualTransactionInput,
): Promise<Transaction> {
  const hash = await computeTransactionHash(
    { date: input.date, description: input.description, amount: input.amount },
    input.accountId,
  )

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    date: input.date,
    description: input.description,
    rawDescription: input.description,
    amount: input.amount,
    accountId: input.accountId,
    categoryId: input.categoryId,
    hash,
  }

  await db.transactions.add(transaction)
  return transaction
}

export async function updateTransaction(
  transactionId: string,
  input: ManualTransactionInput,
): Promise<void> {
  const existing = await db.transactions.get(transactionId)
  if (!existing) throw new Error(`Transaction ${transactionId} not found`)

  const hash = await computeTransactionHash(
    { date: input.date, description: input.description, amount: input.amount },
    input.accountId,
  )
  const duplicate = await db.transactions.where('hash').equals(hash).first()
  if (duplicate && duplicate.id !== transactionId) {
    throw new Error('Another transaction already has the same date, description, amount, and account.')
  }

  await db.transactions.update(transactionId, {
    date: input.date,
    description: input.description,
    rawDescription: input.description,
    amount: input.amount,
    accountId: input.accountId,
    categoryId: input.categoryId,
    hash,
  })
}
