import { describe, expect, it } from 'vitest'
import { computeAllTimeTotal, computeMonthlyTotals } from './savingsTotal'
import type { Transaction } from './types'

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: '2026-01-01',
    description: '',
    rawDescription: '',
    amount: 0,
    accountId: 'checking',
    hash: crypto.randomUUID(),
    ...overrides,
  }
}

describe('computeAllTimeTotal', () => {
  it('sums deposits minus withdrawals into a net running total', () => {
    const transactions = [
      transaction({ categoryId: 'savings', amount: 500, date: '2026-01-05' }),
      transaction({ categoryId: 'savings', amount: 300, date: '2026-02-05' }),
      transaction({ categoryId: 'savings', amount: -100, date: '2026-03-05' }), // a withdrawal
      transaction({ categoryId: 'food', amount: 9999, date: '2026-01-05' }), // different category
    ]
    expect(computeAllTimeTotal('savings', transactions)).toBe(700)
  })

  it('returns 0 for a category with no transactions', () => {
    expect(computeAllTimeTotal('savings', [])).toBe(0)
  })
})

describe('computeMonthlyTotals', () => {
  it('groups by month, sums within a month, and sorts chronologically', () => {
    const transactions = [
      transaction({ categoryId: 'savings', amount: 200, date: '2026-03-10' }),
      transaction({ categoryId: 'savings', amount: 100, date: '2026-01-10' }),
      transaction({ categoryId: 'savings', amount: 50, date: '2026-01-20' }), // same month as above
      transaction({ categoryId: 'other', amount: 9999, date: '2026-01-10' }),
    ]
    expect(computeMonthlyTotals('savings', transactions)).toEqual([
      { monthId: '2026-01', total: 150 },
      { monthId: '2026-03', total: 200 },
    ])
  })

  it('returns an empty array for a category with no transactions', () => {
    expect(computeMonthlyTotals('savings', [])).toEqual([])
  })
})
