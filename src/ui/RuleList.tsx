import { useEffect, useState } from 'react'
import type { Rule } from '../core/types'
import { db } from '../db/db'

// "Editable rule list UI. A plain table is fine." -- section 16, stage 03.
// No category picker yet since nothing has built category management;
// category is a free-text id until that exists.
export function RuleList() {
  const [rules, setRules] = useState<Rule[]>([])

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const all = await db.rules.toArray()
    setRules(all)
  }

  async function updateCategory(id: string, categoryId: string) {
    await db.rules.update(id, { categoryId })
    await refresh()
  }

  async function deleteRule(id: string) {
    await db.rules.delete(id)
    await refresh()
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Match</th>
          <th>Category</th>
          <th>Hits</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => (
          <tr key={rule.id}>
            <td>{rule.match instanceof RegExp ? rule.match.source : rule.match}</td>
            <td>
              <input
                defaultValue={rule.categoryId}
                onBlur={(event) => {
                  if (event.target.value !== rule.categoryId) {
                    void updateCategory(rule.id, event.target.value)
                  }
                }}
              />
            </td>
            <td>{rule.hits}</td>
            <td>{rule.createdAt}</td>
            <td>
              <button type="button" onClick={() => void deleteRule(rule.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
