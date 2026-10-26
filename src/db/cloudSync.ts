import type { SupabaseClient } from '@supabase/supabase-js'
import type { BudgetTableName, LocalMutation } from './db'
import { db, setLocalMutationListener, withoutMutationTracking } from './db'

const TABLES: BudgetTableName[] = ['transactions', 'rules', 'categories', 'months', 'plans']
const CLOUD_TABLE = 'budget_records'
const PAGE_SIZE = 500

interface PendingChange extends LocalMutation {
  changedAt: string
}

interface CloudRecord {
  user_id: string
  table_name: BudgetTableName
  record_id: string
  data: unknown | null
  deleted: boolean
  updated_at: string
}

export type CloudSyncStatus = 'syncing' | 'synced' | 'offline' | 'error'
export interface CloudSyncHandle {
  stop: () => void
  syncNow: () => void
}

function outboxKey(userId: string): string {
  return `shrute-bucks-sync-queue:${userId}`
}

function readOutbox(userId: string): Map<string, PendingChange> {
  try {
    const raw = localStorage.getItem(outboxKey(userId))
    const entries = raw ? (JSON.parse(raw) as PendingChange[]) : []
    return new Map(entries.map((entry) => [`${entry.tableName}:${entry.recordId}`, entry]))
  } catch {
    return new Map()
  }
}

function writeOutbox(userId: string, queue: Map<string, PendingChange>): void {
  localStorage.setItem(outboxKey(userId), JSON.stringify([...queue.values()]))
}

function remoteKey(tableName: BudgetTableName, recordId: string): string {
  return `${tableName}:${recordId}`
}

function serialize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => {
    if (item instanceof RegExp) return { __shruteType: 'RegExp', source: item.source, flags: item.flags }
    return item
  })) as unknown
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive)
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>
    if (item.__shruteType === 'RegExp' && typeof item.source === 'string') {
      return new RegExp(item.source, typeof item.flags === 'string' ? item.flags : '')
    }
    return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, revive(child)]))
  }
  return value
}

async function localRecords(): Promise<Map<string, { tableName: BudgetTableName; recordId: string; data: unknown }>> {
  const result = new Map<string, { tableName: BudgetTableName; recordId: string; data: unknown }>()
  for (const tableName of TABLES) {
    const records = await db.table(tableName).toArray() as Array<{ id: string }>
    for (const record of records) {
      result.set(remoteKey(tableName, record.id), { tableName, recordId: record.id, data: serialize(record) })
    }
  }
  return result
}

async function fetchCloudRecords(client: SupabaseClient, userId: string): Promise<CloudRecord[]> {
  const result: CloudRecord[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(CLOUD_TABLE)
      .select('user_id, table_name, record_id, data, deleted, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as CloudRecord[]
    result.push(...page)
    if (page.length < PAGE_SIZE) return result
  }
}

function setPending(
  queue: Map<string, PendingChange>,
  mutation: LocalMutation,
  userId: string,
): void {
  queue.set(remoteKey(mutation.tableName, mutation.recordId), {
    ...mutation,
    changedAt: new Date().toISOString(),
  })
  writeOutbox(userId, queue)
}

async function pushRecords(
  client: SupabaseClient,
  userId: string,
  queue: Map<string, PendingChange>,
  local: Map<string, { tableName: BudgetTableName; recordId: string; data: unknown }>,
): Promise<void> {
  const pending = [...queue.entries()]
  const rows: CloudRecord[] = pending.map(([, change]) => {
    const localRecord = local.get(remoteKey(change.tableName, change.recordId))
    const isDeleted = change.operation === 'delete' || !localRecord
    return {
      user_id: userId,
      table_name: change.tableName,
      record_id: change.recordId,
      data: isDeleted ? null : localRecord.data,
      deleted: isDeleted,
      updated_at: new Date().toISOString(),
    }
  })

  for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
    const { error } = await client.from(CLOUD_TABLE).upsert(rows.slice(offset, offset + PAGE_SIZE), {
      onConflict: 'user_id,table_name,record_id',
    })
    if (error) throw error
  }

  for (const [key, sent] of pending) {
    if (queue.get(key)?.changedAt === sent.changedAt) queue.delete(key)
  }
  writeOutbox(userId, queue)
}

async function applyCloudRecords(records: CloudRecord[], queue: Map<string, PendingChange>): Promise<void> {
  const latest = new Map(records.map((record) => [remoteKey(record.table_name, record.record_id), record]))
  await withoutMutationTracking(async () => {
    for (const tableName of TABLES) {
      const tableRecords = [...latest.values()].filter((record) => record.table_name === tableName)
      const toDelete: string[] = []
      const toSave: unknown[] = []
      for (const record of tableRecords) {
        const key = remoteKey(record.table_name, record.record_id)
        if (queue.has(key)) continue
        if (record.deleted) toDelete.push(record.record_id)
        else if (record.data) toSave.push(revive(record.data))
      }
      if (toDelete.length) await db.table(tableName).bulkDelete(toDelete)
      if (toSave.length) await db.table(tableName).bulkPut(toSave)
    }
  })
}

async function syncOnce(client: SupabaseClient, userId: string, queue: Map<string, PendingChange>): Promise<void> {
  const [cloud, local] = await Promise.all([fetchCloudRecords(client, userId), localRecords()])
  const cloudByKey = new Map(cloud.map((record) => [remoteKey(record.table_name, record.record_id), record]))

  // Merge local-only records into an existing cloud budget. If the cloud has
  // no records yet, this is the one-time upload of the old browser-only data.
  for (const [key, record] of local) {
    if (!cloudByKey.has(key) && !queue.has(key)) {
      queue.set(key, {
        tableName: record.tableName,
        recordId: record.recordId,
        operation: 'upsert',
        changedAt: new Date().toISOString(),
      })
    }
  }
  writeOutbox(userId, queue)

  if (queue.size) {
    await pushRecords(client, userId, queue, local)
  }

  const freshCloud = await fetchCloudRecords(client, userId)
  await applyCloudRecords(freshCloud, queue)
}

export async function startCloudSync(
  client: SupabaseClient,
  userId: string,
  onStatus: (status: CloudSyncStatus, message?: string) => void,
): Promise<CloudSyncHandle> {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let mutationVersion = 0
  const queue = readOutbox(userId)

  const run = async () => {
    if (stopped || running) return
    if (!navigator.onLine) {
      onStatus('offline', 'Offline — changes will sync when you reconnect.')
      return
    }
    running = true
    const versionAtStart = mutationVersion
    onStatus('syncing', 'Syncing budget…')
    try {
      await syncOnce(client, userId, queue)
      if (!stopped) onStatus(queue.size ? 'offline' : 'synced', queue.size ? 'Changes waiting to sync.' : 'Budget synced')
    } catch (error) {
      if (!stopped) onStatus('error', error instanceof Error ? error.message : 'Cloud sync failed.')
    } finally {
      running = false
      if (!stopped && mutationVersion !== versionAtStart) schedule()
    }
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void run(), 350)
  }

  setLocalMutationListener((mutation) => {
    mutationVersion += 1
    setPending(queue, mutation, userId)
    schedule()
  })
  await run()

  const interval = window.setInterval(() => void run(), 30_000)
  window.addEventListener('focus', schedule)
  window.addEventListener('online', schedule)

  return {
    stop: () => {
      stopped = true
      setLocalMutationListener(() => undefined)
      if (timer) clearTimeout(timer)
      window.clearInterval(interval)
      window.removeEventListener('focus', schedule)
      window.removeEventListener('online', schedule)
    },
    syncNow: schedule,
  }
}
