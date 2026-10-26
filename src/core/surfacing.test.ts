import { describe, expect, it } from 'vitest'
import { surface } from './surfacing'
import type { CategoryLine } from './types'

function line(
  categoryId: string,
  actual: number,
  prevActual: number | null,
  overrides: Partial<CategoryLine> = {},
): CategoryLine {
  return {
    categoryId,
    planState: 'WIN',
    trend: 'STEADY',
    actual,
    planned: actual,
    prevActual,
    avg3: null,
    text: '',
    ...overrides,
  }
}

describe('surface', () => {
  it('a 12-category fixture surfaces exactly 3 and 3 with a correct steady count', () => {
    const lines: CategoryLine[] = [
      // 4 improvement candidates -- only the top 3 by dollar move surface
      line('improve-1', 800, 1000), // delta -200
      line('improve-2', 850, 1000), // delta -150
      line('improve-3', 900, 1000), // delta -100
      line('improve-4', 950, 1000), // delta -50 (4th, collapses)
      // 4 regression candidates -- only the top 3 by dollar move surface
      line('regress-1', 680, 500), // delta +180
      line('regress-2', 620, 500), // delta +120
      line('regress-3', 580, 500), // delta +80
      line('regress-4', 530, 500), // delta +30 (4th, collapses)
      // 4 genuinely steady categories, suppressed for different reasons
      line('steady-no-history', 300, null), // nothing to compare against
      line('steady-small-dollar', 110, 100), // delta $10 < $25
      line('steady-big-percent-small-dollar', 28, 20), // 40% move, only $8
      line('steady-just-under-dollar-threshold', 1024, 1000), // delta $24 < $25
    ]

    const result = surface(lines)

    expect(result.surfaced.map((l) => l.categoryId)).toEqual([
      'improve-1',
      'improve-2',
      'improve-3',
      'regress-1',
      'regress-2',
      'regress-3',
    ])
    expect(result.steadyCount).toBe(6)
  })

  it('a large-percentage small-dollar category is correctly suppressed', () => {
    // section 4.4: "A 40% jump in a $20 category is noise."
    const lines: CategoryLine[] = [line('small-category', 28, 20)]
    const result = surface(lines)

    expect(result.surfaced).toEqual([])
    expect(result.steadyCount).toBe(1)
  })

  it('never surfaces more than 3 per direction even with many eligible movers', () => {
    const lines: CategoryLine[] = [
      line('a', 700, 1000), // -300
      line('b', 750, 1000), // -250
      line('c', 800, 1000), // -200
      line('d', 850, 1000), // -150
      line('e', 900, 1000), // -100
    ]
    const result = surface(lines)
    expect(result.surfaced).toHaveLength(3)
    expect(result.surfaced.map((l) => l.categoryId)).toEqual(['a', 'b', 'c'])
    expect(result.steadyCount).toBe(2)
  })

  it('ranks by absolute dollars, not percentage', () => {
    // a 40%-of-$20 move ($8) must rank below a 12%-of-$2000 move ($240),
    // even though its percentage move is much larger.
    const lines: CategoryLine[] = [
      line('rent', 2240, 2000), // +240, 12%
      line('coffee', 28, 20), // +8, 40% -- suppressed anyway, but proves ranking logic doesn't invert
    ]
    const result = surface(lines)
    expect(result.surfaced.map((l) => l.categoryId)).toEqual(['rent'])
  })

  it('a category with no previous month never surfaces', () => {
    const lines: CategoryLine[] = [line('brand-new', 5000, null)]
    const result = surface(lines)
    expect(result.surfaced).toEqual([])
    expect(result.steadyCount).toBe(1)
  })
})
