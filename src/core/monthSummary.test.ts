import { describe, expect, it } from 'vitest'
import { monthSummary } from './monthSummary'
import type { Month, Plan, Transaction } from './types'

describe('monthSummary', () => {
  const month: Month = {
    id: '2026-09',
    state: 'OPEN',
    income: 5000,
    residentEarned: false,
  }

  const plan: Plan[] = [
    { monthId: '2026-09', categoryId: 'groceries', plannedAmount: 350 },
    { monthId: '2026-09', categoryId: 'savings', plannedAmount: 500 },
  ]

  const transactions: Transaction[] = [
    // two groceries purchases this month: -120 and -100
    {
      id: 't1',
      date: '2026-09-05',
      description: 'safeway',
      rawDescription: 'SAFEWAY 4821',
      amount: -120,
      accountId: 'checking',
      categoryId: 'groceries',
      hash: 'h1',
    },
    {
      id: 't2',
      date: '2026-09-20',
      description: 'trader joes',
      rawDescription: "TRADER JOE'S 0113",
      amount: -100,
      accountId: 'checking',
      categoryId: 'groceries',
      hash: 'h2',
    },
    // a groceries purchase last month must not count
    {
      id: 't3',
      date: '2026-08-31',
      description: 'safeway',
      rawDescription: 'SAFEWAY 4821',
      amount: -999,
      accountId: 'checking',
      categoryId: 'groceries',
      hash: 'h3',
    },
    // an uncategorized transaction must not count toward any category
    {
      id: 't4',
      date: '2026-09-10',
      description: 'unknown',
      rawDescription: 'UNKNOWN MERCHANT',
      amount: -50,
      accountId: 'checking',
      hash: 'h4',
    },
    // a savings deposit (positive amount) this month
    {
      id: 't5',
      date: '2026-09-15',
      description: 'transfer to savings',
      rawDescription: 'TRANSFER TO SAVINGS',
      amount: 500,
      accountId: 'savings',
      categoryId: 'savings',
      hash: 'h5',
    },
  ]

  it('produces hand-checked planned/actual/variance per category', () => {
    const summary = monthSummary(month, transactions, plan)

    expect(summary).toEqual([
      { categoryId: 'groceries', planned: 350, actual: 220, variance: -130 },
      { categoryId: 'savings', planned: 500, actual: 500, variance: 0 },
    ])
  })

  it('excludes transactions from other months and uncategorized transactions', () => {
    const summary = monthSummary(month, transactions, plan)
    const groceries = summary.find((s) => s.categoryId === 'groceries')

    // 220, not 1219 -- the -999 from August and the -50 with no category
    // must both be excluded.
    expect(groceries?.actual).toBe(220)
  })

  it('keeps a planned category in the reflect view when it has no transactions', () => {
    const summary = monthSummary(month, transactions, plan)
    expect(summary).toHaveLength(2)
  })

  it('includes a categorized transaction even when that category was not planned', () => {
    const unplannedTransaction = { ...transactions[0], id: 't6', categoryId: 'fuel', amount: -75 }
    const summary = monthSummary(month, [...transactions, unplannedTransaction], plan)
    expect(summary.find((line) => line.categoryId === 'fuel')).toEqual({
      categoryId: 'fuel', planned: 0, actual: 75, variance: 75,
    })
  })
})
