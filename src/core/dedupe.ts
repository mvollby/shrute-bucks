import type { ParsedTransaction } from './parsedTransaction'

export interface HashedTransaction extends ParsedTransaction {
  accountId: string
  hash: string
}

// Not the full merchant normalization from section 11.4 (stage 03) --
// that collapses "CHIPOTLE 2481 SEATTLE WA" and "CHIPOTLE 0113 PORTLAND"
// to the same merchant, which would be wrong here: those are different
// transactions and must hash differently. This only needs re-importing the
// *same* row to produce the *same* hash, so it just normalizes incidental
// whitespace/case differences a CSV export could introduce between runs.
function normalizeForHash(description: string): string {
  return description.trim().replace(/\s+/g, ' ').toLowerCase()
}

// section 11.2: hash = sha1(date + normalizedDescription + amount + accountId).
// Fields are joined with a separator (the spec's pseudocode concatenates
// them directly) to avoid different field combinations hashing identically,
// e.g. date "2026-9" + amount "-12" colliding with date "2026-9-1" + amount "2".
export async function computeTransactionHash(
  transaction: Pick<ParsedTransaction, 'date' | 'description' | 'amount'>,
  accountId: string,
): Promise<string> {
  const payload = [
    transaction.date,
    normalizeForHash(transaction.description),
    transaction.amount.toString(),
    accountId,
  ].join('|')

  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashTransactions(
  transactions: ParsedTransaction[],
  accountId: string,
): Promise<HashedTransaction[]> {
  return Promise.all(
    transactions.map(async (transaction) => ({
      ...transaction,
      accountId,
      hash: await computeTransactionHash(transaction, accountId),
    })),
  )
}

// Returns only the incoming transactions whose hash isn't already present
// in `existing` -- i.e. what actually needs to be inserted. Re-importing the
// same file is then a complete no-op: dedupeByHash(existing, existing)
// returns [].
export function dedupeByHash<T extends { hash: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(existing.map((t) => t.hash))
  const result: T[] = []

  for (const transaction of incoming) {
    if (!seen.has(transaction.hash)) {
      seen.add(transaction.hash)
      result.push(transaction)
    }
  }

  return result
}
