import { describe, expect, it } from 'vitest'
import type { Clock } from './clock'
import { ClosedMonthError } from './monthState'
import type { Category, Month, Plan, Transaction } from './types'
import type { MonthlyActual } from './variance'
import { AlreadyReviewedError, NotReadyForReviewError, runReview } from './verdict'

function fixedClock(iso: string): Clock {
  return () => new Date(iso)
}

const reviewReadyClock = fixedClock('2026-09-28T00:00:00Z')
// Any day within the month is review-ready now (no more day-26 gate) --
// this clock exists only to prove a month whose calendar month hasn't
// started yet is still correctly blocked.
const monthNotStartedClock = fixedClock('2026-08-15T00:00:00Z')

function makeMonth(overrides: Partial<Month> = {}): Month {
  return {
    id: '2026-09',
    state: 'OPEN',
    income: 5000,
    residentEarned: false,
    ...overrides,
  }
}

const categories: Category[] = [
  { id: 'groceries', name: 'Groceries', kind: 'consume', buildingStyleId: 'a', districtId: 'downtown' },
  { id: 'restaurants', name: 'Restaurants', kind: 'consume', buildingStyleId: 'a', districtId: 'downtown' },
  { id: 'savings', name: 'Savings', kind: 'accrue', buildingStyleId: 'b', districtId: 'monument' },
]

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: '2026-09-05',
    description: '',
    rawDescription: '',
    amount: 0,
    accountId: 'checking',
    hash: crypto.randomUUID(),
    ...overrides,
  }
}

describe('runReview', () => {
  it('throws ClosedMonthError for a CLOSED month', () => {
    const month = makeMonth({ state: 'CLOSED' })
    expect(() => runReview(month, [], [], categories, [], reviewReadyClock)).toThrow(
      ClosedMonthError,
    )
  })

  it('throws NotReadyForReviewError for a month whose calendar month has not started yet', () => {
    const month = makeMonth()
    expect(() => runReview(month, [], [], categories, [], monthNotStartedClock)).toThrow(
      NotReadyForReviewError,
    )
  })

  it('is reviewable immediately, any day in the month -- there is no day-26 wait', () => {
    const month = makeMonth()
    const plan: Plan[] = [{ monthId: '2026-09', categoryId: 'groceries', plannedAmount: 300 }]
    const transactions = [
      transaction({ categoryId: 'groceries', amount: -250, date: '2026-09-05' }),
    ]
    const reviewed = runReview(month, transactions, plan, categories, [], fixedClock('2026-09-02T00:00:00Z'))
    expect(reviewed.state).toBe('REVIEWED')
  })

  it('the verdict cannot change once REVIEWED: reviewing an already-REVIEWED month throws', () => {
    const month = makeMonth()
    const plan: Plan[] = [{ monthId: '2026-09', categoryId: 'groceries', plannedAmount: 300 }]
    const transactions = [
      transaction({ categoryId: 'groceries', amount: -250, date: '2026-09-05' }),
    ]

    const reviewed = runReview(month, transactions, plan, categories, [], reviewReadyClock)
    expect(reviewed.state).toBe('REVIEWED')
    expect(reviewed.verdict).toBeDefined()

    expect(() =>
      runReview(reviewed, transactions, plan, categories, [], reviewReadyClock),
    ).toThrow(AlreadyReviewedError)
  })

  it('computes residentEarned true when every consume category is at or under plan', () => {
    const month = makeMonth()
    const plan: Plan[] = [
      { monthId: '2026-09', categoryId: 'groceries', plannedAmount: 300 },
      { monthId: '2026-09', categoryId: 'restaurants', plannedAmount: 100 },
      { monthId: '2026-09', categoryId: 'savings', plannedAmount: 500 },
    ]
    const transactions = [
      transaction({ categoryId: 'groceries', amount: -300, date: '2026-09-05' }),
      transaction({ categoryId: 'restaurants', amount: -100, date: '2026-09-10' }),
      // savings is accrue and way under plan -- must not affect the verdict
      transaction({ categoryId: 'savings', amount: 50, date: '2026-09-15' }),
    ]

    const reviewed = runReview(month, transactions, plan, categories, [], reviewReadyClock)
    expect(reviewed.residentEarned).toBe(true)
  })

  it('computes residentEarned false when a consume category is even one dollar over plan', () => {
    const month = makeMonth()
    const plan: Plan[] = [
      { monthId: '2026-09', categoryId: 'groceries', plannedAmount: 300 },
      { monthId: '2026-09', categoryId: 'restaurants', plannedAmount: 100 },
    ]
    const transactions = [
      transaction({ categoryId: 'groceries', amount: -300, date: '2026-09-05' }),
      transaction({ categoryId: 'restaurants', amount: -101, date: '2026-09-10' }),
    ]

    const reviewed = runReview(month, transactions, plan, categories, [], reviewReadyClock)
    expect(reviewed.residentEarned).toBe(false)
  })

  it('populates each surfaced line with a real classification derived from monthSummary', () => {
    const month = makeMonth()
    const plan: Plan[] = [{ monthId: '2026-09', categoryId: 'groceries', plannedAmount: 300 }]
    const transactions = [
      transaction({ categoryId: 'groceries', amount: -300, date: '2026-09-05' }),
    ]
    // A real previous month, $400 -> $300 (a $100, 25% drop), so the
    // surfacing rule (section 4.4) actually surfaces this line rather than
    // dropping it for having nothing to compare against.
    const history: MonthlyActual[] = [
      { monthId: '2026-08', categoryId: 'groceries', actual: 400 },
    ]

    const reviewed = runReview(month, transactions, plan, categories, history, reviewReadyClock)
    expect(reviewed.verdict?.lines).toEqual([
      expect.objectContaining({
        categoryId: 'groceries',
        planState: 'BIG_WIN', // 300 <= 300 planned and 300 <= 400*0.85 (340)
        actual: 300,
        planned: 300,
        prevActual: 400,
      }),
    ])
    expect(reviewed.verdict?.steadyCount).toBe(0)
  })

  it('regression test: trend is computed against the real current-month actual, not a default of 0', () => {
    // Caught by hand-testing in the browser: varianceVsAverage/varianceVsPrevious
    // used to look up the current month's actual from `history`, which
    // runReview() deliberately excludes (the current month isn't closed
    // yet) -- silently defaulting to 0 and corrupting the trend. Three full
    // prior months (so avg3 is defined) with a genuinely rising actual is
    // exactly the fixture shape that exposes it: with the bug, actual=0
    // reads as IMPROVING; fixed, it correctly reads as RISING.
    const month = makeMonth()
    const plan: Plan[] = [{ monthId: '2026-09', categoryId: 'restaurants', plannedAmount: 250 }]
    const transactions = [
      transaction({ categoryId: 'restaurants', amount: -380, date: '2026-09-05' }),
    ]
    const history: MonthlyActual[] = [
      { monthId: '2026-06', categoryId: 'restaurants', actual: 200 },
      { monthId: '2026-07', categoryId: 'restaurants', actual: 250 },
      { monthId: '2026-08', categoryId: 'restaurants', actual: 300 },
    ]

    const reviewed = runReview(month, transactions, plan, categories, history, reviewReadyClock)
    expect(reviewed.verdict?.lines).toEqual([
      expect.objectContaining({ categoryId: 'restaurants', planState: 'BLOWN', trend: 'RISING' }),
    ])
  })

  it('a category with nothing eligible to surface against collapses into steadyCount, not a hidden line', () => {
    const month = makeMonth()
    const plan: Plan[] = [{ monthId: '2026-09', categoryId: 'groceries', plannedAmount: 300 }]
    const transactions = [
      transaction({ categoryId: 'groceries', amount: -300, date: '2026-09-05' }),
    ]

    // No history at all -- groceries has no previous month to compare
    // against, so per the surfacing rule it can't be individually shown.
    const reviewed = runReview(month, transactions, plan, categories, [], reviewReadyClock)
    expect(reviewed.verdict?.lines).toEqual([])
    expect(reviewed.verdict?.steadyCount).toBe(1)
  })
})
