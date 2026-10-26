import { dollars } from './copyTemplates'
import type { Category } from './types'

const COUNT_WORDS: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
}

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? n.toString()
}

export interface CategoryActualPlanned {
  categoryId: string
  actual: number
  planned: number
}

// Section 4.7: exactly one suggestion, only when arithmetically true.
// "Restaurants $60 lower would have earned you a resident this month."
// applies only when a *single* consumption category is over plan --
// reducing that one category by exactly its overage is the smallest
// change that flips every consumption category to at-or-under plan,
// which is precisely residentEarned's own condition (section 4.8), so
// the suggestion and the verdict it claims to flip use the same rule.
//
// When more than one category is over, no single number could be true
// (fixing one still leaves the others over), so no dollar figure is
// given. The example text ("Three categories went over...") reports a
// count rather than listing names -- followed here literally, since the
// worked example is the exact voice to match, even though the
// surrounding prose says "name them."
export function computeOneAdjustment(
  summaries: CategoryActualPlanned[],
  categories: Category[],
  categoryNameById: Map<string, string>,
): string | undefined {
  const consumeCategoryIds = new Set(
    categories.filter((category) => category.kind === 'consume').map((category) => category.id),
  )
  const overPlan = summaries.filter(
    (summary) => consumeCategoryIds.has(summary.categoryId) && summary.actual > summary.planned,
  )

  if (overPlan.length === 0) {
    return undefined // resident already earned; nothing to suggest
  }

  if (overPlan.length === 1) {
    const [only] = overPlan
    const name = categoryNameById.get(only.categoryId) ?? only.categoryId
    const reduction = dollars(only.actual - only.planned)
    return `${name} $${reduction} lower would have earned you a resident this month.`
  }

  return `${countWord(overPlan.length)} categories went over. No single change would have covered it.`
}
