import { describe, expect, it } from 'vitest'
import { computeOneAdjustment, type CategoryActualPlanned } from './oneAdjustment'
import type { Category } from './types'

const categories: Category[] = [
  { id: 'groceries', name: 'Groceries', kind: 'consume', buildingStyleId: 'a', districtId: 'downtown' },
  { id: 'restaurants', name: 'Restaurants', kind: 'consume', buildingStyleId: 'a', districtId: 'downtown' },
  { id: 'transit', name: 'Transit', kind: 'consume', buildingStyleId: 'a', districtId: 'downtown' },
  { id: 'savings', name: 'Savings', kind: 'accrue', buildingStyleId: 'b', districtId: 'monument' },
]
const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

function residentEarned(summaries: CategoryActualPlanned[], cats: Category[]): boolean {
  const consumeIds = new Set(cats.filter((c) => c.kind === 'consume').map((c) => c.id))
  return summaries
    .filter((s) => consumeIds.has(s.categoryId))
    .every((s) => s.actual <= s.planned)
}

describe('computeOneAdjustment', () => {
  it('suggests the exact reduction for a single over-plan category, and that reduction actually flips the verdict', () => {
    const summaries: CategoryActualPlanned[] = [
      { categoryId: 'groceries', actual: 280, planned: 300 },
      { categoryId: 'restaurants', actual: 360, planned: 300 }, // $60 over
      { categoryId: 'savings', actual: 500, planned: 1000 }, // accrue, way under -- irrelevant
    ]

    expect(residentEarned(summaries, categories)).toBe(false)

    const adjustment = computeOneAdjustment(summaries, categories, categoryNameById)
    expect(adjustment).toBe('Restaurants $60 lower would have earned you a resident this month.')

    // Prove the suggested $60 reduction would actually have worked: apply
    // it and confirm the verdict really flips to true.
    const adjusted = summaries.map((s) =>
      s.categoryId === 'restaurants' ? { ...s, actual: s.actual - 60 } : s,
    )
    expect(residentEarned(adjusted, categories)).toBe(true)
  })

  it('multi-category overruns produce the "no single change" copy instead', () => {
    const summaries: CategoryActualPlanned[] = [
      { categoryId: 'groceries', actual: 320, planned: 300 },
      { categoryId: 'restaurants', actual: 360, planned: 300 },
      { categoryId: 'transit', actual: 150, planned: 100 },
    ]

    const adjustment = computeOneAdjustment(summaries, categories, categoryNameById)
    expect(adjustment).toBe('Three categories went over. No single change would have covered it.')
  })

  it('returns undefined when no consumption category is over plan', () => {
    const summaries: CategoryActualPlanned[] = [
      { categoryId: 'groceries', actual: 280, planned: 300 },
    ]
    expect(computeOneAdjustment(summaries, categories, categoryNameById)).toBeUndefined()
  })

  it('ignores accrue categories entirely, even if "over plan"', () => {
    const summaries: CategoryActualPlanned[] = [
      { categoryId: 'groceries', actual: 280, planned: 300 },
      { categoryId: 'savings', actual: 1500, planned: 1000 }, // accrue, "over" but irrelevant
    ]
    expect(computeOneAdjustment(summaries, categories, categoryNameById)).toBeUndefined()
  })
})
