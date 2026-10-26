import type { Transaction } from './types'

// The Savings building's running number: all-time net total for the
// category (deposits add, any withdrawal subtracts), not a monthly
// magnitude like monthSummary()'s `actual` -- this is a balance, not a
// spend-vs-plan comparison, so the signed sum is exactly what's wanted,
// no Math.abs().
export function computeAllTimeTotal(categoryId: string, transactions: Transaction[]): number {
  return transactions
    .filter((transaction) => transaction.categoryId === categoryId)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}

export interface MonthlyTotal {
  monthId: string // YYYY-MM
  total: number // net amount that month, not cumulative
}

// Month-by-month breakdown for the click-through panel (section: "month
// per month or graphs of it going up"). Sorted chronologically.
export function computeMonthlyTotals(
  categoryId: string,
  transactions: Transaction[],
): MonthlyTotal[] {
  const byMonth = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.categoryId !== categoryId) continue
    const monthId = transaction.date.slice(0, 7)
    byMonth.set(monthId, (byMonth.get(monthId) ?? 0) + transaction.amount)
  }

  return [...byMonth.entries()]
    .map(([monthId, total]) => ({ monthId, total }))
    .sort((a, b) => a.monthId.localeCompare(b.monthId))
}
