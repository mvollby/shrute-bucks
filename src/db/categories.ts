import type { BudgetCategoryGroup, Category, CategoryKind } from '../core/types'
import { db } from './db'

export async function listCategories(): Promise<Category[]> {
  return db.categories.toArray()
}

export async function createCategory(
  name: string,
  kind: CategoryKind,
  group: BudgetCategoryGroup = 'Needs',
): Promise<Category> {
  const category: Category = {
    id: crypto.randomUUID(),
    name,
    kind,
    group,
    // No building composer exists yet (stage 08) -- placeholders until then.
    buildingStyleId: 'default',
    districtId: kind === 'consume' ? 'downtown' : 'monument',
  }
  await db.categories.add(category)
  return category
}

export async function setCategoryGroup(id: string, group: BudgetCategoryGroup): Promise<void> {
  await db.categories.update(id, { group })
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
}
