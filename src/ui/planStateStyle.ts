import type { PlanState } from '../core/types'

// Shared between Review (one month's category statuses) and Overview
// (every month's total, at a glance) so the same color always means the
// same thing across both screens.
export const PLAN_STATE_COLOR: Record<PlanState, string> = {
  BIG_WIN: '#4f7a3d',
  WIN: '#6f9a4d',
  CLOSE: '#c9a53b',
  SLIPPING: '#c97a3b',
  BLOWN: '#a13d2b',
}

export const PLAN_STATE_LABEL: Record<PlanState, string> = {
  BIG_WIN: 'Big win',
  WIN: 'On track',
  CLOSE: 'Close',
  SLIPPING: 'Slipping',
  BLOWN: 'Over budget',
}

export const NOT_PLANNED_COLOR = '#9aa5b1'
