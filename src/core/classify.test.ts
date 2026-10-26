import { describe, expect, it } from 'vitest'
import { classifyPlanState } from './classify'

describe('classifyPlanState', () => {
  it('BIG_WIN at the exact 0.85x-of-previous boundary', () => {
    // planned=90, actual=85, prevActual=100 -> 85 <= 90 and 85 <= 100*0.85 (85)
    expect(classifyPlanState(85, 90, 100)).toBe('BIG_WIN')
  })

  it('is not BIG_WIN just above the 0.85x boundary', () => {
    expect(classifyPlanState(85.01, 90, 100)).toBe('WIN')
  })

  it('is never BIG_WIN when there is no previous month', () => {
    expect(classifyPlanState(50, 100, null)).toBe('WIN')
  })

  it('WIN at actual === planned', () => {
    expect(classifyPlanState(100, 100, 100)).toBe('WIN')
  })

  it('CLOSE at the exact 1.05x-of-planned boundary', () => {
    expect(classifyPlanState(105, 100, null)).toBe('CLOSE')
  })

  it('is not CLOSE just above the 1.05x boundary', () => {
    expect(classifyPlanState(105.01, 100, null)).toBe('SLIPPING')
  })

  it('SLIPPING at the exact 1.20x-of-planned boundary', () => {
    expect(classifyPlanState(120, 100, null)).toBe('SLIPPING')
  })

  it('BLOWN just above the 1.20x boundary', () => {
    expect(classifyPlanState(120.01, 100, null)).toBe('BLOWN')
  })
})
