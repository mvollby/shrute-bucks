import { normalizeMerchant } from './normalizeMerchant'
import type { Rule, Transaction } from './types'

export function createRuleFromCategorization(
  transaction: Pick<Transaction, 'rawDescription'>,
  categoryId: string,
  createdAt: string,
): Rule {
  return {
    id: crypto.randomUUID(),
    match: normalizeMerchant(transaction.rawDescription),
    categoryId,
    hits: 0,
    createdAt,
  }
}

function ruleMatches(rule: Rule, transaction: Transaction): boolean {
  if (rule.match instanceof RegExp) {
    return rule.match.test(transaction.rawDescription)
  }
  return normalizeMerchant(transaction.rawDescription) === rule.match
}

// A string (exact normalized-merchant) match is always more specific than
// a RegExp (pattern) match, since a RegExp exists to sweep in more than
// one merchant. Within the same kind, match length is used as a proxy for
// specificity -- a longer literal pattern constrains more, e.g. "blue
// bottle coffee" over "coffee". True pattern specificity (which regex
// matches a strictly smaller set of strings) is undecidable in general, so
// this is a practical heuristic, not an attempt at that.
function matchSpecificity(rule: Rule): number {
  return typeof rule.match === 'string' ? rule.match.length : rule.match.source.length
}

// "Most specific match wins, ties broken by most recent" -- when more than
// one rule matches the same transaction.
function selectMatchingRule(rules: Rule[], transaction: Transaction): Rule | undefined {
  const matching = rules.filter((rule) => ruleMatches(rule, transaction))
  if (matching.length <= 1) return matching[0]

  return matching.slice().sort((a, b) => {
    const aIsExact = typeof a.match === 'string'
    const bIsExact = typeof b.match === 'string'
    if (aIsExact !== bIsExact) return aIsExact ? -1 : 1

    const bySpecificity = matchSpecificity(b) - matchSpecificity(a)
    if (bySpecificity !== 0) return bySpecificity

    return b.createdAt.localeCompare(a.createdAt)
  })[0]
}

export interface ApplyRulesResult {
  transactions: Transaction[]
  rules: Rule[]
}

// Applies rules to every not-yet-categorized transaction (section 11.4:
// "Categorizing one row then auto-categorizes every future row from that
// merchant"). Already-categorized transactions -- manual entries, or ones
// a person categorized by hand -- are left alone.
export function applyRules(transactions: Transaction[], rules: Rule[]): ApplyRulesResult {
  const hitCounts = new Map<string, number>()

  const updatedTransactions = transactions.map((transaction) => {
    if (transaction.categoryId) return transaction

    const matchingRule = selectMatchingRule(rules, transaction)
    if (!matchingRule) return transaction

    hitCounts.set(matchingRule.id, (hitCounts.get(matchingRule.id) ?? 0) + 1)
    return { ...transaction, categoryId: matchingRule.categoryId }
  })

  const updatedRules = rules.map((rule) => {
    const additionalHits = hitCounts.get(rule.id)
    return additionalHits ? { ...rule, hits: rule.hits + additionalHits } : rule
  })

  return { transactions: updatedTransactions, rules: updatedRules }
}
