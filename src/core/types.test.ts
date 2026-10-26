import { describe, expect, it } from 'vitest'
import type {
  Category,
  CategoryLine,
  Goal,
  Month,
  Plan,
  Resident,
  Rule,
  Transaction,
  Verdict,
} from './types'

// This file exists to prove every type from section 10 compiles and is
// importable elsewhere in the app. `tsc --noEmit` is the real check; the
// runtime assertions just keep this file from being pruned as dead code.

describe('core types', () => {
  it('Category constructs and exports', () => {
    const category: Category = {
      id: 'groceries',
      name: 'Groceries',
      kind: 'consume',
      buildingStyleId: 'market-01',
      districtId: 'downtown',
    }
    expect(category.kind).toBe('consume')
  })

  it('Transaction constructs and exports', () => {
    const transaction: Transaction = {
      id: 't1',
      date: '2026-09-01',
      description: 'chipotle',
      rawDescription: 'CHIPOTLE 2481 SEATTLE WA',
      amount: -12.5,
      accountId: 'checking',
      categoryId: 'groceries',
      hash: 'abc123',
    }
    expect(transaction.amount).toBeLessThan(0)
  })

  it('Rule accepts both string and RegExp match', () => {
    const stringRule: Rule = {
      id: 'r1',
      match: 'chipotle',
      categoryId: 'groceries',
      hits: 3,
      createdAt: '2026-09-01T00:00:00Z',
    }
    const regexRule: Rule = {
      id: 'r2',
      match: /^SQ \*/,
      categoryId: 'groceries',
      hits: 1,
      createdAt: '2026-09-01T00:00:00Z',
    }
    expect(stringRule.match).toBe('chipotle')
    expect(regexRule.match).toBeInstanceOf(RegExp)
  })

  it('Verdict composes CategoryLine entries', () => {
    const line: CategoryLine = {
      categoryId: 'groceries',
      planState: 'WIN',
      trend: 'IMPROVING',
      actual: 320,
      planned: 350,
      prevActual: 400,
      avg3: 390,
      text: 'Groceries: $320. Better.',
    }
    const verdict: Verdict = {
      headline: ['Groceries came in under plan.', 'No regressions this month.'],
      lines: [line],
      steadyCount: 9,
    }
    expect(verdict.lines).toHaveLength(1)
  })

  it('Month tracks lifecycle state', () => {
    const month: Month = {
      id: '2026-09',
      state: 'OPEN',
      income: 5000,
      residentEarned: false,
    }
    expect(month.state).toBe('OPEN')
  })

  it('Plan links a month to a category', () => {
    const plan: Plan = {
      monthId: '2026-09',
      categoryId: 'groceries',
      plannedAmount: 350,
    }
    expect(plan.plannedAmount).toBe(350)
  })

  it('Goal composes segments', () => {
    const goal: Goal = {
      id: 'ski-trip',
      name: 'Ski trip',
      targetAmount: 1200,
      segments: [{ label: 'lift pass', amount: 300, funded: true }],
      buildingStyleId: 'goal-01',
    }
    expect(goal.segments[0].funded).toBe(true)
  })

  it('Resident carries the ten-layer stack', () => {
    const resident: Resident = {
      id: 'res1',
      name: 'Josh',
      layers: {
        hairBack: 0,
        skin: 3,
        shoes: 1,
        legs: 2,
        shirt: 4,
        facialHair: 0,
        face: 1,
        hairFront: 6,
        glasses: 0,
        hat: 0,
      },
      earnedInMonthId: '2026-09',
      homeTileX: 4,
      homeTileY: 7,
    }
    expect(Object.keys(resident.layers)).toHaveLength(10)
  })
})
