import { describe, expect, it } from 'vitest'
import { OverAllocationError, type AllocationEntry } from './allocate'
import type { Clock } from './clock'
import { closeMonth, NotReviewedError } from './closeMonth'
import { ClosedMonthError } from './monthState'
import type { Month } from './types'

function fixedClock(iso: string): Clock {
  return () => new Date(iso)
}

function makeMonth(overrides: Partial<Month> = {}): Month {
  return {
    id: '2026-09',
    state: 'REVIEWED',
    income: 5000,
    residentEarned: true,
    ...overrides,
  }
}

const validPlan: AllocationEntry[] = [
  { categoryId: 'savings', kind: 'accrue', plannedAmount: 1000 },
  { categoryId: 'rent', kind: 'consume', plannedAmount: 2000 },
]

describe('closeMonth', () => {
  it('throws ClosedMonthError for an already-CLOSED month', () => {
    const month = makeMonth({ state: 'CLOSED' })
    expect(() => closeMonth(month, validPlan, fixedClock('2026-09-30T00:00:00Z'))).toThrow(
      ClosedMonthError,
    )
  })

  it('throws NotReviewedError for a month that has not been reviewed', () => {
    const month = makeMonth({ state: 'OPEN' })
    expect(() => closeMonth(month, validPlan, fixedClock('2026-09-30T00:00:00Z'))).toThrow(
      NotReviewedError,
    )
  })

  it('throws OverAllocationError when the plan exceeds income', () => {
    const month = makeMonth({ income: 1000 })
    expect(() => closeMonth(month, validPlan, fixedClock('2026-09-30T00:00:00Z'))).toThrow(
      OverAllocationError,
    )
  })

  it('the next month exists and is OPEN with zero income', () => {
    const month = makeMonth()
    const { nextMonth } = closeMonth(month, validPlan, fixedClock('2026-09-30T00:00:00Z'))

    expect(nextMonth.id).toBe('2026-10')
    expect(nextMonth.state).toBe('OPEN')
    expect(nextMonth.income).toBe(0)
    expect(nextMonth.residentEarned).toBe(false)
  })

  it('freezes the closed month as CLOSED with a closedAt timestamp', () => {
    const month = makeMonth()
    const clock = fixedClock('2026-09-30T12:00:00Z')
    const { closedMonth } = closeMonth(month, validPlan, clock)

    expect(closedMonth.state).toBe('CLOSED')
    expect(closedMonth.closedAt).toBe(clock().toISOString())
  })

  it('rolls the next month id over a year boundary', () => {
    const month = makeMonth({ id: '2026-12' })
    const { nextMonth } = closeMonth(month, validPlan, fixedClock('2026-12-30T00:00:00Z'))
    expect(nextMonth.id).toBe('2027-01')
  })
})
