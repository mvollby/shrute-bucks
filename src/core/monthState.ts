import type { Clock } from './clock'
import type { Month, MonthState } from './types'

// Invariant 3 (section 2): "A CLOSED month is immutable. Every write path
// to one throws." A typed error so callers (and tests) can distinguish
// this from any other failure.
export class ClosedMonthError extends Error {
  readonly monthId: string

  constructor(monthId: string) {
    super(`Month ${monthId} is closed and immutable`)
    this.name = 'ClosedMonthError'
    this.monthId = monthId
  }
}

export function assertMonthNotClosed(month: Month): void {
  if (month.state === 'CLOSED') {
    throw new ClosedMonthError(month.id)
  }
}

function monthIdOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// A budgeting app you check whenever you want, not a monthly ritual gated
// to a calendar date: a month is reviewable as soon as its own calendar
// month has begun (immediately for the current month, always for a past
// one) -- there's no "wait until day 26" window anymore. REVIEWED and
// CLOSED are still one-way, explicit transitions written by
// runReview()/closeMonth(), so once the *stored* state reaches either, it
// wins outright regardless of what the clock says.
export function deriveMonthState(month: Month, clock: Clock): MonthState {
  if (month.state === 'REVIEWED' || month.state === 'CLOSED') {
    return month.state
  }

  const todayMonthId = monthIdOf(clock())
  return todayMonthId >= month.id ? 'REVIEW_READY' : 'OPEN'
}
