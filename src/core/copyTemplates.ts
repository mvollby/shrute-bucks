import { previousMonthId } from './monthId'
import type { CategoryLine } from './types'
import type { MonthlyActual } from './variance'

// section 0: "Copy templates are the exact voice of the product. Match
// the tone; do not 'improve' it into something more encouraging." Every
// string literal below is transcribed verbatim from section 4.6's table
// (or 4.5's two worked examples) with only the ${...}/{...} placeholders
// computed.

export function dollars(n: number): string {
  return Math.round(Math.abs(n)).toString()
}

// section 4.6, BIG_WIN + IMPROVING's "{n}": how many consecutive months,
// ending at and including this one, has `currentActual` been the lowest
// seen. Walks backward through history until a month that was *lower*
// breaks the streak, or history runs out. A cap of 24 just bounds the
// loop; it is not a claim about how far back the app tracks.
export function lowestInNMonths(
  monthId: string,
  categoryId: string,
  currentActual: number,
  history: MonthlyActual[],
): number {
  let n = 1
  let cursor = monthId
  for (let i = 0; i < 24; i++) {
    cursor = previousMonthId(cursor)
    const prior = history.find((h) => h.monthId === cursor && h.categoryId === categoryId)
    if (!prior || prior.actual < currentActual) break
    n++
  }
  return n
}

// Renders one surfaced CategoryLine's `text` per section 4.6. The table
// gives 7 rows, not all 15 planState x trend combinations -- rows without
// an explicit trend-specific variant use the one template given for that
// planState regardless of trend (CLOSE and SLIPPING each only ever show
// one row; BIG_WIN's only row is IMPROVING). WIN and BLOWN each have two
// explicit variants (IMPROVING/STEADY and RISING/STEADY); any other trend
// for those falls back to the STEADY-style wording rather than inventing
// new copy, since that's the "no special claim" default.
export function renderCategoryLineText(
  line: CategoryLine,
  categoryName: string,
  monthId: string,
  history: MonthlyActual[],
): string {
  const { planState, trend, actual, planned, prevActual, avg3 } = line

  switch (planState) {
    case 'BIG_WIN': {
      const underPlan = dollars(planned - actual)
      if (prevActual === null) {
        return `${categoryName}: $${dollars(actual)}. Much better. $${underPlan} under plan.`
      }
      const belowLastMonth = dollars(prevActual - actual)
      const n = lowestInNMonths(monthId, line.categoryId, actual, history)
      return `${categoryName}: $${dollars(actual)}. Much better. $${underPlan} under plan and $${belowLastMonth} below last month, your lowest in ${n} months.`
    }

    case 'WIN': {
      if (trend === 'IMPROVING' && prevActual !== null) {
        return `${categoryName}: $${dollars(actual)}. Better. Under plan, and down $${dollars(prevActual - actual)} from last month.`
      }
      return `${categoryName}: $${dollars(actual)}, to plan. Held.`
    }

    case 'CLOSE':
      return `${categoryName}: $${dollars(actual)} against a $${dollars(planned)} plan. Close enough.`

    case 'SLIPPING':
      return `${categoryName}: $${dollars(actual)}, $${dollars(actual - planned)} over. Second month climbing. Worth watching before it becomes the problem.`

    case 'BLOWN': {
      if (trend === 'RISING' && avg3 !== null) {
        return `${categoryName}: $${dollars(actual)} against a $${dollars(planned)} plan. Rising for the third month, now $${dollars(actual - avg3)} above your average.`
      }
      if (trend === 'STEADY' && avg3 !== null) {
        return `${categoryName}: $${dollars(actual)} against a $${dollars(planned)} plan. The plan may simply be wrong. You have spent near $${dollars(avg3)} for three months.`
      }
      return `${categoryName}: $${dollars(actual)} against a $${dollars(planned)} plan.`
    }
  }
}

// section 4.5: exactly two sentences, the single biggest improvement then
// the single biggest regression, ranked the same way surfacing ranks them
// (section 4.4 -- absolute dollars vs last month). `surfaced` is already
// improvements-first-then-regressions from surface(), each side already
// sorted by |delta| descending, so the first improvement/regression in
// the array (if any) is the biggest one.
export function renderHeadline(
  surfaced: CategoryLine[],
  categoryNameById: Map<string, string>,
  monthId: string,
  history: MonthlyActual[],
): [string, string] {
  const improvement = surfaced.find(
    (line) => line.prevActual !== null && line.actual < line.prevActual,
  )
  const regression = surfaced.find(
    (line) => line.prevActual !== null && line.actual > line.prevActual,
  )

  const firstSentence = improvement
    ? renderImprovementSentence(
        improvement,
        categoryNameById.get(improvement.categoryId) ?? improvement.categoryId,
        monthId,
        history,
      )
    : 'Nothing improved enough to call out this month.'

  const secondSentence = regression
    ? renderRegressionSentence(
        regression,
        categoryNameById.get(regression.categoryId) ?? regression.categoryId,
      )
    : 'No regressions this month.'

  return [firstSentence, secondSentence]
}

function renderImprovementSentence(
  line: CategoryLine,
  name: string,
  monthId: string,
  history: MonthlyActual[],
): string {
  const underLastMonth = dollars(line.prevActual! - line.actual)
  const base = `${name} came in $${underLastMonth} under last month`

  // "your best in four" only when it's a genuine multi-month streak (n >= 2);
  // "best in 1 month" would be a trivially true, meaningless claim.
  const n = lowestInNMonths(monthId, line.categoryId, line.actual, history)
  if (n >= 2) {
    return `${base}, your best in ${n} months.`
  }
  return `${base}.`
}

function renderRegressionSentence(line: CategoryLine, name: string): string {
  const overPlan = line.actual - line.planned
  if (overPlan <= 0) {
    // Spent more than last month, but still at or under plan -- "over
    // plan" would be false, so this reports the honest comparison instead.
    return `${name} went the other way, up $${dollars(line.actual - line.prevActual!)} from last month.`
  }

  if (line.trend === 'RISING' && line.planState === 'BLOWN') {
    return `${name} went the other way, $${dollars(overPlan)} over plan and rising for the third month.`
  }
  if (line.trend === 'RISING' && line.planState === 'SLIPPING') {
    return `${name} went the other way, $${dollars(overPlan)} over plan and climbing for the second month.`
  }
  return `${name} went the other way, $${dollars(overPlan)} over plan.`
}
