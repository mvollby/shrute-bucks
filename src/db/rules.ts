import { createRuleFromCategorization } from '../core/rules'
import { normalizeMerchant } from '../core/normalizeMerchant'
import { db } from './db'

// Hand-categorizing a transaction writes (or updates) a Rule for its
// merchant, so every future import auto-categorizes the same merchant
// (section 11.4). One rule per normalized merchant: recategorizing a
// merchant updates the existing rule's category rather than piling up a
// duplicate.
export async function categorizeTransaction(
  transactionId: string,
  categoryId: string,
): Promise<void> {
  const transaction = await db.transactions.get(transactionId)
  if (!transaction) {
    throw new Error(`Transaction ${transactionId} not found`)
  }

  await db.transactions.update(transactionId, { categoryId })

  const match = normalizeMerchant(transaction.rawDescription)
  const existingRule = (await db.rules.toArray()).find((rule) => rule.match === match)

  if (existingRule) {
    await db.rules.update(existingRule.id, { categoryId })
  } else {
    const rule = createRuleFromCategorization(transaction, categoryId, new Date().toISOString())
    await db.rules.add(rule)
  }
}
