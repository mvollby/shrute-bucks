import { useEffect, useState } from 'react'
import { getMonthsOverview, type MonthOverviewRow } from '../db/months'
import { NOT_PLANNED_COLOR, PLAN_STATE_COLOR } from './planStateStyle'

const COLUMN_WIDTH = 56
const CHART_HEIGHT = 160

// "The graph for everything in total" -- every month at a glance, its
// own tab, separate from Review's one-month-at-a-time detail. Planned
// bar next to an actual bar tinted by how that month went.
export function OverviewScreen() {
  const [overview, setOverview] = useState<MonthOverviewRow[] | null>(null)

  useEffect(() => {
    void getMonthsOverview().then(setOverview)
  }, [])

  if (!overview) return <p>Loading...</p>
  if (overview.length === 0) {
    return <p>No months yet -- set up a plan on the Plan screen to see them here.</p>
  }

  const maxTotal = Math.max(1, ...overview.flatMap((row) => [row.totalPlanned, row.totalActual]))
  const chartWidth = Math.max(200, overview.length * COLUMN_WIDTH)

  return (
    <div>
      <section className="month-history">
      <h2>Month history</h2>
      <p>Planned vs. actual spending, with each month’s result at a glance.</p>
      <div style={{ overflowX: 'auto' }}>
        <svg width={chartWidth} height={CHART_HEIGHT} role="img" aria-label="Planned vs actual by month">
          {overview.map((row, index) => {
            const x = index * COLUMN_WIDTH
            const color = row.planState ? PLAN_STATE_COLOR[row.planState] : NOT_PLANNED_COLOR
            const plannedHeight = (row.totalPlanned / maxTotal) * (CHART_HEIGHT - 24)
            const actualHeight = (row.totalActual / maxTotal) * (CHART_HEIGHT - 24)
            return (
              <g key={row.monthId}>
                <rect
                  x={x + 4}
                  y={CHART_HEIGHT - 20 - plannedHeight}
                  width={16}
                  height={plannedHeight}
                  fill={NOT_PLANNED_COLOR}
                />
                <rect
                  x={x + 24}
                  y={CHART_HEIGHT - 20 - actualHeight}
                  width={16}
                  height={actualHeight}
                  fill={color}
                />
                <text x={x + COLUMN_WIDTH / 2} y={CHART_HEIGHT - 6} fontSize={9} textAnchor="middle">
                  {row.monthId.slice(5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      </section>
    </div>
  )
}
