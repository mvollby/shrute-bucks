import { classifyPlanState } from './classify'
import type { Clock } from './clock'
import { renderCategoryLineText, renderHeadline } from './copyTemplates'
import { assertMonthNotClosed, deriveMonthState } from './monthState'
import { monthSummary } from './monthSummary'
import { computeOneAdjustment } from './oneAdjustment'
import { surface } from './surfacing'
import type { Category, CategoryLine, Month, Plan, Transaction, Verdict } from './types'
import { varianceVsAverage, varianceVsPrevious, type MonthlyActual } from './variance'

export class AlreadyReviewedError extends Error {
  readonly monthId: string
  constructor(monthId: string) {
    super(`Month ${monthId} has already been reviewed; its verdict cannot change`)
    this.name = 'AlreadyReviewedError'
    this.monthId = monthId
  }
}

export class NotReadyForReviewError extends Error {
  readonly monthId: string
  constructor(monthId: string) {
    super(`Month ${monthId} is not ready for review yet`)
    this.name = 'NotReadyForReviewError'
    this.monthId = monthId
  }
}

// section 4.8: accrue categories are excluded, and a category with no
// plan (so nothing to check) can't fail it either.
function computeResidentEarned(
  summaries: { categoryId: string; actual: number; planned: number }[],
  categories: Category[],
): boolean {
  const consumeCategoryIds = new Set(
    categories.filter((category) => category.kind === 'consume').map((category) => category.id),
  )
  return summaries
    .filter((summary) => consumeCategoryIds.has(summary.categoryId))
    .every((summary) => summary.actual <= summary.planned)
}

// Computes and stores the Verdict, then sets REVIEWED (sections 3.1, 4.8).
// `verdict.lines` holds only the *surfaced* categories (section 4.4: at
// most 3 improvements + 3 regressions) -- everything else is represented
// only by `steadyCount`, not as a hidden/unsurfaced line, since the whole
// point of surfacing is that a review with everything in it is a review
// nobody re-opens.
export function runReview(
  month: Month,
  transactions: Transaction[],
  plan: Plan[],
  categories: Category[],
  history: MonthlyActual[],
  clock: Clock,
): Month {
  assertMonthNotClosed(month)
  if (month.state === 'REVIEWED') {
    throw new AlreadyReviewedError(month.id)
  }
  if (deriveMonthState(month, clock) !== 'REVIEW_READY') {
    throw new NotReadyForReviewError(month.id)
  }

  const summaries = monthSummary(month, transactions, plan)
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]))

  const allLines: CategoryLine[] = summaries.map((summary) => {
    const { prevActual } = varianceVsPrevious(month.id, summary.categoryId, summary.actual, history)
    const { avg3, trend } = varianceVsAverage(month.id, summary.categoryId, summary.actual, history)
    return {
      categoryId: summary.categoryId,
      planState: classifyPlanState(summary.actual, summary.planned, prevActual),
      trend,
      actual: summary.actual,
      planned: summary.planned,
      prevActual,
      avg3,
      text: '', // filled in below, once we know which lines are surfaced
    }
  })

  const { surfaced, steadyCount } = surface(allLines)
  const surfacedWithText = surfaced.map((line) => ({
    ...line,
    text: renderCategoryLineText(
      line,
      categoryNameById.get(line.categoryId) ?? line.categoryId,
      month.id,
      history,
    ),
  }))

  const verdict: Verdict = {
    headline: renderHeadline(surfacedWithText, categoryNameById, month.id, history),
    lines: surfacedWithText,
    oneAdjustment: computeOneAdjustment(summaries, categories, categoryNameById),
    steadyCount,
  }

  return {
    ...month,
    state: 'REVIEWED',
    reviewedAt: clock().toISOString(),
    residentEarned: computeResidentEarned(summaries, categories),
    verdict,
  }
}
