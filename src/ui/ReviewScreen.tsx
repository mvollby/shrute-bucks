import { useEffect, useState } from 'react'
import { nextMonthId, previousMonthId } from '../core/monthId'
import type { BudgetCategoryGroup, Category, CategoryKind } from '../core/types'
import { listCategories } from '../db/categories'
import { getCurrentMonth, getMonthComparison, type MonthComparisonLine } from '../db/months'
import { setPlan } from '../db/plans'
import { OverviewScreen } from './OverviewScreen'

const GROUPS: BudgetCategoryGroup[] = ['Bills', 'Needs', 'Wants']
const money = (amount: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount)

function lineStatus(kind: CategoryKind, variance: number) {
  if (kind === 'accrue') return variance >= 0 ? { text: 'Building up', tone: 'good' } : { text: 'Below plan', tone: 'watch' }
  if (variance > 0) return { text: 'Over plan', tone: 'watch' }
  if (variance < 0) return { text: 'On track', tone: 'good' }
  return { text: 'Right on plan', tone: 'neutral' }
}

export function ReviewScreen() {
  const [monthId, setMonthId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [lines, setLines] = useState<{ monthId: string; data: MonthComparisonLine[] } | null>(null)

  useEffect(() => {
    void Promise.all([getCurrentMonth(), listCategories()]).then(([month, allCategories]) => {
      setMonthId((previous) => previous ?? month.id)
      setCategories(allCategories)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    void getMonthComparison(monthId).then((data) => setLines({ monthId, data }))
  }, [monthId])

  async function updatePlanned(categoryId: string, value: string) {
    if (!monthId) return
    const plannedAmount = Number(value)
    if (!Number.isFinite(plannedAmount) || plannedAmount < 0) return
    await setPlan(monthId, categoryId, plannedAmount)
    setLines({ monthId, data: await getMonthComparison(monthId) })
  }

  if (!monthId) return <p>Loading this month…</p>
  const monthLines = lines?.monthId === monthId ? lines.data : null
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const totalPlanned = monthLines?.reduce((sum, line) => sum + line.planned, 0) ?? 0
  const totalActual = monthLines?.reduce((sum, line) => sum + line.actual, 0) ?? 0
  const grouped = GROUPS.map((group) => ({
    group,
    lines: (monthLines ?? []).filter((line) => (categoryById.get(line.categoryId)?.group ?? 'Needs') === group),
  }))

  return (
    <div className="workspace-screen">
      <div className="screen-heading">
        <div><p className="eyebrow">Your month, in real numbers</p><h1>Reflect</h1>
          <p>Imported transactions determine Actual. You can still adjust the plan for any month.</p></div>
        <div className="month-switcher" aria-label="Choose month">
          <button type="button" aria-label="Previous month" onClick={() => setMonthId(previousMonthId(monthId))}>←</button>
          <strong>{monthId}</strong>
          <button type="button" aria-label="Next month" onClick={() => setMonthId(nextMonthId(monthId))}>→</button>
        </div>
      </div>

      {monthLines === null ? <p>Loading month…</p> : monthLines.length === 0 ? (
        <div className="empty-state"><strong>No data available</strong><p>No plan or categorized transactions have been saved for {monthId} yet.</p></div>
      ) : <>
        <section className="money-summary reflect-summary">
          <div className="summary-card"><span>Planned</span><strong className="summary-value">{money(totalPlanned)}</strong></div>
          <div className="summary-card"><span>Actual</span><strong className="summary-value">{money(totalActual)}</strong></div>
          <div className="summary-card"><span>Difference</span><strong className="summary-value">{money(totalActual - totalPlanned)}</strong></div>
        </section>

        {grouped.map(({ group, lines: groupLines }) => groupLines.length > 0 && (
          <section className="reflect-group" key={group}>
            <div className="category-group-heading"><h2>{group}</h2>
              <strong>{money(groupLines.reduce((sum, line) => sum + line.actual, 0))} actual</strong></div>
            <div className="reflect-list">
              {groupLines.map((line) => {
                const category = categoryById.get(line.categoryId)
                const kind = category?.kind ?? 'consume'
                const status = lineStatus(kind, line.variance)
                return (
                  <article className="reflect-row" key={line.categoryId}>
                    <div className="reflect-category"><strong>{category?.name ?? 'Removed category'}</strong>
                      <span className={`status-pill ${status.tone}`}>{status.text}</span></div>
                    <div className="reflect-metric"><span>Planned</span><label className="category-amount"><span>$</span>
                      <input aria-label={`Planned amount for ${category?.name ?? 'category'}`} type="number" min="0" step="0.01"
                        key={`${monthId}:${line.categoryId}:${line.planned}`} defaultValue={line.planned}
                        onBlur={(event) => void updatePlanned(line.categoryId, event.target.value)} />
                    </label></div>
                    <div className="reflect-metric"><span>Actual</span><strong>{money(line.actual)}</strong></div>
                    <div className={`reflect-metric ${status.tone}`}><span>Difference</span><strong>{money(Math.abs(line.variance))} {kind === 'accrue' ? (line.variance >= 0 ? 'ahead' : 'short') : (line.variance > 0 ? 'over' : 'left')}</strong></div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
        <OverviewScreen />
      </>}
    </div>
  )
}
