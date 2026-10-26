import { describe, expect, it } from 'vitest'
import { applyRules, createRuleFromCategorization } from './rules'
import type { Rule, Transaction } from './types'

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: '2026-09-01',
    description: overrides.rawDescription ?? '',
    rawDescription: '',
    amount: -10,
    accountId: 'checking',
    hash: crypto.randomUUID(),
    ...overrides,
  }
}

// A realistic repeat-merchant mix: rent shows up once, groceries and
// coffee show up often. Real budgets are dominated by a small set of
// merchants visited repeatedly (section 11.4's "on the second real import
// you should be seeing 85% or better auto-categorization").
const REPEAT_MERCHANTS = [
  'CHIPOTLE 2481 SEATTLE WA',
  'STARBUCKS 0092 SEATTLE WA',
  'TRADER JOES 0451 SEATTLE WA',
  'SHELL OIL 88213 SEATTLE WA',
  'NETFLIX.COM',
  'SPOTIFY USA',
  'WHOLE FOODS MKT 10234 SEATTLE WA',
  'COSTCO WHSE 221 SEATTLE WA',
  'CVS/PHARMACY 4471 SEATTLE WA',
  'PANERA BREAD 667 SEATTLE WA',
  'BLUE BOTTLE COFFEE 8821',
  'REI 34 SEATTLE WA',
]

function buildRepeatTransactions(count: number, idPrefix: string): Transaction[] {
  return Array.from({ length: count }, (_, i) =>
    makeTransaction({
      id: `${idPrefix}-${i}`,
      rawDescription: REPEAT_MERCHANTS[i % REPEAT_MERCHANTS.length],
    }),
  )
}

function buildOneOffTransactions(count: number, idPrefix: string): Transaction[] {
  return Array.from({ length: count }, (_, i) =>
    makeTransaction({
      id: `${idPrefix}-oneoff-${i}`,
      rawDescription: `ONE OFF MERCHANT ${i} ${9000 + i} SEATTLE WA`,
    }),
  )
}

describe('applyRules at scale', () => {
  it('reaches 85%+ auto-categorization on a second 200-row pass', () => {
    const firstImport = buildRepeatTransactions(200, 'first')

    // Simulate hand-categorizing one representative transaction per
    // unique merchant -- exactly what createRuleFromCategorization does.
    const uniqueMerchants = [...new Set(firstImport.map((t) => t.rawDescription))]
    const rules: Rule[] = uniqueMerchants.map((merchant, index) =>
      createRuleFromCategorization(
        { rawDescription: merchant },
        `category-${index % 5}`,
        '2026-09-01T00:00:00Z',
      ),
    )

    // Second import, section 11.4's "second real import": mostly the same
    // repeat merchants, plus some genuinely new one-off merchants no rule
    // could know about yet, so 100% is not a foregone conclusion.
    const secondImport = [
      ...buildRepeatTransactions(180, 'second'),
      ...buildOneOffTransactions(20, 'second'),
    ]

    const { transactions } = applyRules(secondImport, rules)
    const categorizedRate =
      transactions.filter((t) => t.categoryId).length / transactions.length

    expect(transactions).toHaveLength(200)
    expect(categorizedRate).toBeGreaterThanOrEqual(0.85)
    expect(categorizedRate).toBeLessThan(1) // proves this isn't trivially 100%
  })
})
