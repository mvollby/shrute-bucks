// Shared YYYY-MM arithmetic, extracted here because a third caller
// (copyTemplates.ts's streak calculation) would otherwise duplicate the
// same logic already private-copied into variance.ts and closeMonth.ts.

export function previousMonthId(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  date.setUTCMonth(date.getUTCMonth() - 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function nextMonthId(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  date.setUTCMonth(date.getUTCMonth() + 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function lastNMonthIds(monthId: string, n: number): string[] {
  const ids: string[] = []
  let cursor = monthId
  for (let i = 0; i < n; i++) {
    cursor = previousMonthId(cursor)
    ids.push(cursor)
  }
  return ids
}
