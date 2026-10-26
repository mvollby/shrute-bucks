import { describe, expect, it } from 'vitest'
import { dedupeByHash, hashTransactions } from './dedupe'
import { importCsv } from './importCsv'

const septemberCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-05,2026-09-06,1234,CHIPOTLE 2481 SEATTLE WA,Dining,12.50,
2026-09-10,2026-09-11,1234,PAYMENT - THANK YOU,Payment/Credit,,500.00
`

// Overlaps the first two rows of septemberCsv (Capital One's capped export
// history means overlapping windows are the normal path, section 11.2) and
// adds one new row.
const overlappingCsv = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-05,2026-09-06,1234,CHIPOTLE 2481 SEATTLE WA,Dining,12.50,
2026-09-10,2026-09-11,1234,PAYMENT - THANK YOU,Payment/Credit,,500.00
2026-09-22,2026-09-23,1234,TRADER JOES,Groceries,38.20,
`

describe('dedupeByHash', () => {
  it('re-importing the same file is a complete no-op', async () => {
    const firstImport = await hashTransactions(importCsv(septemberCsv), 'checking-1234')
    // Simulate the store already containing the first import's rows.
    const store = dedupeByHash([], firstImport)
    expect(store).toHaveLength(2)

    // Parse and hash the identical file again, independently.
    const secondImport = await hashTransactions(importCsv(septemberCsv), 'checking-1234')
    const toInsert = dedupeByHash(store, secondImport)

    expect(toInsert).toHaveLength(0)
    expect(dedupeByHash(store, toInsert)).toHaveLength(0)
  })

  it('two overlapping date-range exports produce zero duplicates', async () => {
    const firstImport = await hashTransactions(importCsv(septemberCsv), 'checking-1234')
    const store = dedupeByHash([], firstImport)

    const secondImport = await hashTransactions(importCsv(overlappingCsv), 'checking-1234')
    const toInsert = dedupeByHash(store, secondImport)

    // Only the one genuinely new row (Trader Joe's) should be new.
    expect(toInsert).toHaveLength(1)
    expect(toInsert[0].rawDescription).toBe('TRADER JOES')

    const merged = [...store, ...toInsert]
    const hashes = merged.map((t) => t.hash)
    expect(new Set(hashes).size).toBe(hashes.length)
    expect(merged).toHaveLength(3)
  })

  it('produces a deterministic hash for the same transaction across parses', async () => {
    const [first] = await hashTransactions(importCsv(septemberCsv), 'checking-1234')
    const [second] = await hashTransactions(importCsv(septemberCsv), 'checking-1234')
    expect(first.hash).toBe(second.hash)
  })

  it('produces different hashes for different accounts', async () => {
    const [checking] = await hashTransactions(importCsv(septemberCsv), 'checking-1234')
    const [savings] = await hashTransactions(importCsv(septemberCsv), 'savings-5678')
    expect(checking.hash).not.toBe(savings.hash)
  })
})
