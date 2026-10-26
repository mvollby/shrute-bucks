import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { categorizeTransaction } from './rules'
import { importTransactionsFromCsv } from './transactions'

const firstImportCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-05,2026-09-06,1234,CHIPOTLE 2481 SEATTLE WA,Dining,12.50,
`

const secondImportCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-20,2026-09-21,1234,CHIPOTLE 0113 PORTLAND,Dining,15.00,
2026-09-22,2026-09-23,1234,TRADER JOES,Groceries,60.00,
`

beforeEach(async () => {
  await db.transactions.clear()
  await db.rules.clear()
})

describe('categorizeTransaction', () => {
  it('categorizing one Chipotle row auto-categorizes all future ones', async () => {
    const [chipotle] = await importTransactionsFromCsv(firstImportCsv, 'checking-1234')
    expect(chipotle.categoryId).toBeUndefined()

    await categorizeTransaction(chipotle.id, 'dining')

    const rules = await db.rules.toArray()
    expect(rules).toHaveLength(1)
    expect(rules[0].match).toBe('chipotle')

    const secondImport = await importTransactionsFromCsv(secondImportCsv, 'checking-1234')
    const newChipotle = secondImport.find((t) => t.rawDescription.includes('PORTLAND'))
    const traderJoes = secondImport.find((t) => t.rawDescription === 'TRADER JOES')

    expect(newChipotle?.categoryId).toBe('dining')
    expect(traderJoes?.categoryId).toBeUndefined()

    // The rule's hit count reflects the auto-categorization on import.
    const updatedRule = await db.rules.get(rules[0].id)
    expect(updatedRule?.hits).toBe(1)
  })

  it('recategorizing a merchant updates the existing rule instead of duplicating it', async () => {
    const [chipotle] = await importTransactionsFromCsv(firstImportCsv, 'checking-1234')
    await categorizeTransaction(chipotle.id, 'dining')
    await categorizeTransaction(chipotle.id, 'takeout')

    const rules = await db.rules.toArray()
    expect(rules).toHaveLength(1)
    expect(rules[0].categoryId).toBe('takeout')
  })
})
