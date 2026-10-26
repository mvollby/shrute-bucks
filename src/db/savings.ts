import { computeAllTimeTotal, computeMonthlyTotals, type MonthlyTotal } from '../core/savingsTotal'
import { listCategories } from './categories'
import { db } from './db'

async function findCategoryIdByName(name: string): Promise<string | null> {
  const categories = await listCategories()
  return categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null
}

// null means "no category with this name exists yet" -- distinct from a
// real total of 0, so callers can tell the difference between "nothing
// saved yet" and "not set up yet".
export async function getSavingsTotal(categoryName: string): Promise<number | null> {
  const categoryId = await findCategoryIdByName(categoryName)
  if (!categoryId) return null
  const transactions = await db.transactions.toArray()
  return computeAllTimeTotal(categoryId, transactions)
}

export async function getSavingsMonthlyTotals(categoryName: string): Promise<MonthlyTotal[] | null> {
  const categoryId = await findCategoryIdByName(categoryName)
  if (!categoryId) return null
  const transactions = await db.transactions.toArray()
  return computeMonthlyTotals(categoryId, transactions)
}
