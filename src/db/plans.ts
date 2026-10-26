import type { PlanRecord } from './db'
import { db } from './db'

function planId(monthId: string, categoryId: string): string {
  return `${monthId}:${categoryId}`
}

export async function listPlansForMonth(monthId: string): Promise<PlanRecord[]> {
  return db.plans.where('monthId').equals(monthId).toArray()
}

export async function setPlan(
  monthId: string,
  categoryId: string,
  plannedAmount: number,
): Promise<void> {
  await db.plans.put({ id: planId(monthId, categoryId), monthId, categoryId, plannedAmount })
}
