import { describe, expect, it } from 'vitest'
import { varianceVsAverage, varianceVsPrevious, type MonthlyActual } from './variance'

// Three closed months of groceries actuals feeding the average/previous
// comparisons for the month being evaluated (2026-09, actual 320 -- passed
// in directly, not part of this history, since the current month isn't
// closed and has no row of its own in a caller's history).
const threeClosedMonths: MonthlyActual[] = [
  { monthId: '2026-06', categoryId: 'groceries', actual: 400 },
  { monthId: '2026-07', categoryId: 'groceries', actual: 380 },
  { monthId: '2026-08', categoryId: 'groceries', actual: 410 },
]

describe('varianceVsPrevious', () => {
  it('computes the delta against last month, hand-checked', () => {
    const result = varianceVsPrevious('2026-09', 'groceries', 320, threeClosedMonths)
    expect(result).toEqual({ actual: 320, prevActual: 410, delta: -90 })
  })

  it('returns nulls when there is no previous month in history', () => {
    const result = varianceVsPrevious('2026-06', 'groceries', 400, threeClosedMonths)
    expect(result).toEqual({ actual: 400, prevActual: null, delta: null })
  })
})

describe('varianceVsAverage', () => {
  it('computes avg3 and IMPROVING trend, hand-checked', () => {
    // avg3 = (410 + 380 + 400) / 3 = 396.666..., 320 <= 396.67 * 0.9 (357)
    const result = varianceVsAverage('2026-09', 'groceries', 320, threeClosedMonths, 3)
    expect(result.actual).toBe(320)
    expect(result.avg3).toBeCloseTo(396.6667, 3)
    expect(result.trend).toBe('IMPROVING')
  })

  it('classifies STEADY within +/- 10% of avg3', () => {
    const priorMonths: MonthlyActual[] = [
      { monthId: '2026-06', categoryId: 'restaurants', actual: 390 },
      { monthId: '2026-07', categoryId: 'restaurants', actual: 400 },
      { monthId: '2026-08', categoryId: 'restaurants', actual: 410 },
    ]
    // avg3 = 400, 410 is within [360, 440]
    const result = varianceVsAverage('2026-09', 'restaurants', 410, priorMonths, 3)
    expect(result.avg3).toBe(400)
    expect(result.trend).toBe('STEADY')
  })

  it('classifies RISING at or above avg3 * 1.10', () => {
    const priorMonths: MonthlyActual[] = [
      { monthId: '2026-06', categoryId: 'restaurants', actual: 380 },
      { monthId: '2026-07', categoryId: 'restaurants', actual: 400 },
      { monthId: '2026-08', categoryId: 'restaurants', actual: 420 },
    ]
    // avg3 = 400, 500 >= 440
    const result = varianceVsAverage('2026-09', 'restaurants', 500, priorMonths, 3)
    expect(result.avg3).toBe(400)
    expect(result.trend).toBe('RISING')
  })

  it('returns UNKNOWN with fewer than two closed months of history', () => {
    const shortHistory: MonthlyActual[] = [
      { monthId: '2026-08', categoryId: 'groceries', actual: 410 },
    ]
    const result = varianceVsAverage('2026-09', 'groceries', 320, shortHistory, 3)
    expect(result.avg3).toBeNull()
    expect(result.trend).toBe('UNKNOWN')
  })
})
