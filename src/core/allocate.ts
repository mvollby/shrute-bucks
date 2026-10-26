import type { CategoryKind } from './types'

// Thrown by allocate() when planned amounts exceed income. A typed error
// rather than a boolean/null return so Budget Day UI can block the flow
// on a specific, testable condition instead of a generic thrown Error.
export class OverAllocationError extends Error {
  readonly totalPlanned: number
  readonly income: number

  constructor(totalPlanned: number, income: number) {
    super(
      `Planned total $${totalPlanned.toFixed(2)} exceeds income $${income.toFixed(2)}`,
    )
    this.name = 'OverAllocationError'
    this.totalPlanned = totalPlanned
    this.income = income
  }
}

export interface AllocationEntry {
  categoryId: string
  kind: CategoryKind
  plannedAmount: number
}

export interface Allocation {
  categoryId: string
  kind: CategoryKind
  amount: number
}

export interface AllocationResult {
  allocations: Allocation[]
  remainder: number
}

// Pay-yourself-first per section 5.1: accrue categories (savings, emergency
// fund, goals) allocate before consume categories, regardless of input
// order. The ordering isn't just cosmetic here — the UI in stage 13 enforces
// "pay yourself first" by not rendering consume categories until accrue
// allocation is committed, and this ordered array is what it renders from.
export function allocate(
  income: number,
  planEntries: AllocationEntry[],
): AllocationResult {
  const totalPlanned = planEntries.reduce(
    (sum, entry) => sum + entry.plannedAmount,
    0,
  )

  if (totalPlanned > income) {
    throw new OverAllocationError(totalPlanned, income)
  }

  const ordered = [
    ...planEntries.filter((entry) => entry.kind === 'accrue'),
    ...planEntries.filter((entry) => entry.kind === 'consume'),
  ]

  const allocations: Allocation[] = ordered.map((entry) => ({
    categoryId: entry.categoryId,
    kind: entry.kind,
    amount: entry.plannedAmount,
  }))

  return { allocations, remainder: income - totalPlanned }
}
