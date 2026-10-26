import { describe, expect, it } from 'vitest'
import { lowestInNMonths, renderCategoryLineText, renderHeadline } from './copyTemplates'
import type { CategoryLine } from './types'
import type { MonthlyActual } from './variance'

function line(overrides: Partial<CategoryLine> = {}): CategoryLine {
  return {
    categoryId: 'groceries',
    planState: 'WIN',
    trend: 'STEADY',
    actual: 300,
    planned: 300,
    prevActual: null,
    avg3: null,
    text: '',
    ...overrides,
  }
}

describe('lowestInNMonths', () => {
  it('returns 4 when the current month is the lowest of the last four', () => {
    const history: MonthlyActual[] = [
      { monthId: '2026-06', categoryId: 'groceries', actual: 400 },
      { monthId: '2026-07', categoryId: 'groceries', actual: 380 },
      { monthId: '2026-08', categoryId: 'groceries', actual: 350 },
    ]
    expect(lowestInNMonths('2026-09', 'groceries', 300, history)).toBe(4)
  })

  it('returns 1 when a more-recent prior month was even lower', () => {
    const history: MonthlyActual[] = [
      { monthId: '2026-08', categoryId: 'groceries', actual: 250 },
    ]
    expect(lowestInNMonths('2026-09', 'groceries', 300, history)).toBe(1)
  })
})

describe('renderCategoryLineText -- section 4.6 templates, every combination correctly substituted', () => {
  it('BIG_WIN + IMPROVING', () => {
    const history: MonthlyActual[] = [
      { monthId: '2026-06', categoryId: 'groceries', actual: 400 },
      { monthId: '2026-07', categoryId: 'groceries', actual: 380 },
      { monthId: '2026-08', categoryId: 'groceries', actual: 350 },
    ]
    const text = renderCategoryLineText(
      line({ planState: 'BIG_WIN', trend: 'IMPROVING', actual: 300, planned: 340, prevActual: 350 }),
      'Groceries',
      '2026-09',
      history,
    )
    expect(text).toBe(
      'Groceries: $300. Much better. $40 under plan and $50 below last month, your lowest in 4 months.',
    )
  })

  it('WIN + IMPROVING', () => {
    const text = renderCategoryLineText(
      line({ planState: 'WIN', trend: 'IMPROVING', actual: 300, planned: 350, prevActual: 400 }),
      'Groceries',
      '2026-09',
      [],
    )
    expect(text).toBe('Groceries: $300. Better. Under plan, and down $100 from last month.')
  })

  it('WIN + STEADY', () => {
    const text = renderCategoryLineText(
      line({ planState: 'WIN', trend: 'STEADY', actual: 300, planned: 300 }),
      'Groceries',
      '2026-09',
      [],
    )
    expect(text).toBe('Groceries: $300, to plan. Held.')
  })

  it('CLOSE', () => {
    const text = renderCategoryLineText(
      line({ planState: 'CLOSE', trend: 'STEADY', actual: 315, planned: 300 }),
      'Groceries',
      '2026-09',
      [],
    )
    expect(text).toBe('Groceries: $315 against a $300 plan. Close enough.')
  })

  it('SLIPPING + RISING', () => {
    const text = renderCategoryLineText(
      line({ planState: 'SLIPPING', trend: 'RISING', actual: 350, planned: 300 }),
      'Restaurants',
      '2026-09',
      [],
    )
    expect(text).toBe(
      'Restaurants: $350, $50 over. Second month climbing. Worth watching before it becomes the problem.',
    )
  })

  it('BLOWN + RISING', () => {
    const text = renderCategoryLineText(
      line({ planState: 'BLOWN', trend: 'RISING', actual: 500, planned: 300, avg3: 400 }),
      'Restaurants',
      '2026-09',
      [],
    )
    expect(text).toBe(
      'Restaurants: $500 against a $300 plan. Rising for the third month, now $100 above your average.',
    )
  })

  it('BLOWN + STEADY', () => {
    const text = renderCategoryLineText(
      line({ planState: 'BLOWN', trend: 'STEADY', actual: 410, planned: 300, avg3: 400 }),
      'Restaurants',
      '2026-09',
      [],
    )
    expect(text).toBe(
      'Restaurants: $410 against a $300 plan. The plan may simply be wrong. You have spent near $400 for three months.',
    )
  })
})

describe('renderHeadline', () => {
  const categoryNameById = new Map([
    ['groceries', 'Groceries'],
    ['restaurants', 'Restaurants'],
  ])

  it('renders the biggest improvement and biggest regression, matching the spec examples in style', () => {
    const improvement = line({
      categoryId: 'groceries',
      actual: 309,
      prevActual: 400,
    })
    const regression = line({
      categoryId: 'restaurants',
      planState: 'BLOWN',
      trend: 'RISING',
      actual: 410,
      planned: 300,
      prevActual: 350,
    })

    const [first, second] = renderHeadline([improvement, regression], categoryNameById, '2026-09', [])

    expect(first).toBe('Groceries came in $91 under last month.')
    expect(second).toBe('Restaurants went the other way, $110 over plan and rising for the third month.')
  })

  it('a month with no regressions produces an honest second sentence, not a manufactured one', () => {
    const improvement = line({ categoryId: 'groceries', actual: 300, prevActual: 400 })
    const [, second] = renderHeadline([improvement], categoryNameById, '2026-09', [])
    expect(second).toBe('No regressions this month.')
  })

  it('a month with no improvements produces an honest first sentence', () => {
    const regression = line({
      categoryId: 'restaurants',
      planState: 'SLIPPING',
      actual: 350,
      planned: 300,
      prevActual: 300,
    })
    const [first] = renderHeadline([regression], categoryNameById, '2026-09', [])
    expect(first).toBe('Nothing improved enough to call out this month.')
  })

  it('appends the streak claim only for a genuine multi-month record', () => {
    const history: MonthlyActual[] = [
      { monthId: '2026-06', categoryId: 'groceries', actual: 400 },
      { monthId: '2026-07', categoryId: 'groceries', actual: 380 },
      { monthId: '2026-08', categoryId: 'groceries', actual: 350 },
    ]
    const improvement = line({ categoryId: 'groceries', actual: 300, prevActual: 350 })
    const [first] = renderHeadline([improvement], categoryNameById, '2026-09', history)
    expect(first).toBe('Groceries came in $50 under last month, your best in 4 months.')
  })

  it('a regression that is still under plan is described honestly, not falsely as "over plan"', () => {
    const regression = line({
      categoryId: 'restaurants',
      planState: 'WIN',
      actual: 100,
      planned: 300,
      prevActual: 40,
    })
    const [, second] = renderHeadline([regression], categoryNameById, '2026-09', [])
    expect(second).toBe('Restaurants went the other way, up $60 from last month.')
  })
})
