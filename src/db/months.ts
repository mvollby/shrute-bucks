import { classifyPlanState } from '../core/classify'
import type { Clock } from '../core/clock'
import { systemClock } from '../core/clock'
import { assertMonthNotClosed } from '../core/monthState'
import { monthSummary, type CategorySummary } from '../core/monthSummary'
import type { Month, PlanState, Trend } from '../core/types'
import { varianceVsAverage, varianceVsPrevious, type MonthlyActual } from '../core/variance'
import { listCategories } from './categories'
import { db } from './db'
import { listPlansForMonth } from './plans'

function currentMonthId(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// A budgeting app you check whenever you want, not one with a manual
// "close the month" ritual: "current" is always just today's real
// calendar month, full stop -- no more picking "whichever month isn't
// CLOSED yet." This is what makes month advancement automatic (section
// user asked for: no button, October just becomes current the moment the
// calendar reaches it).
//
// put() rather than add(): React StrictMode double-invokes effects, so
// two concurrent first calls can both observe "this month doesn't exist"
// and both try to create it -- put() makes that harmless.
export async function getOrCreateMonth(monthId: string): Promise<Month> {
  const existing = await db.months.get(monthId)
  if (existing) return existing

  const month: Month = { id: monthId, state: 'OPEN', income: 0, residentEarned: false }
  await db.months.put(month)
  return month
}

export async function getCurrentMonth(clock: Clock = systemClock): Promise<Month> {
  return getOrCreateMonth(currentMonthId(clock()))
}

export async function setMonthIncome(monthId: string, income: number): Promise<void> {
  const month = await db.months.get(monthId)
  if (!month) throw new Error(`Month ${monthId} not found`)
  assertMonthNotClosed(month)
  await db.months.put({ ...month, income })
}

// Builds the cross-month actuals history the trend/comparison functions
// need, from every *other* month stored so far.
async function buildHistory(excludingMonthId: string): Promise<MonthlyActual[]> {
  const [allMonths, transactions] = await Promise.all([
    db.months.toArray(),
    db.transactions.toArray(),
  ])

  const history: MonthlyActual[] = []
  for (const month of allMonths) {
    if (month.id === excludingMonthId) continue
    const plan = await listPlansForMonth(month.id)
    for (const summary of monthSummary(month, transactions, plan)) {
      history.push({ monthId: month.id, categoryId: summary.categoryId, actual: summary.actual })
    }
  }
  return history
}

export async function listAllMonths(): Promise<Month[]> {
  return db.months.toArray()
}

export interface MonthComparisonLine extends CategorySummary {
  prevActual: number | null
  avg3: number | null
  trend: Trend
}

// The plain, always-available "how did this month go" numbers for one
// month -- no calendar gate, no narrative copy, works for any stored
// month regardless of whether it's the current, a future (pre-planned),
// or a past month.
export async function getMonthComparison(monthId: string): Promise<MonthComparisonLine[]> {
  // Review browses months with plain prev/next arrows, including ones
  // nobody has ever touched (e.g. paging back before any data exists) --
  // a month with no stored row is just a month with nothing planned, not
  // an error; monthSummary() only ever reads `.id` off this, so a
  // synthetic placeholder is exactly as good as the real row for this.
  const month = (await db.months.get(monthId)) ?? {
    id: monthId,
    state: 'OPEN' as const,
    income: 0,
    residentEarned: false,
  }

  const [transactions, plan, history] = await Promise.all([
    db.transactions.toArray(),
    listPlansForMonth(monthId),
    buildHistory(monthId),
  ])

  return monthSummary(month, transactions, plan).map((summary) => {
    const { prevActual } = varianceVsPrevious(monthId, summary.categoryId, summary.actual, history)
    const { avg3, trend } = varianceVsAverage(monthId, summary.categoryId, summary.actual, history)
    return { ...summary, prevActual, avg3, trend }
  })
}

export interface MonthOverviewRow {
  monthId: string
  totalPlanned: number
  totalActual: number
  variance: number
  // null when nothing has been planned for this month yet (a freshly
  // created future month) -- "0 spent against 0 planned" is not a WIN,
  // it's "not planned yet", so it's kept out of the WIN/BLOWN scale
  // entirely rather than reported as one.
  planState: PlanState | null
}

// The "graph of each month, which ones went well and which don't": one
// row per stored month (current, past, or pre-planned future), consume
// categories only (an accrue/savings category running "over" its plan is
// good, not bad -- same reasoning as the old residentEarned check),
// classified with the same WIN/BLOWN scale already used per-category
// (core/classify.ts) but applied to the month's *total* consume spend,
// so one month is one clear verdict rather than a pile of category rows.
export async function getMonthsOverview(): Promise<MonthOverviewRow[]> {
  const [allMonths, transactions, categories] = await Promise.all([
    db.months.toArray(),
    db.transactions.toArray(),
    listCategories(),
  ])

  const consumeCategoryIds = new Set(
    categories.filter((c) => c.kind === 'consume').map((c) => c.id),
  )
  const sortedIds = allMonths.map((m) => m.id).sort((a, b) => a.localeCompare(b))

  const totalsByMonth = new Map<string, { planned: number; actual: number }>()
  for (const month of allMonths) {
    const plan = await listPlansForMonth(month.id)
    const consumeSummaries = monthSummary(month, transactions, plan).filter((s) =>
      consumeCategoryIds.has(s.categoryId),
    )
    totalsByMonth.set(month.id, {
      planned: consumeSummaries.reduce((sum, s) => sum + s.planned, 0),
      actual: consumeSummaries.reduce((sum, s) => sum + s.actual, 0),
    })
  }

  return sortedIds.map((monthId, index) => {
    const { planned, actual } = totalsByMonth.get(monthId)!
    const prevMonthId = index > 0 ? sortedIds[index - 1] : null
    const prevActual = prevMonthId ? totalsByMonth.get(prevMonthId)!.actual : null

    return {
      monthId,
      totalPlanned: planned,
      totalActual: actual,
      variance: actual - planned,
      planState: planned === 0 ? null : classifyPlanState(actual, planned, prevActual),
    }
  })
}
