import 'fake-indexeddb/auto'
import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it } from 'vitest'
import { monthSummary } from '../core/monthSummary'
import type { Month, Plan } from '../core/types'
import { db, ShruteBucksDB } from './db'
import { addManualTransaction, importTransactionsFromCsv, importTransactionsFromSpreadsheet } from './transactions'

const cardCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-05,2026-09-06,1234,CHIPOTLE 2481 SEATTLE WA,Dining,12.50,
2026-09-10,2026-09-11,1234,PAYMENT - THANK YOU,Payment/Credit,,500.00
`

beforeEach(async () => {
  await db.transactions.clear()
})

describe('importTransactionsFromCsv', () => {
  it('persists imported rows to IndexedDB', async () => {
    const inserted = await importTransactionsFromCsv(cardCsv, 'checking-1234')
    expect(inserted).toHaveLength(2)

    const stored = await db.transactions.toArray()
    expect(stored).toHaveLength(2)
  })

  it('imported rows survive a page reload (a fresh DB connection)', async () => {
    await importTransactionsFromCsv(cardCsv, 'checking-1234')

    // Simulate a page reload: open a brand new connection to the same
    // named IndexedDB database instead of reusing the existing one.
    const reopened = new ShruteBucksDB()
    const stored = await reopened.transactions.toArray()
    expect(stored).toHaveLength(2)
    reopened.close()
  })

  it('re-importing the same file inserts nothing', async () => {
    await importTransactionsFromCsv(cardCsv, 'checking-1234')
    const second = await importTransactionsFromCsv(cardCsv, 'checking-1234')

    expect(second).toHaveLength(0)
    expect(await db.transactions.toArray()).toHaveLength(2)
  })
})

describe('importTransactionsFromSpreadsheet', () => {
  it('reads an Excel workbook, assigns its account, and stores signed transactions', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Payee', 'Amount'],
      ['10/02/2026', 'Corner Market', -24.5],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = new File([bytes], 'statement.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const imported = await importTransactionsFromSpreadsheet(file, 'checking')
    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({ date: '2026-10-02', amount: -24.5, accountId: 'checking' })
  })
})

describe('addManualTransaction', () => {
  it('flows through monthSummary identically to an imported transaction', async () => {
    await importTransactionsFromCsv(cardCsv, 'checking-1234')
    await addManualTransaction({
      date: '2026-09-12',
      description: 'Venmo - Alex, rent split',
      amount: -40,
      accountId: 'venmo',
      categoryId: 'shared-expenses',
    })

    const allTransactions = await db.transactions.toArray()
    // Categorize the imported grocery row too, so both an imported and a
    // manual transaction feed the same monthSummary() call with no
    // special-casing between them.
    const categorized = allTransactions.map((t) =>
      t.rawDescription === 'CHIPOTLE 2481 SEATTLE WA'
        ? { ...t, categoryId: 'dining' }
        : t,
    )

    const month: Month = {
      id: '2026-09',
      state: 'OPEN',
      income: 0,
      residentEarned: false,
    }
    const plan: Plan[] = [
      { monthId: '2026-09', categoryId: 'dining', plannedAmount: 50 },
      { monthId: '2026-09', categoryId: 'shared-expenses', plannedAmount: 100 },
    ]

    const summary = monthSummary(month, categorized, plan)

    expect(summary).toEqual([
      { categoryId: 'dining', planned: 50, actual: 12.5, variance: -37.5 },
      { categoryId: 'shared-expenses', planned: 100, actual: 40, variance: -60 },
    ])
  })
})
