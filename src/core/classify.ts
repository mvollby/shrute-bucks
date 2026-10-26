import type { PlanState } from './types'

// section 4.2, consumption categories only. Order matters: WIN's condition
// is a superset of BIG_WIN's, so BIG_WIN must be checked first or it would
// never be reached.
export function classifyPlanState(
  actual: number,
  planned: number,
  prevActual: number | null,
): PlanState {
  if (prevActual !== null && actual <= planned && actual <= prevActual * 0.85) {
    return 'BIG_WIN'
  }
  if (actual <= planned) {
    return 'WIN'
  }
  if (actual <= planned * 1.05) {
    return 'CLOSE'
  }
  if (actual <= planned * 1.2) {
    return 'SLIPPING'
  }
  return 'BLOWN'
}
