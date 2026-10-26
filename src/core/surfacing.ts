import type { CategoryLine } from './types'

const MIN_DOLLAR_MOVE = 25
const MIN_PERCENT_MOVE = 0.05
const MAX_PER_DIRECTION = 3

export interface SurfacingResult {
  // Improvements (best first), then regressions (worst first).
  surfaced: CategoryLine[]
  steadyCount: number
}

function deltaOf(line: CategoryLine): number | null {
  return line.prevActual === null ? null : line.actual - line.prevActual
}

// section 4.4: "If a category moved less than $25 or less than 5%, it
// never appears individually regardless of rank." A category with no
// previous month to compare against has nothing to rank by, so it's
// never eligible either -- it just collapses into steadyCount.
function isEligible(line: CategoryLine): boolean {
  if (line.prevActual === null) return false

  const dollarMove = Math.abs(line.actual - line.prevActual)
  if (dollarMove < MIN_DOLLAR_MOVE) return false

  const percentMove = line.prevActual === 0 ? Infinity : dollarMove / Math.abs(line.prevActual)
  return percentMove >= MIN_PERCENT_MOVE
}

// "Rank by absolute dollars moved against last month, never by
// percentage... Show at most three improvements and at most three
// regressions. Everything else collapses into a single line."
export function surface(lines: CategoryLine[]): SurfacingResult {
  const eligible = lines.filter(isEligible)
  const rankedByDollarMove = eligible
    .slice()
    .sort((a, b) => Math.abs(deltaOf(b)!) - Math.abs(deltaOf(a)!))

  const improvements = rankedByDollarMove.filter((line) => deltaOf(line)! < 0).slice(0, MAX_PER_DIRECTION)
  const regressions = rankedByDollarMove.filter((line) => deltaOf(line)! > 0).slice(0, MAX_PER_DIRECTION)

  const surfaced = [...improvements, ...regressions]
  const surfacedIds = new Set(surfaced.map((line) => line.categoryId))
  const steadyCount = lines.filter((line) => !surfacedIds.has(line.categoryId)).length

  return { surfaced, steadyCount }
}
