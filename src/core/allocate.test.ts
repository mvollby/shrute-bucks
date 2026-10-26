import { describe, expect, it } from 'vitest'
import { allocate, OverAllocationError, type AllocationEntry } from './allocate'

describe('allocate', () => {
  it('throws a typed OverAllocationError when planned exceeds income', () => {
    const planEntries: AllocationEntry[] = [
      { categoryId: 'savings', kind: 'accrue', plannedAmount: 3000 },
      { categoryId: 'rent', kind: 'consume', plannedAmount: 2500 },
    ]

    expect(() => allocate(5000, planEntries)).toThrow(OverAllocationError)

    try {
      allocate(5000, planEntries)
      expect.unreachable('allocate should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(OverAllocationError)
      const overAllocationError = error as OverAllocationError
      expect(overAllocationError.totalPlanned).toBe(5500)
      expect(overAllocationError.income).toBe(5000)
    }
  })

  it('does not throw when planned exactly equals income', () => {
    const planEntries: AllocationEntry[] = [
      { categoryId: 'savings', kind: 'accrue', plannedAmount: 3000 },
      { categoryId: 'rent', kind: 'consume', plannedAmount: 2000 },
    ]

    expect(() => allocate(5000, planEntries)).not.toThrow()
    expect(allocate(5000, planEntries).remainder).toBe(0)
  })

  it('orders accrue categories before consume categories regardless of input order', () => {
    const planEntries: AllocationEntry[] = [
      { categoryId: 'rent', kind: 'consume', plannedAmount: 2000 },
      { categoryId: 'restaurants', kind: 'consume', plannedAmount: 300 },
      { categoryId: 'savings', kind: 'accrue', plannedAmount: 1000 },
      { categoryId: 'emergency-fund', kind: 'accrue', plannedAmount: 500 },
    ]

    const result = allocate(5000, planEntries)

    expect(result.allocations.map((allocation) => allocation.categoryId)).toEqual([
      'savings',
      'emergency-fund',
      'rent',
      'restaurants',
    ])
    expect(result.allocations.map((allocation) => allocation.kind)).toEqual([
      'accrue',
      'accrue',
      'consume',
      'consume',
    ])
  })

  it('computes the unallocated remainder', () => {
    const planEntries: AllocationEntry[] = [
      { categoryId: 'savings', kind: 'accrue', plannedAmount: 1000 },
    ]

    expect(allocate(5000, planEntries).remainder).toBe(4000)
  })
})
