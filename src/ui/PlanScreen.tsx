import { useEffect, useState } from 'react'
import { nextMonthId, previousMonthId } from '../core/monthId'
import type { BudgetCategoryGroup, Category, CategoryKind, Month } from '../core/types'
import { createCategory, deleteCategory, listCategories, setCategoryGroup } from '../db/categories'
import type { PlanRecord } from '../db/db'
import { getCurrentMonth, getOrCreateMonth, setMonthIncome } from '../db/months'
import { listPlansForMonth, setPlan } from '../db/plans'

const GROUPS: BudgetCategoryGroup[] = ['Bills', 'Needs', 'Wants']

function currency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function PlanScreen() {
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null)
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null)
  const [month, setMonth] = useState<Month | null>(null)
  const [income, setIncome] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryGroup, setNewCategoryGroup] = useState<BudgetCategoryGroup>('Needs')
  const [newCategoryKind, setNewCategoryKind] = useState<CategoryKind>('consume')

  useEffect(() => {
    void (async () => {
      const current = await getCurrentMonth()
      setCurrentMonthId(current.id)
      setSelectedMonthId((previous) => previous ?? nextMonthId(current.id))
    })()
  }, [])

  useEffect(() => {
    if (selectedMonthId) void loadMonth(selectedMonthId)
  }, [selectedMonthId])

  async function loadMonth(monthId: string) {
    const [selected, monthPlans, allCategories] = await Promise.all([
      getOrCreateMonth(monthId), listPlansForMonth(monthId), listCategories(),
    ])
    setMonth(selected)
    setIncome(String(selected.income))
    setPlans(monthPlans)
    setCategories(allCategories)
  }

  async function refresh() {
    if (selectedMonthId) await loadMonth(selectedMonthId)
  }

  async function saveIncome() {
    if (!month) return
    const amount = Number(income)
    if (!Number.isFinite(amount) || amount < 0 || amount === month.income) return
    await setMonthIncome(month.id, amount)
    await refresh()
  }

  async function savePlan(categoryId: string, value: string) {
    if (!month) return
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0) return
    await setPlan(month.id, categoryId, amount)
    await refresh()
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault()
    if (!newCategoryName.trim()) return
    await createCategory(newCategoryName.trim(), newCategoryKind, newCategoryGroup)
    setNewCategoryName('')
    await refresh()
  }

  async function changeGroup(categoryId: string, group: BudgetCategoryGroup) {
    await setCategoryGroup(categoryId, group)
    await refresh()
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Remove “${category.name}” and its category setup? Existing transactions will remain.`)) return
    await deleteCategory(category.id)
    await refresh()
  }

  if (!month || !currentMonthId) return <p>Loading your plan…</p>

  const isLocked = month.id < currentMonthId
  const plannedByCategory = new Map(plans.map((plan) => [plan.categoryId, plan.plannedAmount]))
  const totalPlanned = plans.reduce((sum, plan) => sum + plan.plannedAmount, 0)
  const remainder = month.income - totalPlanned

  return (
    <div className="workspace-screen">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Give every dollar a job</p>
          <h1>Plan</h1>
          <p>Set up next month before it starts. Your plan is saved as you go.</p>
        </div>
        <div className="month-switcher" aria-label="Choose month">
          <button type="button" aria-label="Previous month" onClick={() => setSelectedMonthId(previousMonthId(month.id))}>←</button>
          <strong>{month.id}</strong>
          <button type="button" aria-label="Next month" onClick={() => setSelectedMonthId(nextMonthId(month.id))}>→</button>
        </div>
      </div>

      <section className="money-summary" aria-label="Plan totals">
        <label className="summary-card income-card">
          <span>Money to plan</span>
          <span className="summary-value"><span aria-hidden="true">$</span><input
            aria-label="Monthly income available to plan"
            type="number" min="0" step="0.01" value={income}
            onChange={(event) => setIncome(event.target.value)} onBlur={() => void saveIncome()}
          /></span>
          <small>Income expected this month</small>
        </label>
        <div className="summary-card">
          <span>Planned</span><strong className="summary-value">{currency(totalPlanned)}</strong>
          <small>{currency(totalPlanned)} of {currency(month.income)} allocated</small>
        </div>
        <div className={`summary-card ${remainder < 0 ? 'summary-warning' : ''}`}>
          <span>{remainder < 0 ? 'Over planned' : 'Left to plan'}</span>
          <strong className="summary-value">{currency(Math.abs(remainder))}</strong>
          <small>{remainder < 0 ? 'Reduce category plans to balance' : 'Unassigned for this month'}</small>
        </div>
      </section>

      {isLocked && <p className="notice">This month is in the past. Its plan is read-only here.</p>}

      <section className="category-editor">
        <div className="section-title"><div><p className="eyebrow">Your budget</p><h2>Categories</h2></div></div>
        {GROUPS.map((group) => {
          const groupCategories = categories.filter((category) => (category.group ?? 'Needs') === group)
          const groupTotal = groupCategories.reduce((sum, category) => sum + (plannedByCategory.get(category.id) ?? 0), 0)
          return (
            <section className="category-group" key={group}>
              <div className="category-group-heading"><h3>{group}</h3><strong>{currency(groupTotal)}</strong></div>
              {groupCategories.length === 0 ? <p className="muted empty-group">No categories yet.</p> : (
                <div className="category-list">
                  {groupCategories.map((category) => (
                    <div className="category-row" key={category.id}>
                      <div className="category-name"><span className="category-dot" />
                        <div><strong>{category.name}</strong><small>{category.kind === 'accrue' ? 'Savings' : group}</small></div>
                      </div>
                      <label className="category-amount"><span className="sr-only">Plan for {category.name}</span>
                        <span>$</span><input type="number" min="0" step="0.01" disabled={isLocked}
                          defaultValue={plannedByCategory.get(category.id) ?? 0}
                          onBlur={(event) => void savePlan(category.id, event.target.value)} />
                      </label>
                      <select aria-label={`Group for ${category.name}`} disabled={isLocked}
                        value={category.group ?? 'Needs'} onChange={(event) => void changeGroup(category.id, event.target.value as BudgetCategoryGroup)}>
                        {GROUPS.map((option) => <option key={option}>{option}</option>)}
                      </select>
                      <button className="quiet-button" type="button" disabled={isLocked}
                        aria-label={`Delete ${category.name}`} onClick={() => void removeCategory(category)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </section>

      <form className="add-category-form" onSubmit={(event) => void addCategory(event)}>
        <h2>Add a category</h2>
        <input aria-label="New category name" placeholder="e.g. Groceries" value={newCategoryName}
          onChange={(event) => setNewCategoryName(event.target.value)} required />
        <select aria-label="Category group" value={newCategoryGroup}
          onChange={(event) => setNewCategoryGroup(event.target.value as BudgetCategoryGroup)}>
          {GROUPS.map((group) => <option key={group}>{group}</option>)}
        </select>
        <select aria-label="Category type" value={newCategoryKind}
          onChange={(event) => setNewCategoryKind(event.target.value as CategoryKind)}>
          <option value="consume">Spending</option><option value="accrue">Savings</option>
        </select>
        <button type="submit">Add category</button>
      </form>
    </div>
  )
}
