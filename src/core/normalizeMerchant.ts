// section 11.4:
//   CHIPOTLE 2481 SEATTLE WA   ->   chipotle
//   CHIPOTLE 0113 PORTLAND     ->   chipotle
//   SQ *BLUE BOTTLE 8821       ->   blue bottle
//
// The store number is the real signal here, not just noise to strip on its
// own: once one appears, everything after it (city, state) is location
// text riding along with it, so the merchant name is whatever comes before
// the first purely-numeric token. A trailing state code with no preceding
// number is stripped too, per the spec's explicit "and state codes".
const PROCESSOR_PREFIXES = [/^sq\s*\*/i, /^tst\s*\*/i, /^paypal\s*\*/i]

const US_STATE_CODES = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
  'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
  'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
  'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
  'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
  'dc',
])

function isStoreNumber(token: string): boolean {
  return /^#?\d+$/.test(token)
}

export function normalizeMerchant(rawDescription: string): string {
  let value = rawDescription.trim()

  for (const prefix of PROCESSOR_PREFIXES) {
    value = value.replace(prefix, '')
  }

  const tokens = value.trim().split(/\s+/).filter(Boolean)

  const storeNumberIndex = tokens.findIndex(isStoreNumber)
  let kept = storeNumberIndex === -1 ? tokens : tokens.slice(0, storeNumberIndex)

  if (kept.length > 1) {
    const last = kept[kept.length - 1].toLowerCase()
    if (US_STATE_CODES.has(last)) {
      kept = kept.slice(0, -1)
    }
  }

  if (kept.length === 0) {
    // Nothing survived (e.g. the whole description was a store number) --
    // fall back to the original text rather than normalizing to empty.
    return value.trim().toLowerCase()
  }

  return kept.join(' ').toLowerCase()
}
