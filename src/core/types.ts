// Data model per SPEC.md section 10.
// Building is deliberately absent from this file: it is derived on every
// render from Category + Plan + Transaction + allocation history, and is
// never stored. See section 2, invariant 2.

export type CategoryKind = 'consume' | 'accrue'
export type BudgetCategoryGroup = 'Bills' | 'Needs' | 'Wants'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  group?: BudgetCategoryGroup
  buildingStyleId: string
  districtId: string
}

export interface Transaction {
  id: string
  date: string // ISO date
  description: string
  rawDescription: string
  amount: number // negative = money out, positive = money in
  accountId: string
  categoryId?: string
  hash: string // dedupe key across re-imports, see section 11.2
}

export interface Rule {
  id: string
  match: string | RegExp
  categoryId: string
  hits: number
  createdAt: string // ISO datetime
}

export type MonthState = 'OPEN' | 'REVIEW_READY' | 'REVIEWED' | 'CLOSED'

// Per-category classification against plan, section 4.2.
export type PlanState = 'BIG_WIN' | 'WIN' | 'CLOSE' | 'SLIPPING' | 'BLOWN'

// Trend vs. trailing average, computed independently of plan, section 4.3.
export type Trend = 'IMPROVING' | 'STEADY' | 'RISING' | 'UNKNOWN'

export interface CategoryLine {
  categoryId: string
  planState: PlanState
  trend: Trend
  actual: number
  planned: number
  prevActual: number | null // null when there's no previous month to compare against
  avg3: number | null // null when trend is UNKNOWN (fewer than 2 closed months)
  text: string // rendered copy from the section 4.6 templates
}

export interface Verdict {
  headline: [string, string]
  lines: CategoryLine[]
  oneAdjustment?: string
  steadyCount: number
}

export interface Month {
  id: string // YYYY-MM
  state: MonthState
  income: number
  reviewedAt?: string // ISO datetime
  closedAt?: string // ISO datetime
  residentEarned: boolean
  verdict?: Verdict
}

export interface Plan {
  monthId: string
  categoryId: string
  plannedAmount: number
}

export interface GoalSegment {
  label: string
  amount: number
  funded: boolean
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  segments: GoalSegment[]
  buildingStyleId: string
  completedAt?: string // ISO datetime
}

export interface ResidentLayers {
  hairBack: number
  skin: number
  shoes: number
  legs: number
  shirt: number
  facialHair: number
  face: number
  hairFront: number
  glasses: number
  hat: number
}

export interface Resident {
  id: string
  name: string
  layers: ResidentLayers
  earnedInMonthId: string
  homeTileX: number
  homeTileY: number
  giftRecipient?: boolean
}
