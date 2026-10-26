import { describe, expect, it } from 'vitest'
import type { Clock } from './clock'
import { assertMonthNotClosed, ClosedMonthError, deriveMonthState } from './monthState'
import type { Month } from './types'

function fixedClock(iso: string): Clock {
  return () => new Date(iso)
}

function makeMonth(overrides: Partial<Month> = {}): Month {
  return {
    id: '2026-09',
    state: 'OPEN',
    income: 5000,
    residentEarned: false,
    ...overrides,
  }
}

describe('deriveMonthState', () => {
  it('is REVIEW_READY on any day once the month has begun, not just late in it', () => {
    const month = makeMonth()
    const state = deriveMonthState(month, fixedClock('2026-09-02T00:00:00Z'))
    expect(state).toBe('REVIEW_READY')
  })

  it('is REVIEW_READY late in the month too', () => {
    const month = makeMonth()
    const state = deriveMonthState(month, fixedClock('2026-09-30T00:00:00Z'))
    expect(state).toBe('REVIEW_READY')
  })

  it('is REVIEW_READY once the calendar has crossed into the next month', () => {
    const month = makeMonth()
    const state = deriveMonthState(month, fixedClock('2026-10-02T00:00:00Z'))
    expect(state).toBe('REVIEW_READY')
  })

  it('is OPEN for a month whose calendar month has not started yet', () => {
    const month = makeMonth({ id: '2026-10' })
    const state = deriveMonthState(month, fixedClock('2026-09-20T00:00:00Z'))
    expect(state).toBe('OPEN')
  })

  it('a REVIEWED month stays REVIEWED regardless of the clock', () => {
    const month = makeMonth({ state: 'REVIEWED' })
    const state = deriveMonthState(month, fixedClock('2026-09-05T00:00:00Z'))
    expect(state).toBe('REVIEWED')
  })

  it('a CLOSED month stays CLOSED regardless of the clock', () => {
    const month = makeMonth({ state: 'CLOSED' })
    const state = deriveMonthState(month, fixedClock('2026-09-05T00:00:00Z'))
    expect(state).toBe('CLOSED')
  })
})

describe('assertMonthNotClosed', () => {
  it('throws a typed ClosedMonthError for a CLOSED month', () => {
    const month = makeMonth({ state: 'CLOSED' })
    expect(() => assertMonthNotClosed(month)).toThrow(ClosedMonthError)
  })

  it('does not throw for OPEN, REVIEW_READY, or REVIEWED months', () => {
    for (const state of ['OPEN', 'REVIEW_READY', 'REVIEWED'] as const) {
      expect(() => assertMonthNotClosed(makeMonth({ state }))).not.toThrow()
    }
  })
})
