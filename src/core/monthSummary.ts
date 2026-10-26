import type { Month, Plan, Transaction } from './types'

export interface CategorySummary {
  categoryId: string
  planned: number
  actual: number
  variance: number // actual - planned; positive means over plan
}

function isInMonth(date: string, monthId: string): boolean {
  return date.slice(0, 7) === monthId
}

// Per-category planned/actual/variance for one month, section 4.1.
// Driven by Plan, not by which categories happen to have transactions: a
// category with no Plan entry for this month has no "planned" to compare
// against and is left out, matching the classification rules in 4.2, which
// are only defined relative to a plan.
export function monthSummary(
  month: Month,
  transactions: Transaction[],
  plan: Plan[],
): CategorySummary[] {
  const monthPlans = plan.filter((entry) => entry.monthId === month.id)
  const plannedByCategory = new Map(monthPlans.map((entry) => [entry.categoryId, entry.plannedAmount]))
  const categoryIds = new Set(monthPlans.map((entry) => entry.categoryId))
  for (const transaction of transactions) {
    if (transaction.categoryId && isInMonth(transaction.date, month.id)) {
      categoryIds.add(transaction.categoryId)
    }
  }

  return [...categoryIds].map((categoryId) => {
    const actualRaw = transactions
      .filter(
        (transaction) =>
          transaction.categoryId === categoryId &&
          isInMonth(transaction.date, month.id),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    // Transaction.amount is signed (negative = money out). "actual" is
    // reported as a plain dollar figure comparable to plannedAmount, so
    // both a consumption category's outflows and an accrual category's
    // deposits collapse to the same positive magnitude.
    const actual = Math.abs(actualRaw)

    return {
      categoryId,
      planned: plannedByCategory.get(categoryId) ?? 0,
      actual,
      variance: actual - (plannedByCategory.get(categoryId) ?? 0),
    }
  })
}
