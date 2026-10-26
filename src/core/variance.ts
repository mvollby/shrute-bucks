import { lastNMonthIds, previousMonthId } from './monthId'
import type { Trend } from './types'

// A flat per-month, per-category actual, the shape monthSummary() produces
// across many months. Callers accumulate these across closed months and
// pass the slice in; these functions stay pure and never reach for storage.
export interface MonthlyActual {
  monthId: string // YYYY-MM
  categoryId: string
  actual: number
}

export interface PreviousComparison {
  actual: number
  prevActual: number | null
  delta: number | null // actual - prevActual; negative = spent less than last month
}

export interface AverageComparison {
  actual: number
  avg3: number | null
  trend: Trend
}

function findActual(
  history: MonthlyActual[],
  monthId: string,
  categoryId: string,
): number | null {
  return (
    history.find((h) => h.monthId === monthId && h.categoryId === categoryId)
      ?.actual ?? null
  )
}

// Section 4.1's prevActual, and the delta the headline (4.5) and copy
// templates (4.6) render, e.g. "$91 under last month". `actual` is passed
// in explicitly rather than looked up from `history` -- a caller's
// `history` may deliberately exclude the current month (it's not a
// "closed month" yet, see runReview()), and looking it up internally
// silently defaulted to 0 in that case, corrupting every downstream
// trend/delta calculation. Found by hand-testing in the browser; no unit
// test had a fixture that could have caught it.
export function varianceVsPrevious(
  monthId: string,
  categoryId: string,
  actual: number,
  history: MonthlyActual[],
): PreviousComparison {
  const prevActual = findActual(history, previousMonthId(monthId), categoryId)

  if (prevActual === null) {
    return { actual, prevActual: null, delta: null }
  }
  return { actual, prevActual, delta: actual - prevActual }
}

// Section 4.1's avg3 and the section 4.3 trend classification. Trend needs
// at least two closed months of history; with fewer, it's UNKNOWN and no
// trend language should appear in the copy (section 4.3).
export function varianceVsAverage(
  monthId: string,
  categoryId: string,
  actual: number,
  history: MonthlyActual[],
  n = 3,
): AverageComparison {
  const priorActuals = lastNMonthIds(monthId, n)
    .map((id) => findActual(history, id, categoryId))
    .filter((value): value is number => value !== null)

  if (priorActuals.length < 2) {
    return { actual, avg3: null, trend: 'UNKNOWN' }
  }

  const avg3 =
    priorActuals.reduce((sum, value) => sum + value, 0) / priorActuals.length

  let trend: Trend
  if (actual <= avg3 * 0.9) {
    trend = 'IMPROVING'
  } else if (actual >= avg3 * 1.1) {
    trend = 'RISING'
  } else {
    trend = 'STEADY'
  }

  return { actual, avg3, trend }
}
