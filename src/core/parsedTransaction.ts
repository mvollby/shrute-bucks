// What a CSV adapter produces per row, before id/hash are assigned by the
// import pipeline (section 11.2's dedupe hash needs accountId too, which
// isn't known to the CSV itself).
export interface ParsedTransaction {
  date: string // ISO date, YYYY-MM-DD
  description: string
  rawDescription: string
  amount: number // negative = money out, positive = money in
}
