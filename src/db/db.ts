import Dexie, { type Table } from 'dexie'
import type { Category, Month, Plan, Rule, Transaction } from '../core/types'

export interface PlanRecord extends Plan {
  id: string // `${monthId}:${categoryId}` -- Dexie needs a primary key, Plan itself has none
}

export type BudgetTableName = 'transactions' | 'rules' | 'categories' | 'months' | 'plans'
export interface LocalMutation {
  tableName: BudgetTableName
  recordId: string
  operation: 'upsert' | 'delete'
}

let mutationListener: (mutation: LocalMutation) => void = () => undefined
let trackingPaused = false

// Schema declares only what's needed so far. Goals and residents get added
// via version bumps in the stages that actually start reading/writing them.
export class ShruteBucksDB extends Dexie {
  transactions!: Table<Transaction, string>
  rules!: Table<Rule, string>
  categories!: Table<Category, string>
  months!: Table<Month, string>
  plans!: Table<PlanRecord, string>

  constructor(name = 'shrute-bucks') {
    super(name)
    this.version(1).stores({
      // &hash = unique index: a DB-level backstop for the content-hash
      // dedupe in src/core/dedupe.ts, in case anything ever calls
      // db.transactions.add() without going through that check first.
      transactions: 'id, &hash, accountId, date, categoryId',
    })
    this.version(2).stores({
      // No index on `match`: it's string | RegExp (a RegExp can't be used
      // as an IndexedDB key), and rule sets are small enough that scanning
      // with `.toArray()` and filtering in JS is simpler and plenty fast.
      rules: 'id, categoryId, createdAt',
    })
    this.version(3).stores({
      categories: 'id, kind',
      months: 'id, state',
      plans: 'id, monthId, categoryId',
    })

    for (const tableName of ['transactions', 'rules', 'categories', 'months', 'plans'] as const) {
      const table = this.table(tableName)
      table.hook('creating', (primaryKey, record) => {
        emitMutation(tableName, String(primaryKey ?? (record as { id?: string }).id))
      })
      table.hook('updating', (_modifications, primaryKey) => {
        emitMutation(tableName, String(primaryKey))
      })
      table.hook('deleting', (primaryKey) => {
        emitMutation(tableName, String(primaryKey), 'delete')
      })
    }
  }
}

function emitMutation(tableName: BudgetTableName, recordId: string, operation: 'upsert' | 'delete' = 'upsert') {
  if (!trackingPaused && recordId) mutationListener({ tableName, recordId, operation })
}

export function setLocalMutationListener(listener: (mutation: LocalMutation) => void): void {
  mutationListener = listener
}

export async function withoutMutationTracking<T>(callback: () => Promise<T>): Promise<T> {
  trackingPaused = true
  try {
    return await callback()
  } finally {
    trackingPaused = false
  }
}

export let db = new ShruteBucksDB()

let activationQueue = Promise.resolve()

export function activateUserDatabase(userId: string): Promise<void> {
  activationQueue = activationQueue.then(() => activateUserDatabaseNow(userId))
  return activationQueue
}

async function activateUserDatabaseNow(userId: string): Promise<void> {
  const targetName = `shrute-bucks-user-${userId}`
  if (db.name === targetName) return
  const previous = db
  const next = new ShruteBucksDB(targetName)
  await next.open()

  // A previous version kept all records in a single browser database. Move
  // that data into the first signed-in user's private local database once.
  const migrated = typeof localStorage !== 'undefined' && localStorage.getItem('shrute-bucks-legacy-migrated') === 'yes'
  if (previous.name === 'shrute-bucks' && !migrated) {
    await withoutMutationTracking(async () => {
      let foundRecords = false
      for (const tableName of ['transactions', 'rules', 'categories', 'months', 'plans'] as const) {
        const records = await previous.table(tableName).toArray()
        if (records.length) foundRecords = true
        if (records.length) await next.table(tableName).bulkPut(records)
      }
      if (foundRecords && typeof localStorage !== 'undefined') {
        localStorage.setItem('shrute-bucks-legacy-migrated', 'yes')
      }
    })
  }

  db = next
  previous.close()
}
