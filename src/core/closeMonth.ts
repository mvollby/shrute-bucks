import { allocate, type AllocationEntry } from './allocate'
import type { Clock } from './clock'
import { nextMonthId } from './monthId'
import { assertMonthNotClosed } from './monthState'
import type { Month } from './types'

export class NotReviewedError extends Error {
  readonly monthId: string
  constructor(monthId: string) {
    super(`Month ${monthId} must be reviewed before it can be closed`)
    this.name = 'NotReviewedError'
    this.monthId = monthId
  }
}

export interface CloseMonthResult {
  closedMonth: Month
  nextMonth: Month
}

// Section 5.1 step 6 ("Lock") and section 3.1's REVIEWED -> CLOSED
// transition: freezes the reviewed month forever and opens the next one
// fresh. `planEntries` is the allocation being locked in for the month
// just reviewed, validated via allocate() so an invalid one can't be
// committed by closing (section 5.1: "Over-allocation is blocked with a
// typed error"). The next month opens with income 0 -- confirming next
// month's income is Budget Day step 1, a separate action this item
// doesn't build (no UI/flow for it exists yet).
export function closeMonth(
  month: Month,
  planEntries: AllocationEntry[],
  clock: Clock,
): CloseMonthResult {
  assertMonthNotClosed(month)
  if (month.state !== 'REVIEWED') {
    throw new NotReviewedError(month.id)
  }

  allocate(month.income, planEntries)

  const closedMonth: Month = {
    ...month,
    state: 'CLOSED',
    closedAt: clock().toISOString(),
  }

  const nextMonth: Month = {
    id: nextMonthId(month.id),
    state: 'OPEN',
    income: 0,
    residentEarned: false,
  }

  return { closedMonth, nextMonth }
}
