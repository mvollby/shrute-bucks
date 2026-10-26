import { describe, expect, it } from 'vitest'
import { applyRules, createRuleFromCategorization } from './rules'
import type { Rule, Transaction } from './types'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    date: '2026-09-05',
    description: 'CHIPOTLE 2481 SEATTLE WA',
    rawDescription: 'CHIPOTLE 2481 SEATTLE WA',
    amount: -12.5,
    accountId: 'checking',
    hash: crypto.randomUUID(),
    ...overrides,
  }
}

describe('createRuleFromCategorization', () => {
  it('builds a rule matching the normalized merchant', () => {
    const rule = createRuleFromCategorization(
      { rawDescription: 'CHIPOTLE 2481 SEATTLE WA' },
      'dining',
      '2026-09-05T00:00:00Z',
    )
    expect(rule.match).toBe('chipotle')
    expect(rule.categoryId).toBe('dining')
    expect(rule.hits).toBe(0)
  })
})

describe('applyRules', () => {
  it('categorizing one Chipotle row auto-categorizes all future ones', () => {
    const rule = createRuleFromCategorization(
      { rawDescription: 'CHIPOTLE 2481 SEATTLE WA' },
      'dining',
      '2026-09-05T00:00:00Z',
    )

    const futureTransactions = [
      makeTransaction({ rawDescription: 'CHIPOTLE 0113 PORTLAND' }),
      makeTransaction({ rawDescription: 'CHIPOTLE 9921 AUSTIN TX' }),
      makeTransaction({ rawDescription: 'TRADER JOES', description: 'TRADER JOES' }),
    ]

    const result = applyRules(futureTransactions, [rule])

    expect(result.transactions[0].categoryId).toBe('dining')
    expect(result.transactions[1].categoryId).toBe('dining')
    expect(result.transactions[2].categoryId).toBeUndefined()
  })

  it('increments hit count once per matched transaction', () => {
    const rule: Rule = {
      id: 'r1',
      match: 'chipotle',
      categoryId: 'dining',
      hits: 2,
      createdAt: '2026-09-01T00:00:00Z',
    }

    const transactions = [
      makeTransaction({ rawDescription: 'CHIPOTLE 2481 SEATTLE WA' }),
      makeTransaction({ rawDescription: 'CHIPOTLE 0113 PORTLAND' }),
    ]

    const result = applyRules(transactions, [rule])
    expect(result.rules[0].hits).toBe(4)
  })

  it('does not overwrite an already-categorized transaction', () => {
    const rule: Rule = {
      id: 'r1',
      match: 'chipotle',
      categoryId: 'dining',
      hits: 0,
      createdAt: '2026-09-01T00:00:00Z',
    }
    const alreadyCategorized = makeTransaction({
      rawDescription: 'CHIPOTLE 2481 SEATTLE WA',
      categoryId: 'takeout', // hand-categorized differently
    })

    const result = applyRules([alreadyCategorized], [rule])
    expect(result.transactions[0].categoryId).toBe('takeout')
    expect(result.rules[0].hits).toBe(0)
  })
})

describe('applyRules conflict resolution', () => {
  it('an exact string match wins over an overlapping RegExp match', () => {
    const exactRule: Rule = {
      id: 'exact',
      match: 'chipotle',
      categoryId: 'dining',
      hits: 0,
      createdAt: '2026-09-01T00:00:00Z',
    }
    const regexRule: Rule = {
      id: 'regex',
      match: /chip/i,
      categoryId: 'fast-food',
      hits: 0,
      createdAt: '2026-09-10T00:00:00Z', // more recent, but less specific
    }

    const transaction = makeTransaction({ rawDescription: 'CHIPOTLE 2481 SEATTLE WA' })
    const result = applyRules([transaction], [regexRule, exactRule])

    expect(result.transactions[0].categoryId).toBe('dining')
  })

  it('among two RegExp matches, the longer (more specific) pattern wins', () => {
    const broadRule: Rule = {
      id: 'broad',
      match: /coffee/i,
      categoryId: 'coffee-general',
      hits: 0,
      createdAt: '2026-09-10T00:00:00Z', // more recent, but less specific
    }
    const narrowRule: Rule = {
      id: 'narrow',
      match: /blue bottle coffee/i,
      categoryId: 'blue-bottle',
      hits: 0,
      createdAt: '2026-09-01T00:00:00Z',
    }

    const transaction = makeTransaction({ rawDescription: 'BLUE BOTTLE COFFEE 8821' })
    const result = applyRules([transaction], [broadRule, narrowRule])

    expect(result.transactions[0].categoryId).toBe('blue-bottle')
  })

  it('ties in specificity are broken by the most recently created rule', () => {
    const older: Rule = {
      id: 'older',
      match: 'chipotle',
      categoryId: 'dining',
      hits: 0,
      createdAt: '2026-09-01T00:00:00Z',
    }
    const newer: Rule = {
      id: 'newer',
      match: 'chipotle',
      categoryId: 'takeout',
      hits: 0,
      createdAt: '2026-09-10T00:00:00Z',
    }

    const transaction = makeTransaction({ rawDescription: 'CHIPOTLE 2481 SEATTLE WA' })
    const result = applyRules([transaction], [older, newer])

    expect(result.transactions[0].categoryId).toBe('takeout')
  })
})
